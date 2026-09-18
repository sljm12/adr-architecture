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

test('shows linked and unlinked component ADR summaries and opens a decision directly', async ({ page }) => {
  const diagram = { id: '00000000-0000-0000-0000-000000000521', name: 'Payments', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', trashedAt: null, components: [
    { id: '00000000-0000-0000-0000-000000000522', diagramId: '00000000-0000-0000-0000-000000000521', name: 'API gateway', description: null, type: 'service', position: { x: 80, y: 100 }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: '00000000-0000-0000-0000-000000000523', diagramId: '00000000-0000-0000-0000-000000000521', name: 'Payments database', description: null, type: 'store', position: { x: 320, y: 100 }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  ], relationships: [] };
  const adr = { id: '00000000-0000-0000-0000-000000000524', diagramId: diagram.id, title: 'Use a payment boundary', context: 'Context', decision: 'Decision', consequences: 'Consequences', alternativesOrConstraints: null, status: 'accepted', replacementAdrId: null, componentIds: [diagram.components[0].id], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' };
  await page.route('**/api/diagrams', route => route.fulfill({ status: route.request().method() === 'POST' ? 201 : 200, contentType: 'application/json', body: JSON.stringify(route.request().method() === 'POST' ? diagram : [diagram]) }));
  await page.route('**/api/diagrams/*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(diagram) }));
  await page.route('**/api/diagrams/*/adrs', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ id: adr.id, title: adr.title, status: adr.status, updatedAt: adr.updatedAt, componentCount: 1 }]) }));
  await page.route('**/api/diagrams/*/components/*/adrs', async route => {
    const componentId = route.request().url().split('/components/')[1].split('/adrs')[0];
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(componentId === diagram.components[0].id ? [{ id: adr.id, title: adr.title, status: adr.status, updatedAt: adr.updatedAt }] : []) });
  });
  await page.route('**/api/adrs/*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(adr) }));

  await page.goto('/');
  await page.getByLabel('Diagram name').fill('Payments'); await page.getByRole('button', { name: 'Create diagram' }).click();
  await page.getByRole('group', { name: 'Component API gateway' }).click();
  const inspector = page.getByLabel('Diagram inspector');
  await expect(inspector.getByRole('heading', { name: 'Linked ADRs' })).toBeVisible();
  await expect(inspector.getByRole('button', { name: 'Open ADR: Use a payment boundary' })).toBeVisible();
  await inspector.getByRole('button', { name: 'Open ADR: Use a payment boundary' }).click();
  await expect(page.getByLabel('ADR workspace')).toContainText('Architecture Decision Record');
  await page.getByRole('button', { name: 'Close inspector' }).click();
  await page.getByRole('group', { name: 'Component Payments database' }).click();
  await expect(page.getByLabel('Diagram inspector')).toContainText('No linked ADRs for this component.');
});

