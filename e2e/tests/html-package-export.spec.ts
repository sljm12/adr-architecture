import { test, expect } from '@playwright/test';
import JSZip from 'jszip';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

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
  { id: ids.relationshipAdr, diagramId: ids.diagram, title: 'Ledger ordering', context: 'Ledger writes must be ordered.', decision: 'Write sequentially.', consequences: 'Lower throughput.', alternativesOrConstraints: null, status: 'rejected', replacementAdrId: null, componentIds: [], relationshipIds: [ids.relationship], createdAt: timestamp, updatedAt: timestamp },
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
    for (const name of ['index.html', 'adrs.html', 'styles.css', 'diagram.svg']) {
      const file = zip.file(name);
      expect(file, `missing ${name}`).not.toBeNull();
      await writeFile(join(directory, name), await file!.async('nodebuffer'));
    }
    const index = await readFile(join(directory, 'index.html'), 'utf8');
    expect(index).not.toMatch(/<script\b|(?:src|href)=["']https?:\/\//i);
    await page.goto(pathToFileURL(join(directory, 'index.html')).href);
    await page.locator(`a[href="#component-${ids.component}"]`).last().click();
    await expect(page.locator(`#component-${ids.component}`)).toContainText('Payment boundary');
    await expect(page.locator(`#component-${ids.component}`)).not.toContainText('Ledger ordering');

    await page.locator(`a[href="#relationship-${ids.relationship}"]`).last().click();
    await expect(page.locator(`#relationship-${ids.relationship}`)).toContainText('Ledger ordering');
    await expect(page.locator(`#relationship-${ids.relationship}`)).not.toContainText('Payment boundary');
    await page.locator(`#relationship-${ids.relationship} a[href^="adrs.html#adr-"]`).click();
    await expect(page.locator(`#adr-${ids.relationshipAdr}`)).toContainText('Write sequentially.');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
