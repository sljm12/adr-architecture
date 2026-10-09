import { test, expect, type Page } from '@playwright/test';
import { buildApp } from '../../backend/src/api/app';
import { DiagramRepository } from '../../backend/src/persistence/diagram-repository';
import { componentContextFixture, componentParentFixture, emptyComponentFixture, populatedComponentFixture, componentFixtureIds as ids } from '../../shared/tests/component-fixtures';
import type { DiagramDocument } from '../../shared/src/index';

async function harness(page: Page) {
  const repository = new DiagramRepository(); repository.create(componentContextFixture()); repository.create(componentParentFixture());
  const app = buildApp(repository);
  const behavior = { failSave: false, failLoad: false, posts: 0 };
  await page.route(/\/api\/(?:diagrams|adrs)(?:\/|$|\?)/, async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace(/^\/api/, '');
    if (request.method() === 'POST' && path.endsWith('/component-diagram')) behavior.posts++;
    if (behavior.failSave && request.method() === 'PUT') { behavior.failSave = false; return route.fulfill({ status: 503, json: { message: 'Parent save temporarily failed' } }); }
    if (behavior.failLoad && request.method() === 'GET' && repository.get(path.split('/')[2])?.kind === 'component' && path.split('/').length === 3) { behavior.failLoad = false; return route.fulfill({ status: 503, json: { message: 'Child load temporarily failed' } }); }
    const response = await app.inject({ method: request.method() as any, url: path, ...(request.postData() ? { payload: JSON.parse(request.postData()!) } : {}) });
    await route.fulfill({ status: response.statusCode, contentType: 'application/json', body: response.body });
  });
  await page.goto('/'); await page.locator(`.saved-diagram-button[data-diagram-id="${ids.parent}"]`).click();
  return { repository, app, behavior };
}
const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"] .component-node`);
test('selects, enters, returns with focus, reopens, and creates Datastore child by keyboard', async ({ page }) => {
  const { app, repository, behavior } = await harness(page);
  try {
    await node(page, ids.application).click(); await expect(page.getByRole('button', { name: 'Create component diagram', exact: true })).toBeVisible(); expect(behavior.posts).toBe(0);
    await node(page, ids.application).dblclick(); await expect(page.locator('#component-diagram-heading')).toBeFocused();
    const child = repository.findContainerForOwner(ids.application)!;
    await expect(page.getByRole('group', { name: 'Container boundary for Payment API', exact: true })).toBeVisible(); expect(child.components).toEqual([]);
    await page.screenshot({ path: 'test-results/component-entry.png', fullPage: true });
    await page.getByRole('button', { name: /^Return to Payments, owner Payment API/ }).click(); await expect(page.locator('#container-diagram-heading')).toBeFocused();
    await expect(page.getByRole('button', { name: 'Open component diagram', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Open component diagram', exact: true }).click(); await expect(page.locator('#component-diagram-heading')).toBeVisible();
    expect(repository.findContainerForOwner(ids.application)!.id).toBe(child.id);
    await page.getByRole('button', { name: /^Return to Payments, owner Payment API/ }).click();
    await node(page, ids.datastore).click(); const action = page.getByRole('button', { name: 'Create component diagram', exact: true }); await action.focus(); await page.keyboard.press('Enter');
    await expect(page.locator('#component-diagram-heading')).toBeFocused(); expect(repository.findChildren(ids.parent)).toHaveLength(2);
  } finally { await app.close(); }
});
test('retains parent drafts on cancel and failed save; retries a committed child load', async ({ page }) => {
  const { app, repository, behavior } = await harness(page);
  try {
    await node(page, ids.application).click(); await page.getByLabel('Component name', { exact: true }).fill('Renamed API'); await page.getByRole('button', { name: 'Save component', exact: true }).click();
    await page.getByRole('button', { name: 'Create component diagram', exact: true }).click(); await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click(); expect(behavior.posts).toBe(0);
    await expect(node(page, ids.application)).toContainText('Renamed API');
    await page.getByRole('button', { name: 'Create component diagram', exact: true }).click(); behavior.failSave = true;
    await page.getByRole('button', { name: 'Save and open', exact: true }).click(); await expect(page.getByRole('alertdialog')).toBeVisible(); expect(behavior.posts).toBe(0);
    behavior.failLoad = true; await page.getByRole('button', { name: 'Save and open', exact: true }).click();
    await expect(page.getByText('Child load temporarily failed', { exact: false }).first()).toBeVisible();
    const created = repository.findContainerForOwner(ids.application)!; expect(created.name).toBe('Renamed API');
    await page.locator('[aria-label="Create or open component diagram"]').getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.locator('#component-diagram-heading')).toHaveText('Renamed API'); expect(repository.findContainerForOwner(ids.application)!.id).toBe(created.id); expect(behavior.posts).toBe(1);
  } finally { await app.close(); }
});
test('offers named recovery for a recoverable child without creating a replacement', async ({ page }) => {
  const { app, repository, behavior } = await harness(page);
  try {
    repository.create({ ...emptyComponentFixture(), status: 'trashed', trashedAt: new Date().toISOString() } as DiagramDocument);
    await node(page, ids.application).click();
    await expect(page.getByRole('button', { name: 'Restore component diagram', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Restore component diagram', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Payment API');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(repository.get(ids.child)?.status).toBe('trashed'); expect(behavior.posts).toBe(0);
  } finally { await app.close(); }
});
test('opens a supporting container canonical child and gives internal Components no deeper action', async ({ page }) => {
  const { app, repository } = await harness(page);
  try {
    repository.create(populatedComponentFixture() as DiagramDocument);
    await node(page, ids.application).dblclick(); await expect(page.locator('#component-diagram-heading')).toBeVisible();
    await node(page, ids.internal).click(); await expect(page.getByRole('button', { name: /component diagram/i })).toHaveCount(0);
    await node(page, ids.internal).dblclick(); expect(repository.findChildren(ids.parent)).toHaveLength(1);
    await node(page, ids.siblingOccurrence).dblclick();
    await expect.poll(() => repository.findContainerForOwner(ids.datastore)?.id).toBeTruthy();
    expect(repository.findContainerForOwner(ids.datastore)?.scope).toMatchObject({ parentDiagramId: ids.parent, containerId: ids.datastore });
  } finally { await app.close(); }
});
test('suppresses modified and multiple-selection entry and keeps Software System entry', async ({ page }) => {
  const { app, behavior } = await harness(page);
  try {
    for (const modifier of ['Shift', 'Control', 'Alt', 'Meta'] as const) { await node(page, ids.application).dblclick({ modifiers: [modifier] }); expect(behavior.posts).toBe(0); }
    await node(page, ids.application).click(); await node(page, ids.datastore).click({ modifiers: ['Shift'] });
    await expect(page.getByRole('button', { name: 'Create component diagram', exact: true })).toHaveCount(0);
    await node(page, ids.application).dblclick(); expect(behavior.posts).toBe(0);
    await node(page, ids.personOccurrence).dblclick(); expect(behavior.posts).toBe(0);
    await node(page, ids.systemOccurrence).dblclick(); await expect(page.locator('#container-diagram-heading')).toHaveText('Ledger');
  } finally { await app.close(); }
});
test('guards and preserves an unsaved ADR before Component entry', async ({ page }) => {
  const { app, behavior } = await harness(page);
  try {
    await page.getByRole('button', { name: 'Decision', exact: true }).click();
    await page.getByLabel('Title required').fill('Keep the Container decision draft');
    await node(page, ids.application).click(); await page.getByRole('button', { name: 'Create component diagram', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Save both before opening');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(behavior.posts).toBe(0); await page.getByRole('button', { name: 'Decision', exact: true }).click();
    await expect(page.getByLabel('Title required')).toHaveValue('Keep the Container decision draft');
  } finally { await app.close(); }
});
