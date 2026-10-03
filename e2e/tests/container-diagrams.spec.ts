import { expect, test, type Page, type Route } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { calculateGroupBounds, diagramDocumentSchema } from '../../shared/src/index';
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

async function mockContainerApi(page: Page, options: { failFirstChildLoad?: boolean; failFirstAvailability?: boolean; sourceOccurrence?: boolean; duplicateParent?: boolean } = {}) {
  let parent = makeParent();
  const children = new Map<string, any>();
  const allocatedChildIds = new Map<string, string>();
  let failFirstChildLoad = options.failFirstChildLoad ?? false;
  let failFirstAvailability = options.failFirstAvailability ?? false;
  let failNextSave = false;
  const savedPaths: string[] = [];
  const adrs = new Map<string, any>();
  const extraParents = new Map<string, any>();
  if (options.duplicateParent) {
    const otherParent = { ...makeParent(), id: randomUUID(), components: [] as any[], relationships: [], groups: [] };
    const owner = { ...parent.components[0], id: randomUUID(), diagramId: otherParent.id };
    otherParent.components = [owner]; extraParents.set(otherParent.id, otherParent);
    children.set(ids.owner, { ...makeChild(parent, ids.owner), name: 'Runtime' });
    children.set(owner.id, { ...makeChild(otherParent, owner.id), name: 'Runtime' });
  }
  const sourceParent = (child: any) => child.scope.parentDiagramId === parent.id ? parent : extraParents.get(child.scope.parentDiagramId);
  const resolved = (document: any) => {
    if (document.kind !== 'container') return document;
    const p = sourceParent(document), owner = p.components.find((c: any) => c.id === document.scope.softwareSystemId);
    return { ...document, scope: { ...document.scope, parentDiagramName: p.name, softwareSystemName: owner.name, softwareSystemDescription: owner.description }, components: document.components.map((c: any) => { const source = p.components.find((s: any) => s.id === c.sourceComponentId); return c.role === 'external' && source ? { ...c, name: source.name, description: source.description, type: source.type } : c; }) };
  };
  if (options.sourceOccurrence) {
    const sourceChild = makeSourceOccurrenceChild(parent);
    children.set(ids.sourceSystem, sourceChild);
    children.set(ids.owner, makeChild(parent, ids.owner));
  }
  const activeSummaries = () => [parent, ...extraParents.values(), ...children.values()].map(resolved).map((document: any) => ({
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
    const adrPath = path.match(/^\/diagrams\/([^/]+)\/adrs(?:\/full)?$/);
    if (adrPath && method === 'GET') return fulfill(route, [...adrs.values()].filter(adr => adr.diagramId === adrPath[1]));
    if (adrPath && method === 'POST') {
      const adr = { ...route.request().postDataJSON(), id: randomUUID(), diagramId: adrPath[1], componentIds: [], relationshipIds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      adrs.set(adr.id, adr); return fulfill(route, adr, 201);
    }
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
    const contextPath = path.match(/^\/diagrams\/([^/]+)\/container-context$/);
    if (contextPath) {
      const child=[...children.values()].find(d=>d.id===contextPath[1]);
      return fulfill(route,{scope:resolved(child).scope,sources:sourceParent(child).components.filter((c:any)=>c.id!==child.scope.softwareSystemId).map((c:any)=>({id:c.id,name:c.name,description:c.description,type:c.type})),capturedAt:new Date().toISOString()});
    }
    const diagramPath = path.match(/^\/diagrams\/([^/]+)$/);
    if (diagramPath) {
      const [, id] = diagramPath;
      const found = id === parent.id ? parent : extraParents.get(id) ?? [...children.values()].find(document => document.id === id);
      if (!found) return fulfill(route, { message: 'Diagram not found.' }, 404);
      if (method === 'GET') {
        if (found.kind === 'container' && failFirstChildLoad) {
          failFirstChildLoad = false;
          return fulfill(route, { message: 'Temporary child load failure.' }, 503);
        }
        return fulfill(route, resolved(found));
      }
      if (method === 'PUT') {
        savedPaths.push(id);
        if (failNextSave) { failNextSave = false; return fulfill(route, { message: 'Temporary save failure.' }, 503); }
        const saved = diagramDocumentSchema.parse(JSON.parse(route.request().postData() ?? '{}'));
        if (id === parent.id) parent = saved as any;
        else if (extraParents.has(id)) extraParents.set(id, saved);
        else {
          const ownerId = (saved as any).scope.softwareSystemId;
          children.set(ownerId, saved as any);
        }
        return fulfill(route, resolved(saved));
      }
    }
    return fulfill(route, { message: `No mock for ${method} ${path}` }, 404);
  });
  return { get parent() { return parent; }, children, extraParents, savedPaths, adrs, failSave: () => { failNextSave = true; } };
}

test('keeps a named child under its parent across repeated saves, guarded return, refresh and failed-save retry', async ({ page }) => {
  test.setTimeout(60_000);
  const mock = await mockContainerApi(page, { sourceOccurrence: true });
  const beforeParent = structuredClone(mock.parent);
  const child = mock.children.get(ids.sourceSystem);
  await page.goto('/'); await page.locator(`.saved-diagram-button[data-diagram-id="${child.id}"]`).click();
  await page.getByLabel('Diagram name', { exact: true }).fill('Ledger runtime');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator(`.saved-diagram-children .saved-diagram-button[data-diagram-id="${child.id}"]`)).toContainText('Ledger runtime');
  await page.getByLabel('Diagram name', { exact: true }).fill('Ledger runtime two');
  mock.failSave(); await page.getByRole('button', { name: /Return to .*Payments architecture/ }).click();
  await page.getByRole('button', { name: 'Save and load', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Temporary save failure' }).first()).toBeVisible();
  await expect(page.getByLabel('Diagram name', { exact: true })).toHaveValue('Ledger runtime two');
  await page.getByRole('button', { name: 'Save and load', exact: true }).click();
  await expect(page.locator('#diagram-heading')).toHaveText('Payments architecture');
  await expect(page.locator('#diagram-heading')).toBeFocused();
  await expect(page.locator(`.react-flow__node[data-id="${ids.sourceSystem}"] .component-node`)).toHaveClass(/is-selected/);
  expect(mock.parent).toEqual(beforeParent); expect(mock.savedPaths).toEqual([child.id, child.id, child.id]);
  await page.reload(); await page.locator(`.saved-diagram-button[data-diagram-id="${child.id}"]`).click();
  await expect(page.getByLabel('Diagram name', { exact: true })).toHaveValue('Ledger runtime two');
  expect(mock.children.get(ids.sourceSystem).scope.parentDiagramId).toBe(ids.parentDiagram);
  await page.getByLabel('Diagram name', { exact: true }).fill('Canceled draft');
  await page.getByRole('button', { name: /Return to .*Payments architecture/ }).click(); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByLabel('Diagram name', { exact: true })).toHaveValue('Canceled draft');
  await page.getByRole('button', { name: /Return to .*Payments architecture/ }).click(); await page.getByRole('button', { name: 'Discard and load', exact: true }).click();
  await expect(page.locator('#diagram-heading')).toHaveText('Payments architecture');
  expect(mock.children.get(ids.sourceSystem).name).toBe('Ledger runtime two');
});

test('groups identically named children by parent UUID and counts own-field filter matches only', async ({ page }) => {
  const mock = await mockContainerApi(page, { duplicateParent: true }); await page.goto('/');
  const children = [...mock.children.values()];
  await expect(page.locator('.saved-diagram-group')).toHaveCount(2);
  for (const child of children) await expect(page.locator(`.saved-diagram-group[data-parent-diagram-id="${child.scope.parentDiagramId}"] .saved-diagram-children`)).toContainText('Runtime');
  await page.getByLabel('Filter diagrams by name').fill('runtime');
  await expect(page.locator('#saved-diagrams-filter-status')).toHaveText('2 of 4 diagrams match the filters.');
  await expect(page.locator('.saved-diagram-parent-context')).toHaveCount(2);
  await page.getByLabel('Sort diagrams by').selectOption('name'); await page.getByLabel('Sort direction').selectOption('ascending');
  const first = page.locator(`.saved-diagram-button[data-diagram-id="${children[0].id}"]`); await first.focus(); await page.keyboard.press('Enter');
  await expect(first).toHaveAttribute('aria-current', 'true');
  await page.getByLabel('Diagram name', { exact: true }).fill('Runtime renamed'); await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator(`.saved-diagram-button[data-diagram-id="${children[0].id}"]`)).toHaveCount(1);
  const deleteAction = page.locator('.saved-diagram-row').filter({ has: page.locator(`.saved-diagram-button[data-diagram-id="${children[0].id}"]`) }).getByRole('button', { name: /^Delete Runtime renamed,/ });
  await deleteAction.focus(); await page.keyboard.press('Enter'); await expect(page.getByRole('alertdialog')).toContainText('Delete "Runtime renamed"?');
  await page.keyboard.press('Escape'); await expect(deleteAction).toBeFocused(); expect(mock.children.size).toBe(2);
  await page.getByLabel('Filter diagrams by name').fill('payments architecture');
  await expect(page.locator('#saved-diagrams-filter-status')).toHaveText('2 of 4 diagrams match the filters.'); await expect(page.locator('.saved-diagram-children')).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click(); await expect(page.locator('.saved-diagram-children')).toHaveCount(2);
  await page.screenshot({ path: 'test-results/container-library.png' });
  await page.getByLabel('Created from', { exact: true }).fill('2026-01-02'); await page.getByLabel('Created to', { exact: true }).fill('2026-01-01'); await expect(page.locator('#saved-diagrams-filter-status')).toContainText('End date must be');
});

test('refreshes source names independently of local edits and guards a dirty ADR before library and new navigation', async ({ page }) => {
  const mock = await mockContainerApi(page, { sourceOccurrence: true }); await page.goto('/');
  await page.locator(`.saved-diagram-button[data-diagram-id="${ids.populatedChild}"]`).click();
  await page.getByLabel('Diagram name', { exact: true }).fill('Own runtime name');
  mock.parent.name = 'Renamed overview'; mock.parent.components.find((c: any) => c.id === ids.sourceSystem).name = 'Renamed owner'; mock.parent.components.find((c: any) => c.id === ids.owner).name = 'Renamed source';
  const regroupedIds = [ids.owner, ids.duplicateOwner];
  mock.parent.groups = [{ ...mock.parent.groups[0], name: 'Regrouped systems', memberComponentIds: regroupedIds, ...calculateGroupBounds(mock.parent.components.filter((c: any) => regroupedIds.includes(c.id))) }];
  await page.getByRole('button', { name: 'Refresh source details', exact: true }).click();
  await expect(page.locator('#container-diagram-heading')).toHaveText('Renamed owner'); await expect(page.getByRole('group', { name: 'Component Renamed source, Software System' })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await expect(page.getByLabel('Diagram name', { exact: true })).toHaveValue('Ledger'); await expect(page.locator('#container-diagram-heading')).toHaveText('Renamed owner');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const savedChild = structuredClone(mock.children.get(ids.sourceSystem));
  await page.getByRole('button', { name: /Return to Renamed overview/ }).click();
  await expect(page.locator('#diagram-heading')).toHaveText('Renamed overview');
  await expect(page.locator(`.react-flow__node[data-id="${ids.group}"]`)).toContainText('Regrouped systems');
  await page.locator(`.saved-diagram-button[data-diagram-id="${ids.populatedChild}"]`).click();
  await expect(page.locator('#container-diagram-heading')).toHaveText('Renamed owner');
  expect(mock.children.get(ids.sourceSystem)).toEqual(savedChild);
  await page.getByRole('button', { name: 'Decision', exact: true }).click(); await page.getByLabel('Title required').fill('Unsaved decision');
  await page.locator(`.saved-diagram-button[data-diagram-id="${ids.parentDiagram}"]`).click(); await expect(page.getByRole('alertdialog')).toBeVisible(); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByLabel('Title required')).toHaveValue('Unsaved decision');
  await page.getByRole('button', { name: 'New diagram', exact: true }).click(); await expect(page.getByRole('alertdialog')).toContainText('decision'); await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(page.getByLabel('Title required')).toHaveValue('Unsaved decision');
});

test('saves both child and decision before navigation and discards both only after a successful load', async ({ page }) => {
  const mock = await mockContainerApi(page, { sourceOccurrence: true });
  await page.goto('/'); await page.locator(`.saved-diagram-button[data-diagram-id="${ids.populatedChild}"]`).click();
  await page.getByLabel('Diagram name', { exact: true }).fill('Child and decision');
  await page.getByRole('button', { name: 'Decision', exact: true }).click();
  for (const [label, value] of [['Title required', 'Keep the decision'], ['Context required', 'Scope context'], ['Decision required', 'Use a boundary'], ['Consequences required', 'Stable scope']]) await page.getByLabel(label, { exact: true }).fill(value);
  await page.locator(`.saved-diagram-button[data-diagram-id="${ids.parentDiagram}"]`).click(); await page.getByRole('button', { name: 'Save and load', exact: true }).click();
  await expect(page.locator('#diagram-heading')).toHaveText('Payments architecture');
  expect(mock.children.get(ids.sourceSystem).name).toBe('Child and decision'); expect([...mock.adrs.values()]).toEqual([expect.objectContaining({ diagramId: ids.populatedChild, title: 'Keep the decision' })]);
  await page.locator(`.saved-diagram-button[data-diagram-id="${ids.populatedChild}"]`).click();
  await page.getByLabel('Diagram name', { exact: true }).fill('Discarded diagram'); await page.getByRole('button', { name: 'Decision', exact: true }).click(); await page.getByLabel('Title required', { exact: true }).fill('Discarded ADR');
  await page.getByRole('button', { name: /Return to .*Payments architecture/ }).click(); await page.getByRole('button', { name: 'Discard and load', exact: true }).click();
  await expect(page.locator('#diagram-heading')).toHaveText('Payments architecture');
  expect(mock.children.get(ids.sourceSystem).name).toBe('Child and decision'); expect(mock.adrs.size).toBe(1);
  await page.getByRole('button', { name: 'Decision', exact: true }).click(); await expect(page.getByLabel('Title required', { exact: true })).toHaveValue('');
});

test('re-guards a decision edited during a slow parent load and retains the current child', async ({ page }) => {
  await mockContainerApi(page, { sourceOccurrence: true }); await page.goto('/');
  await page.locator(`.saved-diagram-button[data-diagram-id="${ids.populatedChild}"]`).click();
  await page.getByRole('button', { name: 'Decision', exact: true }).click();
  await expect(page.getByText('No decisions yet. Create one to capture the reasoning behind this diagram.')).toBeVisible();
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  let requested = false;
  await page.route(`**/api/diagrams/${ids.parentDiagram}`, async route => { requested = true; await gate; await route.fallback(); });
  await page.getByRole('button', { name: /Return to .*Payments architecture/ }).click(); await expect.poll(() => requested).toBe(true);
  await page.getByLabel('Title required', { exact: true }).fill('Edited during load'); release();
  await expect(page.getByRole('alertdialog')).toBeVisible(); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByLabel('Title required', { exact: true })).toHaveValue('Edited during load'); await expect(page.locator('#container-diagram-heading')).toHaveText('Ledger');
});

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

