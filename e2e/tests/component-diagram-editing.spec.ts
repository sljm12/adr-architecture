import { test, expect, type Page } from '@playwright/test';
import { buildApp } from '../../backend/src/api/app';
import { DiagramRepository } from '../../backend/src/persistence/diagram-repository';
import { componentContextFixture, componentParentFixture, emptyComponentFixture, componentFixtureIds as ids } from '../../shared/tests/component-fixtures';
import type { DiagramDocument } from '../../shared/src/index';

async function harness(page: Page) {
  const repository = new DiagramRepository(); repository.create(componentContextFixture()); repository.create(componentParentFixture()); repository.create(emptyComponentFixture() as DiagramDocument);
  const app = buildApp(repository);
  await page.route(/\/api\/(?:diagrams|adrs)(?:\/|$|\?)/, async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace(/^\/api/, '');
    const response = await app.inject({ method: request.method() as any, url: path, ...(request.postData() ? { payload: JSON.parse(request.postData()!) } : {}) });
    await route.fulfill({ status: response.statusCode, contentType: 'application/json', body: response.body });
  });
  await page.goto('/'); await page.locator(`.saved-diagram-button[data-diagram-id="${ids.parent}"]`).click();
  await page.locator(`.react-flow__node[data-id="${ids.application}"] .component-node`).click();
  await page.getByRole('button', { name: 'Open component diagram', exact: true }).click();
  await expect(page.locator('#component-diagram-heading')).toBeVisible();
  return { repository, app };
}
async function add(page: Page, name: string) {
  await page.getByRole('button', { name: 'Add component', exact: true }).first().click();
  await page.getByLabel('Component name', { exact: true }).fill(name);
  await page.getByLabel('Responsibilities', { exact: true }).fill(`Handles ${name.toLowerCase()}`);
  await page.getByLabel('Technology', { exact: true }).fill('TypeScript');
  await page.getByRole('button', { name: 'Add component', exact: true }).last().click();
}
async function save(page: Page) { await page.getByRole('button', { name: 'Save', exact: true }).click(); await expect(page.locator('.save-status')).toContainText('Saved'); }
test('models three Components, supporting sources and interactions, saves/reopens without ancestor edits', async ({ page }) => {
  const { app, repository } = await harness(page); const parent = structuredClone(repository.get(ids.parent));
  try {
    await add(page, 'Controller'); await add(page, 'Validator'); await add(page, 'Repository');
    for (const source of [ids.datastore, ids.personOccurrence]) {
      await page.getByRole('button', { name: 'Include external participant', exact: true }).first().click();
      await page.getByLabel('External participant', { exact: true }).selectOption(source);
      await page.getByRole('button', { name: 'Include participant', exact: true }).click();
    }
    await save(page); const internals = repository.get(ids.child)!.components.filter(c => c.role === 'component');
    for (const [index, target] of [[0, internals[1].id], [1, internals[2].id]] as const) {
      await page.getByRole('button', { name: 'Connect', exact: true }).click();
      await page.getByLabel('From', { exact: true }).selectOption(internals[index].id); await page.getByLabel('To', { exact: true }).selectOption(target);
      await page.getByLabel('Interaction description', { exact: true }).fill(`Calls ${index + 1}`); await page.getByLabel('Protocol', { exact: true }).fill('HTTPS');
      await page.getByRole('button', { name: 'Connect components', exact: true }).click();
    }
    await save(page); const before = repository.get(ids.child)!;
    const node = page.locator(`.react-flow__node[data-id="${internals[0].id}"]`); await node.focus(); await page.keyboard.press('Enter'); await page.keyboard.press('ArrowRight');
    await expect(page.locator('.save-status')).toContainText('Unsaved');
    await page.getByRole('button', { name: 'Undo', exact: true }).click(); await save(page); expect(repository.get(ids.child)!.components[0].position).toEqual(before.components[0].position);
    await page.getByRole('button', { name: 'Redo', exact: true }).click(); await save(page); expect(repository.get(ids.child)!.components[0].position.x).toBeGreaterThan(before.components[0].position.x);
    const modeled = repository.get(ids.child)!;
    await page.getByRole('button', { name: 'Hide Details panel', exact: true }).click(); await page.getByRole('button', { name: 'Fit View', exact: true }).click();
    await page.screenshot({ path: 'test-results/component-modeling.png', fullPage: true });
    await page.getByRole('button', { name: /^Return to Payments, owner Payment API/ }).click();
    await page.getByRole('button', { name: 'Add component', exact: true }).first().click();
    await expect(page.getByRole('radio', { name: 'Application', exact: true })).toBeChecked(); await expect(page.getByRole('radio', { name: 'Datastore', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.locator(`.react-flow__node[data-id="${ids.application}"] .component-node`).click(); await page.getByRole('button', { name: 'Open component diagram', exact: true }).click();
    await expect(page.locator('#component-diagram-heading')).toBeVisible(); expect(repository.get(ids.child)).toEqual(modeled); expect(repository.get(ids.parent)).toEqual(parent);
    expect(modeled.components.filter(c => c.role === 'component')).toHaveLength(3); expect(modeled.relationships).toHaveLength(2);
    await expect(page.locator('.relationship-label').first()).toContainText('HTTPS');
  } finally { await app.close(); }
});
test('retains invalid fields and endpoints, provides keyboard sizing, and navigates to canonical sources with draft guard', async ({ page }) => {
  const { app, repository } = await harness(page);
  try {
    await page.getByRole('button', { name: 'Add component', exact: true }).first().click();
    await page.getByLabel('Component name', { exact: true }).fill(' Retained handler '); await page.getByLabel('Responsibilities', { exact: true }).fill(' '); await page.getByLabel('Technology', { exact: true }).fill('TS');
    await page.getByRole('button', { name: 'Add component', exact: true }).last().click(); await expect(page.getByLabel('Responsibilities', { exact: true })).toHaveAttribute('aria-invalid', 'true'); await expect(page.getByLabel('Component name', { exact: true })).toHaveValue(' Retained handler ');
    await page.getByLabel('Responsibilities', { exact: true }).fill('Handles requests'); await page.getByRole('button', { name: 'Add component', exact: true }).last().click();
    await save(page); const internal = repository.get(ids.child)!.components[0];
    await page.locator(`.react-flow__node[data-id="${internal.id}"] .component-node`).click();
    const width = page.getByLabel('Width', { exact: true }); await width.fill(String(internal.size.width + 100)); await page.getByRole('button', { name: 'Apply size', exact: true }).click(); await save(page); expect(repository.get(ids.child)!.components[0].size.width).toBe(internal.size.width + 100);
    await page.getByRole('button', { name: 'Include external participant', exact: true }).first().click(); await page.getByLabel('External participant', { exact: true }).selectOption(ids.personOccurrence); await page.getByRole('button', { name: 'Include participant', exact: true }).click(); await save(page);
    const occurrence = repository.get(ids.child)!.components[1]; await page.locator(`.react-flow__node[data-id="${occurrence.id}"] .component-node`).click();
    await expect(page.getByRole('button', { name: 'Edit source', exact: true })).toBeEnabled();
    await page.getByLabel('Width', { exact: true }).fill(String(occurrence.size.width + 20)); await page.getByRole('button', { name: 'Apply size', exact: true }).click();
    await page.getByRole('button', { name: 'Edit source', exact: true }).click(); await expect(page.getByRole('alertdialog')).toBeVisible(); await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(page.locator('#component-diagram-heading')).toBeVisible();
    await page.getByRole('button', { name: 'Edit source', exact: true }).click(); await page.getByRole('alertdialog').getByRole('button', { name: 'Discard and load', exact: true }).click(); await expect(page.locator('#diagram-heading')).toBeVisible(); await expect(page.getByLabel('Component name', { exact: true })).toHaveValue('Customer');
  } finally { await app.close(); }
});

test('retains invalid interactions, refreshes both source levels and preserves source/local geometry on failure', async ({ page }) => {
  const { app, repository } = await harness(page);
  try {
    await add(page, 'Handler');
    for (const source of [ids.datastore, ids.personOccurrence]) {
      await page.getByRole('button', { name: 'Include external participant', exact: true }).first().click(); await page.getByLabel('External participant', { exact: true }).selectOption(source); await page.getByRole('button', { name: 'Include participant', exact: true }).click();
    }
    await save(page); const modeled = repository.get(ids.child)!;
    await page.getByRole('button', { name: 'Connect', exact: true }).click();
    await page.getByLabel('From', { exact: true }).selectOption(modeled.components[1].id); await page.getByLabel('To', { exact: true }).selectOption(modeled.components[2].id);
    await page.getByLabel('Interaction description', { exact: true }).fill('Retained interaction'); await page.getByLabel('Protocol', { exact: true }).fill('HTTPS'); await page.getByRole('button', { name: 'Connect components', exact: true }).click();
    await expect(page.getByLabel('Diagram inspector').getByRole('alert').filter({ hasText: 'at least one internal component' })).toBeVisible(); await expect(page.getByLabel('Interaction description', { exact: true })).toHaveValue('Retained interaction'); expect(repository.get(ids.child)!.relationships).toEqual([]);
    await page.getByLabel('From', { exact: true }).selectOption(modeled.components[0].id); await page.getByRole('button', { name: 'Connect components', exact: true }).click(); await save(page);
    const before = repository.get(ids.child)!; const parent = repository.get(ids.parent)!; parent.components.find(c => c.id === ids.datastore)!.technology = 'SQLite'; repository.replace(parent);
    const context = repository.get(ids.context)!; context.components.find(c => c.id === ids.canonicalPerson)!.name = 'Current customer'; repository.replace(context);
    const parentAfter = repository.get(ids.parent)!; const contextAfter = repository.get(ids.context)!;
    await page.getByRole('button', { name: 'Refresh source details', exact: true }).click();
    await expect(page.locator(`.react-flow__node[data-id="${modeled.components[1].id}"]`)).toContainText('SQLite'); await expect(page.locator(`.react-flow__node[data-id="${modeled.components[2].id}"]`)).toContainText('Current customer');
    const supportingNode = page.locator(`.react-flow__node[data-id="${modeled.components[1].id}"]`); await supportingNode.focus(); await page.keyboard.press('Enter'); await page.keyboard.press('ArrowRight'); await save(page);
    expect(repository.get(ids.parent)).toEqual(parentAfter); expect(repository.get(ids.context)).toEqual(contextAfter);
    expect(repository.get(ids.child)!.relationships[0].id).toBe(before.relationships[0].id);
    expect(repository.get(ids.child)!.components[1].position.x).toBe(before.components[1].position.x + 5);
    await page.route(`**/api/diagrams/${ids.child}/component-context`, route => route.fulfill({ status: 503, json: { message: 'Source temporarily unavailable' } }), { times: 1 });
    await page.getByRole('button', { name: 'Refresh source details', exact: true }).click(); await expect(page.getByRole('alert').filter({ hasText: 'Source temporarily unavailable' })).toBeVisible();
    await expect(supportingNode).toContainText('SQLite'); await expect(page.locator('.save-status')).toContainText('Saved');
  } finally { await app.close(); }
});
