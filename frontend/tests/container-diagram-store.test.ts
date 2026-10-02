import { beforeEach, describe, expect, it } from 'vitest';
import { diagramDocumentSchema, type DiagramDocument } from '../../shared/src/index';
import { emptyChildFixture, populatedChildFixture, containerFixtureIds as ids } from '../../shared/tests/container-fixtures';
import { useDiagramStore } from '../src/state/diagram-store';
const store = () => useDiagramStore.getState();
const child = () => diagramDocumentSchema.parse(populatedChildFixture()) as DiagramDocument;
beforeEach(() => store().open(diagramDocumentSchema.parse(emptyChildFixture()) as DiagramDocument));
describe('atomic container authoring commands', () => {
  it('adds a complete artifact atomically and restores an empty boundary through history',()=>{
    const before=structuredClone(store().document!);
    expect(store().addContainer({name:' Web app ',description:' Displays payments ',technology:' React ',containerType:'application'})).toBe(true);
    const added=structuredClone(store().document!);expect(added.components[0]).toMatchObject({name:'Web app',description:'Displays payments',technology:'React',type:'container',role:'container',containerType:'application',sourceComponentId:null});expect(diagramDocumentSchema.safeParse(added).success).toBe(true);
    store().undo();expect(store().document).toEqual(before);store().redo();expect(store().document).toEqual(added);
    store().update(document=>({...document,components:[]}));expect(store().document!.boundary).toEqual(before.boundary);store().undo();expect(store().document).toEqual(added);
  });
  it('adds, edits subtype and fits layout as one history entry with stable references', () => {
    store().open(child());
    const before = structuredClone(store().document!);
    expect(store().editContainer(ids.container, { name:'Ledger DB', description:'Stores balances', technology:'PostgreSQL', containerType:'datastore' })).toBe(true);
    expect(store().document!.components[0]).toMatchObject({ id:ids.container, containerType:'datastore' });
    expect(store().document!.relationships).toEqual(before.relationships);
    expect(store().document!.scope).toEqual(before.scope);
    store().undo();
    expect(store().document).toEqual(before);
    store().redo();
    expect(store().document!.components[0].containerType).toBe('datastore');
  });
  it('rejects general commands and invalid metadata without history or dirty state', () => {
    const before = store().document;
    expect(store().addComponent('Person', 'person')).toBe(false);
    expect(store().createGroup('Group', [ids.owner, ids.sourceSystem])).toBe(false);
    expect(store().addContainer({ name:'API', description:' ', technology:'TS', containerType:'application' })).toBe(false);
    expect(store().addContainer({ name:'API', description:'Handles requests', technology:'TS', containerType:'person' as any })).toBe(false);
    expect(store().document).toBe(before);
    expect(store().status).toBe('saved');
    expect(store().canUndo).toBe(false);
  });
  it('fits movement and displaced externals atomically and rejects invalid external placement', () => {
    store().open(child());
    const before = structuredClone(store().document!);
    expect(store().moveComponent(ids.container, {x:650,y:100})).toBe(true);
    expect(store().document!.components[1].position).not.toEqual(before.components[1].position);
    store().undo();
    expect(store().document).toEqual(before);
    expect(store().moveComponent(ids.externalOccurrence, {x:100,y:100})).toBe(false);
    expect(store().document).toEqual(before);
    expect(store().resizeComponent(ids.container, {width:500,height:300})).toBe(true);
    store().undo();
    expect(store().document).toEqual(before);
  });
  it('validates interaction endpoints, description, direction and protocol before creating an edge', () => {
    store().open(child());
    const before = store().document;
    expect(store().addRelationship(ids.container, ids.person, 'calls', 'directed')).toBe(false);
    expect(store().addRelationship(ids.container, ids.externalOccurrence, ' ', 'directed')).toBe(false);
    expect(store().addRelationship(ids.container, ids.externalOccurrence, 'calls', 'undirected')).toBe(false);
    expect(store().document).toBe(before);
    expect(store().addRelationship(ids.container, ids.externalOccurrence, 'calls', 'directed', ' HTTPS ')).toBe(true);
    expect(store().document!.relationships.at(-1)?.protocol).toBe('HTTPS');
    expect(store().setRelationshipDirection(ids.childRelationship, 'undirected')).toBe(false);
    const linked=structuredClone(store().document!);store().removeRelationship(ids.childRelationship);expect(store().document!.relationships.some(r=>r.id===ids.childRelationship)).toBe(false);store().undo();expect(store().document).toEqual(linked);
  });
  it('protects external source details and caps undo history', () => {
    store().open(child());
    expect(store().renameComponent(ids.externalOccurrence, 'Changed')).toBe(false);
    expect(store().setComponentType(ids.externalOccurrence, 'person')).toBe(false);
    for (let i=0;i<110;i++) store().moveComponent(ids.container, {x:100+i,y:100});
    let count=0; while(store().canUndo) { store().undo(); count++; }
    expect(count).toBe(99);
  });
  it('includes separate source occurrences without copying parent relationships and rejects duplicates/owners/stale scope',()=>{
    const context={scope:store().document!.scope!,sources:[{id:ids.person,name:'Customer',description:'Places orders',type:'person' as const},{id:ids.owner,name:'Owner',description:null,type:'software-system' as const}],capturedAt:new Date().toISOString()};
    expect(store().includeExternalParticipant(ids.owner,context)).toBe(false);
    expect(store().includeExternalParticipant(ids.person,context)).toBe(true);
    const added=store().document!.components[0];expect(added).toMatchObject({sourceComponentId:ids.person,role:'external',containerType:null,technology:null});expect(added.id).not.toBe(ids.person);expect(store().document!.relationships).toEqual([]);
    const before=store().document;expect(store().includeExternalParticipant(ids.person,context)).toBe(false);expect(store().document).toBe(before);
    expect(store().includeExternalParticipant(ids.person,{...context,scope:{...context.scope,parentDiagramId:ids.populatedChild}})).toBe(false);
    store().undo();expect(store().document!.components).toEqual([]);
  });
});
