import { test, expect } from '@playwright/test';
import JSZip from 'jszip';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildHtmlPackage } from '../../shared/src/export/html-package';
import { disableOfflinePackageNetwork, openOfflinePackagePage, preparePersistedHtmlPackageFixture, downloadAndExtractOfflinePackage, offlineDiagram, offlineTimestamp, renderScaleOfflinePackage } from './html-package-fixtures';
import { aggregateInput } from '../../shared/tests/html-package-input';
import { diagramDocumentSchema } from '../../shared/src/index';

const ids = {
  diagram: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  component: '3f2504e0-4f89-41d3-9a0c-0305e82c3302',
  database: '3f2504e0-4f89-41d3-9a0c-0305e82c3303',
  relationship: '3f2504e0-4f89-41d3-9a0c-0305e82c3304',
  componentAdr: '3f2504e0-4f89-41d3-9a0c-0305e82c3305',
  relationshipAdr: '3f2504e0-4f89-41d3-9a0c-0305e82c3306',
};
const timestamp = '2026-01-01T00:00:00.000Z';
const diagram = {
  id: ids.diagram, name: 'Payments', status: 'active', createdAt: timestamp, updatedAt: timestamp, trashedAt: null,
  components: [
    { id: ids.component, diagramId: ids.diagram, name: 'Payment API', description: null, type: 'software-system', position: { x: 60, y: 60 }, size: { width: 220, height: 100 }, createdAt: timestamp, updatedAt: timestamp },
    { id: ids.database, diagramId: ids.diagram, name: 'Ledger', description: null, type: 'software-system', position: { x: 420, y: 60 }, size: { width: 180, height: 72 }, createdAt: timestamp, updatedAt: timestamp },
  ],
  relationships: [{ id: ids.relationship, diagramId: ids.diagram, sourceComponentId: ids.component, targetComponentId: ids.database, direction: 'directed', label: 'writes', createdAt: timestamp, updatedAt: timestamp }],
  groups: [],
};
const fullAdrs = [
  { id: ids.componentAdr, diagramId: ids.diagram, title: 'Payment boundary', context: 'Payments need an owner.', decision: 'Keep payment logic in the API.', consequences: 'The API owns retries.', alternativesOrConstraints: null, status: 'accepted', replacementAdrId: null, componentIds: [ids.component], relationshipIds: [], createdAt: timestamp, updatedAt: timestamp },
  { id: ids.relationshipAdr, diagramId: ids.diagram, title: 'Ledger ordering', context: 'Ledger writes must be ordered. <script>window.__unsafe=true</script>', decision: 'Write sequentially.', consequences: 'Lower throughput.', alternativesOrConstraints: null, status: 'rejected', replacementAdrId: null, componentIds: [], relationshipIds: [ids.relationship], createdAt: timestamp, updatedAt: timestamp },
];

async function mockDiagramApi(page: import('@playwright/test').Page) {
  await page.route('**/api/diagrams', route => route.request().method() === 'GET'
    ? route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ id: ids.diagram, name: diagram.name, status: 'active', createdAt: timestamp, updatedAt: timestamp }]) })
    : route.fallback());
  await page.route(`**/api/diagrams/${ids.diagram}`, route => route.request().method() === 'GET'
    ? route.fulfill({ contentType: 'application/json', body: JSON.stringify(diagram) })
    : route.fallback());
  await page.route(`**/api/diagrams/${ids.diagram}/adrs`, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(fullAdrs.map(({ id, title, status, updatedAt, componentIds, relationshipIds }) => ({ id, title, status, updatedAt, componentCount: componentIds.length, relationshipCount: relationshipIds.length }))) }));
  await page.route(`**/api/diagrams/${ids.diagram}/component-adr-counts`, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ componentId: ids.component, count: 1 }]) }));
  await page.route(`**/api/diagrams/${ids.diagram}/adrs/full`, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(fullAdrs) }));
  await page.route(`**/api/diagrams/${ids.diagram}/export/html-source`, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ entryDiagramId: ids.diagram, sourceCapturedAt: timestamp,
    diagrams: [{ diagram: diagramDocumentSchema.parse(diagram), adrs: fullAdrs }], containerContext: null,
    availability: diagram.components.map(c => ({ parentDiagramId: ids.diagram, softwareSystemId: c.id, availability: 'none', diagram: null })) }) }));
}

