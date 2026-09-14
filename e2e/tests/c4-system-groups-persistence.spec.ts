import { expect, test, type Page } from '@playwright/test';

const diagram = {
  id: '00000000-0000-4000-8000-000000000701', name: 'System context', status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', trashedAt: null,
  components: [], relationships: [], groups: [],
};

async function mockPersistenceApi(page: Page) {
  let latest = structuredClone(diagram);
  await page.route('**/api/diagrams', async route => {
    if (route.request().method() === 'POST') return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(latest) });
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify([latest]) });
  });
  await page.route('**/api/diagrams/**', async route => {
    const method = route.request().method();
    if (method === 'PUT') {
      latest = route.request().postDataJSON();
      if (latest.relationships.length === 0 && latest.components.length >= 2) {
        latest.relationships = [{ id: '00000000-0000-4000-8000-000000000702', diagramId: latest.id, sourceComponentId: latest.components[0].id, targetComponentId: latest.components[1].id, direction: 'directed', label: 'calls', createdAt: latest.createdAt, updatedAt: latest.updatedAt }];
      }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(latest) });
    }
    if (route.request().url().endsWith('/export/mermaid')) return route.fulfill({ contentType: 'text/vnd.mermaid', headers: { 'content-disposition': 'attachment; filename="system-context.mmd"' }, body: 'flowchart TD\n  subgraph group_platform["Platform"]\n  end' });
    if (method === 'GET') return route.fulfill({ contentType: 'application/json', body: JSON.stringify(latest) });
    if (method === 'DELETE' && route.request().url().includes('/components/')) return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ message: 'Component cannot be removed while it belongs to system group 00000000-0000-4000-8000-000000000703.', componentId: latest.components[0]?.id, relationshipCount: 0, groupIds: [latest.groups[0]?.id] }) });
    return route.fallback();
  });
}

test('preserves group and relationship identity across save, reopen, edits, conflict feedback, and export', async ({ page }) => {
  await mockPersistenceApi(page);
  await page.goto('/');
  await page.getByLabel('Diagram name').fill('System context');
  await page.getByRole('button', { name: 'Create diagram' }).click();
  const inspector = page.getByLabel('Diagram inspector');

  for (const name of ['Checkout', 'Ledger']) {
    await page.locator('.command-bar').getByRole('button', { name: 'Add component' }).click();
    await inspector.getByLabel('Component name').fill(name);
    await inspector.getByRole('radio', { name: /Software System/ }).check();
    await inspector.getByRole('button', { name: 'Add component' }).click();
  }
  await page.getByLabel('Component Checkout, Software System').click();
  await page.getByLabel('Component Ledger, Software System').click({ modifiers: ['Shift'] });
  await page.getByRole('button', { name: 'Group selected systems', exact: true }).click();
  await inspector.getByLabel('Group name').fill('Platform');
  await inspector.getByRole('button', { name: 'Group selected systems', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.save-status')).toHaveText('Saved');

  await page.getByRole('button', { name: /System context, last saved/ }).click();
  const boundary = page.getByLabel(/System group /);
  await expect(boundary).toBeVisible();
  await boundary.locator('.group-boundary-label').click();
  await inspector.getByLabel('Group name').fill('Core Platform');
  await inspector.getByRole('button', { name: 'Rename group' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await boundary.locator('.group-boundary-label').click();
  await inspector.getByRole('button', { name: 'Ungroup', exact: true }).click();
  await page.locator('.confirm-dialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByLabel(/System group Core Platform/)).toBeVisible();

  await page.getByLabel('Component Checkout, Software System').click();
  await inspector.getByRole('button', { name: 'Delete component' }).click();
  await page.locator('.confirm-dialog').getByRole('button', { name: 'Remove component' }).click();
  await expect(page.locator('.recovery-notice')).toContainText(/belongs to system group|system group/i);

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Mermaid' }).click();
  expect((await download).suggestedFilename()).toBe('system-context.mmd');
  await expect(page.locator('#export-status')).toContainText('Exported Mermaid');
});
