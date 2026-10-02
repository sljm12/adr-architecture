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
  it('round trips both subtypes with identity, creation time and parent contents intact',async()=>{
    const original=await repository.get(populatedChildFixture().id);const parent=await repository.get(generalParentFixture().id);const service=new DiagramService(repository);
    for(const containerType of ['datastore','application'] as const){const next=structuredClone(original!);next.components[0].containerType=containerType;await service.save(next.id,next);const loaded=await service.load(next.id);expect(loaded.components[0]).toMatchObject({id:original!.components[0].id,createdAt:original!.components[0].createdAt,containerType});expect(loaded.relationships.map(({updatedAt,...r})=>r)).toEqual(original!.relationships.map(({updatedAt,...r})=>r));expect(await repository.get(parent!.id)).toEqual(parent);}
  });
  it('rolls back invalid child writes and keeps parent and child artifacts intact',async()=>{
    const before=(await repository.get(populatedChildFixture().id))!;const parent=await repository.get(generalParentFixture().id);const service=new DiagramService(repository);
    for(const mutate of [(d:any)=>d.components[0].containerType=null,(d:any)=>d.components[0].containerType='queue',(d:any)=>d.components[1].sourceComponentId=d.components[0].id,(d:any)=>d.components[1].position={x:100,y:100},(d:any)=>d.relationships[0].label=' ']){const input=structuredClone(before);mutate(input);await expect(service.save(input.id,input)).rejects.toThrow();expect(await repository.get(input.id)).toEqual(before);expect(await repository.get(parent!.id)).toEqual(parent);}
  });
});
