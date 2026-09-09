import { expect, test, type Page } from '@playwright/test';

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
  const started = await page.evaluate(() => performance.now());
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

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.save-status')).toHaveText('Saved', { timeout: 3_000 });
  const saveElapsed = await page.evaluate(start => performance.now() - start, started);
  expect(saveElapsed).toBeLessThan(3_000);

  const exportStarted = await page.evaluate(() => performance.now());
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Mermaid' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.mmd$/);
  const exportElapsed = await page.evaluate(start => performance.now() - start, exportStarted);
  expect(exportElapsed).toBeLessThan(3_000);
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
