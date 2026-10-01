import { expect, test, type Page, type Route } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { diagramDocumentSchema } from '../../shared/src/index';
import { containerFixtureIds as ids, emptyChildFixture, groupedOwnerParentFixture, populatedChildFixture } from '../../shared/tests/container-fixtures';

const childIds: Record<string, string> = {
  [ids.owner]: '99000000-0000-4000-8000-000000000001',
  [ids.duplicateOwner]: '99000000-0000-4000-8000-000000000002',
  [ids.sourceSystem]: ids.populatedChild,
  '90000000-0000-4000-8000-000000000099': '99000000-0000-4000-8000-000000000004',
};

function makeParent() {
  const parent = groupedOwnerParentFixture() as any;
  parent.components = parent.components.map((component: any) => ({
    ...component,
    name: component.id === ids.owner || component.id === ids.duplicateOwner ? 'Payments' : component.name,
  }));
  return diagramDocumentSchema.parse(parent) as any;
}

function makeChild(parent: any, ownerId: string, id = childIds[ownerId] ?? randomUUID()) {
  const owner = parent.components.find((component: any) => component.id === ownerId);
  const base = emptyChildFixture() as any;
  return diagramDocumentSchema.parse({
    ...base,
    id,
    name: owner.name,
    scope: { parentDiagramId: parent.id, softwareSystemId: owner.id, parentDiagramName: parent.name, softwareSystemName: owner.name, softwareSystemDescription: owner.description },
  }) as any;
}

function makeSourceOccurrenceChild(parent: any) {
  const base = populatedChildFixture() as any;
  const childId = ids.populatedChild;
  const owner = parent.components.find((component: any) => component.id === ids.sourceSystem);
  const payment = parent.components.find((component: any) => component.id === ids.owner);
  return diagramDocumentSchema.parse({
    ...base,
    id: childId,
    name: owner.name,
    scope: { parentDiagramId: parent.id, softwareSystemId: owner.id, parentDiagramName: parent.name, softwareSystemName: owner.name, softwareSystemDescription: owner.description },
    components: base.components.map((component: any) => component.role === 'external'
      ? { ...component, diagramId: childId, name: payment.name, description: payment.description, type: payment.type, sourceComponentId: payment.id }
      : { ...component, diagramId: childId }),
    relationships: base.relationships.map((relationship: any) => ({ ...relationship, diagramId: childId })),
  }) as any;
}

async function mockContainerApi(page: Page, options: { failFirstChildLoad?: boolean; failFirstAvailability?: boolean; sourceOccurrence?: boolean } = {}) {
  let parent = makeParent();
  const children = new Map<string, any>();
  const allocatedChildIds = new Map<string, string>();
  let failFirstChildLoad = options.failFirstChildLoad ?? false;
  let failFirstAvailability = options.failFirstAvailability ?? false;
  if (options.sourceOccurrence) {
    const sourceChild = makeSourceOccurrenceChild(parent);
    children.set(ids.sourceSystem, sourceChild);
    children.set(ids.owner, makeChild(parent, ids.owner));
  }
  const activeSummaries = () => [parent, ...children.values()].map((document: any) => ({
    id: document.id, name: document.name, status: document.status, createdAt: document.createdAt, updatedAt: document.updatedAt,
    kind: document.kind, scope: document.scope,
  }));
  const fulfill = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const childId = (ownerId: string) => {
    let id = childIds[ownerId] ?? allocatedChildIds.get(ownerId);
    if (!id) { id = randomUUID(); allocatedChildIds.set(ownerId, id); }
    return id;
  };

  await page.route('**/api/diagrams', async route => {
    if (route.request().method() === 'GET') return fulfill(route, activeSummaries());
    return fulfill(route, { message: 'Unsupported diagram request.' }, 400);
  });
  await page.route('**/api/diagrams/**', async route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    const method = route.request().method();
    if (path === '/diagrams/trash') return fulfill(route, []);
    if (method === 'GET' && /^\/diagrams\/[^/]+\/adrs(?:\/full)?$/.test(path)) return fulfill(route, []);
    if (method === 'GET' && /^\/diagrams\/[^/]+\/component-adr-counts$/.test(path)) return fulfill(route, []);
    if (method === 'GET' && /^\/diagrams\/[^/]+\/(?:components\/[^/]+\/adrs|relationships\/[^/]+\/adrs)$/.test(path)) return fulfill(route, []);
    const entry = path.match(/^\/diagrams\/([^/]+)\/components\/([^/]+)\/container-diagram$/);
    if (entry) {
      const [, diagramId, componentId] = entry;
      const sourceDiagram = diagramId === parent.id ? parent : [...children.values()].find(document => document.id === diagramId);
      const selected = sourceDiagram?.components.find((component: any) => component.id === componentId);
      if (!sourceDiagram || !selected) return fulfill(route, { message: 'Component not found.' }, 404);
      const ownerId = selected.role === 'external' ? selected.sourceComponentId : selected.id;
      const owner = parent.components.find((component: any) => component.id === ownerId);
      if (!owner) return fulfill(route, { message: 'Owner not found.' }, 404);
      const existing = children.get(ownerId);
      if (method === 'GET' && failFirstAvailability) {
        failFirstAvailability = false;
        return fulfill(route, { message:'Temporary availability failure.' }, 503);
      }
      if (method === 'GET') return fulfill(route, { parentDiagramId: parent.id, softwareSystemId: ownerId, availability: existing ? existing.status === 'trashed' ? 'trashed' : 'active' : 'none', diagram: existing ? { id: existing.id, name: existing.name, status: existing.status, createdAt: existing.createdAt, updatedAt: existing.updatedAt, kind: existing.kind, scope: existing.scope } : null });
      if (method === 'POST') {
        const child = existing ?? makeChild(parent, ownerId, childId(ownerId));
        children.set(ownerId, child);
        return fulfill(route, child, existing ? 200 : 201);
      }
    }
    const diagramPath = path.match(/^\/diagrams\/([^/]+)$/);
    if (diagramPath) {
      const [, id] = diagramPath;
      const found = id === parent.id ? parent : [...children.values()].find(document => document.id === id);
      if (!found) return fulfill(route, { message: 'Diagram not found.' }, 404);
      if (method === 'GET') {
        if (found.kind === 'container' && failFirstChildLoad) {
          failFirstChildLoad = false;
          return fulfill(route, { message: 'Temporary child load failure.' }, 503);
        }
        return fulfill(route, found);
      }
      if (method === 'PUT') {
        const saved = diagramDocumentSchema.parse(JSON.parse(route.request().postData() ?? '{}'));
        if (id === parent.id) parent = saved as any;
        else {
          const ownerId = (saved as any).scope.softwareSystemId;
          children.set(ownerId, saved as any);
        }
        return fulfill(route, saved);
      }
    }
    return fulfill(route, { message: `No mock for ${method} ${path}` }, 404);
  });
  return { parent, children };
}