async function tabToHref(page: import('@playwright/test').Page, href: string) {
  for (let index = 0; index < 100; index++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(expected => document.activeElement?.getAttribute('href') === expected && !document.activeElement?.closest('svg'), href)) {
      await expect(page.locator('a:focus')).toHaveCSS('outline-style', 'solid');
      const destination = new URL(href, page.url()).href;
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(destination);
      await page.waitForLoadState('domcontentloaded');
      return;
    }
  }
  throw new Error(`Native Tab navigation could not reach ${href}`);
}

test('exports the persisted parent and two children with exact offline ADR and native keyboard owner/source navigation', async ({ page, request, context }) => {
  const fixture = await preparePersistedHtmlPackageFixture(request, '/api');
  const child = fixture.children.find(d => d.components.length)!;
  const relationship = child.relationships.find(r => fixture.expected.directAdrIds[r.id].length)!;
  const empty = fixture.children.find(d => !d.components.length)!;
  const external = child.components.find(c => c.role === 'external')!;
  const sourceUrl = `/api/diagrams/${fixture.parent.id}/export/html-source`;
  const before = await (await request.get(sourceUrl)).json();
  await page.goto('/');
  await page.locator(`.saved-diagram-button[data-diagram-id="${fixture.parent.id}"]`).click();
  await expect(page.locator('.package-nav')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Export HTML package', exact: true })).toBeEnabled();
  const requests: string[] = [], writes: string[] = [];
  page.on('request', r => { if (r.url().includes('/api/')) { requests.push(r.url()); if (r.method() !== 'GET') writes.push(r.method()); } });
  const directory = await mkdtemp(join(tmpdir(), 'adr-parent-child-'));
  try {
    const { files } = await downloadAndExtractOfflinePackage(page, directory);
    expect(Object.keys(files).sort()).toEqual(fixture.expected.filePaths.sort());
    expect(requests.filter(url => url.endsWith('/export/html-source'))).toHaveLength(1);
    expect(requests.filter(url => /\/adrs\/full$|\/container-context$|\/container-diagram$/.test(url))).toEqual([]);
    expect(writes).toEqual([]);
    const after = await (await request.get(sourceUrl)).json();
    expect(after.diagrams).toEqual(before.diagrams); expect(after.availability).toEqual(before.availability);
    await disableOfflinePackageNetwork(context);
    await openOfflinePackagePage(page, directory);
    // Pointer selection exposes the exact parent relationship links.
    const parentRelationship = fixture.parent.relationships[0];
    await page.locator(`.artifact-index a[href="#relationship-${parentRelationship.id}"]`).click();
    const actualParent = await page.locator(`#relationship-${parentRelationship.id} .linked-adrs a`).evaluateAll(links => links.map(a => a.getAttribute('href')!.split('#adr-')[1]));
    expect(actualParent.sort()).toEqual(fixture.expected.directAdrIds[parentRelationship.id].sort());
    const trashedOwner = fixture.trashedChild.scope!.softwareSystemId;
    await page.locator(`.artifact-index a[href="#component-${trashedOwner}"]`).click();
    await expect(page.locator(`#component-${trashedOwner}`)).toContainText('trashed');
    await expect(page.locator(`#component-${trashedOwner} .container-navigation a`)).toHaveCount(0);
    const noneOwner = fixture.availability.find(a => a.availability === 'none')!.softwareSystemId;
    await page.locator(`.artifact-index a[href="#component-${noneOwner}"]`).click();
    await expect(page.locator(`#component-${noneOwner}`)).toContainText('No active container diagram is included');
    // Restart with normal page focus; use only native Tab/Enter through the child ADR journey.
    await openOfflinePackagePage(page, directory);
    await tabToHref(page, `#component-${child.scope!.softwareSystemId}`);
    await tabToHref(page, `diagrams/${child.id}/index.html`);
    await expect(page).toHaveURL(new RegExp(`/diagrams/${child.id}/index.html$`));
    await expect(page.locator('.export-scope')).toContainText('Container diagram');
    await tabToHref(page, `#relationship-${relationship.id}`);
    const local = fixture.expected.directAdrIds[relationship.id];
    const detail = page.locator(`#relationship-${relationship.id}`);
    expect(await detail.locator('.linked-adrs a').evaluateAll(links => links.map(a => a.getAttribute('href')!.split('#adr-')[1]))).toEqual(local);
    await tabToHref(page, `../../adrs.html#adr-${local[0]}`);
    await expect(page.locator(`#adr-${local[0]}`)).toContainText(fixture.adrsByDiagram[child.id].find(a => a.id === local[0])!.decision);
    await tabToHref(page, `diagrams/${child.id}/index.html#relationship-${relationship.id}`);
    await tabToHref(page, `../../index.html#component-${child.scope!.softwareSystemId}`);
    await expect(page).toHaveURL(new RegExp(`#component-${child.scope!.softwareSystemId}$`));
    // External occurrences keep their own decisions and reuse the included sibling.
    await openOfflinePackagePage(page, directory, child.id);
    await tabToHref(page, `#component-${external.id}`);
    const externalDetail = page.locator(`#component-${external.id}`);
    expect(await externalDetail.locator('.linked-adrs a').evaluateAll(links => links.map(a => a.getAttribute('href')!.split('#adr-')[1]))).toEqual(fixture.expected.directAdrIds[external.id]);
    await tabToHref(page, `../${empty.id}/index.html`);
    await expect(page).toHaveURL(new RegExp(`/diagrams/${empty.id}/index.html$`));
    await expect(page.locator('.system-boundary')).toBeVisible();
    await expect(page.getByText('No ADRs belong to this diagram.')).toBeVisible();
    await page.getByRole('link', { name: 'Return to System context', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`#component-${empty.scope!.softwareSystemId}$`));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

for (const empty of [false, true]) test(`direct ${empty ? 'empty' : 'populated'} child exports only itself`, async ({ page, context }) => {
  const { fixture } = aggregateInput();
  const child = fixture.children.find(d => Boolean(d.components.length) !== empty)!;
  const containerContext = { scope: child.scope, capturedAt: timestamp, sources: fixture.parent.components.filter(c => c.id !== child.scope!.softwareSystemId && (c.type === 'person' || c.type === 'software-system')).map(c => ({ id: c.id, name: c.name, description: c.description, type: c.type })) };
  const source = { entryDiagramId: child.id, sourceCapturedAt: timestamp, diagrams: [{ diagram: child, adrs: fixture.adrsByDiagram[child.id] }], availability: [], containerContext };
  await page.route(/^https?:\/\/[^/]+\/api\//, async route => {
    const path = new URL(route.request().url()).pathname;
    const value = path.endsWith('/export/html-source') ? source : path.endsWith('/container-context') ? containerContext
      : path === '/api/diagrams' ? [fixture.parent, child] : path === `/api/diagrams/${child.id}` ? child : path === `/api/diagrams/${fixture.parent.id}` ? fixture.parent : [];
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(value) });
  });
  await page.goto('/');
  await page.locator(`.saved-diagram-button[data-diagram-id="${child.id}"]`).click();
  const directory = await mkdtemp(join(tmpdir(), 'adr-direct-child-'));
  try {
    const { files } = await downloadAndExtractOfflinePackage(page, directory);
    expect(Object.keys(files).some(path => path.startsWith('diagrams/'))).toBe(false);
    expect(files['index.html']).not.toContain('Return to System context</a>');
    expect(files['index.html']).not.toContain('Open container diagram</a>');
    await disableOfflinePackageNetwork(context);
    await openOfflinePackagePage(page, directory);
    await expect(page.locator('.export-scope')).toContainText('Single-diagram snapshot');
    await expect(page.locator('.system-boundary')).toBeVisible();
    if (empty) await expect(page.getByText('This diagram has no components or relationships.')).toBeVisible();
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a corrupt required child fails atomically without download or save', async ({ page }) => {
  const { fixture, source } = aggregateInput();
  source.diagrams.find(d => d.diagram.relationships.length && d.diagram.kind === 'container')!.diagram.relationships[0].targetComponentId = crypto.randomUUID();
  const downloads: string[] = [], writes: string[] = [];
  await page.route(/^https?:\/\/[^/]+\/api\//, async route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'GET') writes.push(path);
    const value = path.endsWith('/export/html-source') ? source : path === '/api/diagrams' ? [fixture.parent]
      : path === `/api/diagrams/${fixture.parent.id}` ? fixture.parent : [];
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(value) });
  });
  page.on('download', download => downloads.push(download.suggestedFilename()));
  await page.goto('/');
  await page.locator(`.saved-diagram-button[data-diagram-id="${fixture.parent.id}"]`).click();
  await page.getByRole('button', { name: 'Export HTML package', exact: true }).click();
  await expect(page.locator('#html-export-status')).toContainText('Diagram');
  await expect(page.locator('#html-export-status')).toContainText('retry');
  expect(downloads).toEqual([]); expect(writes).toEqual([]);
});