test('authors two container subtypes and external interactions with atomic history and saved identity',async({page})=>{
  test.setTimeout(60_000);
  const mock=await mockContainerApi(page);
  const originalParent=structuredClone(mock.parent);
  await page.goto('/');await page.locator(`.saved-diagram-button[data-diagram-id="${ids.parentDiagram}"]`).click();
  await page.getByRole('button',{name:'Add component',exact:true}).click();
  await page.getByRole('radio',{name:/^Person /}).check();
  await page.locator(`.saved-diagram-button[data-diagram-id="${ids.parentDiagram}"]`).click();
  await page.getByRole('group',{name:'Component Payments, Software System'}).nth(0).dblclick();
  await expect(page.locator('#container-diagram-heading')).toHaveText('Payments');
  for(const [name,subtype,technology] of [['Web app','Application','React'],['Service','Application','TypeScript'],['Ledger DB','Datastore','PostgreSQL']]){
    await page.getByRole('button',{name:'Add component',exact:true}).click();const inspector=page.getByLabel('Diagram inspector');
    await expect(inspector.getByRole('radio')).toHaveCount(2);await inspector.getByLabel(subtype,{exact:true}).check();await inspector.getByLabel('Component name',{exact:true}).fill(name);await inspector.getByLabel('Responsibilities',{exact:true}).fill(`Responsibilities for ${name}`);await inspector.getByLabel('Technology',{exact:true}).fill(technology);await inspector.getByRole('button',{name:'Add component',exact:true}).click();
  }
  await page.getByRole('button',{name:'Include external participant',exact:true}).click();
  await page.getByLabel('External participant',{exact:true}).selectOption(ids.person);await page.getByLabel('Diagram inspector').getByRole('button',{name:'Include participant',exact:true}).click();
  await page.getByRole('group',{name:'Component Customer, Person'}).click();await expect(page.getByLabel('External participant details')).toContainText('Source details are read-only');await expect(page.getByLabel('Diagram inspector').getByRole('radio')).toHaveCount(0);
  await page.getByRole('button',{name:'Include external participant',exact:true}).click();await expect(page.locator(`#external-participant option[value="${ids.person}"]`)).toBeDisabled();await page.getByLabel('External participant',{exact:true}).selectOption(ids.sourceSystem);await page.getByLabel('Diagram inspector').getByRole('button',{name:'Include participant',exact:true}).click();
  await page.getByRole('button',{name:'Connect',exact:true}).click();const inspector=page.getByLabel('Diagram inspector');await inspector.getByLabel('From',{exact:true}).selectOption({label:'Web app'});await inspector.getByLabel('To',{exact:true}).selectOption({label:'Ledger DB'});await inspector.getByLabel('Interaction description',{exact:true}).fill('Stores data');await inspector.getByLabel('Protocol',{exact:true}).fill('SQL');await inspector.getByRole('button',{name:'Connect components',exact:true}).click();
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.getByText('Saved',{exact:true}).first()).toBeVisible();
  const saved=mock.children.get(ids.owner);expect(saved.components.map((c:any)=>c.containerType)).toEqual(['application','application','datastore',null,null]);expect(saved.relationships[0].protocol).toBe('SQL');expect(mock.parent).toEqual(originalParent);
  await page.getByRole('group',{name:'Component Ledger DB, Datastore'}).click();await page.getByLabel('Application',{exact:true}).check();await inspector.getByRole('button',{name:'Save component',exact:true}).click();await expect(page.getByRole('group',{name:'Component Ledger DB, Application'})).toBeVisible();await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByRole('group',{name:'Component Ledger DB, Datastore'})).toBeVisible();await page.getByRole('button',{name:'Redo',exact:true}).click();await expect(page.getByRole('group',{name:'Component Ledger DB, Application'})).toBeVisible();
  await page.getByRole('button',{name:'Save',exact:true}).click();await page.locator(`.saved-diagram-button[data-diagram-id="${ids.parentDiagram}"]`).click();await page.locator(`.saved-diagram-button[data-diagram-id="${saved.id}"]`).click();await page.getByRole('group',{name:'Component Ledger DB, Application'}).click();await expect(page.getByLabel('Application',{exact:true})).toBeChecked();expect(mock.children.get(ids.owner).id).toBe(saved.id);expect(mock.parent).toEqual(originalParent);
});

