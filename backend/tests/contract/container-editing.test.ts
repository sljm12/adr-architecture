import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import { DiagramRepository } from '../../src/persistence/diagram-repository';
import { generalParentFixture, populatedChildFixture, containerFixtureIds as ids } from '../../../shared/tests/container-fixtures';
import { completeAdrPayload } from '../fixtures';
const apps: ReturnType<typeof buildApp>[]=[];
afterEach(async()=>{await Promise.all(apps.splice(0).map(app=>app.close()));});
function setup() { const repository=new DiagramRepository(); const parent=generalParentFixture(); const child=populatedChildFixture(); repository.create(parent as any); repository.create(child as any); const app=buildApp(repository); apps.push(app); return {app,repository,parent,child}; }
describe('child authoring PUT contract',()=>{
  it.each(['application','datastore'])('persists %s without writing the parent, and resolves display caches',async subtype=>{
    const {app,repository,parent,child}=setup();
    const before=repository.get(parent.id);
    const payload:any=structuredClone(child); payload.components[0].containerType=subtype; payload.components[1].name='Client cache';
    const response=await app.inject({method:'PUT',url:`/diagrams/${child.id}`,payload});
    expect(response.statusCode).toBe(200);
    expect(response.json().components[0]).toMatchObject({id:ids.container,containerType:subtype});
    expect(response.json().components[1].name).toBe('Ledger');
    expect(repository.get(parent.id)).toEqual(before);
    expect(response.json().relationships.map(({updatedAt,...r}:any)=>r)).toEqual(child.relationships.map(({updatedAt,...r})=>r));
  });
  it.each([
    ['missing subtype',(d:any)=>delete d.components[0].containerType],
    ['null subtype',(d:any)=>d.components[0].containerType=null],
    ['unsupported subtype',(d:any)=>d.components[0].containerType='queue'],
    ['parent type',(d:any)=>d.components[0].type='person'],
    ['responsibility',(d:any)=>d.components[0].description=' '],
    ['technology',(d:any)=>d.components[0].technology=' '],
    ['undirected',(d:any)=>d.relationships[0].direction='undirected'],
    ['blank interaction',(d:any)=>d.relationships[0].label=' '],
    ['external clearance',(d:any)=>d.components[1].position={x:100,y:100}],
    ['missing endpoint',(d:any)=>d.relationships[0].targetComponentId=ids.person],
    ['owner source',(d:any)=>d.components[1].sourceComponentId=ids.owner],
    ['source chain',(d:any)=>d.components[1].sourceComponentId=ids.container],
  ])('rejects %s atomically',async(_,mutate)=>{
    const {app,repository,child}=setup(); const before=repository.get(child.id); const payload=structuredClone(child); mutate(payload);
    const response=await app.inject({method:'PUT',url:`/diagrams/${child.id}`,payload});
    expect([409,422]).toContain(response.statusCode); expect(repository.get(child.id)).toEqual(before);
  });
  it('returns fresh eligible source context excluding the owner',async()=>{
    const {app,child}=setup(); const response=await app.inject({method:'GET',url:`/diagrams/${child.id}/container-context`});
    expect(response.statusCode).toBe(200); expect(response.json().sources.map((s:any)=>s.id)).toEqual(expect.arrayContaining([ids.person,ids.sourceSystem])); expect(response.json().sources.map((s:any)=>s.id)).not.toContain(ids.owner);
  });
  it('keeps local ADR component and interaction links across subtype changes and confirmed removal blockers',async()=>{
    const {app,child}=setup();
    const adr=(await app.inject({method:'POST',url:`/diagrams/${child.id}/adrs`,payload:completeAdrPayload})).json();
    expect((await app.inject({method:'PUT',url:`/adrs/${adr.id}/components`,payload:{componentIds:[ids.container]}})).statusCode).toBe(200);
    expect((await app.inject({method:'PUT',url:`/adrs/${adr.id}/relationships`,payload:{relationshipIds:[ids.childRelationship]}})).statusCode).toBe(200);
    const next:any=structuredClone(child);next.components[0].containerType='datastore';
    expect((await app.inject({method:'PUT',url:`/diagrams/${child.id}`,payload:next})).statusCode).toBe(200);
    expect((await app.inject({method:'GET',url:`/adrs/${adr.id}`})).json()).toMatchObject({componentIds:[ids.container],relationshipIds:[ids.childRelationship]});
    expect((await app.inject({method:'DELETE',url:`/diagrams/${child.id}/relationships/${ids.childRelationship}`})).statusCode).toBe(409);
  });
  it('rejects duplicate sources and other-parent sources without writing either parent',async()=>{
    const {app,repository,parent,child}=setup();const other=structuredClone(parent);other.id=crypto.randomUUID();other.components=other.components.map(c=>({...c,id:crypto.randomUUID(),diagramId:other.id}));other.relationships=[];repository.create(other as any);
    const before=repository.get(child.id);
    const duplicate=structuredClone(child);duplicate.components.push({...child.components[1],id:crypto.randomUUID(),position:{x:900,y:100}});
    expect((await app.inject({method:'PUT',url:`/diagrams/${child.id}`,payload:duplicate})).statusCode).toBe(422);
    const otherSource=structuredClone(child);otherSource.components[1].sourceComponentId=other.components[2].id;
    expect((await app.inject({method:'PUT',url:`/diagrams/${child.id}`,payload:otherSource})).statusCode).toBe(409);
    expect(repository.get(child.id)).toEqual(before);expect(repository.get(parent.id)?.components).toEqual(parent.components);expect(repository.get(other.id)?.components).toEqual(other.components);
  });
});