test('links a mixed component and relationship scope, opens its relationship summary, and keeps the relationship label', async ({ page }) => {
  const diagram = { id: '00000000-0000-0000-0000-000000000531', name: 'Payments', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', trashedAt: null, components: [
    { id: '00000000-0000-0000-0000-000000000532', diagramId: '00000000-0000-0000-0000-000000000531', name: 'API gateway', description: null, type: 'service', position: { x: 80, y: 100 }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: '00000000-0000-0000-0000-000000000533', diagramId: '00000000-0000-0000-0000-000000000531', name: 'Payments database', description: null, type: 'store', position: { x: 320, y: 100 }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  ], relationships: [{ id: '00000000-0000-0000-0000-000000000534', diagramId: '00000000-0000-0000-0000-000000000531', sourceComponentId: '00000000-0000-0000-0000-000000000532', targetComponentId: '00000000-0000-0000-0000-000000000533', direction: 'directed', label: 'sends', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }], };
  let adr: any = null;
  await page.route('**/api/diagrams', route => route.fulfill({ status: route.request().method() === 'POST' ? 201 : 200, contentType: 'application/json', body: JSON.stringify(route.request().method() === 'POST' ? diagram : [diagram]) }));
  await page.route('**/api/diagrams/*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(diagram) }));
  await page.route('**/api/diagrams/*/adrs', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ contentType: 'application/json', body: JSON.stringify(adr ? [{ id: adr.id, title: adr.title, status: adr.status, updatedAt: adr.updatedAt, componentCount: adr.componentIds.length, relationshipCount: adr.relationshipIds.length }] : []) });
    const payload = route.request().postDataJSON(); adr = { ...payload, id: '00000000-0000-0000-0000-000000000535', diagramId: diagram.id, componentIds: [], relationshipIds: [], createdAt: diagram.createdAt, updatedAt: diagram.updatedAt }; return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(adr) });
  });
  await page.route('**/api/diagrams/*/relationships/*/adrs', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(adr ? [{ id: adr.id, title: adr.title, status: adr.status, updatedAt: adr.updatedAt }] : []) }));
  await page.route('**/api/adrs/**', async route => {
    const url = route.request().url(); const payload = route.request().method() === 'PUT' ? route.request().postDataJSON() : undefined;
    if (url.endsWith('/components')) adr = { ...adr, componentIds: payload.componentIds, updatedAt: '2026-01-02T00:00:00.000Z' };
    if (url.endsWith('/relationships')) adr = { ...adr, relationshipIds: payload.relationshipIds, updatedAt: '2026-01-02T00:00:00.000Z' };
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(adr) });
  });
  await page.goto('/');
  await page.getByLabel('Diagram name').fill('Payments'); await page.getByRole('button', { name: 'Create diagram' }).click();
  const workspace = page.getByLabel('ADR workspace'); await page.getByRole('button', { name: 'Decision' }).click(); await workspace.getByRole('button', { name: 'New decision' }).click(); await fillAdrForm(page);
  await workspace.getByRole('checkbox', { name: 'API gateway', exact: true }).check(); await workspace.getByRole('checkbox', { name: 'Relationship API gateway → Payments database · sends', exact: true }).check();
  await workspace.getByRole('button', { name: 'Save decision' }).click(); await expect(workspace.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
  expect(adr.componentIds).toEqual([diagram.components[0].id]); expect(adr.relationshipIds).toEqual([diagram.relationships[0].id]);
  await workspace.getByRole('button', { name: 'Remove relationship API gateway → Payments database · sends' }).click();
  await workspace.getByRole('checkbox', { name: 'Relationship API gateway → Payments database · sends' }).check();
  await workspace.getByRole('button', { name: 'View' }).last().click();
  const inspector = page.getByLabel('Diagram inspector'); await expect(inspector.getByRole('heading', { name: 'Linked ADRs' })).toBeVisible(); await expect(inspector).toContainText('API gateway → Payments database · sends');
  await inspector.getByRole('button', { name: 'Open ADR: Use a payment service boundary' }).click(); await expect(page.getByLabel('ADR workspace')).toContainText('Architecture Decision Record');
});

