import { expect, test, type Page } from '@playwright/test';

const diagram = { id: '00000000-0000-0000-0000-000000000011', name: 'System', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', trashedAt: null, components: [], relationships: [] };

async function mockDiagramApi(page: Page) {
  let latest = diagram;
  let putCount = 0;
  await page.route('**/api/diagrams', async route => {
    if (route.request().method() === 'POST') return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(diagram) });
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify([latest]) });
  });
  await page.route('**/api/diagrams/**', async route => {
    if (route.request().method() === 'PUT') {
      putCount += 1;
      latest = route.request().postDataJSON();
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(latest) });
    }
    if (route.request().method() === 'GET') return route.fulfill({ contentType: 'application/json', body: JSON.stringify(latest) });
    return route.fallback();
  });
  return { putCount: () => putCount };
}

test('keeps edits unsaved until the user explicitly saves', async ({ page }) => {
  const api = await mockDiagramApi(page);
  await page.goto('/');
  await page.getByLabel('Diagram name').fill('System');
  await page.getByRole('button', { name: 'Create diagram' }).click();
  await page.getByLabel('Name your next building block').fill('API');
  await page.getByRole('button', { name: 'Add' }).click();

  await expect(page.locator('.save-status')).toHaveText('Unsaved changes');
  await page.waitForTimeout(500);
  expect(api.putCount()).toBe(0);

  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.save-status')).toHaveText('Saved');
  expect(api.putCount()).toBe(1);
});