test('creates distinct empty children from grouped duplicate-name systems, keeps ordinary selection, and opens by keyboard action', async ({ page }) => {
  const mock = await mockContainerApi(page);
  await page.goto('/');
  await page.locator(`.saved-diagram-button[data-diagram-id="${ids.parentDiagram}"]`).click();

  const systems = page.getByRole('group', { name: 'Component Payments, Software System' });
  await systems.nth(0).click();
  const createAction = page.getByRole('button', { name: 'Create or open container diagram for Payments' });
  await expect(createAction).toBeEnabled();
  await createAction.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#container-diagram-heading')).toHaveText('Payments');
  await expect(page.locator('.container-empty-instruction')).toContainText('no containers yet');
  await expect(page.locator('.container-boundary-node')).toHaveAttribute('aria-label', 'Software System boundary for Payments');
  const firstChildId = mock.children.get(ids.owner)?.id;

  await page.locator(`.saved-diagram-button[data-diagram-id="${ids.parentDiagram}"]`).click();
  await expect(page.locator('.current-diagram')).toContainText('4 components');
  await systems.nth(0).click();
  await expect(page.locator('.container-entry-panel .primary-pill')).toHaveText('Open container diagram');
  await page.getByRole('button', { name: 'Create or open container diagram for Payments' }).click();
  await expect(page.locator('#container-diagram-heading')).toHaveText('Payments');
  expect(mock.children.get(ids.owner)?.id).toBe(firstChildId);
  expect(mock.children.size).toBe(1);

  await page.locator(`.saved-diagram-button[data-diagram-id="${ids.parentDiagram}"]`).click();
  await expect(page.locator('.current-diagram')).toContainText('4 components');
  await systems.nth(1).dblclick();
  await expect(page.locator('#container-diagram-heading')).toHaveText('Payments');
  expect(mock.children.get(ids.duplicateOwner)?.id).not.toBe(firstChildId);
  expect(mock.children.size).toBe(2);

  await page.locator(`.saved-diagram-button[data-diagram-id="${ids.parentDiagram}"]`).click();
  await expect(page.locator('.current-diagram')).toContainText('4 components');
  await page.getByRole('group', { name: 'Component Customer, Person' }).click();
  await expect(page.getByLabel('Container diagram action')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Select at least two Software System components' })).toBeDisabled();
});

test('keeps the parent visible when child loading fails and retry opens the already-created child', async ({ page }) => {
  const mock = await mockContainerApi(page, { failFirstChildLoad: true });
  await page.goto('/');
  await page.locator(`.saved-diagram-button[data-diagram-id="${ids.parentDiagram}"]`).click();
  await page.getByRole('group', { name: 'Component Payments, Software System' }).nth(0).dblclick();
  await expect(page.locator('.container-entry-feedback').filter({ hasText: 'Temporary child load failure.' })).toBeVisible();
  await expect(page.locator(`.saved-diagram-button[data-diagram-id="${ids.parentDiagram}"]`)).toHaveAttribute('aria-current', 'true');
  expect(mock.children.size).toBe(1);
  await page.getByLabel('Container diagram action').getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('#container-diagram-heading')).toHaveText('Payments');
  expect(mock.children.size).toBe(1);
});

