import { describe, expect, it } from 'vitest';
import { AdrRepository } from '../../src/persistence/adr-repository';
import { completeAdrPayload } from '../fixtures';

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
});
