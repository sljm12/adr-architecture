import { describe,expect,it } from 'vitest'; import { buildApp } from '../src/api/app'; import { DiagramRepository } from '../src/persistence/diagram-repository'; import type { DiagramDocument } from '../../../shared/src/index';
const d:DiagramDocument={id:'d',name:'x',status:'active',createdAt:'n',updatedAt:'n',trashedAt:null,components:[],relationships:[],groups:[]}; describe('repository',()=>it('preserves document IDs on replacement',()=>{const r=new DiagramRepository();r.create(d);const saved=r.replace({...d,name:'renamed'});expect(saved.id).toBe('d');expect(r.get('d')?.name).toBe('renamed');}));
describe('diagram summary API', () => {
  it('returns the immutable creation timestamp in active summaries and retains it after edits', async () => {
    const repository = new DiagramRepository();
    const app = buildApp(repository); await app.ready();
    const created = await app.inject({ method: 'POST', url: '/diagrams', payload: { name: 'System' } });
    const document = created.json();
    const edited = await app.inject({ method: 'PUT', url: `/diagrams/${document.id}`, payload: { ...document, name: 'Renamed', createdAt: '2020-01-01T00:00:00.000Z' } });
    expect(edited.statusCode).toBe(200);
    expect(edited.json().createdAt).toBe(document.createdAt);
    const listed = await app.inject({ method: 'GET', url: '/diagrams' });
    expect(listed.json()).toEqual([expect.objectContaining({ id: document.id, name: 'Renamed', createdAt: document.createdAt })]);
    await app.close();
  });

  it('leaves an active summary unchanged when deletion targets an unavailable diagram', async () => {
    const repository = new DiagramRepository(); repository.create({ ...d, id: '00000000-0000-4000-8000-000000000099' });
    const app = buildApp(repository); await app.ready();
    const before = await app.inject({ method: 'GET', url: '/diagrams' });
    const response = await app.inject({ method: 'DELETE', url: '/diagrams/00000000-0000-4000-8000-000000000098' });
    expect(response.statusCode).toBe(404);
    expect(await app.inject({ method: 'GET', url: '/diagrams' }).then(result => result.json())).toEqual(before.json());
    await app.close();
  });
});
