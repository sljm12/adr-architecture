import type * as Domain from '../../../shared/src/index';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/api/app';
import { DiagramRepository } from '../../src/persistence/diagram-repository';
import { ComponentContextService } from '../../src/services/component-context';
import { componentContextFixture, componentParentFixture, populatedComponentFixture, componentFixtureIds as ids } from '../../../shared/tests/component-fixtures';
import type { DiagramDocument } from '../../../shared/src/index';

function setup() {
  const repository = new DiagramRepository();
  repository.create(componentContextFixture()); repository.create(componentParentFixture()); repository.create(populatedComponentFixture() as DiagramDocument);
  return { repository, app: buildApp(repository) };
}
describe('Component foundational write guards', () => {
  it('preserves scope and occurrence identities and rejects status/source/role reassignment', async () => {
    const { repository, app } = setup();
    try {
      const before = repository.get(ids.child)!;
      for (const change of [
        (d: Domain.DiagramDocument) => { d.kind = 'general'; d.scope = null; d.boundary = null; d.components = []; d.relationships = []; },
        (d: Domain.DiagramDocument) => { (d.scope as Domain.ComponentScope).containerId = ids.datastore; },
        (d: Domain.DiagramDocument) => { d.scope!.parentDiagramId = ids.context; },
        (d: Domain.DiagramDocument) => { d.status = 'trashed'; },
        (d: Domain.DiagramDocument) => { d.components[2].sourceComponentId = ids.systemOccurrence; d.components.splice(3, 1); },
        (d: Domain.DiagramDocument) => { d.components[2] = { ...d.components[2], role: 'component', type: 'component', sourceComponentId: null, technology: 'TS', description: 'New internal', position: { x: 250, y: 68 } }; },
      ]) {
        const input = structuredClone(before); change(input);
        const response = await app.inject({ method: 'PUT', url: `/diagrams/${ids.child}`, payload: input });
        expect([409, 422]).toContain(response.statusCode);
        expect(repository.get(ids.child)).toEqual(before);
      }
    } finally { await app.close(); }
  });
  it.each(['active', 'trashed'] as const)('blocks immediate source omission/delete and owner removal for a %s child', async status => {
    const { repository, app } = setup();
    if (status === 'trashed') repository.trash(ids.child);
    try {
      const before = repository.get(ids.parent)!;
      for (const componentId of [ids.personOccurrence, ids.application]) {
        const input = { ...before, components: before.components.filter(c => c.id !== componentId), relationships: before.relationships.filter(r => r.sourceComponentId !== componentId && r.targetComponentId !== componentId) };
        const response = await app.inject({ method: 'PUT', url: `/diagrams/${ids.parent}`, payload: input });
        expect(response.statusCode).toBe(409); expect(response.json().code).toBe('DIAGRAM_DEPENDENCY');
        expect(response.json().diagramBlockers).toEqual(expect.arrayContaining([expect.objectContaining({ diagramId: ids.child })]));
        const deletion = await app.inject({ method: 'DELETE', url: `/diagrams/${ids.parent}/components/${componentId}` });
        expect(deletion.statusCode).toBe(409); expect(deletion.json().code).toBe('DIAGRAM_DEPENDENCY');
        expect(repository.get(ids.parent)).toEqual(before);
      }
    } finally { await app.close(); }
  });
  it('allows Application↔Datastore and resolves titles/source chains without timestamp writes', async () => {
    const { repository, app } = setup();
    try {
      const input = repository.get(ids.parent)!; input.components[0].containerType = 'datastore'; input.components[0].name = 'Renamed owner';
      const response = await app.inject({ method: 'PUT', url: `/diagrams/${ids.parent}`, payload: input });
      expect(response.statusCode).toBe(200);
      const child = (await app.inject(`/diagrams/${ids.child}`)).json();
      expect(child).toMatchObject({ id: ids.child, name: 'Renamed owner', createdAt: populatedComponentFixture().createdAt, updatedAt: populatedComponentFixture().updatedAt, scope: { containerId: ids.application, containerType: 'datastore' } });
      const context = await new ComponentContextService(repository).contextFromRepository(repository.get(ids.child)!, repository);
      expect(context.sources).toEqual(expect.arrayContaining([expect.objectContaining({ id: ids.personOccurrence, canonicalSourceComponentId: ids.canonicalPerson, sourceDiagramId: ids.context }), expect.objectContaining({ id: ids.datastore, canonicalSourceComponentId: ids.datastore, sourceDiagramId: ids.parent })]));
      expect(context.sources.some(s => s.id === ids.application)).toBe(false);
    } finally { await app.close(); }
  });
  it('rejects inactive ancestors and wrong-level, cyclic, broken or duplicate canonical sources', async () => {
    const { repository, app } = setup();
    try {
      for (const source of [ids.canonicalPerson, ids.childPerson, ids.internal]) {
        const input = repository.get(ids.child)!; input.components[2].sourceComponentId = source;
        const result = await app.inject({ method: 'PUT', url: `/diagrams/${ids.child}`, payload: input });
        expect(result.statusCode).toBe(409); expect(result.json().code).toBe('IMMUTABLE_SCOPE');
      }
      repository.trash(ids.context);
      expect((await app.inject({ method: 'PUT', url: `/diagrams/${ids.child}`, payload: populatedComponentFixture() })).statusCode).toBe(409);
      expect((await app.inject({ method: 'POST', url: `/diagrams/${ids.child}/adrs`, payload: { title: 'Decision', context: 'Context', decision: 'Decision', consequences: 'Consequences', status: 'draft' } })).statusCode).toBe(409);
    } finally { await app.close(); }
  });
  it('batch-resolves canonical sources with one read per ancestor and no component lookups', async () => {
    const { repository, app } = setup();
    try {
      const child = repository.get(ids.child)!;
      const get = vi.spyOn(repository, 'get'); const findComponent = vi.spyOn(repository, 'findComponent');
      const context = await new ComponentContextService(repository).contextFromRepository(child, repository);
      expect(get.mock.calls.map(([id]) => id)).toEqual([ids.parent, ids.context]);
      expect(findComponent).not.toHaveBeenCalled();
      expect(context.sources).toHaveLength(3);
      const local = child.components[2]; const before = structuredClone(child);
      const refreshed = await new ComponentContextService(repository).hydrateDocument(child, repository);
      expect(refreshed.components[2]).toMatchObject({ id: local.id, sourceComponentId: ids.personOccurrence, position: local.position });
      expect(child).toEqual(before); expect(refreshed.relationships).toEqual(before.relationships);
    } finally { await app.close(); }
  });
  it.each(['duplicate', 'cyclic', 'wrong-level', 'missing'] as const)('rejects %s saved source chains without retargeting', async failure => {
    const { repository, app } = setup();
    try {
      const child = repository.get(ids.child)!; const parent = repository.get(ids.parent)!;
      const person = parent.components.find(c => c.id === ids.personOccurrence)!;
      if (failure === 'duplicate') parent.components.push({ ...person, id: ids.linkedAdr });
      else person.sourceComponentId = failure === 'cyclic' ? person.id : failure === 'wrong-level' ? ids.datastore : ids.unlinkedAdr;
      const actualGet = repository.get.bind(repository);
      vi.spyOn(repository, 'get').mockImplementation(id => id === ids.parent ? parent : actualGet(id));
      await expect(new ComponentContextService(repository).hydrateDocument(child, repository)).rejects.toMatchObject({ code: 'DIAGRAM_REFERENCE_BROKEN' });
      expect(repository.get(ids.child)?.components[2].sourceComponentId).toBe(ids.personOccurrence);
    } finally { await app.close(); }
  });
  it('protects canonical Context sources and allows explicit removal before immediate-source removal', async () => {
    const { repository, app } = setup();
    try {
      const before = repository.get(ids.context)!;
      const response = await app.inject({ method: 'PUT', url: `/diagrams/${ids.context}`, payload: { ...before, components: before.components.filter(c => c.id !== ids.canonicalPerson) } });
      expect(response.statusCode).toBe(409); expect(repository.get(ids.context)).toEqual(before);
      const child = repository.get(ids.child)!;
      expect((await app.inject({ method: 'PUT', url: `/diagrams/${ids.child}`, payload: { ...child, components: child.components.filter(c => c.id !== ids.childPerson) } })).statusCode).toBe(200);
      expect((await app.inject({ method: 'DELETE', url: `/diagrams/${ids.parent}/components/${ids.personOccurrence}` })).statusCode).toBe(200);
      expect(repository.get(ids.context)?.components.some(c => c.id === ids.canonicalPerson)).toBe(true);
    } finally { await app.close(); }
  });
});
