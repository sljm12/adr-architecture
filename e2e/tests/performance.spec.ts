import { expect, test, type Page } from '@playwright/test';
import { buildApp } from '../../backend/src/api/app';
import { DiagramRepository } from '../../backend/src/persistence/diagram-repository';
import { containerScaleFixture } from '../../shared/tests/container-scale-fixture';

const diagram = { id: '00000000-0000-0000-0000-000000000021', name: 'Performance system', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', trashedAt: null, components: [], relationships: [] };

async function mockDiagramApi(page: Page, failFirstSave = false) {
  let saveAttempts = 0;
  await page.route('**/api/diagrams', async route => {
    if (route.request().method() === 'POST') return route.fulfill({ contentType: 'application/json', body: JSON.stringify(diagram) });
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify([diagram]) });
  });
  await page.route('**/api/diagrams/**', async route => {
    if (route.request().method() === 'PUT') { if (failFirstSave && saveAttempts++ === 0) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Temporary save failure.' }) }); return route.fulfill({ contentType: 'application/json', body: route.request().postData() ?? JSON.stringify(diagram) }); }
    if (route.request().url().endsWith('/export/mermaid')) return route.fulfill({ contentType: 'text/vnd.mermaid', headers: { 'content-disposition': 'attachment; filename="performance-system.mmd"' }, body: 'flowchart TD\n  API["API"]' });
    return route.fallback();
  });
}

test('loads, saves, and exports a five-component/five-relationship diagram within the feedback target', async ({ page }) => {
  await mockDiagramApi(page);
  await page.goto('/');
  const authoringStarted = await page.evaluate(() => performance.now());
  await page.getByLabel('Diagram name').fill('Performance system');
  await page.getByRole('button', { name: 'Create diagram' }).click();

  for (const name of ['API', 'Web', 'Worker', 'Database', 'Queue']) {
    await page.getByRole('button', { name: 'Add component' }).click();
    const inspector = page.getByLabel('Diagram inspector');
    await inspector.getByLabel('Component name').fill(name);
    await inspector.getByRole('button', { name: 'Add component' }).click();
  }
  const relationships = [['Web', 'API'], ['API', 'Worker'], ['Worker', 'Database'], ['Worker', 'Queue'], ['Queue', 'Web']];
  for (const [source, target] of relationships) {
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    const inspector = page.getByLabel('Diagram inspector');
    await inspector.getByLabel('From').selectOption({ label: source });
    await inspector.getByLabel('To', { exact: true }).selectOption({ label: target });
    await inspector.getByRole('button', { name: 'Connect components' }).click();
  }

  const authoringMs = await page.evaluate(start => performance.now() - start, authoringStarted);
  const saveStarted = await page.evaluate(() => performance.now());
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.save-status')).toHaveText('Saved', { timeout: 3_000 });
  const saveElapsed = await page.evaluate(start => performance.now() - start, saveStarted);
  expect(saveElapsed).toBeLessThan(3_000);

  const exportStarted = await page.evaluate(() => performance.now());
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Mermaid' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.mmd$/);
  const exportElapsed = await page.evaluate(start => performance.now() - start, exportStarted);
  expect(exportElapsed).toBeLessThan(3_000);
  console.info('General five-component baseline (mock transport, milliseconds):', JSON.stringify({ authoringMs, saveMs: saveElapsed, mermaidMs: exportElapsed }));
});

for (const kind of ['general', 'container'] as const) {
  test(`loads, edits, saves and exports the ${kind} 200-component/300-relationship envelope`, async ({ page }) => {
    test.setTimeout(60_000);
    const { parent, child, general } = containerScaleFixture();
    const document = kind === 'container' ? child : general;
    const repository = new DiagramRepository();
    repository.create(parent); repository.create(child); repository.create(general);
    const app = buildApp(repository);
    let contextRequests = 0;
    await page.route(/\/api\/(?:diagrams|adrs)(?:\/|$|\?)/, async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.pathname.endsWith('/container-context')) contextRequests++;
      const response = await app.inject({ method: request.method() as any, url: url.pathname.replace(/^\/api/, '') + url.search, ...(request.postData() ? { payload: JSON.parse(request.postData()!) } : {}) });
      await route.fulfill({ status: response.statusCode, contentType: response.headers['content-type'] as string, body: response.body });
    });
    try {
      await page.goto('/');
      const loadStarted = await page.evaluate(() => performance.now());
      await page.locator(`.saved-diagram-button[data-diagram-id="${document.id}"]`).click();
      await expect(page.getByLabel('Diagram name', { exact: true })).toHaveValue(document.name);
      await expect(page.locator('.react-flow__node-component')).toHaveCount(200);
      await expect(page.locator('.react-flow__edge')).toHaveCount(300);
      const loadMs = await page.evaluate(start => performance.now() - start, loadStarted);
      const editStarted = await page.evaluate(() => performance.now());
      await page.getByLabel('Diagram name', { exact: true }).fill(`${document.name} edited`);
      await expect(page.locator('.save-status')).toHaveText('Unsaved changes');
      const editMs = await page.evaluate(start => performance.now() - start, editStarted);
      const saveStarted = await page.evaluate(() => performance.now());
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.locator('.save-status')).toHaveText('Saved', { timeout: 3_000 });
      const saveMs = await page.evaluate(start => performance.now() - start, saveStarted);
      const exportStarted = await page.evaluate(() => performance.now());
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Export Mermaid' }).click();
      expect((await download).suggestedFilename()).toMatch(/\.mmd$/);
      const mermaidMs = await page.evaluate(start => performance.now() - start, exportStarted);
      expect(saveMs).toBeLessThan(3_000); expect(mermaidMs).toBeLessThan(3_000);
      const exportContextBefore = contextRequests;
      const htmlStarted = await page.evaluate(() => performance.now());
      const html = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Export HTML package' }).click();
      expect((await html).suggestedFilename()).toMatch(/\.zip$/);
      const htmlMs = await page.evaluate(start => performance.now() - start, htmlStarted);
      expect(contextRequests - exportContextBefore).toBe(kind === 'container' ? 1 : 0);
      const saved = repository.get(document.id)!;
      expect(saved.components.map(component => component.id)).toEqual(document.components.map(component => component.id));
      expect(saved.relationships).toHaveLength(300);
      expect(repository.get(parent.id)).toEqual(parent);
      console.info(`Spec 009 ${kind} browser envelope (in-process API, milliseconds):`, JSON.stringify({ loadMs, editMs, saveMs, mermaidMs, htmlMs, exportContextRequests: contextRequests - exportContextBefore }));
    } finally { await app.close(); }
  });
}

test('keeps the draft visible after a save failure and recovers on the next edit', async ({ page }) => {
  await mockDiagramApi(page, true);
  await page.goto('/');
  await page.getByLabel('Diagram name').fill('Recovery system');
  await page.getByRole('button', { name: 'Create diagram' }).click();
  await page.getByRole('button', { name: 'Add component' }).click();
  let inspector = page.getByLabel('Diagram inspector');
  await inspector.getByLabel('Component name').fill('API');
  await inspector.getByRole('button', { name: 'Add component' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.save-status')).toContainText('Save failed', { timeout: 3_000 });
  await expect(page.getByRole('group', { name: 'Component API' })).toBeVisible();
  await page.getByRole('button', { name: 'Add component' }).click();
  inspector = page.getByLabel('Diagram inspector');
  await inspector.getByLabel('Component name').fill('Database');
  await inspector.getByRole('button', { name: 'Add component' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.save-status')).toHaveText('Saved', { timeout: 3_000 });
});
