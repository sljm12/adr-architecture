import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import { AdrRepository } from '../../src/persistence/adr-repository';
import { DiagramRepository } from '../../src/persistence/diagram-repository';
import { completeAdrPayload } from '../fixtures';
import { containerFixtureIds as ids, generalParentFixture, populatedChildFixture } from '../../../shared/tests/container-fixtures';

const apps: Array<{ close: () => Promise<void> }> = [];
const createApp = (parentInput:any = generalParentFixture(), childInput:any = populatedChildFixture(), adrs = new AdrRepository()) => {
  const repository = new DiagramRepository();
  repository.create(parentInput);
  if (childInput) repository.create(childInput);
  const app = buildApp(repository, adrs);
  apps.push(app);
  return { app, repository, adrs };
};

afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });

describe('container graph write guards', () => {
  it('blocks owner and source deletion through the component route, including hidden child dependencies', async () => {
    const { app } = createApp();
    const owner = await app.inject({ method:'DELETE', url:`/diagrams/${ids.parentDiagram}/components/${ids.owner}` });
    expect(owner.statusCode).toBe(409);
    expect(owner.json()).toMatchObject({ code:'DIAGRAM_DEPENDENCY', diagramBlockers:[expect.objectContaining({ diagramId:ids.populatedChild, componentId:ids.owner })] });

    const source = await app.inject({ method:'DELETE', url:`/diagrams/${ids.parentDiagram}/components/${ids.sourceSystem}` });
    expect(source.statusCode).toBe(409);
    expect(source.json()).toMatchObject({ code:'DIAGRAM_DEPENDENCY', diagramBlockers:[expect.objectContaining({ diagramId:ids.populatedChild, sourceComponentId:ids.sourceSystem })] });
  });

  it('prevents complete PUT from omitting or invalidly reclassifying owners and sources', async () => {
    const parent = { ...(generalParentFixture() as any), relationships:[] };
    const { app } = createApp(parent);
    const omittingOwner = { ...parent, components:parent.components.filter((component:any) => component.id !== ids.owner) };
    const missing = await app.inject({ method:'PUT', url:`/diagrams/${ids.parentDiagram}`, payload:omittingOwner });
    expect(missing.statusCode).toBe(409);
    expect(missing.json()).toMatchObject({ code:'DIAGRAM_DEPENDENCY', diagramBlockers:[expect.objectContaining({ componentId:ids.owner })] });

    const invalidOwner = { ...parent, components:parent.components.map((component:any) => component.id === ids.owner ? { ...component, type:'person' } : component) };
    expect((await app.inject({ method:'PUT', url:`/diagrams/${ids.parentDiagram}`, payload:invalidOwner })).json()).toMatchObject({ code:'DIAGRAM_DEPENDENCY' });

    const invalidSource = { ...parent, components:parent.components.map((component:any) => component.id === ids.sourceSystem ? { ...component, type:'database' } : component) };
    const response = await app.inject({ method:'PUT', url:`/diagrams/${ids.parentDiagram}`, payload:invalidSource });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code:'DIAGRAM_DEPENDENCY', diagramBlockers:[expect.objectContaining({ sourceComponentId:ids.sourceSystem })] });
  });

  it('keeps child ownership and occurrence source identities immutable and rejects status changes', async () => {
    const { app, repository } = createApp();
    const child = repository.get(ids.populatedChild)! as any;
    const ownerChanged = { ...child, scope:{ ...child.scope, softwareSystemId:ids.duplicateOwner } };
    expect((await app.inject({ method:'PUT', url:`/diagrams/${child.id}`, payload:ownerChanged })).json()).toMatchObject({ code:'IMMUTABLE_SCOPE' });

    const sourceChanged = { ...child, components:child.components.map((component:any) => component.id === ids.externalOccurrence ? { ...component, sourceComponentId:ids.person } : component) };
    expect((await app.inject({ method:'PUT', url:`/diagrams/${child.id}`, payload:sourceChanged })).json()).toMatchObject({ code:'IMMUTABLE_SCOPE' });

    const trashedPayload = { ...child, status:'trashed', trashedAt:child.updatedAt };
    expect((await app.inject({ method:'PUT', url:`/diagrams/${child.id}`, payload:trashedPayload })).json()).toMatchObject({ code:'IMMUTABLE_SCOPE' });
  });

  it('blocks omission of an ADR-linked component and keeps generic creation at general scope', async () => {
    const parent = generalParentFixture() as any;
    const adrs = new AdrRepository();
    const { app } = createApp(parent, null, adrs);
    const adr = adrs.create(ids.parentDiagram, completeAdrPayload);
    adrs.replaceLinks(adr.id, [ids.person]);
    const incoming = { ...parent, components:parent.components.filter((component:any) => component.id !== ids.person) };
    const blocked = await app.inject({ method:'PUT', url:`/diagrams/${ids.parentDiagram}`, payload:incoming });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json()).toMatchObject({ code:'DIAGRAM_DEPENDENCY', blockers:[expect.objectContaining({ adrId:adr.id })] });

    const generic = await app.inject({ method:'POST', url:'/diagrams', payload:{ name:'Still general', kind:'container', scope:{ parentDiagramId:ids.parentDiagram, softwareSystemId:ids.owner } } });
    expect(generic.statusCode).toBe(201);
    expect(generic.json()).toMatchObject({ kind:'general', scope:null, boundary:null });
  });

  it('keeps ADR links local and rejects child decision writes after the parent becomes inactive', async () => {
    const { app, repository } = createApp();
    const childAdr = await app.inject({ method:'POST', url:`/diagrams/${ids.populatedChild}/adrs`, payload:completeAdrPayload });
    expect(childAdr.statusCode).toBe(201);

    const boundaryTarget = await app.inject({ method:'PUT', url:`/adrs/${childAdr.json().id}/components`, payload:{ componentIds:['90000000-0000-4000-8000-000000000099'] } });
    expect(boundaryTarget.statusCode).toBe(422);
    expect(boundaryTarget.json()).toMatchObject({ fields:{ componentIds:expect.any(String) } });

    await repository.trash(ids.parentDiagram);
    const inactiveWrite = await app.inject({ method:'PATCH', url:`/adrs/${childAdr.json().id}`, payload:completeAdrPayload });
    expect(inactiveWrite.statusCode).toBe(409);
    expect(inactiveWrite.json()).toMatchObject({ code:'PARENT_INACTIVE' });
  });
});