test('persists keyboard and pointer geometry, rejects external overlap, and undoes boundary displacement in one step',async({page})=>{
  test.setTimeout(60_000);
  await page.setViewportSize({width:1600,height:1000});
  const mock=await mockContainerApi(page,{sourceOccurrence:true});await page.goto('/');await page.locator(`.saved-diagram-button[data-diagram-id="${ids.populatedChild}"]`).click();
  const before=structuredClone(mock.children.get(ids.sourceSystem));
  const internal=page.locator(`.react-flow__node[data-id="${ids.container}"]`);
  await internal.focus();await page.keyboard.press('Enter');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect.poll(()=>mock.children.get(ids.sourceSystem).components[0].position.x).toBe(before.components[0].position.x+10);
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await page.getByRole('button',{name:'Save',exact:true}).click();await expect.poll(()=>mock.children.get(ids.sourceSystem).components[0].position.x).toBe(before.components[0].position.x);
  const box=(await internal.boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+270,box.y+box.height/2,{steps:12});await page.mouse.up();
  await page.getByRole('button',{name:'Save',exact:true}).click();await expect.poll(()=>mock.children.get(ids.sourceSystem).components[1].position.x).not.toBe(before.components[1].position.x);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await page.getByRole('button',{name:'Save',exact:true}).click();await expect.poll(()=>mock.children.get(ids.sourceSystem).components[1].position.x).toBe(before.components[1].position.x);
  await page.getByRole('button',{name:'Hide Details panel',exact:true}).click();await page.getByRole('button',{name:'Fit View',exact:true}).click();
  const ext=page.locator(`.react-flow__node[data-id="${ids.externalOccurrence}"]`),extBox=(await ext.boundingBox())!,intBox=(await internal.boundingBox())!;
  await page.mouse.move(extBox.x+extBox.width/2,extBox.y+extBox.height/2);await page.mouse.down();await page.mouse.move(intBox.x+intBox.width/2,intBox.y+intBox.height/2,{steps:12});await page.mouse.up();
  await expect(page.getByRole('alert').filter({hasText:'clearance'})).toBeVisible();await page.getByRole('button',{name:'Save',exact:true}).click();await expect.poll(()=>mock.children.get(ids.sourceSystem).components[1].position.x).toBe(before.components[1].position.x);
});

