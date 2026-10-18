import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';
import type { InjectOptions } from 'light-my-request';
import { buildApp } from '../../backend/src/api/app';
import { DiagramRepository } from '../../backend/src/persistence/diagram-repository';
import { AdrRepository } from '../../backend/src/persistence/adr-repository';
import { GraphTransaction } from '../../backend/src/persistence/graph-transaction';
import { componentTestDatabase, postgresEnabled } from '../../backend/tests/persistence/component-test-database';
import { seedArchiveRows, snapshotArchiveDatabase } from '../../backend/tests/persistence/diagram-archive-fixtures';
import { archiveFixture, archiveFieldInventory, archiveId, emptyArchiveFixture } from '../../shared/tests/archive-fixtures';
import { parseArchive } from '../../shared/src/index';

function memoryInstallation() {
  const diagrams = new DiagramRepository(), adrs = new AdrRepository();
  return { diagrams, adrs, app: buildApp(diagrams, adrs), graph: new GraphTransaction(diagrams, adrs) };
}
async function browserApi(page: Page, initial: ReturnType<typeof buildApp>) {
  const state = { app: initial, exports: 0, imports: 0, preparedText: '', failRefresh: false, failSave: false, loseImportResponse: false, delayPreview: 0 };
  await page.route(/\/api\/(?:diagrams|diagram-archives|adrs)(?:\/|$|\?)/, async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.replace(/^\/api/, '') + url.search;
    if (state.failSave && request.method() === 'PUT') { state.failSave = false; return route.fulfill({ status: 503, json: { message: 'Save temporarily unavailable' } }); }
    if (state.failRefresh && request.method() === 'GET' && path === '/diagrams') { state.failRefresh = false; return route.fulfill({ status: 503, json: { message: 'List temporarily unavailable' } }); }
    if (path === '/diagram-archives/preview' && state.delayPreview) await new Promise(resolve => setTimeout(resolve, state.delayPreview));
    if (path === '/diagram-archives/import') state.imports++;
    const response = await state.app.inject({ method: request.method() as InjectOptions['method'], url: path, ...(request.postData() ? { headers: { 'content-type': request.headers()['content-type'] }, payload: request.postData()! } : {}) });
    if (path.endsWith('/archive')) { state.exports++; state.preparedText = response.json().archiveText; }
    if (path === '/diagram-archives/import' && state.loseImportResponse) return route.abort('failed');
    await route.fulfill({ status: response.statusCode, contentType: 'application/json', body: response.body });
  });
  return state;
}
const row = (page: Page, id: string) => page.locator(`.saved-diagram-button[data-diagram-id="${id}"]`);
async function chooseFile(page: Page, text: string) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import diagram archive', exact: true }).click();
  await (await chooser).setFiles({ name: 'architecture.adr.json', mimeType: 'application/json', buffer: Buffer.from(text) });
}

