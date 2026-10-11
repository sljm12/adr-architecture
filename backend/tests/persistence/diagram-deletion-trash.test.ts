import { describe, expect, it } from 'vitest';
import { diagramDeletionFixture } from '../component-recovery-fixture';
import { DiagramRepository, type DiagramRepositoryLike } from '../../src/persistence/diagram-repository';
import { AdrRepository } from '../../src/persistence/adr-repository';
import { DiagramService } from '../../src/services/diagram-service';
import { componentTestDatabase, postgresEnabled } from './component-test-database';
import { scopedRepository } from '../html-export-source-fixtures';

for (const postgres of [false,true]) describe.skipIf(postgres && !postgresEnabled)(`${postgres?'PostgreSQL':'memory'} confirmed hierarchy Trash`,()=>{
  async function setup() { const database=postgres?await componentTestDatabase():undefined; const fixture=await diagramDeletionFixture(database?.diagrams??new DiagramRepository(),database?.adrs??new AdrRepository()); return {...fixture,close:()=>database?.close()}; }
  it('retains every artifact/ADR/link and earlier provenance through Trash/restoration',async()=>{
    const {repository,adrs,ids,before,close}=await setup();
    try {
      const service=new DiagramService(repository,adrs);const preview=await service.previewDeletion({selector:{id:ids.context},mode:'trash'});
      await service.executeDeletion(ids.context,{mode:'trash',confirmationToken:preview.confirmationToken});
      expect((await repository.list()).map(d=>d.id)).toEqual([ids.unrelated]);
      expect(await repository.getTrashProvenance(ids.datastoreChild)).toEqual(before.independentProvenance);
      const impact=await service.restoreImpact(ids.context); await service.restore(ids.context,{confirmedDiagramIds:impact.affectedDiagramIds,confirmedTrashBatchId:impact.trashBatchId});
      for (const original of before.documents) {
        const current=(await repository.get(original.id))!;
        expect({...current,updatedAt:original.updatedAt}).toEqual(original);
      }
      expect(await adrs.listFull(ids.child)).toEqual(before.adrs);
    } finally {await close();}
  });
  it('rolls back a failure after the first member, including revisions and provenance',async()=>{
    const {repository,adrs,ids,before,close}=await setup();
    try {
      const revisions=await Promise.all(before.documents.map(d=>repository.getDeletionRevision(d.id)));
      let count=0;
      const failing:DiagramRepositoryLike=scopedRepository(repository,scoped=>({trash:async(id,provenance)=>{ const result=await scoped.trash(id,provenance);if(++count===2)throw Error('Injected Trash failure');return result; }}));
      const service=new DiagramService(failing,adrs);const preview=await service.previewDeletion({selector:{id:ids.context},mode:'trash'});
      await expect(service.executeDeletion(ids.context,{mode:'trash',confirmationToken:preview.confirmationToken})).rejects.toThrow('Injected Trash failure');
      const sorted=(docs:typeof before.documents)=>[...docs].sort((a,b)=>a.id.localeCompare(b.id));
      expect(sorted(await repository.listAll())).toEqual(sorted(before.documents));
      expect(await Promise.all(before.documents.map(d=>repository.getDeletionRevision(d.id)))).toEqual(revisions);
      expect(await adrs.listFull(ids.child)).toEqual(before.adrs);
      expect(await repository.getTrashProvenance(ids.context)).toEqual({trashBatchId:null,trashRootDiagramId:null});
    } finally {await close();}
  });
});
