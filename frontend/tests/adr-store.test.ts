import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ArchitectureDecisionRecord } from '../../shared/src/index';
import { adrClient } from '../src/api/adr-client';
import { useAdrStore } from '../src/state/adr-store';

const record: ArchitectureDecisionRecord = { id: '00000000-0000-0000-0000-000000000401', diagramId: '00000000-0000-0000-0000-000000000402', title: 'Existing decision', context: 'Context', decision: 'Decision', consequences: 'Consequences', alternativesOrConstraints: null, status: 'accepted', replacementAdrId: null, componentIds: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };

afterEach(() => { vi.restoreAllMocks(); useAdrStore.setState({ diagramId: null, records: [], draft: null, status: 'idle', error: null, fieldErrors: {}, canUndo: false, canRedo: false }); });

describe('ADR draft state', () => {
  it('validates required fields before save and retains the draft', async () => {
    const create = vi.spyOn(adrClient, 'create');
    useAdrStore.getState().startNew(record.diagramId);
    const saved = await useAdrStore.getState().save();
    expect(saved).toBe(false); expect(useAdrStore.getState()).toMatchObject({ status: 'failed', draft: expect.objectContaining({ diagramId: record.diagramId }), fieldErrors: expect.objectContaining({ title: expect.any(String), context: expect.any(String) }) });
    expect(create).not.toHaveBeenCalled();
  });

  it('preserves failed edits, retries, and ignores stale responses', async () => {
    vi.spyOn(adrClient, 'create').mockRejectedValueOnce(new Error('Backend unavailable')).mockResolvedValueOnce(record);
    useAdrStore.getState().startNew(record.diagramId); useAdrStore.getState().update(draft => ({ ...draft, title: record.title, context: record.context, decision: record.decision, consequences: record.consequences }));
    await useAdrStore.getState().save(); expect(useAdrStore.getState()).toMatchObject({ status: 'failed', error: 'Backend unavailable', draft: expect.objectContaining({ title: record.title }) });
    await useAdrStore.getState().retry(); expect(useAdrStore.getState()).toMatchObject({ status: 'saved', draft: expect.objectContaining({ id: record.id }) });
    vi.spyOn(adrClient, 'update').mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ ...record, title: 'stale server response' }), 10)));
    useAdrStore.getState().update(draft => ({ ...draft, title: 'Local edit' })); const pending = useAdrStore.getState().save(); useAdrStore.getState().update(draft => ({ ...draft, title: 'Newer local edit' })); await pending;
    expect(useAdrStore.getState().draft?.title).toBe('Newer local edit'); expect(useAdrStore.getState().status).toBe('unsaved');
  });
});
