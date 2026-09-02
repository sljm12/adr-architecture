import { test, expect } from '@playwright/test';

const diagram = { id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301', name: 'System', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', trashedAt: null, components: [], relationships: [] };

async function mockDiagramApi(page: import('@playwright/test').Page) {
  let latest = diagram;
  await page.route('**/api/diagrams', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(diagram) }));
  await page.route('**/api/diagrams/**', async route => {
    if (route.request().method() === 'PUT') { latest = route.request().postDataJSON(); return route.fulfill({ contentType: 'application/json', body: JSON.stringify(latest) }); }
    if (route.request().url().endsWith('/export/mermaid') && latest.components.length === 0) return route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ message: 'Add at least one component before exporting.', fields: { components: 'At least one component is required.' } }) });
    if (route.request().url().endsWith('/export/mermaid')) return route.fulfill({ contentType: 'text/vnd.mermaid', headers: { 'content-disposition': 'attachment; filename="system.mmd"' }, body: 'flowchart TD\n  API["API"]' });
    return route.fallback();
  });
}

test('exports the current pending draft and announces success', async ({ page }) => {
  await mockDiagramApi(page);
  await page.goto('/');
  await page.getByLabel('Diagram name').fill('System');
  await page.getByRole('button', { name: 'Create diagram' }).click();
  await page.getByLabel('Name your next building block').fill('API');
  await page.getByRole('button', { name: 'Add' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Mermaid' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.mmd$/);
  await expect(page.locator('#export-status')).toContainText('Exported');
});

test('shows actionable feedback instead of downloading an invalid export', async ({ page }) => {
  await mockDiagramApi(page);
  await page.goto('/');
  await page.getByLabel('Diagram name').fill('System');
  await page.getByRole('button', { name: 'Create diagram' }).click();
  await page.getByRole('button', { name: 'Export Mermaid' }).click();
  await expect(page.locator('#export-status')).toContainText(/Add at least one component/i);
});
