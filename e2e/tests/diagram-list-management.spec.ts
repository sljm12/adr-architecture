import { type Page, type Route } from '@playwright/test';
import type { DiagramDocument, DiagramSummary } from '../../shared/src/index';

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
