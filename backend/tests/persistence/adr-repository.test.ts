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
});
