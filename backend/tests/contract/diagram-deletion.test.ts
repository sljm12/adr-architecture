import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import Ajv from 'ajv';
import { createHash } from 'node:crypto';
import { buildApp } from '../../src/api/app';
import { diagramDeletionFixture } from '../component-recovery-fixture';
import { DiagramService } from '../../src/services/diagram-service';
import { AdrService } from '../../src/services/adr-service';
import { deletionImpactSchema, deletionResultSchema } from '../../../shared/src/index';
import { scopedRepository } from '../html-export-source-fixtures';

const contractPath = resolve('specs/012-cli-delete-diagrams/contracts/openapi.json');
const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
// Resolve this contract's local and external schemas, then validate actual HTTP bodies.
function dereference(value: any, path = contractPath): any {
  if (Array.isArray(value)) return value.map(v => dereference(v, path));
  if (!value || typeof value !== 'object') return value;
  if (value.$ref) {
    const [file, pointer] = value.$ref.split('#'); const target = file ? resolve(dirname(path), file) : path;
    const source = readFileSync(target, 'utf8');
    // Pin the four referenced legacy YAML schemas; fail if their source changes.
    const document = target.endsWith('.yaml') ? JSON.parse(readFileSync(new URL('./diagram-deletion-summary-contract.json', import.meta.url), 'utf8')) : JSON.parse(source);
    if (target.endsWith('.yaml')) expect(createHash('sha256').update(source).digest('hex')).toBe(document.sourceSha256);
    const schema = pointer.split('/').slice(1).reduce((v: any, key: string) => v[key], document);
    return dereference(schema, target);
  }
  return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,dereference(v,path)]));
}
const ajv = new Ajv({ strict: false, validateFormats: false });
const validate = (name: string, body: unknown) => {
  const check = ajv.compile(dereference(contract.components.schemas[name]));
  expect(check(body), JSON.stringify(check.errors)).toBe(true);
};
const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });
async function setup() { const fixture = await diagramDeletionFixture(); const app = buildApp(fixture.repository, fixture.adrs); apps.push(app); return { ...fixture, app }; }

