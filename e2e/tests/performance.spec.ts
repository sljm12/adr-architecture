import { expect, test, type Page } from '@playwright/test';
import { buildApp } from '../../backend/src/api/app';
import { DiagramRepository } from '../../backend/src/persistence/diagram-repository';
import { containerScaleFixture } from '../../shared/tests/container-scale-fixture';
import { componentScaleFixture, sampledMedian } from '../../shared/tests/component-scale-fixture';
import { AdrRepository } from '../../backend/src/persistence/adr-repository';

// Full canvas trace snapshots would dominate the repeated scale measurements.
test.use({ trace: 'off' });

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
      await expect(page.getByLabel('Diagram name', { exact: true })).toHaveValue(kind === 'container' ? child.scope!.softwareSystemName : document.name);
      await expect(page.locator('.react-flow__node-component')).toHaveCount(200);
      await expect(page.locator('.react-flow__edge')).toHaveCount(300);
      const loadMs = await page.evaluate(start => performance.now() - start, loadStarted);
      const editStarted = await page.evaluate(() => performance.now());
      if (kind === 'general') await page.getByLabel('Diagram name', { exact: true }).fill(`${document.name} edited`);
      else {
        await page.locator(`.react-flow__node[data-id="${document.components[0].id}"]`).focus();
        await page.keyboard.press('Enter');
        await page.getByLabel('Responsibilities', { exact: true }).fill('Edited scale responsibility');
        await page.getByRole('button', { name: 'Save component', exact: true }).click();
      }
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
      // The source DTO carries all scoped contexts in one hierarchy request.
      expect(contextRequests - exportContextBefore).toBe(0);
      const saved = repository.get(document.id)!;
      expect(saved.components.map(component => component.id)).toEqual(document.components.map(component => component.id));
      expect(saved.relationships).toHaveLength(300);
      expect(repository.get(parent.id)).toEqual(parent);
      console.info(`Spec 009 ${kind} browser envelope (in-process API, milliseconds):`, JSON.stringify({ loadMs, editMs, saveMs, mermaidMs, htmlMs, exportContextRequests: contextRequests - exportContextBefore }));
    } finally { await app.close(); }
  });
}

test('measures warmed Container/Component scale loads, edits, saves, opens and browser ZIP generation', async ({ page, browser }) => {
  test.setTimeout(240_000);
  const fixture = componentScaleFixture(), repository = new DiagramRepository(), adrs = new AdrRepository();
  fixture.documents.forEach(d => repository.create(d)); fixture.adrs.forEach(a => adrs.registerAdr(a));
  const app = buildApp(repository, adrs);
  const requests: Record<string, number> = {};
  await page.route(/\/api\/(?:diagrams|adrs)(?:\/|$|\?)/, async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname.replace(/^\/api/, '');
    requests[path] = (requests[path] ?? 0) + 1;
    const response = await app.inject({ method: request.method() as any, url: path + url.search, ...(request.postData() ? { payload: JSON.parse(request.postData()!) } : {}) });
    await route.fulfill({ status: response.statusCode, contentType: response.headers['content-type'] as string, body: response.body });
  });
  try {
    const timings: Record<string, unknown> = {};
    for (const d of [fixture.containers[0], fixture.components[0]]) {
      let iteration = 0;
      const steps: Record<string, number[]> = { load: [], edit: [], save: [], zip: [] };
      timings[`${d.kind}.loadEditSaveZip`] = await sampledMedian(async () => {
        let started = performance.now();
        await page.goto('/');
        await page.locator(`.saved-diagram-button[data-diagram-id="${d.id}"]`).click();
        await expect(page.locator('.react-flow__node-component')).toHaveCount(200);
        await expect(page.locator('.react-flow__edge')).toHaveCount(300);
        steps.load.push(performance.now() - started); started = performance.now();
        await page.locator(`.react-flow__node[data-id="${d.components[0].id}"]`).focus();
        await page.keyboard.press('Enter');
        await page.getByLabel('Responsibilities', { exact: true }).fill(`Scale edit ${iteration++}`);
        await page.getByRole('button', { name: 'Save component', exact: true }).click();
        steps.edit.push(performance.now() - started); started = performance.now();
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(page.locator('.save-status')).toHaveText('Saved');
        steps.save.push(performance.now() - started); started = performance.now();
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export HTML package', exact: true }).click();
        expect((await download).suggestedFilename()).toMatch(/\.zip$/);
        steps.zip.push(performance.now() - started);
      });
      timings[`${d.kind}.steps`] = Object.fromEntries(Object.entries(steps).map(([name, values]) => {
        const samples = values.slice(5), sorted = [...samples].sort((a, b) => a - b);
        return [name, { warmups: 5, samples, medianMs: (sorted[9] + sorted[10]) / 2 }];
      }));
      const owner = d.kind === 'component' ? fixture.containers[0].components[0] : fixture.context.components[0];
      const parentId = d.scope!.parentDiagramId, suffix = d.kind === 'component' ? 'component-diagram' : 'container-diagram';
      timings[`${d.kind}.idempotentOpen`] = await sampledMedian(async () => {
        const response = await app.inject({ method: 'POST', url: `/diagrams/${parentId}/components/${owner.id}/${suffix}` });
        expect(response.statusCode).toBe(200); expect(response.json().id).toBe(d.id);
      });
      expect(repository.get(d.id)!.components.map(c => c.id)).toEqual(d.components.map(c => c.id));
    }
    // Selected-item ADR/entry reads are expected; supporting occurrences must not fan out into requests.
    const requestedArtifactIds = new Set(Object.keys(requests).flatMap(p => p.match(/\/components\/([0-9a-f-]{36})(?:\/|$)/)?.[1] ?? []));
    expect([...requestedArtifactIds].sort()).toEqual([fixture.containers[0].components[0].id, fixture.components[0].components[0].id].sort());
    console.info('Spec 010 warmed browser scale (in-process API; no PostgreSQL lock claim):', JSON.stringify({ browser: browser.version(), timings, requests }));
  } finally { await app.close(); }
});

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
