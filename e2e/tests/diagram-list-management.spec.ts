import { type Page, type Route } from '@playwright/test';
import { expect, test } from '@playwright/test';
import type { DiagramDocument, DiagramSummary } from '../../shared/src/index';
import { activeDiagramListFixtures, recoverableDiagramFixture } from '../../frontend/tests/diagram-list-fixtures';

type JsonValue = DiagramDocument | DiagramSummary | DiagramSummary[] | { message: string };

const fulfillJson = (route: Route, body: JsonValue, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** Mock the active summary endpoint without intercepting create or document-load requests. */
export async function mockActiveDiagramSummaries(page: Page, summaries: DiagramSummary[]) {
  await page.route('**/api/diagrams', route => route.request().method() === 'GET' ? fulfillJson(route, summaries) : route.fallback());
}

/** Mock the existing recoverable-trash list and restore endpoints. */
export async function mockTrashAndRestore(page: Page, trash: DiagramSummary[], restored: Record<string, DiagramDocument> = {}) {
  await page.route('**/api/diagrams/trash', route => route.request().method() === 'GET' ? fulfillJson(route, trash) : route.fallback());
  await page.route('**/api/diagrams/*/restore', route => {
    if (route.request().method() !== 'POST') return route.fallback();
    const id = route.request().url().split('/').at(-2) ?? '';
    return restored[id] ? fulfillJson(route, restored[id]) : fulfillJson(route, { message: 'Diagram not found.' }, 404);
  });
}

/** Mock a successful recoverable deletion for one stable diagram UUID. */
export async function mockSuccessfulDiagramDeletion(page: Page, diagramId: string) {
  await page.route(`**/api/diagrams/${diagramId}`, route => route.request().method() === 'DELETE' ? route.fulfill({ status: 204 }) : route.fallback());
}

/** Mock a deletion failure while leaving the API response actionable. */
export async function mockFailedDiagramDeletion(page: Page, diagramId: string, message = 'Diagram is unavailable.') {
  await page.route(`**/api/diagrams/${diagramId}`, route => route.request().method() === 'DELETE' ? fulfillJson(route, { message }, 404) : route.fallback());
}

/** Return successive active-list snapshots to exercise refresh/deletion races. */
export async function mockActiveRefreshRace(page: Page, snapshots: DiagramSummary[][]) {
  let requestNumber = 0;
  await page.route('**/api/diagrams', route => {
    if (route.request().method() !== 'GET') return route.fallback();
    const snapshot = snapshots[Math.min(requestNumber++, snapshots.length - 1)] ?? [];
    return fulfillJson(route, snapshot);
  });
}

test.describe('find diagrams by name or creation date', () => {
  test('filters by trimmed name, inclusive date boundaries, and combined criteria', async ({ page }) => {
    await mockActiveDiagramSummaries(page, activeDiagramListFixtures);
    await page.goto('/');

    await expect(page.locator('.saved-diagram-button')).toHaveCount(activeDiagramListFixtures.length);
    await page.getByLabel('Filter diagrams by name').fill('  API ');
    await expect(page.getByRole('button', { name: /Payments API, last saved/ })).toHaveCount(1);
    await expect(page.getByRole('button', { name: /Inventory, last saved/ })).toHaveCount(0);

    await page.getByLabel('Filter diagrams by name').fill('');
    await page.getByLabel('Created from').fill('2026-01-10');
    await page.getByLabel('Created to').fill('2026-01-12');
    await expect(page.getByRole('button', { name: /Payments API, last saved/ })).toHaveCount(1);
    await expect(page.getByRole('button', { name: /Inventory, last saved/ })).toHaveCount(0);

    await page.getByLabel('Filter diagrams by name').fill('payments');
    await page.getByLabel('Created to').fill('2026-01-01');
    await expect(page.getByRole('alert')).toContainText('End date must be on or after the start date.');
    await page.getByLabel('Created to').fill('2026-01-10');
    await expect(page.getByRole('button', { name: /Payments, last saved/ })).toHaveCount(2);
  });

  test('reports no matches and restores the complete active list', async ({ page }) => {
    await mockActiveDiagramSummaries(page, activeDiagramListFixtures);
    await page.goto('/');

    await page.getByLabel('Filter diagrams by name').fill('does not exist');
    await expect(page.getByText('No diagrams match these filters.')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).first().click();
    await expect(page.getByRole('button', { name: /Inventory, last saved/ })).toBeVisible();
    await expect(page.getByText('No diagrams match these filters.')).toHaveCount(0);
  });

  test('shows the empty active-list state', async ({ page }) => {
    await mockActiveDiagramSummaries(page, []);
    await page.goto('/');
    await expect(page.getByText('No saved diagrams yet.')).toBeVisible();
    await expect(page.getByLabel('Filter diagrams by name')).toHaveCount(0);
  });
});

test.describe('sort diagrams for review', () => {
  test('sorts by field and direction, keeps filtered ties stable, and opens the selected UUID', async ({ page }) => {
    await mockActiveDiagramSummaries(page, activeDiagramListFixtures);
    const selected = activeDiagramListFixtures.find(item => item.id === '00000000-0000-4000-8000-000000000404')!;
    const selectedDocument: DiagramDocument = { ...selected, status: 'active', trashedAt: null, components: [], relationships: [], groups: [] };
    await page.route(`**/api/diagrams/${selected.id}`, route => route.request().method() === 'GET' ? fulfillJson(route, selectedDocument) : route.fallback());
    await page.goto('/');

    const names = () => page.locator('.saved-diagram-button strong').allTextContents();
    await page.getByLabel('Sort diagrams by').selectOption('name');
    await page.getByLabel('Sort direction').selectOption('ascending');
    await expect.poll(names).toEqual(['Before range', 'Inventory', 'Payments', 'Payments', 'Payments API']);

    await page.getByLabel('Sort direction').selectOption('descending');
    await expect.poll(names).toEqual(['Payments API', 'Payments', 'Payments', 'Inventory', 'Before range']);

    await page.getByLabel('Sort diagrams by').selectOption('createdAt');
    await page.getByLabel('Sort direction').selectOption('ascending');
    await expect.poll(names).toEqual(['Before range', 'Payments', 'Payments', 'Payments API', 'Inventory']);

    await page.getByLabel('Sort direction').selectOption('descending');
    await expect.poll(names).toEqual(['Inventory', 'Payments API', 'Payments', 'Payments', 'Before range']);

    await page.getByLabel('Filter diagrams by name').fill('payments');
    await page.getByLabel('Sort diagrams by').selectOption('name');
    await page.getByLabel('Sort direction').selectOption('ascending');
    await expect.poll(names).toEqual(['Payments', 'Payments', 'Payments API']);
    await expect(page.locator(`.saved-diagram-button[data-diagram-id="${selected.id}"]`)).toHaveCount(1);
    await page.locator(`.saved-diagram-button[data-diagram-id="${selected.id}"]`).click();
    await expect(page.locator('.current-diagram strong')).toHaveText(selected.name);
  });
});

test.describe('delete diagrams safely', () => {
  test('names the target, allows cancellation, then removes only the confirmed UUID', async ({ page }) => {
    const target = activeDiagramListFixtures[0];
    await mockActiveDiagramSummaries(page, activeDiagramListFixtures);
    await mockSuccessfulDiagramDeletion(page, target.id);
    await page.goto('/');

    const row = page.locator(`li:has(.saved-diagram-button[data-diagram-id="${target.id}"])`);
    await row.getByRole('button', { name: `Delete ${target.name}` }).click();
    await expect(page.getByRole('alertdialog')).toContainText(`Delete "${target.name}"?`);
    await expect(page.getByRole('alertdialog')).toContainText('recoverable trash');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(row).toBeVisible();

    await row.getByRole('button', { name: `Delete ${target.name}` }).click();
    await page.getByRole('button', { name: 'Move to trash' }).click();
    await expect(page.locator(`.saved-diagram-button[data-diagram-id="${target.id}"]`)).toHaveCount(0);
    await expect(page.locator('.saved-diagrams-success')).toContainText('recoverable trash');
    await expect(page.locator(`.saved-diagram-button[data-diagram-id="${activeDiagramListFixtures[1].id}"]`)).toHaveCount(1);
  });

  test('keeps a failed target visible and exposes an actionable error', async ({ page }) => {
    const target = activeDiagramListFixtures[0];
    await mockActiveDiagramSummaries(page, activeDiagramListFixtures);
    await mockFailedDiagramDeletion(page, target.id, 'Diagram is unavailable.');
    await page.goto('/');
    const row = page.locator(`li:has(.saved-diagram-button[data-diagram-id="${target.id}"])`);
    await row.getByRole('button', { name: `Delete ${target.name}` }).click();
    await page.getByRole('button', { name: 'Move to trash' }).click();
    await expect(row).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Diagram is unavailable.');
    await expect(page.getByRole('alert')).toContainText('Refresh the list');
  });

  test('shows the create action after deleting the last active diagram', async ({ page }) => {
    const target = activeDiagramListFixtures[0];
    await mockActiveDiagramSummaries(page, [target]);
    await mockSuccessfulDiagramDeletion(page, target.id);
    await page.goto('/');
    await page.getByRole('button', { name: `Delete ${target.name}` }).click();
    await page.getByRole('button', { name: 'Move to trash' }).click();
    await expect(page.getByText('No saved diagrams yet.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create your first diagram' })).toBeVisible();
  });

  test('requires resolving unsaved current work before deletion can proceed', async ({ page }) => {
    const current = { ...recoverableDiagramFixture, id: '00000000-0000-4000-8000-000000000420', name: 'Current draft', status: 'active' as const, trashedAt: null };
    await page.route('**/api/diagrams', route => {
      if (route.request().method() === 'GET') return fulfillJson(route, []);
      if (route.request().method() === 'POST') return fulfillJson(route, current);
      return route.fallback();
    });
    await page.route(`**/api/diagrams/${current.id}`, route => {
      if (route.request().method() === 'GET') return fulfillJson(route, current);
      if (route.request().method() === 'PUT') return fulfillJson(route, current);
      if (route.request().method() === 'DELETE') return route.fulfill({ status: 204 });
      return route.fallback();
    });
    await page.goto('/');
    await page.getByLabel('Diagram name').fill(current.name);
    await page.getByRole('button', { name: 'Create diagram' }).click();
    await page.getByRole('button', { name: 'Add component' }).click();
    await page.getByLabel('Component name').fill('Draft service');
    await page.getByRole('button', { name: 'Add component' }).last().click();
    await page.getByRole('button', { name: `Delete ${current.name}` }).click();
    await page.getByRole('button', { name: 'Move to trash' }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Resolve unsaved changes before deletion');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('.current-diagram strong')).toHaveText('Current draft');
    await expect(page.locator(`[data-diagram-id="${current.id}"]`)).toHaveCount(1);
  });

  test('restores the original document through the existing recovery endpoints', async ({ page }) => {
    const summary = { id: recoverableDiagramFixture.id, name: recoverableDiagramFixture.name, status: 'trashed' as const, createdAt: recoverableDiagramFixture.createdAt, updatedAt: recoverableDiagramFixture.updatedAt };
    await mockActiveDiagramSummaries(page, []);
    await mockTrashAndRestore(page, [summary], { [summary.id]: { ...recoverableDiagramFixture, status: 'active', trashedAt: null } });
    await page.goto('/');
    const restored = await page.evaluate(async id => (await fetch(`/api/diagrams/${id}/restore`, { method: 'POST' })).json(), summary.id);
    expect(restored).toMatchObject({ id: summary.id, status: 'active', createdAt: summary.createdAt, components: expect.arrayContaining([expect.objectContaining({ id: recoverableDiagramFixture.components[0].id })]), relationships: expect.arrayContaining([expect.objectContaining({ id: recoverableDiagramFixture.relationships[0].id })]) });
  });
});