describe('confirmed Trash HTTP contract', () => {
  it('previews exact name/UUID parity without mutation and commits/restores the active batch', async () => {
    const { app, repository, adrs, ids, before } = await setup();
    const request = { selector: { name: before.documents.find(d => d.id === ids.context)!.name }, mode: 'trash' };
    validate('PreviewRequest', request);
    const preview = await app.inject({ method:'POST', url:'/diagrams/deletion-preview', payload:request });
    expect(preview.statusCode).toBe(200); validate('DeletionImpact', preview.json());
    const impact = deletionImpactSchema.parse(preview.json());
    expect(impact.affectedDiagrams.map(d => d.id)).toEqual([ids.context, ids.parent, ids.child]);
    const byId = await app.inject({ method:'POST', url:'/diagrams/deletion-preview', payload:{ selector:{ id:ids.context }, mode:'trash' } });
    expect(byId.json()).toEqual(impact);
    expect(await repository.listAll()).toEqual(before.documents);
    const confirmation = { mode:impact.mode, confirmationToken:impact.confirmationToken }; validate('Confirmation', confirmation);
    const result = await app.inject({ method:'POST', url:`/diagrams/${ids.context}/deletion`, payload:confirmation });
    expect(result.statusCode).toBe(200); validate('DeletionResult',result.json());
    expect(deletionResultSchema.parse(result.json())).toEqual({ rootDiagramId:ids.context, mode:'trash', affectedDiagrams:impact.affectedDiagrams });
    expect(await repository.getTrashProvenance(ids.datastoreChild)).toEqual(before.independentProvenance);
    const service = new DiagramService(repository,adrs); const restore = await service.restoreImpact(ids.context);
    await service.restore(ids.context,{ confirmedDiagramIds:restore.affectedDiagramIds, confirmedTrashBatchId:restore.trashBatchId });
    expect(await adrs.listFull(ids.child)).toEqual(before.adrs);
    expect((await repository.get(ids.child))!.components).toEqual(before.documents.find(d => d.id === ids.child)!.components);
    expect((await repository.get(ids.datastoreChild))!.status).toBe('trashed');
    expect(await repository.get(ids.unrelated)).toEqual(before.documents.find(d => d.id === ids.unrelated));
  });
  it.each(['parent','child'] as const)('resolves owner-derived %s names and selects only its subtree', async selected => {
    const { app, repository, ids } = await setup(); const document=(await repository.get(ids[selected]))!;
    const preview=await app.inject({ method:'POST',url:'/diagrams/deletion-preview',payload:{ selector:{ name:document.name },mode:'trash' } });
    expect(preview.statusCode).toBe(200);
    expect(preview.json().rootDiagramId).toBe(document.id);
    expect(preview.json().affectedDiagrams.map((d:any)=>d.id)).toEqual(selected==='parent'?[ids.parent,ids.child]:[ids.child]);
  });
  it('rejects invalid, missing, ambiguous, stale and unsupported permanent execution without mutation', async () => {
    const { app, repository, adrs, ids }=await setup(); const service=new DiagramService(repository,adrs);
    const preview=await service.previewDeletion({ selector:{ id:ids.context },mode:'trash' });
    const cases = [
      ['/diagrams/deletion-preview',{selector:{ name:'Payments arch' },mode:'trash'},404],
      ['/diagrams/deletion-preview',{selector:{ name:' ' },mode:'trash'},400],
      ['/diagrams/deletion-preview',{selector:{ id:ids.context },mode:'trash',extra:1},400],
      [`/diagrams/${ids.context}/deletion`,{mode:'trash',confirmationToken:'bad'},400],
      [`/diagrams/${ids.context}/deletion`,{mode:'permanent',confirmationToken:preview.confirmationToken},409],
    ] as const;
    for (const [url,payload,status] of cases) { const response=await app.inject({method:'POST',url,payload});expect(response.statusCode).toBe(status);validate('Error',response.json()); }
    const original=(await repository.get(ids.context))!;
    await service.create(original.name);
    const duplicate=await app.inject({method:'POST',url:'/diagrams/deletion-preview',payload:{selector:{name:original.name},mode:'trash'}});
    expect(duplicate.statusCode).toBe(409);validate('Error',duplicate.json());expect(duplicate.json().candidates).toHaveLength(2);
    await new AdrService(adrs,repository).create(ids.context,{title:'New',context:'Context',decision:'Decision',consequences:'Consequences',status:'draft'});
    const stale=await app.inject({method:'POST',url:`/diagrams/${ids.context}/deletion`,payload:{mode:'trash',confirmationToken:preview.confirmationToken}});
    expect(stale.statusCode).toBe(409);expect(stale.json().code).toBe('DELETE_IMPACT_CHANGED');validate('Error',stale.json());
    expect((await repository.get(ids.context))!.status).toBe('active');
  });
  it('hashes complete ADR links and saved revisions, preserves canonical ordering, and ignores unrelated graphs', async () => {
    const {repository,adrs,ids}=await setup();const service=new DiagramService(repository,adrs);
    const input={selector:{id:ids.child},mode:'trash' as const};const preview=await service.previewDeletion(input);
    const reordered=scopedRepository(repository,scoped=>({get:async id=>{const d=await scoped.get(id);return d&&{...d,components:[...d.components].reverse(),relationships:[...d.relationships].reverse()};}}));
    expect((await new DiagramService(reordered,adrs).previewDeletion(input)).confirmationToken).toBe(preview.confirmationToken);
    const unrelated=(await repository.get(ids.unrelated))!;await service.save(ids.unrelated,{...unrelated,name:'Unrelated edit'});
    expect((await service.previewDeletion(input)).confirmationToken).toBe(preview.confirmationToken);
    const adr=(await adrs.listFull(ids.child)).find(a=>a.status==='accepted')!;
    await new AdrService(adrs,repository).replaceRelationshipLinks(adr.id,{relationshipIds:[]});
    await expect(service.executeDeletion(ids.child,{mode:'trash',confirmationToken:preview.confirmationToken})).rejects.toMatchObject({detail:{code:'DELETE_IMPACT_CHANGED'}});
    expect((await repository.get(ids.child))!.status).toBe('active');
  });
  it('refuses missing, duplicate and wrong-owner graph references before preview or mutation',async()=>{
    const {repository,adrs,ids}=await setup();
    for (const override of [
      {findDescendants:async()=>[(await repository.getGraphMembership(ids.context))!]},
      {getGraphMembership:async(id:string)=>{const m=await repository.getGraphMembership(id);return m&&{...m,ownerComponentId:ids.internal};}},
      {get:async(id:string)=>id===ids.parent?undefined:repository.get(id)},
    ]) {
      const service=new DiagramService(scopedRepository(repository,()=>override),adrs);
      await expect(service.previewDeletion({selector:{id:ids.context},mode:'trash'})).rejects.toThrow();
      expect((await repository.get(ids.context))!.status).toBe('active');
    }
  });
});
