import { expect, test, type Page } from '@playwright/test';

const first = { id: '00000000-0000-0000-0000-000000000201', name: 'System', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', trashedAt: null, components: [{ id: '00000000-0000-0000-0000-000000000211', diagramId: '00000000-0000-0000-0000-000000000201', name: 'API', description: null, type: null, position: { x: 0, y: 0 }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }], relationships: [] };
const second = { ...first, id: '00000000-0000-0000-0000-000000000202', name: 'System', updatedAt: '2026-01-02T00:00:00.000Z', components: [{ ...first.components[0], id: '00000000-0000-0000-0000-000000000212', diagramId: '00000000-0000-0000-0000-000000000202', name: 'Database' }] };

async function mockApi(page: Page, documents: typeof first[]) {
  await page.route('**/api/diagrams', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(documents.map(({ components, relationships, createdAt, trashedAt, ...summary }) => summary)) }));
  await page.route('**/api/diagrams/*', route => {
    const requested = documents.find(document => document.id === route.request().url().split('/').pop());
    return requested ? route.fulfill({ contentType: 'application/json', body: JSON.stringify(requested) }) : route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Document is unavailable.' }) });
  });
}

test('shows an empty saved-document state with a create action', async ({ page }) => {
  await mockApi(page, []);
  await page.goto('/');
  await expect(page.getByText('No saved diagrams yet.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create your first diagram' })).toBeVisible();
});

test('lists duplicate names by last-saved time and loads the selected document', async ({ page }) => {
  await mockApi(page, [first, second]);
  await page.goto('/');
  await expect(page.getByRole('button', { name: /System, last saved/ })).toHaveCount(2);
  await page.getByRole('button', { name: /System, last saved/ }).nth(1).click();
  await expect(page.getByTestId(`rf__node-${second.components[0].id}`).getByText('Database', { exact: true })).toBeVisible();
});

test('protects unsaved changes before switching saved documents', async ({ page }) => {
  await mockApi(page, [first, second]);
  await page.goto('/');
  await page.getByRole('button', { name: /System, last saved/ }).first().click();
  await page.getByLabel('Name your next building block').fill('Unsaved');
  await page.getByRole('button', { name: 'Add' }).click();
  await page.getByRole('button', { name: /System, last saved/ }).nth(1).click();
  await expect(page.getByRole('alertdialog', { name: 'Save changes before loading?' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByTestId(/^rf__node-/).getByText('Unsaved', { exact: true })).toBeVisible();
});