test('captures an unsaved owner rename before a delayed source read and preserves later editing state', async ({ page }) => {
  const { fixture, source } = aggregateInput();
  const child = fixture.children.find(d => d.components.length)!;
  let release!: () => void;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  const writes: string[] = [];
  await page.route(/^https?:\/\/[^/]+\/api\//, async route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'GET') writes.push(path);
    if (path.endsWith('/export/html-source')) await delayed;
    const availability = fixture.availability.find(a => path.includes(`/components/${a.softwareSystemId}/container-diagram`));
    const value = path.endsWith('/export/html-source') ? source : path === '/api/diagrams' ? [fixture.parent]
      : path === `/api/diagrams/${fixture.parent.id}` ? fixture.parent : availability ?? [];
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(value) });
  });
  await page.goto('/');
  await page.locator(`.saved-diagram-button[data-diagram-id="${fixture.parent.id}"]`).click();
  await page.locator(`.react-flow__node[data-id="${child.scope!.softwareSystemId}"]`).click();
  await page.locator('#component-edit-name').fill('Captured owner');
  await page.getByRole('button', { name: 'Save component', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export HTML package', exact: true }).click();
  await expect(page.locator('#html-export-status')).toHaveText('Gathering saved diagrams and ADRs…');
  await expect(page.getByRole('button', { name: 'Export HTML package', exact: true })).toBeDisabled();
  await page.locator('#component-edit-name').fill('Later owner');
  await page.getByRole('button', { name: 'Save component', exact: true }).click();
  release();
  const download = await downloadPromise;
  const archive = await JSZip.loadAsync(await readFile((await download.path())!));
  const html = await archive.file(`diagrams/${child.id}/index.html`)!.async('string');
  expect(html).toContain('Captured owner'); expect(html).not.toContain('Later owner');
  await expect(page.locator('#component-edit-name')).toHaveValue('Later owner');
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
  expect(writes).toEqual([]);
  await expect(page.locator('#html-export-status')).toHaveText('HTML package downloaded.');
});