test('reports an availability failure without creating a child and retries the read', async ({ page }) => {
  const mock = await mockContainerApi(page, { failFirstAvailability: true });
  await page.goto('/');
  await page.locator(`.saved-diagram-button[data-diagram-id="${ids.parentDiagram}"]`).click();
  await page.getByRole('group', { name: 'Component Payments, Software System' }).nth(0).click();
  const panel = page.getByLabel('Container diagram action');
  await expect(panel).toContainText('Container availability could not be checked.');
  expect(mock.children.size).toBe(0);
  await panel.getByRole('button', { name:'Retry', exact:true }).click();
  await expect(panel.locator('.primary-pill')).toBeEnabled();
  await expect(panel.locator('.primary-pill')).toHaveText('Create container diagram');
  await panel.getByRole('button', { name:'Create or open container diagram for Payments' }).click();
  await expect(page.locator('#container-diagram-heading')).toHaveText('Payments');
  expect(mock.children.size).toBe(1);
});

test('guards an unsaved owner with Save, Discard, and Cancel and rejects an owner removed by discard', async ({ page }) => {
  const mock = await mockContainerApi(page);
  await page.goto('/');
  await page.locator(`.saved-diagram-button[data-diagram-id="${ids.parentDiagram}"]`).click();
  await page.getByRole('button', { name: 'Add component' }).click();
  let inspector = page.getByLabel('Diagram inspector');
  await inspector.getByLabel('Component name').fill('Draft system');
  await inspector.getByRole('button', { name: 'Add component' }).click();
  await page.getByRole('group', { name: 'Component Draft system, Software System' }).click();
  await page.getByRole('button', { name: 'Create or open container diagram for Draft system' }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(mock.children.size).toBe(0);

  await page.getByRole('group', { name: 'Component Draft system, Software System' }).click();
  await page.getByRole('button', { name: 'Create or open container diagram for Draft system' }).click();
  await page.getByRole('button', { name: 'Save and open' }).click();
  await expect(page.locator('#container-diagram-heading')).toHaveText('Draft system');
  expect(mock.children.size).toBe(1);

  await page.locator(`.saved-diagram-button[data-diagram-id="${ids.parentDiagram}"]`).click();
  await page.getByRole('button', { name: 'Add component' }).click();
  inspector = page.getByLabel('Diagram inspector');
  await inspector.getByLabel('Component name').fill('Discarded system');
  await inspector.getByRole('button', { name: 'Add component' }).click();
  await page.getByRole('group', { name: 'Component Discarded system, Software System' }).click();
  await page.getByRole('button', { name: 'Create or open container diagram for Discarded system' }).click();
  await page.getByRole('button', { name: 'Discard and open' }).click();
  await expect(page.locator('.container-navigation-feedback').filter({ hasText: 'only present in the discarded draft' })).toBeVisible();
  expect(mock.children.size).toBe(1);
});

test('opens an external Software System occurrence through its canonical source owner', async ({ page }) => {
  const mock = await mockContainerApi(page, { sourceOccurrence: true });
  await page.goto('/');
  await page.locator(`.saved-diagram-button[data-diagram-id="${ids.populatedChild}"]`).click();
  await page.getByRole('group', { name: 'Component Payments, Software System' }).click();
  const openAction = page.getByRole('button', { name: 'Create or open container diagram for Payments' });
  await expect(openAction).toBeEnabled();
  await openAction.click();
  await expect(page.locator('#container-diagram-heading')).toHaveText('Payments');
  expect(mock.children.get(ids.owner)?.id).toBe(childIds[ids.owner]);
  expect(mock.children.size).toBe(2);
});

test('keeps a dirty ADR in the current diagram until the container-navigation guard is resolved', async ({ page }) => {
  const mock = await mockContainerApi(page);
  await page.goto('/');
  await page.locator(`.saved-diagram-button[data-diagram-id="${ids.parentDiagram}"]`).click();
  await page.getByRole('button', { name: 'Decision', exact: true }).click();
  await page.getByLabel('Title required').fill('Keep the decision draft');
  await page.getByLabel('Context required').fill('This ADR is not saved yet.');
  await page.getByLabel('Decision required').fill('Keep editing in the current diagram until navigation is confirmed.');
  await page.getByLabel('Consequences required').fill('The draft stays local until it is saved.');
  await page.getByRole('group', { name: 'Component Payments, Software System' }).nth(0).click();
  const action = page.getByRole('button', { name: 'Create or open container diagram for Payments' });
  await expect(action).toBeEnabled();
  await action.click();
  await expect(page.getByRole('alertdialog')).toContainText('Save both before opening');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.current-diagram')).toContainText('Payments architecture');
  expect(mock.children.size).toBe(0);
  await page.getByRole('button', { name: 'Decision', exact: true }).click();
  await expect(page.getByLabel('Title required')).toHaveValue('Keep the decision draft');
});
