import { describe, expect, it } from 'vitest';
import { diagramDeletionFixture } from '../component-recovery-fixture';
import { DiagramRepository } from '../../src/persistence/diagram-repository';
import { AdrRepository } from '../../src/persistence/adr-repository';
import { DiagramService } from '../../src/services/diagram-service';
import { componentTestDatabase, postgresEnabled } from './component-test-database';
import { scopedRepository } from '../html-export-source-fixtures';

for (const postgres of [false,true]) describe.skipIf(postgres && !postgresEnabled)(`${postgres?'PostgreSQL':'memory'} permanent hierarchy purge`,()=>{
  async function setup() { const database=postgres?await componentTestDatabase():undefined; return {...await diagramDeletionFixture(database?.diagrams??new DiagramRepository(),database?.adrs??new AdrRepository()),database}; }
  it.each(['active','trashed'] as const)('removes all artifacts, internal replacement chains and prior batches from a %s root',async status=>{
    const {repository,adrs,ids,before,database}=await setup();
    try {
      const service=new DiagramService(repository,adrs);
      if(status==='trashed'){const impact=await service.trashImpact(ids.context);await service.trash(ids.context,impact.affectedDiagramIds);}
      const preview=await service.previewDeletion({selector:{id:ids.context},mode:'permanent'});
      expect(new Set(preview.affectedDiagrams.map(d=>d.id))).toEqual(new Set([ids.context,ids.parent,ids.child,ids.datastoreChild]));
      const result=await service.executeDeletion(ids.context,{mode:'permanent',confirmationToken:preview.confirmationToken});
      expect(result.affectedDiagrams).toEqual(preview.affectedDiagrams);
      expect(await repository.listAll()).toEqual([before.documents.find(d=>d.id===ids.unrelated)]);
      expect(await repository.listTrash()).toEqual([]);
      for(const d of preview.affectedDiagrams){expect(await repository.getDeletionRevision(d.id)).toBeUndefined();expect(await adrs.listFull(d.id)).toEqual([]);expect(await repository.getTrashProvenance(d.id)).toEqual({trashBatchId:null,trashRootDiagramId:null});}
      if(adrs instanceof AdrRepository){const state=adrs.snapshotGraph();expect(state.diagrams.has(ids.child)).toBe(false);expect(state.components.has(ids.internal)).toBe(false);expect(state.relationships.size).toBe(0);expect(state.records.size).toBe(0);}
      if(database)for(const table of ['components','relationships','system_groups','system_group_members','adrs','adr_component_links','adr_relationship_links'])expect((await database.pool.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count,table).toBe(0);
      if(database)expect((await database.pool.query('SELECT id,trash_batch_id,trash_root_diagram_id FROM diagrams')).rows).toEqual([{id:ids.unrelated,trash_batch_id:null,trash_root_diagram_id:null}]);
    }finally{await database?.close();}
  });
  it('preserves child owners, ancestors and siblings and frees the owner slot for a new UUID',async()=>{
    const {repository,adrs,ids,before,database}=await setup();
    try{
      const service=new DiagramService(repository,adrs);const preview=await service.previewDeletion({selector:{id:ids.child},mode:'permanent'});
      await service.executeDeletion(ids.child,{mode:'permanent',confirmationToken:preview.confirmationToken});
      for(const d of before.documents.filter(d=>d.id!==ids.child))expect(await repository.get(d.id)).toEqual(d);
      expect(await repository.findComponent(ids.application)).toBeDefined();
      const created=await service.createOrOpenComponentDiagram(ids.parent,ids.application);expect(created.created).toBe(true);expect(created.document.id).not.toBe(ids.child);
    }finally{await database?.close();}
  });
  it.each(['descendant','root'])('rolls back after %s removal, including ADR records, indexes, provenance and counters',async failure=>{
    const {repository,adrs,ids,before,database}=await setup();
    try{
      const revisions=await Promise.all(before.documents.map(d=>repository.getDeletionRevision(d.id)));
      const adrState=adrs instanceof AdrRepository?adrs.snapshotGraph():undefined;
      const failing=scopedRepository(repository,scoped=>({purge:async diagramIds=>{
        await scoped.purge(failure==='root'?diagramIds:[diagramIds[0]]);
        expect(await scoped.get(failure==='root'?ids.context:diagramIds[0])).toBeUndefined();
        throw Error('Injected purge failure');
      }}));
      const service=new DiagramService(failing,adrs);const preview=await service.previewDeletion({selector:{id:ids.context},mode:'permanent'});
      await expect(service.executeDeletion(ids.context,{mode:'permanent',confirmationToken:preview.confirmationToken})).rejects.toThrow('Injected purge failure');
      const sorted=(docs:typeof before.documents)=>[...docs].sort((a,b)=>a.id.localeCompare(b.id));expect(sorted(await repository.listAll())).toEqual(sorted(before.documents));
      expect(await adrs.listFull(ids.child)).toEqual(before.adrs);expect(await Promise.all(before.documents.map(d=>repository.getDeletionRevision(d.id)))).toEqual(revisions);
      expect(await repository.getTrashProvenance(ids.datastoreChild)).toEqual(before.independentProvenance);
      if(adrs instanceof AdrRepository)expect(adrs.snapshotGraph()).toEqual(adrState);
    }finally{await database?.close();}
  });
  it('inspects raw outside parent/owner/source references without status filtering',async()=>{
    const {repository,ids,database}=await setup();
    try{
      const context=(await repository.get(ids.context))!;
      const scope={diagramIds:[ids.context],componentIds:context.components.map(c=>c.id),relationshipIds:context.relationships.map(r=>r.id)};
      await repository.trash(ids.parent);
      const blockers=await repository.deletionBlockers(scope);
      expect(blockers).toEqual(expect.arrayContaining([
        expect.objectContaining({diagramId:ids.parent,artifactId:ids.parent,reason:expect.stringContaining('Parent diagram')}),
        expect.objectContaining({diagramId:ids.parent,artifactId:ids.parent,reason:expect.stringContaining('Owner component')}),
        expect.objectContaining({diagramId:ids.parent,artifactId:ids.systemOccurrence,reason:expect.stringContaining('Source component')}),
      ]));
    }finally{await database?.close();}
  });
  it.each(['source','endpoint','group','trash-root','component-link','relationship-link','replacement'])('blocks an outside %s reference and preserves every saved artifact',async kind=>{
    const {repository,adrs,ids,before,database}=await setup();
    try{
      const service=new DiagramService(repository,adrs);const preview=await service.previewDeletion({selector:{id:ids.context},mode:'permanent'});
      const artifactId=crypto.randomUUID();
      if(kind==='trash-root')await repository.trash(ids.unrelated,{trashBatchId:crypto.randomUUID(),trashRootDiagramId:ids.context});
      else if(kind.endsWith('link')||kind==='replacement'){
        const adr=await adrs.create(ids.unrelated,{title:'Outside',context:'Context',decision:'Decision',consequences:'Consequences',status:'draft',replacementAdrId:kind==='replacement'?before.adrs[0].id:null});
        if(kind==='component-link')await adrs.replaceLinks(adr.id,[ids.internal]);if(kind==='relationship-link')await adrs.replaceRelationshipLinks(adr.id,[ids.relationship]);
      }else if(database){
        if(kind==='source')await database.pool.query(`INSERT INTO components (id,diagram_id,name,description,type,role,container_type,technology,source_component_id,x,y,width,height,created_at,updated_at) SELECT $1,$2,name,description,type,role,container_type,technology,source_component_id,x,y,width,height,created_at,updated_at FROM components WHERE id=$3`,[artifactId,ids.unrelated,ids.siblingOccurrence]);
        if(kind==='endpoint')await database.pool.query(`INSERT INTO relationships (id,diagram_id,source_component_id,target_component_id,direction,label,protocol,created_at,updated_at) SELECT $1,$2,source_component_id,target_component_id,direction,label,protocol,created_at,updated_at FROM relationships WHERE id=$3`,[artifactId,ids.unrelated,ids.relationship]);
        if(kind==='group'){
          await database.pool.query(`INSERT INTO system_groups (id,diagram_id,name,x,y,width,height,created_at,updated_at) SELECT $1,$2,name,x,y,width,height,created_at,updated_at FROM system_groups LIMIT 1`,[artifactId,ids.unrelated]);
          await database.pool.query('INSERT INTO system_group_members (group_id,component_id,created_at) VALUES ($1,$2,now())',[artifactId,ids.internal]);
        }
      }else{
        const outside=(await repository.get(ids.unrelated))!,child=(await repository.get(ids.child))!;
        if(kind==='source')outside.components=[{...child.components[1],id:artifactId,diagramId:outside.id}];
        if(kind==='endpoint')outside.relationships=[{...child.relationships[0],id:artifactId,diagramId:outside.id}];
        if(kind==='group')outside.groups=[{...before.documents.find(d=>d.id===ids.context)!.groups[0],id:artifactId,diagramId:outside.id,memberComponentIds:[ids.internal]}];
        (repository as any).documents.set(outside.id,outside);
      }
      if(kind!=='trash-root')await repository.trash(ids.unrelated);
      const saved=await repository.listAll();const sorted=(docs:typeof saved)=>[...docs].sort((a,b)=>a.id.localeCompare(b.id));
      await expect(service.previewDeletion({selector:{id:ids.context},mode:'permanent'})).rejects.toMatchObject({detail:{code:'DIAGRAM_DEPENDENCY',blockers:expect.arrayContaining([expect.objectContaining({diagramId:ids.unrelated})])}});
      await expect(service.executeDeletion(ids.context,{mode:'permanent',confirmationToken:preview.confirmationToken})).rejects.toMatchObject({detail:{code:'DIAGRAM_DEPENDENCY'}});
      expect(sorted(await repository.listAll())).toEqual(sorted(saved));expect(await adrs.listFull(ids.child)).toEqual(before.adrs);
    }finally{await database?.close();}
  });
  it('rolls back an unexpected restrictive constraint with an actionable error',async()=>{
    const {repository,adrs,ids,before,database}=await setup();
    try{
      const failing=scopedRepository(repository,scoped=>({purge:async diagramIds=>{await scoped.purge(diagramIds);throw Object.assign(Error('Unexpected FK'),{code:'23503',constraint:'outside_reference'});}}));
      const service=new DiagramService(failing,adrs);const preview=await service.previewDeletion({selector:{id:ids.context},mode:'permanent'});
      await expect(service.executeDeletion(ids.context,{mode:'permanent',confirmationToken:preview.confirmationToken})).rejects.toMatchObject({detail:{code:'DIAGRAM_DEPENDENCY',remedy:expect.stringContaining('preview')}});
      const sorted=(docs:typeof before.documents)=>[...docs].sort((a,b)=>a.id.localeCompare(b.id));expect(sorted(await repository.listAll())).toEqual(sorted(before.documents));expect(await adrs.listFull(ids.child)).toEqual(before.adrs);
    }finally{await database?.close();}
  });
});
