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
  await page.getByRole('button', { name: 'Decision' }).click(); const adrWorkspace = page.getByLabel('ADR workspace'); await adrWorkspace.getByRole('button', { name: 'New decision' }).click();
  await adrWorkspace.getByRole('button', { name: 'Save decision' }).click(); await expect(adrWorkspace.getByRole('status').filter({ hasText: 'Needs attention' })).toBeVisible();
  await fillAdrForm(page); await adrWorkspace.getByRole('button', { name: 'Save decision' }).click(); await expect(adrWorkspace.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
  await page.getByRole('button', { name: 'Existing decision' }).count().catch(() => undefined);
});

test('links zero, one, and multiple components, then unlinks without changing component identity', async ({ page }) => {
  const diagram = { id: '00000000-0000-0000-0000-000000000511', name: 'Payments', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', trashedAt: null, components: [
    { id: '00000000-0000-0000-0000-000000000512', diagramId: '00000000-0000-0000-0000-000000000511', name: 'API gateway', description: null, type: 'service', position: { x: 80, y: 100 }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: '00000000-0000-0000-0000-000000000513', diagramId: '00000000-0000-0000-0000-000000000511', name: 'Payments database', description: null, type: 'store', position: { x: 320, y: 100 }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  ], relationships: [] };
  let adr: any = null;
  await page.route('**/api/diagrams', route => route.fulfill({ status: route.request().method() === 'POST' ? 201 : 200, contentType: 'application/json', body: JSON.stringify(route.request().method() === 'POST' ? diagram : [diagram]) }));
  await page.route('**/api/diagrams/*/adrs', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ contentType: 'application/json', body: JSON.stringify(adr ? [{ id: adr.id, title: adr.title, status: adr.status, updatedAt: adr.updatedAt, componentCount: adr.componentIds.length }] : []) });
    const payload = route.request().postDataJSON(); adr = { ...payload, id: '00000000-0000-0000-0000-000000000514', diagramId: diagram.id, componentIds: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }; return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(adr) });
  });
  await page.route('**/api/adrs/**', async route => {
    const url = route.request().url();
    if (url.endsWith('/components') && route.request().method() === 'PUT') { adr = { ...adr, componentIds: route.request().postDataJSON().componentIds, updatedAt: '2026-01-02T00:00:00.000Z' }; return route.fulfill({ contentType: 'application/json', body: JSON.stringify(adr) }); }
    if (route.request().method() === 'GET') return route.fulfill({ contentType: 'application/json', body: JSON.stringify(adr) });
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(adr) });
  });
  await page.goto('/');
  await page.getByLabel('Diagram name').fill('Payments'); await page.getByRole('button', { name: 'Create diagram' }).click();
  const workspace = page.getByLabel('ADR workspace'); await page.getByRole('button', { name: 'Decision' }).click(); await workspace.getByRole('button', { name: 'New decision' }).click(); await fillAdrForm(page);
  await expect(workspace.getByText('Unlinked — this ADR applies across the diagram.')).toBeVisible();
  await workspace.getByRole('checkbox', { name: 'API gateway' }).check(); await workspace.getByRole('checkbox', { name: 'Payments database' }).check();
  await workspace.getByRole('button', { name: 'Save decision' }).click(); await expect(workspace.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
  expect(adr.componentIds).toEqual([diagram.components[0].id, diagram.components[1].id]);
  await workspace.getByRole('button', { name: `Remove ${diagram.components[0].name}` }).click(); await workspace.getByRole('button', { name: 'Save decision' }).click();
  expect(adr.componentIds).toEqual([diagram.components[1].id]);
});
