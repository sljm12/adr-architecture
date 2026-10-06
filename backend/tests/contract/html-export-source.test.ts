import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import { htmlExportSourceSchema } from '../../../shared/src/index';
import { exportDiagramFixture, htmlPackageFixtureIds as ids } from '../../../shared/tests/html-export-fixtures';
import { scopedRepository, sourceFixture } from '../html-export-source-fixtures';

const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); });
function setup(overrides?: Parameters<typeof scopedRepository>[1]) {
  const seeded = sourceFixture();
  const app = buildApp(overrides ? scopedRepository(seeded.diagrams, overrides) : seeded.diagrams, seeded.adrs);
  apps.push(app);
  return { ...seeded, app, get: (id = seeded.fixture.parent.id) => app.inject({ method: 'GET', url: `/diagrams/${id}/export/html-source` }) };
}

describe('GET HTML export source', () => {
  it('returns entry first, UUID-ordered active children, all full local ADRs and deliberate exclusions', async () => {
    const { fixture, get } = setup();
    const response = await get(); expect(response.statusCode).toBe(200);
    const body = htmlExportSourceSchema.parse(response.json());
    expect(body.diagrams.map(member => member.diagram.id)).toEqual(fixture.expected.diagramIds);
    for (const member of body.diagrams) expect(member.adrs).toEqual(fixture.adrsByDiagram[member.diagram.id]);
    expect(body.availability).toMatchObject(fixture.availability);
    expect(body.containerContext).toBeNull();
  });
  it('returns only a selected child plus every eligible source, including unused sources', async () => {
    const { fixture, get } = setup(); const child = fixture.children.find(child => child.components.length)!;
    const response = await get(child.id); expect(response.statusCode).toBe(200);
    const body = htmlExportSourceSchema.parse(response.json());
    expect(body.diagrams.map(member => member.diagram.id)).toEqual([child.id]);
    expect(body.availability).toEqual([]);
    expect(body.containerContext?.scope).toMatchObject(child.scope!);
    expect(body.containerContext?.sources.map(source => source.id).sort()).toEqual(fixture.parent.components.filter(component => component.id !== child.scope!.softwareSystemId && ['person', 'software-system'].includes(component.type!)).map(component => component.id).sort());
  });
  it('preserves no-child and legacy general entries', async () => {
    const { diagrams, get } = setup(); const legacy = exportDiagramFixture(); diagrams.create(legacy);
    const response = await get(legacy.id); expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ entryDiagramId: legacy.id, diagrams: [{ diagram: { kind: 'general' }, adrs: [] }], containerContext: null });
    expect(response.json().availability.every((item: any) => item.availability === 'none')).toBe(true);
  });
  it('does not read global lists or hydrate unrelated corrupt diagrams', async () => {
    const { get } = setup(repository => ({ listAll: () => { throw new Error('global read'); }, findChildren: () => { throw new Error('filtered discovery'); }, get: id => {
      const document = repository.get(id); if (id === ids.unrelatedChild) throw new Error('unrelated corruption'); return document;
    } }));
    expect((await get()).statusCode).toBe(200);
  });
  it.each(['missing', 'trashed'])('returns scoped 404 for %s entry', async state => {
    const { fixture, get } = setup(); const id = state === 'missing' ? crypto.randomUUID() : fixture.trashedChild.id;
    const response = await get(id); expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: 'HTML_EXPORT_NOT_FOUND', diagramId: id, artifactKind: 'diagram', field: 'status', remedy: expect.any(String) });
  });
  it('returns scoped 422 for an invalid request UUID', async () => {
    const response = await setup().get('invalid'); expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'HTML_EXPORT_VALIDATION_FAILED', diagramId: 'invalid', field: 'id', remedy: expect.any(String) });
  });
  it('fails the entire source when an expected active child cannot load', async () => {
    const { fixture, get } = setup(repository => ({ get: id => id === ids.emptyChild ? undefined : repository.get(id) }));
    const response = await get(); expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'HTML_EXPORT_SOURCE_INCOMPLETE', diagramId: fixture.children[0].id, artifactId: fixture.children[0].id, field: 'diagram', remedy: expect.any(String) });
    expect(response.json()).not.toHaveProperty('diagrams');
  });
  it.each(['owner', 'source'])('returns 409 identifying a broken %s', async kind => {
    const { fixture, diagrams, get } = setup(); const parent = diagrams.get(fixture.parent.id)!;
    const child = fixture.children.find(child => child.components.length)!;
    const target = kind === 'owner' ? child.scope!.softwareSystemId : fixture.availability.find(item => item.availability === 'none')!.softwareSystemId;
    if (kind === 'source') {
      const changed = diagrams.get(child.id)!;
      changed.components.find(component => component.role === 'external')!.sourceComponentId = target;
      diagrams.replace(changed);
    }
    parent.groups = []; parent.components.find(component => component.id === target)!.type = null; diagrams.replace(parent);
    const response = await get(); expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: 'HTML_EXPORT_SOURCE_INCOMPLETE', diagramId: child.id, artifactKind: 'component', artifactId: kind === 'owner' ? target : child.components.find(component => component.role === 'external')!.id, field: kind === 'owner' ? 'scope.softwareSystemId' : 'sourceComponentId' });
  });
  it('returns artifact-specific 422 for unsupported saved content', async () => {
    const { fixture, get } = setup(repository => ({ get: async id => {
      const document = await repository.get(id); if (document && id === ids.parentDiagram) { document.groups = []; document.components[0].type = 'unsupported'; } return document;
    } }));
    const response = await get(); expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'HTML_EXPORT_VALIDATION_FAILED', diagramId: fixture.parent.id, artifactKind: 'component', artifactId: fixture.parent.components[0].id, field: 'type' });
  });
  it('returns safe scoped 500 without leaking read failures or partial members', async () => {
    const { fixture, get } = setup(repository => ({ get: id => { if (id !== ids.parentDiagram) throw new Error('private database detail'); return repository.get(id); } }));
    const response = await get(); expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ code: 'HTML_EXPORT_SOURCE_FAILED', diagramId: fixture.children[0].id, field: 'source', remedy: expect.any(String) });
    expect(response.body).not.toContain('private database detail'); expect(response.json()).not.toHaveProperty('diagrams');
  });
  it('rejects broken saved ADR artifact and replacement links before returning a source', async () => {
    const { fixture, adrs, get } = setup(); const adr = fixture.adrsByDiagram[fixture.parent.id][0];
    adrs.registerAdr({ ...adr, componentIds: [ids.container] });
    const response = await get(); expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ diagramId: fixture.parent.id, artifactKind: 'ADR', artifactId: adr.id, field: 'componentIds', remedy: expect.any(String) });
    adrs.registerAdr({ ...adr, replacementAdrId: ids.childAcceptedAdr });
    const replacement = await get(); expect(replacement.statusCode).toBe(422);
    expect(replacement.json()).toMatchObject({ diagramId: fixture.parent.id, artifactId: adr.id, field: 'replacementAdrId' });
  });
  it('returns a valid empty directly selected child and no bundled navigation scope', async () => {
    const { fixture, get } = setup(); const child = fixture.children.find(child => !child.components.length)!;
    const response = await get(child.id); expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ diagrams: [{ diagram: { id: child.id, components: [], relationships: [], boundary: child.boundary }, adrs: [] }], availability: [], containerContext: { scope: child.scope } });
    expect(response.json().diagrams).toHaveLength(1);
  });
  it.each(['scope', 'date', 'geometry', 'text', 'duplicate-ID'])('reports invalid saved child %s without partial content', async kind => {
    const { get } = setup(repository => ({ get: async id => {
      const document = await repository.get(id);
      if (document && id === ids.populatedChild) {
        if (kind === 'scope') document.scope!.softwareSystemId = ids.sourceSystem;
        if (kind === 'date') document.components[0].updatedAt = 'bad-date';
        if (kind === 'geometry') document.components[0].size.width = -1;
        if (kind === 'text') document.components[0].description = 'bad\u0001text';
        if (kind === 'duplicate-ID') document.components.push(structuredClone(document.components[0]));
      }
      return document;
    } }));
    const response = await get(); expect(response.statusCode).toBe(kind === 'scope' ? 409 : 422);
    expect(response.json()).toMatchObject({ diagramId: ids.populatedChild, remedy: expect.any(String) });
    if (kind === 'date') expect(response.json()).toMatchObject({ artifactKind: 'component', artifactId: ids.container, field: 'diagrams.2.diagram.components.0.updatedAt' });
    expect(response.json()).not.toHaveProperty('diagrams');
  });
});
