import { type Page, type Route } from '@playwright/test';
import { expect, test } from '@playwright/test';
import type { DiagramDocument, DiagramSummary } from '../../shared/src/index';
import { activeDiagramListFixtures } from '../../frontend/tests/diagram-list-fixtures';

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
