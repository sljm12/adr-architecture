import { test, expect } from '@playwright/test';
import JSZip from 'jszip';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildHtmlPackage } from '../../shared/src/export/html-package';
import { offlineDiagram, offlineTimestamp, renderScaleOfflinePackage } from './html-package-fixtures';

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
}

test('downloads a package that supports direct component and relationship navigation from file://', async ({ page }) => {
  await mockDiagramApi(page);
  await page.goto('/');
  const savedDiagram = page.locator(`.saved-diagram-button[data-diagram-id="${ids.diagram}"]`);
  await expect(savedDiagram).toBeVisible();
  await savedDiagram.click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export HTML package' }).click();
  await expect(page.locator('#html-export-status')).toHaveText('HTML package downloaded.');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/payments.*\.zip$/i);

  const archivePath = await download.path();
  expect(archivePath).toBeTruthy();
  const zip = await JSZip.loadAsync(await readFile(archivePath!));
  const directory = await mkdtemp(join(tmpdir(), 'adr-diagram-html-export-'));
  try {
    expect(Object.values(zip.files).filter(file => !file.dir)).toHaveLength(6);
    for (const [name, file] of Object.entries(zip.files)) {
      if (file.dir) continue;
      const target = join(directory, name);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, await file.async('nodebuffer'));
    }
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
