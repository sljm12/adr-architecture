import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { DiagramRepository, PostgresDiagramRepository, type DiagramRepositoryLike } from '../../src/persistence/diagram-repository';
import { DiagramService } from '../../src/services/diagram-service';
import { diagramDocumentSchema, type DiagramDocument } from '../../../shared/src/index';
import { generalParentFixture, populatedChildFixture } from '../../../shared/tests/container-fixtures';
import * as schema from '../../src/persistence/schema';
const enabled=process.env.RUN_POSTGRES_TESTS==='1'&&Boolean(process.env.DATABASE_URL);
for(const postgres of [false,true]) describe.skipIf(postgres&&!enabled)(`container editing ${postgres?'PostgreSQL':'memory'}`,()=>{
  let repository:DiagramRepositoryLike; let pool:Pool; let admin:Pool; const schemaName=`editing_${randomUUID().replaceAll('-','')}`;
  beforeAll(async()=>{
    if(postgres){admin=new Pool({connectionString:process.env.DATABASE_URL});await admin.query(`CREATE SCHEMA ${schemaName}`);pool=new Pool({connectionString:process.env.DATABASE_URL,options:`-c search_path=${schemaName}`});for(const name of ['0001_initial','0002_adrs','0003_system_groups','0004_component_dimensions','0005_c4_container_diagrams','0006_container_component_types'])await pool.query(await readFile(new URL(`../../drizzle/${name}.sql`,import.meta.url),'utf8'));repository=new PostgresDiagramRepository(drizzle(pool,{schema}));}
    else repository=new DiagramRepository();
    await repository.create(diagramDocumentSchema.parse(generalParentFixture()) as DiagramDocument);
    await repository.create(diagramDocumentSchema.parse(populatedChildFixture()) as DiagramDocument);
  });
  afterAll(async()=>{await pool?.end();if(admin){await admin.query(`DROP SCHEMA ${schemaName} CASCADE`);await admin.end();}});
  it('resolves legacy names on every read and normalizes stale child saves without read-time timestamp changes', async () => {
    const service = new DiagramService(repository);
    const p = (await repository.get(generalParentFixture().id))!;
    const c = (await repository.get(populatedChildFixture().id))!;
    await repository.replace({ ...c, name: 'Old custom title' });
    const before = (await repository.get(c.id))!;
    await service.save(p.id, { ...p, components: p.components.map(component => component.id === c.scope!.softwareSystemId ? { ...component, name: 'aa' } : component) });
    for (const loaded of [await repository.get(c.id), await repository.findContainerForOwner(c.scope!.softwareSystemId), (await repository.findChildren(p.id))[0], (await repository.listAll()).find(d => d.id === c.id), await service.load(c.id)]) {
      expect(loaded).toMatchObject({ id: c.id, name: 'aa', updatedAt: before.updatedAt, scope: { softwareSystemName: 'aa' } });
    }
    expect((await service.containerAvailability(p.id, c.scope!.softwareSystemId)).diagram?.name).toBe('aa');
    expect((await service.createOrOpenContainerDiagram(p.id, c.scope!.softwareSystemId)).document.name).toBe('aa');
    const saved = await service.save(c.id, { ...c, name: 'Stale title' });
    expect(saved).toMatchObject({ name: 'aa', scope: { softwareSystemName: 'aa' }, createdAt: c.createdAt });
    await repository.trash(c.id);
    expect((await service.listSummaries('trashed'))[0].name).toBe('aa');
    expect((await repository.restore(c.id))?.name).toBe('aa');
    await service.save(p.id, p);
  });
  it('round trips both subtypes with identity, creation time and parent contents intact',async()=>{
    const original=await repository.get(populatedChildFixture().id);const parent=await repository.get(generalParentFixture().id);const service=new DiagramService(repository);
    for(const containerType of ['datastore','application'] as const){const next=structuredClone(original!);next.components[0].containerType=containerType;await service.save(next.id,next);const loaded=await service.load(next.id);expect(loaded.components[0]).toMatchObject({id:original!.components[0].id,createdAt:original!.components[0].createdAt,containerType});expect(loaded.relationships.map(({updatedAt,...r})=>r)).toEqual(original!.relationships.map(({updatedAt,...r})=>r));expect(await repository.get(parent!.id)).toEqual(parent);}
  });
  it('rolls back invalid child writes and keeps parent and child artifacts intact',async()=>{
    const before=(await repository.get(populatedChildFixture().id))!;const parent=await repository.get(generalParentFixture().id);const service=new DiagramService(repository);
    for(const mutate of [(d:any)=>d.components[0].containerType=null,(d:any)=>d.components[0].containerType='queue',(d:any)=>d.components[1].sourceComponentId=d.components[0].id,(d:any)=>d.components[1].position={x:100,y:100},(d:any)=>d.relationships[0].label=' ']){const input=structuredClone(before);mutate(input);await expect(service.save(input.id,input)).rejects.toThrow();expect(await repository.get(input.id)).toEqual(before);expect(await repository.get(parent!.id)).toEqual(parent);}
  });
  it('batch lists active/trash children with owner-derived names and unchanged local timestamps', async () => {
    const service = new DiagramService(repository);
    const original = (await repository.get(populatedChildFixture().id))!;
    const parent = (await repository.get(generalParentFixture().id))!;
    const sourceId = original.components[1].sourceComponentId;
    await service.save(parent.id, { ...parent, components: parent.components.map(c => c.id === sourceId ? { ...c, description: 'Previous source details' } : c) });
    await service.save(original.id, { ...original, name: 'Independent runtime' });
    const childBefore = (await repository.get(original.id))!;
    const currentParent = (await repository.get(parent.id))!;
    await service.save(parent.id, { ...currentParent, name: 'Current parent', components: currentParent.components.map(c => c.id === sourceId ? { ...c, name: 'Current source', description: null, type: 'person' } : c.id === original.scope!.softwareSystemId ? { ...c, name: 'Current owner' } : c) });
    const loaded = await service.load(original.id);
    expect(loaded).toMatchObject({ id: original.id, name: 'Current owner', updatedAt: childBefore.updatedAt, boundary: childBefore.boundary, scope: { parentDiagramName: 'Current parent', softwareSystemName: 'Current owner' } });
    expect(loaded.components[1]).toMatchObject({ name: 'Current source', description: null, type: 'person', position: original.components[1].position });
    const active = await service.listSummaries();
    expect(active).toHaveLength(2); expect(active.find(d => d.id === original.id)).toMatchObject({ name: 'Current owner', kind: 'container', scope: loaded.scope, createdAt: original.createdAt });
    await repository.trash(original.id);
    expect(await service.listSummaries('trashed')).toEqual([expect.objectContaining({ id: original.id, name: 'Current owner', scope: loaded.scope })]);
    await repository.restore(original.id);
  });
});
