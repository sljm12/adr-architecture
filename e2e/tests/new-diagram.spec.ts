import { expect, test, type Page } from '@playwright/test';

const diagram = { id: '00000000-0000-0000-0000-000000000041', name: 'Current system', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', trashedAt: null, components: [], relationships: [] };

async function mockDiagramApi(page: Page) {
  await page.route('**/api/diagrams', async route => {
    if (route.request().method() === 'POST') return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(diagram) });
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify([diagram]) });
  });
}

test('opens the new-diagram form without discarding a saved diagram', async ({ page }) => {
  await mockDiagramApi(page);
  await page.goto('/');
  await page.getByLabel('Diagram name').fill('Current system');
  await page.getByRole('button', { name: 'Create diagram' }).click();

  await page.getByRole('button', { name: 'New Diagram' }).click();
  await expect(page.getByRole('heading', { name: 'Create a diagram' })).toBeVisible();
  await expect(page.getByLabel('Diagram name')).toBeVisible();
});

test('confirms before discarding unsaved edits for a new diagram', async ({ page }) => {
  await mockDiagramApi(page);
  await page.goto('/');
  await page.getByLabel('Diagram name').fill('Current system');
  await page.getByRole('button', { name: 'Create diagram' }).click();
  await page.getByLabel('Name your next building block').fill('API');
  await page.getByRole('button', { name: 'Add' }).click();

  await page.getByRole('button', { name: 'New Diagram' }).click();
  await expect(page.getByRole('alertdialog', { name: 'Discard unsaved changes?' })).toBeVisible();
  await page.getByRole('button', { name: 'Discard and create' }).click();
  await expect(page.getByLabel('Diagram name')).toBeVisible();
});
