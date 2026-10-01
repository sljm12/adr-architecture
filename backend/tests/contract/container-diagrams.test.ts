import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import { DiagramRepository } from '../../src/persistence/diagram-repository';
import { containerFixtureIds as ids, emptyChildFixture, generalParentFixture, populatedChildFixture } from '../../../shared/tests/container-fixtures';

const activeApps: Array<{ close: () => Promise<void> }> = [];
const makeApp = (...documents: any[]) => {
  const repository = new DiagramRepository();
  documents.forEach(document => repository.create(document));
  const app = buildApp(repository);
  activeApps.push(app);
  return { app, repository };
};

afterEach(async () => { await Promise.all(activeApps.splice(0).map(app => app.close())); });

describe('container diagram create-or-open contract', () => {
  it('returns read-only availability and creates one complete empty child on POST', async () => {
    const { app, repository } = makeApp(generalParentFixture());
    const path = `/diagrams/${ids.parentDiagram}/components/${ids.owner}/container-diagram`;

    const firstAvailability = await app.inject({ method:'GET', url:path });
    expect(firstAvailability.statusCode).toBe(200);
    expect(firstAvailability.json()).toMatchObject({ parentDiagramId:ids.parentDiagram, softwareSystemId:ids.owner, availability:'none', diagram:null });
    expect(repository.list()).toHaveLength(1);

    const created = await app.inject({ method:'POST', url:path });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ kind:'container', name:'Payments', components:[], relationships:[], groups:[], boundary:{ position:{x:0,y:0}, size:{width:480,height:320} }, scope:{ parentDiagramId:ids.parentDiagram, softwareSystemId:ids.owner } });
    const repeated = await app.inject({ method:'POST', url:path });
    expect(repeated.statusCode).toBe(200);
    expect(repeated.json().id).toBe(created.json().id);
    expect((await app.inject({ method:'GET', url:path })).json()).toMatchObject({ availability:'active', diagram:{ id:created.json().id } });
  });

  it('keeps duplicate labels separate and rejects ineligible or mismatched path artifacts', async () => {
    const parent = generalParentFixture() as any;
    const otherParentId = '95000000-0000-4000-8000-000000000001';
    const otherParent = { ...parent, id:otherParentId, name:'Second parent', components:parent.components.map((component:any,index:number) => ({ ...component, id:`95000000-0000-4000-8000-${String(index + 2).padStart(12,'0')}`, diagramId:otherParentId })), relationships:[], groups:[] };
    const { app } = makeApp(parent, otherParent);
    const first = await app.inject({ method:'POST', url:`/diagrams/${parent.id}/components/${ids.owner}/container-diagram` });
    const duplicateName = await app.inject({ method:'POST', url:`/diagrams/${parent.id}/components/${ids.duplicateOwner}/container-diagram` });
    expect(first.statusCode).toBe(201);
    expect(duplicateName.statusCode).toBe(201);
    expect(first.json().id).not.toBe(duplicateName.json().id);

    const person = await app.inject({ method:'GET', url:`/diagrams/${parent.id}/components/${ids.person}/container-diagram` });
    expect(person.statusCode).toBe(422);
    expect(person.json()).toMatchObject({ fields:{ componentId:expect.any(String) } });
    const mismatch = await app.inject({ method:'GET', url:`/diagrams/${otherParent.id}/components/${ids.owner}/container-diagram` });
    expect(mismatch.statusCode).toBe(404);
  });

  it('canonicalizes an external Software System occurrence to its source owner', async () => {
    const parent = generalParentFixture();
    const occurrenceDiagram = populatedChildFixture();
    const { app } = makeApp(parent, occurrenceDiagram);
    const response = await app.inject({ method:'POST', url:`/diagrams/${occurrenceDiagram.id}/components/${ids.externalOccurrence}/container-diagram` });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ scope:{ parentDiagramId:ids.parentDiagram, softwareSystemId:ids.sourceSystem, softwareSystemName:'Ledger' }, name:'Ledger' });
  });

  it('returns RESTORE_REQUIRED for an existing trashed canonical child and rejects inactive parents', async () => {
    const parent = generalParentFixture();
    const child = emptyChildFixture() as any;
    child.status = 'trashed';
    child.trashedAt = child.updatedAt;
    const { app, repository } = makeApp(parent, child);
    const path = `/diagrams/${ids.parentDiagram}/components/${ids.owner}/container-diagram`;
    const restoreRequired = await app.inject({ method:'POST', url:path });
    expect(restoreRequired.statusCode).toBe(409);
    expect(restoreRequired.json()).toMatchObject({ code:'RESTORE_REQUIRED', diagram:{ id:ids.emptyChild, status:'trashed' } });
    await repository.trash(ids.parentDiagram);
    const inactive = await app.inject({ method:'GET', url:path });
    expect(inactive.statusCode).toBe(409);
    expect(inactive.json()).toMatchObject({ code:'PARENT_INACTIVE' });
  });
});
