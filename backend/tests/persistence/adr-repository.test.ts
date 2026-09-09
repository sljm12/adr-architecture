import { describe, expect, it } from 'vitest';
import { AdrRepository } from '../../src/persistence/adr-repository';
import { completeAdrPayload } from '../fixtures';
import { adrFixtureIds, completeAdrFixture } from '../../../shared/tests/adr-fixtures';

describe('ADR repository', () => {
  it('preserves a stable ID, server timestamps, duplicate titles, and long text', () => {
    const repository = new AdrRepository();
    const first = repository.create('00000000-0000-0000-0000-000000000001', { ...completeAdrPayload, title: 'Same title', context: 'x'.repeat(6000) });
    const second = repository.create(first.diagramId, { ...completeAdrPayload, title: 'Same title' });
    const updated = repository.update(first.id, { ...completeAdrPayload, title: 'Updated title', context: 'x'.repeat(6000) });
    expect(updated?.id).toBe(first.id); expect(updated?.createdAt).toBe(first.createdAt); expect(updated?.context).toBe('x'.repeat(6000));
    expect(repository.list(first.diagramId)).toHaveLength(2); expect(second.id).not.toBe(first.id);
  });

  it('blocks deleting a replacement ADR and allows deletion after repair', () => {
    const repository = new AdrRepository();
    const replacement = repository.create('00000000-0000-0000-0000-000000000001', completeAdrPayload);
    const original = repository.create(replacement.diagramId, { ...completeAdrPayload, status: 'superseded', replacementAdrId: replacement.id });
    const blocked = repository.delete(replacement.id);
    expect(blocked).toMatchObject({ deleted: false, blockers: [expect.objectContaining({ adrId: original.id })] });
    repository.update(original.id, { ...completeAdrPayload, status: 'rejected', replacementAdrId: null });
    expect(repository.delete(replacement.id)).toEqual({ deleted: true });
  });

  it('replaces zero-to-many links without changing the ADR identity', () => {
    const repository = new AdrRepository();
    repository.registerComponent({ id: '00000000-0000-0000-0000-000000000002', diagramId: '00000000-0000-0000-0000-000000000001', name: 'API' });
    repository.registerComponent({ id: '00000000-0000-0000-0000-000000000003', diagramId: '00000000-0000-0000-0000-000000000001', name: 'Database' });
    const adr = repository.create('00000000-0000-0000-0000-000000000001', completeAdrPayload);
    const linked = repository.replaceLinks(adr.id, ['00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003']);
    expect(linked).toMatchObject({ id: adr.id, componentIds: ['00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003'] });
    const unlinked = repository.replaceLinks(adr.id, []);
    expect(unlinked).toMatchObject({ id: adr.id, componentIds: [] });
    expect(unlinked?.createdAt).toBe(adr.createdAt);
  });

  it('reports every ADR linked to a component for deletion guards', () => {
    const repository = new AdrRepository();
    const adr = repository.create('00000000-0000-0000-0000-000000000001', completeAdrPayload);
    repository.replaceLinks(adr.id, ['00000000-0000-0000-0000-000000000002']);
    expect(repository.componentBlockers('00000000-0000-0000-0000-000000000002')).toEqual([expect.objectContaining({ adrId: adr.id, title: adr.title })]);
  });

  it('returns deterministic reverse component summaries and an empty result for an unlinked component', () => {
    const repository = new AdrRepository();
    repository.registerComponent({ id: adrFixtureIds.componentA, diagramId: adrFixtureIds.diagram, name: 'API' });
    repository.registerComponent({ id: adrFixtureIds.componentB, diagramId: adrFixtureIds.diagram, name: 'Database' });
    repository.registerComponent({ id: adrFixtureIds.otherComponent, diagramId: adrFixtureIds.otherDiagram, name: 'Other' });
    const older = completeAdrFixture({ id: adrFixtureIds.adr, componentIds: [adrFixtureIds.componentA], updatedAt: '2026-01-01T00:00:00.000Z' });
    const newer = completeAdrFixture({ id: adrFixtureIds.replacementAdr, title: 'Use a queue', componentIds: [adrFixtureIds.componentA], updatedAt: '2026-01-02T00:00:00.000Z' });
    repository.registerAdr(older); repository.registerAdr(newer);

    expect(repository.listByComponent(adrFixtureIds.diagram, adrFixtureIds.componentA)).toEqual([
      expect.objectContaining({ id: older.id, title: older.title, status: older.status, updatedAt: older.updatedAt }),
      expect.objectContaining({ id: newer.id, title: newer.title, status: newer.status, updatedAt: newer.updatedAt }),
    ]);
    expect(repository.listByComponent(adrFixtureIds.diagram, adrFixtureIds.componentB)).toEqual([]);
    expect(repository.listByComponent(adrFixtureIds.diagram, adrFixtureIds.otherComponent)).toBeUndefined();
  });

  it('replaces relationship links independently while preserving component links', () => {
    const repository = new AdrRepository();
    const relationship = { id: '00000000-0000-0000-0000-000000000231', diagramId: adrFixtureIds.diagram };
    const secondRelationship = { id: '00000000-0000-0000-0000-000000000232', diagramId: adrFixtureIds.diagram };
    repository.registerComponent({ id: adrFixtureIds.componentA, diagramId: adrFixtureIds.diagram, name: 'API' });
    repository.registerRelationship(relationship);
    repository.registerRelationship(secondRelationship);
    const adr = repository.create(adrFixtureIds.diagram, completeAdrPayload);
    repository.replaceLinks(adr.id, [adrFixtureIds.componentA]);
    const linked = repository.replaceRelationshipLinks(adr.id, [relationship.id, secondRelationship.id]);
    expect(linked).toMatchObject({ id: adr.id, componentIds: [adrFixtureIds.componentA], relationshipIds: [relationship.id, secondRelationship.id] });
    const unlinked = repository.replaceRelationshipLinks(adr.id, []);
    expect(unlinked).toMatchObject({ id: adr.id, componentIds: [adrFixtureIds.componentA], relationshipIds: [] });
  });

  it('returns deterministic reverse relationship summaries and relationship blockers', () => {
    const repository = new AdrRepository();
    const relationship = { id: '00000000-0000-0000-0000-000000000231', diagramId: adrFixtureIds.diagram };
    repository.registerRelationship(relationship);
    const older = completeAdrFixture({ id: adrFixtureIds.adr, relationshipIds: [relationship.id], updatedAt: '2026-01-01T00:00:00.000Z' });
    const newer = completeAdrFixture({ id: adrFixtureIds.replacementAdr, title: 'Use a queue', relationshipIds: [relationship.id], updatedAt: '2026-01-02T00:00:00.000Z' });
    repository.registerAdr(older); repository.registerAdr(newer);

    expect(repository.listByRelationship(adrFixtureIds.diagram, relationship.id)).toEqual([
      expect.objectContaining({ id: older.id, title: older.title, status: older.status, updatedAt: older.updatedAt }),
      expect.objectContaining({ id: newer.id, title: newer.title, status: newer.status, updatedAt: newer.updatedAt }),
    ]);
    expect(repository.relationshipBlockers(relationship.id)).toEqual([
      expect.objectContaining({ adrId: older.id, title: older.title }),
      expect.objectContaining({ adrId: newer.id, title: newer.title }),
    ]);
  });
});