test('PostgreSQL: approved exact child export to empty installation, reload, three levels, ADRs, save and Trash restore', async ({ page }) => {
  test.setTimeout(60_000);
  test.skip(!postgresEnabled, 'Requires RUN_POSTGRES_TESTS=1 and DATABASE_URL; uses two isolated schemas');
  const source = await componentTestDatabase(), destination = await componentTestDatabase();
  const sourceApp = buildApp(source.diagrams, source.adrs), destinationApp = buildApp(destination.diagrams, destination.adrs);
  try {
    const fixture = archiveFixture(); fixture.records.diagrams[2].deletionRevision = '37';
    await seedArchiveRows(source.pool, fixture);
    const api = await browserApi(page, sourceApp);
    await page.goto('/'); await row(page, archiveId(2)).click();
    await page.getByRole('button', { name: 'Export diagram archive', exact: true }).click();
    const review = page.getByRole('dialog', { name: 'Review archive export' });
    for (const id of fixture.includedDiagramIds) await expect(review).toContainText(id);
    await expect(review.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
    const downloadEvent = page.waitForEvent('download');
    await review.getByRole('button', { name: 'Download archive', exact: true }).click();
    const download = await downloadEvent, text = await readFile((await download.path())!, 'utf8');
    expect(text).toBe(api.preparedText); expect(api.exports).toBe(1);
    expect(download.suggestedFilename()).toBe(`diagram-${archiveId(2)}.adr.json`);
    await page.getByRole('button', { name: 'Dismiss archive message' }).click();
    await page.getByRole('button', { name: 'Open recovery', exact: true }).click();
    await page.locator(`.saved-diagram-trash-row[data-diagram-id="${archiveId(4)}"]`).getByRole('button', { name: /^Export archive/ }).click();
    await expect(page.getByRole('dialog')).toContainText('trashed'); await page.keyboard.press('Escape');
    api.app = destinationApp; await page.reload();
    await expect(page.getByText('No saved diagrams yet.')).toBeVisible();
    await chooseFile(page, text);
    await expect(page.getByRole('dialog', { name: 'Review archive import' })).toContainText('0 removed');
    await page.getByRole('button', { name: 'Import archive', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Import succeeded:' })).toBeVisible(); expect(api.imports).toBe(1);
    const before = await snapshotArchiveDatabase(source.pool), after = await snapshotArchiveDatabase(destination.pool);
    for (const collection of Object.keys(archiveFieldInventory)) expect(after[collection]).toEqual(before[collection]);
    expect(after.signedZero).toEqual(before.signedZero);
    await page.reload(); await row(page, archiveId(1)).click();
    await expect(page.locator('#diagram-heading')).toContainText('Architecture');
    await page.getByRole('button', { name: 'Decision', exact: true }).click();
    await expect(page.getByRole('button', { name: /Decision 0/ }).first()).toBeVisible();
    await page.getByRole('button', { name: /Decision 0/ }).first().click();
    await expect(page.getByRole('textbox', { name: /^Context/ })).toHaveValue('Context 世界');
    await row(page, archiveId(2)).click(); await expect(page.locator('#container-diagram-heading')).toContainText('Element 11');
    await page.getByRole('button', { name: 'Open recovery', exact: true }).click();
    await page.locator(`.saved-diagram-trash-row[data-diagram-id="${archiveId(3)}"]`).getByRole('button', { name: 'Restore', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Restore diagrams', exact: true }).click();
    await expect(page.locator('#component-diagram-heading')).toContainText('Element 21');
    await page.getByRole('button', { name: 'Add component', exact: true }).first().click();
    await page.getByLabel('Component name', { exact: true }).fill('Imported worker');
    await page.getByLabel('Responsibilities', { exact: true }).fill('Works after restoration');
    await page.getByLabel('Technology', { exact: true }).fill('TypeScript');
    await page.getByRole('button', { name: 'Add component', exact: true }).last().click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('.save-status')).toContainText('Saved'); await page.reload();
    await row(page, archiveId(3)).click(); await expect(page.locator('.react-flow__node').filter({ hasText: 'Imported worker' })).toBeVisible();
  } finally { await sourceApp.close(); await destinationApp.close(); await source.close(); await destination.close(); }
});

test('coordinator: cancel is safe, drafts offer save/retry/saved-only, and keyboard focus returns', async ({ page }) => {
  const source = memoryInstallation(); await source.graph.applyArchiveRows(parseArchive(JSON.stringify(emptyArchiveFixture())).records);
  try {
    const api = await browserApi(page, source.app); await page.goto('/'); await row(page, archiveId(1)).click();
    await page.getByLabel('Diagram name', { exact: true }).fill('Draft title');
    const trigger = page.getByRole('button', { name: 'Export diagram archive', exact: true }); await trigger.click();
    await expect(page.getByRole('alertdialog')).toContainText('unsaved changes');
    await page.keyboard.press('Escape'); await expect(page.getByLabel('Diagram name', { exact: true })).toHaveValue('Draft title');
    await trigger.click(); api.failSave = true;
    await page.getByRole('button', { name: 'Save and review again', exact: true }).click();
    await expect(page.locator('.archive-transfer-notice')).toContainText('Save temporarily unavailable');
    await page.getByRole('button', { name: 'Continue with saved data', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Architecture'); await expect(page.getByRole('dialog')).not.toContainText('Draft title');
    await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
    await trigger.click(); await page.getByRole('button', { name: 'Save and review again', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Draft title'); await page.keyboard.press('Escape');
    expect((await source.graph.readArchiveSnapshot()).diagrams[0].name).toBe('Draft title');
  } finally { await source.app.close(); }
});

test('coordinator: empty-list import cancels safely, announces busy, preserves unrelated drafts, and retries only refresh', async ({ page }) => {
  const destination = memoryInstallation(), text = JSON.stringify(emptyArchiveFixture());
  try {
    const api = await browserApi(page, destination.app); await page.goto('/');
    await chooseFile(page, text); await expect(page.getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape'); expect((await destination.graph.readArchiveSnapshot()).diagrams).toEqual([]);
    api.delayPreview = 250; await chooseFile(page, text); await expect(page.getByRole('status').filter({ hasText: 'Preparing archive review' })).toBeVisible();
    await expect(page.getByRole('dialog')).toBeVisible(); api.failRefresh = true;
    await page.getByRole('button', { name: 'Import archive', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Import succeeded; refresh failed'); expect(api.imports).toBe(1);
    await page.getByRole('button', { name: 'Retry import refresh' }).click();
    await expect(row(page, archiveId(1))).toBeVisible(); expect(api.imports).toBe(1);
    await row(page, archiveId(1)).click(); await page.getByLabel('Diagram name', { exact: true }).fill('Unrelated draft');
    const other = emptyArchiveFixture(); other.records.diagrams[0].id = archiveId(999); other.selectedDiagramId = archiveId(999); other.seedDiagramIds = [archiveId(999)]; other.includedDiagramIds = [archiveId(999)];
    await chooseFile(page, JSON.stringify(other)); await page.getByRole('button', { name: 'Import archive', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Import succeeded:' })).toBeVisible();
    await expect(page.getByLabel('Diagram name', { exact: true })).toHaveValue('Unrelated draft');
  } finally { await destination.app.close(); }
});

test('coordinator: a lost import response reports uncertainty without resubmitting', async ({ page }) => {
  const destination = memoryInstallation();
  try {
    const api = await browserApi(page, destination.app); api.loseImportResponse = true;
    await page.goto('/'); await chooseFile(page, JSON.stringify(emptyArchiveFixture()));
    await page.getByRole('button', { name: 'Import archive', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('uncertain'); expect(api.imports).toBe(1);
    expect((await destination.graph.readArchiveSnapshot()).diagrams).toHaveLength(1);
  } finally { await destination.app.close(); }
});

test('coordinator: decision drafts require a saved-only choice or a save with fresh review', async ({ page }) => {
  const source = memoryInstallation(); await source.graph.applyArchiveRows(parseArchive(JSON.stringify(archiveFixture())).records);
  try {
    const api = await browserApi(page, source.app); await page.goto('/'); await row(page, archiveId(1)).click();
    await page.getByRole('button', { name: 'Decision', exact: true }).click();
    await page.getByRole('button', { name: /Decision 0/ }).first().click();
    await page.getByRole('textbox', { name: /^Context/ }).fill('Unsaved decision context');
    await page.getByRole('button', { name: 'Export diagram archive', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Continue with saved data', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible(); expect(JSON.parse(api.preparedText).records.adrs[0].context).toBe('Context 世界');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Export diagram archive', exact: true }).click();
    await page.getByRole('button', { name: 'Save and review again', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible(); expect(JSON.parse(api.preparedText).records.adrs[0].context).toBe('Unsaved decision context');
    await page.keyboard.press('Escape');
  } finally { await source.app.close(); }
});