test('downloads a package that supports direct component and relationship navigation from file://', async ({ page }) => {
  await mockDiagramApi(page);
  await page.goto('/');
  const savedDiagram = page.locator(`.saved-diagram-button[data-diagram-id="${ids.diagram}"]`);
  await expect(savedDiagram).toBeVisible();
  await savedDiagram.click();

  const directory = await mkdtemp(join(tmpdir(), 'adr-diagram-html-export-'));
  try {
    const { files, filename } = await downloadAndExtractOfflinePackage(page, directory);
    await expect(page.locator('#html-export-status')).toHaveText('HTML package downloaded.');
    expect(filename).toMatch(/payments.*\.zip$/i);
    expect(Object.keys(files)).toHaveLength(6);
    const index = await readFile(join(directory, 'index.html'), 'utf8');
    expect(index).not.toMatch(/<script\b|(?:src|href)=["']https?:\/\//i);
    expect(index).toContain('class="diagram-component component-type-');
    expect(index).toContain('class="diagram-relationship"');
    await page.goto(pathToFileURL(join(directory, 'index.html')).href);
    await page.keyboard.press('Tab');
    const focusedLink = page.locator('.package-nav a');
    await expect(focusedLink).toBeFocused();
    await expect(focusedLink).toHaveCSS('outline-style', 'solid');
    await page.locator(`a[href="#component-${ids.component}"]`).last().click();
    await expect(page.locator(`#component-${ids.component}`)).toContainText('Payment boundary');
    await expect(page.locator(`#component-${ids.component}`)).not.toContainText('Ledger ordering');

    await page.locator(`a[href="#relationship-${ids.relationship}"]`).last().click();
    await expect(page.locator(`#relationship-${ids.relationship}`)).toContainText('Ledger ordering');
    await expect(page.locator(`#relationship-${ids.relationship}`)).not.toContainText('Payment boundary');
    await page.locator(`#relationship-${ids.relationship} a[href^="adrs.html#adr-"]`).click();
    await expect(page.locator(`#adr-${ids.relationshipAdr}`)).toContainText('Write sequentially.');
    await expect(page.locator('script')).toHaveCount(0);
    await expect(page.locator(`#adr-${ids.relationshipAdr}`)).toContainText('<script>window.__unsafe=true</script>');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('renders a valid empty diagram with explicit artifact and ADR empty states', async ({ page }) => {
  const directory = await mkdtemp(join(tmpdir(), 'adr-diagram-empty-package-'));
  try {
    const files = buildHtmlPackage({ diagram: { ...offlineDiagram, components: [], relationships: [], groups: [] }, adrs: [], capturedAt: offlineTimestamp });
    for (const [name, content] of Object.entries(files)) {
      const target = join(directory, name);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
    }

    await page.goto(pathToFileURL(join(directory, 'index.html')).href);
    await expect(page.getByText('This diagram has no components or relationships.')).toBeVisible();
    await expect(page.getByText('No ADRs are included in this package.')).toBeVisible();
    await expect(page.locator('.package-nav a')).toContainText('(0)');
    await page.locator('.package-nav a').click();
    await expect(page.getByText('No ADRs belong to this diagram.')).toBeVisible();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('opens a complete 100-component, 200-relationship, 100-ADR package within ten seconds', async ({ page }) => {
  const startedAt = performance.now();
  const files = renderScaleOfflinePackage();
  expect(Object.keys(files)).toHaveLength(104);
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) zip.file(name, content);
  const archive = await zip.generateAsync({ type: 'nodebuffer' });
  const directory = await mkdtemp(join(tmpdir(), 'adr-diagram-scale-package-'));
  try {
    const extracted = await JSZip.loadAsync(archive);
    for (const [name, file] of Object.entries(extracted.files)) {
      if (file.dir) continue;
      const target = join(directory, name);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, await file.async('nodebuffer'));
    }
    expect(performance.now() - startedAt).toBeLessThan(10_000);
    expect(Object.keys(extracted.files).filter(name => /^adrs\/[0-9a-f-]+\.md$/i.test(name))).toHaveLength(100);

    await page.goto(pathToFileURL(join(directory, 'index.html')).href);
    await expect(page.locator('.diagram-component-link')).toHaveCount(100);
    await expect(page.locator('.diagram-relationship-link')).toHaveCount(200);
    await expect(page.locator('.artifact-detail')).toHaveCount(300);
    await page.goto(pathToFileURL(join(directory, 'adrs.html')).href);
    await expect(page.locator('.adr-catalog .adr-index-link')).toHaveCount(100);
    await expect(page.locator('.adr-detail')).toHaveCount(100);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
