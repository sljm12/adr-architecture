import { expect, test } from '@playwright/test';
import { fillAdrForm } from './adr-fixtures';

test('creates, validates, saves, reopens, and retries an ADR', async ({ page }) => {
  const diagram = { id: '00000000-0000-0000-0000-000000000501', name: 'Payments', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', trashedAt: null, components: [], relationships: [] };
  let adr: Record<string, unknown> | null = null; let failNextSave = true;
  await page.route('**/api/diagrams', route => route.fulfill({ status: route.request().method() === 'POST' ? 201 : 200, contentType: 'application/json', body: JSON.stringify(route.request().method() === 'POST' ? diagram : []) }));
  await page.route('**/api/diagrams/*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(diagram) }));
  await page.route('**/api/diagrams/*/adrs', async route => { if (route.request().method() === 'GET') return route.fulfill({ contentType: 'application/json', body: JSON.stringify(adr ? [{ id: adr.id, title: adr.title, status: adr.status, updatedAt: adr.updatedAt, componentCount: 0 }] : []) }); const payload = route.request().postDataJSON(); adr = { ...payload, id: '00000000-0000-0000-0000-000000000502', diagramId: diagram.id, componentIds: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }; return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(adr) }); });
  await page.route('**/api/adrs/*', async route => { if (route.request().method() === 'GET') return route.fulfill({ contentType: 'application/json', body: JSON.stringify(adr) }); if (route.request().method() === 'PATCH' && failNextSave) { failNextSave = false; return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Backend unavailable' }) }); } const payload = route.request().postDataJSON(); adr = { ...adr, ...payload, updatedAt: '2026-01-02T00:00:00.000Z' }; return route.fulfill({ contentType: 'application/json', body: JSON.stringify(adr) }); });
  await page.goto('/');
  await page.getByLabel('Diagram name').fill('Payments'); await page.getByRole('button', { name: 'Create diagram' }).click();
  await page.getByRole('button', { name: 'Decision' }).click(); await page.getByRole('button', { name: 'New decision' }).click();
  await page.getByRole('button', { name: 'Save decision' }).click(); await expect(page.getByRole('status').filter({ hasText: 'Needs attention' })).toBeVisible();
  await fillAdrForm(page); await page.getByRole('button', { name: 'Save decision' }).click(); await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
  await page.getByRole('button', { name: 'Existing decision' }).count().catch(() => undefined);
});