test('resizes containers atomically and keeps complete long metadata inside the card',async({page})=>{
  test.setTimeout(60_000);await page.setViewportSize({width:1600,height:1000});
  const mock=await mockContainerApi(page,{sourceOccurrence:true});await page.goto('/');await page.locator(`.saved-diagram-button[data-diagram-id="${ids.populatedChild}"]`).click();
  await page.getByRole('group',{name:'Component Payment API, Application'}).click();const inspector=page.getByLabel('Diagram inspector');
  const responsibilities='Handles requests, validates payment details and records the result. '.repeat(6);const technology='TypeScript and PostgreSQL with transactional request processing and stable identifiers';
  await inspector.getByLabel('Responsibilities',{exact:true}).fill(responsibilities);await inspector.getByLabel('Technology',{exact:true}).fill(technology);await inspector.getByRole('button',{name:'Save component',exact:true}).click();
  const card=page.getByRole('group',{name:'Component Payment API, Application'});
  await expect(card.locator('.component-responsibility')).toHaveText(responsibilities.trim());await expect(card.locator('.component-technology')).toContainText(technology);
  const contentBounds=await card.evaluate(el=>({cardBottom:el.getBoundingClientRect().bottom,textBottom:el.querySelector('.component-technology')!.getBoundingClientRect().bottom}));
  expect(contentBounds.textBottom).toBeLessThanOrEqual(contentBounds.cardBottom-4);
  await page.getByRole('button',{name:'Save',exact:true}).click();const before=structuredClone(mock.children.get(ids.sourceSystem));
  await page.getByRole('button',{name:'Hide Details panel',exact:true}).click();await page.getByRole('button',{name:'Fit View',exact:true}).click();
  const handle=page.locator(`.react-flow__node[data-id="${ids.container}"] .react-flow__resize-control.bottom.right.handle`);await expect(handle).toBeVisible();const box=(await handle.boundingBox())!;
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+100,box.y+box.height/2+20,{steps:10});await page.mouse.up();
  await page.getByRole('button',{name:'Save',exact:true}).click();await expect.poll(()=>mock.children.get(ids.sourceSystem).components[0].size.width).toBeGreaterThan(before.components[0].size.width);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await page.getByRole('button',{name:'Save',exact:true}).click();await expect.poll(()=>mock.children.get(ids.sourceSystem).components[0].size.width).toBe(before.components[0].size.width);await expect.poll(()=>mock.children.get(ids.sourceSystem).boundary).toEqual(before.boundary);
  await page.screenshot({path:'test-results/container-metadata.png'});
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