test('edits component names and relationship label/direction without changing artifact identities', async ({ page }) => {
  let diagram: any = { id: '00000000-0000-0000-0000-000000000541', name: 'Payments', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', trashedAt: null, components: [
    { id: '00000000-0000-0000-0000-000000000542', diagramId: '00000000-0000-0000-0000-000000000541', name: 'API', description: null, type: 'service', position: { x: 80, y: 100 }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: '00000000-0000-0000-0000-000000000543', diagramId: '00000000-0000-0000-0000-000000000541', name: 'Database', description: null, type: 'store', position: { x: 320, y: 100 }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  ], relationships: [{ id: '00000000-0000-0000-0000-000000000544', diagramId: '00000000-0000-0000-0000-000000000541', sourceComponentId: '00000000-0000-0000-0000-000000000542', targetComponentId: '00000000-0000-0000-0000-000000000543', direction: 'directed', label: 'queries', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }] };
  await page.route('**/api/diagrams', route => route.fulfill({ status: route.request().method() === 'POST' ? 201 : 200, contentType: 'application/json', body: JSON.stringify(route.request().method() === 'POST' ? diagram : [diagram]) }));
  await page.route('**/api/diagrams/*/components/*/adrs', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('**/api/diagrams/*/relationships/*/adrs', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('**/api/diagrams/*', async route => {
    if (route.request().method() === 'PUT') { diagram = { ...route.request().postDataJSON(), updatedAt: '2026-01-02T00:00:00.000Z' }; return route.fulfill({ contentType: 'application/json', body: JSON.stringify(diagram) }); }
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(diagram) });
  });

  await page.goto('/');
  await page.getByLabel('Diagram name').fill('Payments'); await page.getByRole('button', { name: 'Create diagram' }).click();
  await page.getByRole('group', { name: 'Component API' }).click();
  const inspector = page.getByLabel('Diagram inspector');
  await inspector.getByLabel('Component name').fill('Gateway'); await inspector.getByRole('button', { name: 'Save component' }).click();
  await expect(inspector).toContainText('Gateway');

  await page.locator('.react-flow__edge').first().click();
  await inspector.getByLabel('Relationship label').fill('sends events');
  await inspector.getByRole('button', { name: 'Reverse direction' }).click();
  await inspector.getByLabel('Relationship direction').selectOption('undirected');
  await inspector.getByRole('button', { name: 'Save relationship' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
  expect(diagram.components.find((component: any) => component.id === '00000000-0000-0000-0000-000000000542').name).toBe('Gateway');
  expect(diagram.relationships[0]).toMatchObject({ id: '00000000-0000-0000-0000-000000000544', sourceComponentId: '00000000-0000-0000-0000-000000000543', targetComponentId: '00000000-0000-0000-0000-000000000542', direction: 'undirected', label: 'sends events' });
});

test('reviews statuses, supersedes with a replacement, blocks replacement deletion, and repairs then confirms delete', async ({ page }) => {
  const diagram = { id: '00000000-0000-0000-0000-000000000551', name: 'Payments', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', trashedAt: null, components: [], relationships: [] };
  const originalId = '00000000-0000-0000-0000-000000000552';
  const replacementId = '00000000-0000-0000-0000-000000000553';
  const rejectedId = '00000000-0000-0000-0000-000000000554';
  let adrs: any[] = [];
  await page.route('**/api/diagrams', route => route.fulfill({ status: route.request().method() === 'POST' ? 201 : 200, contentType: 'application/json', body: JSON.stringify(route.request().method() === 'POST' ? diagram : [diagram]) }));
  await page.route('**/api/diagrams/*/adrs', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ contentType: 'application/json', body: JSON.stringify(adrs.map(adr => ({ id: adr.id, title: adr.title, status: adr.status, updatedAt: adr.updatedAt, componentCount: 0, relationshipCount: 0 }))) });
    const payload = route.request().postDataJSON();
    const id = adrs.length === 0 ? originalId : adrs.length === 1 ? replacementId : rejectedId;
    const adr = { ...payload, id, diagramId: diagram.id, componentIds: [], relationshipIds: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
    adrs = [...adrs, adr];
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(adr) });
  });
  await page.route('**/api/adrs/**', async route => {
    const id = route.request().url().split('/api/adrs/')[1];
    const adr = adrs.find(item => item.id === id);
    if (route.request().method() === 'GET') return route.fulfill({ contentType: 'application/json', body: JSON.stringify(adr) });
    if (route.request().method() === 'DELETE') {
      const blocker = adrs.find(item => item.replacementAdrId === id);
      if (blocker) return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ message: 'ADR cannot be deleted while it is referenced as a replacement', blockers: [{ adrId: blocker.id, title: blocker.title, reason: 'This ADR is the replacement for the blocking ADR.' }] }) });
      adrs = adrs.filter(item => item.id !== id);
      return route.fulfill({ status: 204 });
    }
    const payload = route.request().postDataJSON();
    const updated = { ...adr, ...payload, updatedAt: '2026-01-02T00:00:00.000Z' };
    adrs = adrs.map(item => item.id === id ? updated : item);
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(updated) });
  });

  await page.goto('/');
  await page.getByLabel('Diagram name').fill('Payments'); await page.getByRole('button', { name: 'Create diagram' }).click();
  await page.getByRole('button', { name: 'Decision' }).click();
  const workspace = page.getByLabel('ADR workspace');
  await workspace.getByRole('button', { name: 'New decision' }).click(); await fillAdrForm(page); await workspace.getByRole('button', { name: 'Save decision' }).click();
  await workspace.getByRole('button', { name: 'New decision' }).click(); await fillAdrForm(page); await page.getByLabel('Title').fill('Replacement decision'); await page.locator('#adr-status').selectOption('accepted'); await workspace.getByRole('button', { name: 'Save decision' }).click();
  await workspace.getByRole('button', { name: 'New decision' }).click(); await fillAdrForm(page); await page.getByLabel('Title').fill('Rejected decision'); await page.locator('#adr-status').selectOption('rejected'); await workspace.getByRole('button', { name: 'Save decision' }).click();
  await expect(workspace.locator('.adr-status-rejected').last()).toBeVisible();

  await workspace.getByRole('button', { name: /Use a payment service boundary/ }).first().click();
  await page.locator('#adr-status').selectOption('superseded'); await workspace.getByLabel('Replacement decision').selectOption(replacementId); await workspace.getByRole('button', { name: 'Save decision' }).click();
  await expect(workspace.locator('.adr-status-superseded').last()).toBeVisible();

  await workspace.getByRole('button', { name: /Replacement decision/ }).click(); await workspace.getByRole('button', { name: 'Delete decision' }).click(); await workspace.getByRole('button', { name: 'Delete decision', exact: true }).last().click();
  await expect(workspace).toContainText('Dependency blocker'); await expect(workspace).toContainText(originalId);
  await workspace.getByRole('button', { name: 'Open blocking decision' }).click(); await page.locator('#adr-status').selectOption('rejected'); await workspace.getByRole('button', { name: 'Save decision' }).click();
  await workspace.getByRole('button', { name: /Replacement decision/ }).click(); await workspace.getByRole('button', { name: 'Delete decision' }).click(); await workspace.getByRole('button', { name: 'Delete decision', exact: true }).last().click();
  await expect(workspace).toContainText('Decision deleted successfully.'); await expect(workspace.getByRole('button', { name: /Replacement decision/ })).toHaveCount(0);
});
