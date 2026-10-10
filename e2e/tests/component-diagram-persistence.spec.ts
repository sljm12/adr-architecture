import { test, expect } from '@playwright/test';
import { buildApp } from '../../backend/src/api/app';
import { componentTestDatabase, postgresEnabled } from '../../backend/tests/persistence/component-test-database';
import { componentContextFixture, componentParentFixture, emptyComponentFixture, componentFixtureIds as ids } from '../../shared/tests/component-fixtures';
import type { DiagramDocument } from '../../shared/src/index';

test('real HTTP/PostgreSQL: authors and reopens local ADR content, blocks immediate source removal and stages exact recovery', async ({ page }) => {
  test.skip(!postgresEnabled, 'Requires RUN_POSTGRES_TESTS=1 and a dedicated DATABASE_URL');
  const database = await componentTestDatabase();
  const app = buildApp(database.diagrams, database.adrs);
  let httpRequests = 0;
  app.addHook('onRequest', async () => { httpRequests++; });
  try {
    for (const d of [componentContextFixture(), componentParentFixture(), emptyComponentFixture(), emptyComponentFixture('datastore')]) await database.diagrams.create(d as DiagramDocument);
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    // This proxy forwards to a listening HTTP server; responses come from migrated PostgreSQL.
    await page.route(/\/api\/(?:diagrams|adrs)(?:\/|$|\?)/, async route => {
      const url = new URL(route.request().url());
      const response = await route.fetch({ url: `${address}${url.pathname.replace(/^\/api/, '')}${url.search}` });
      await route.fulfill({ response });
    });
    const row = (id: string) => page.locator(`.saved-diagram-button[data-diagram-id="${id}"]`);
    const recover = async (kind: 'trash' | 'restore', id: string) => page.evaluate(({ kind, id }) => window.dispatchEvent(new CustomEvent('adr:recover-diagram', { detail: { kind, id } })), { kind, id });
    await page.goto('/'); await row(ids.child).click();
    await page.getByRole('button', { name: 'Add component', exact: true }).first().click();
    await page.getByLabel('Component name', { exact: true }).fill('Request handler');
    await page.getByLabel('Responsibilities', { exact: true }).fill('Validates requests');
    await page.getByLabel('Technology', { exact: true }).fill('TypeScript');
    await page.getByRole('button', { name: 'Add component', exact: true }).last().click();
    await page.getByRole('button', { name: 'Include external participant', exact: true }).first().click();
    await page.getByLabel('External participant', { exact: true }).selectOption(ids.personOccurrence);
    await page.getByRole('button', { name: 'Include participant', exact: true }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click(); await expect(page.locator('.save-status')).toContainText('Saved');
    const child = (await database.diagrams.get(ids.child))!;
    const internal = child.components.find(c => c.role === 'component')!, occurrence = child.components.find(c => c.role === 'external')!;
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await page.getByLabel('From', { exact: true }).selectOption(internal.id); await page.getByLabel('To', { exact: true }).selectOption(occurrence.id);
    await page.getByLabel('Interaction description', { exact: true }).fill('Accepts request');
    await page.getByLabel('Protocol', { exact: true }).fill('HTTPS');
    await page.getByRole('button', { name: 'Connect components', exact: true }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click(); await expect(page.locator('.save-status')).toContainText('Saved');
    await page.getByRole('button', { name: 'Decision', exact: true }).click();
    for (const [name, value] of [['Title required', 'Validate requests locally'], ['Context required', 'Requests need validation'], ['Decision required', 'Use the handler'], ['Consequences required', 'Consistent validation']]) await page.getByLabel(name, { exact: true }).fill(value);
    for (const name of ['Request handler', 'Customer']) { await page.getByRole('checkbox', { name, exact: true }).focus(); await page.keyboard.press('Space'); }
    await page.getByRole('checkbox', { name: /Relationship Request handler/ }).check();
    await page.getByRole('button', { name: 'Save decision', exact: true }).click(); await expect(page.getByRole('button', { name: 'Delete decision', exact: true })).toBeVisible();
    const adr = (await database.adrs.listFull(ids.child))[0];
    expect(adr.componentIds.sort()).toEqual([internal.id, occurrence.id].sort()); expect(adr.relationshipIds).toHaveLength(1);
    await page.reload(); await row(ids.child).click(); await expect(page.locator('#component-diagram-heading')).toBeVisible();
    expect((await database.diagrams.get(ids.child))!.components.map(c => c.id)).toEqual(child.components.map(c => c.id));
    await page.getByRole('button', { name: /^Return to Payments, owner Payment API/ }).click();
    await page.locator(`.react-flow__node[data-id="${ids.personOccurrence}"] .component-node`).click();
    await page.getByRole('button', { name: 'Delete component', exact: true }).click();
    await expect(page.locator('.recovery-notice')).toContainText(occurrence.id);
    expect((await database.diagrams.get(ids.parent))!.components.some(c => c.id === ids.personOccurrence)).toBe(true);
    await recover('trash', ids.datastoreChild); await page.getByRole('button', { name: 'Move to trash', exact: true }).click();
    await expect.poll(async () => (await database.diagrams.get(ids.datastoreChild))?.status).toBe('trashed');
    const independent = await database.diagrams.getTrashProvenance(ids.datastoreChild);
    await recover('trash', ids.context); await expect(page.getByRole('alertdialog')).toContainText(ids.child);
    await expect(page.getByRole('alertdialog')).not.toContainText(ids.datastoreChild);
    await page.getByRole('button', { name: 'Move to trash', exact: true }).click();
    await expect.poll(async () => (await database.diagrams.get(ids.child))?.status).toBe('trashed');
    await recover('restore', ids.datastoreChild); await expect(page.getByRole('alertdialog')).toContainText('will remain in trash');
    await page.getByRole('button', { name: 'Restore diagrams', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toContainText('separate restoration');
    expect((await database.diagrams.get(ids.context))?.status).toBe('active'); expect((await database.diagrams.get(ids.child))?.status).toBe('active');
    expect(await database.diagrams.getTrashProvenance(ids.datastoreChild)).toEqual(independent);
    await page.getByRole('button', { name: 'Restore diagrams', exact: true }).click();
    await expect(page.locator('#component-diagram-heading')).toBeVisible();
    expect((await database.diagrams.get(ids.datastoreChild))?.status).toBe('active'); expect(await database.adrs.get(adr.id)).toEqual(adr);
    expect(httpRequests).toBeGreaterThan(30);
  } finally { await app.close(); await database.close(); }
});
