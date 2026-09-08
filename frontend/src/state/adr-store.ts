import { create } from 'zustand';
import type { AdrStatus, AdrSummary, AdrWritePayload, ArchitectureDecisionRecord } from '../../../shared/src/index';
import { adrWriteSchema } from '../../../shared/src/index';
import { adrClient } from '../api/adr-client';
import { BoundedHistory } from './history';

export type AdrSaveStatus = 'idle' | 'loading' | 'unsaved' | 'saving' | 'saved' | 'failed';
export type AdrDraft = AdrWritePayload & { id?: string; diagramId: string; createdAt?: string; updatedAt?: string };
type State = {
  diagramId: string | null;
  records: AdrSummary[];
  draft: AdrDraft | null;
  status: AdrSaveStatus;
  error: string | null;
  fieldErrors: Record<string, string>;
  canUndo: boolean;
  canRedo: boolean;
  load: (diagramId: string) => Promise<void>;
  select: (id: string) => Promise<void>;
  startNew: (diagramId?: string) => void;
  open: (record: ArchitectureDecisionRecord) => void;
  update: (fn: (draft: AdrDraft) => AdrDraft) => void;
  undo: () => void;
  redo: () => void;
  save: () => Promise<boolean>;
  retry: () => Promise<boolean>;
};

const history = new BoundedHistory<AdrDraft>();
const copy = (draft: AdrDraft) => structuredClone(draft);
const historyState = () => ({ canUndo: history.canUndo, canRedo: history.canRedo });
const emptyDraft = (diagramId: string): AdrDraft => ({ diagramId, title: '', context: '', decision: '', consequences: '', alternativesOrConstraints: null, status: 'draft', replacementAdrId: null });
const writePayload = (draft: AdrDraft): AdrWritePayload => ({ title: draft.title, context: draft.context, decision: draft.decision, consequences: draft.consequences, alternativesOrConstraints: draft.alternativesOrConstraints ?? null, status: draft.status, replacementAdrId: draft.replacementAdrId ?? null });
const summary = (record: ArchitectureDecisionRecord): AdrSummary => ({ id: record.id, title: record.title, status: record.status, updatedAt: record.updatedAt, componentCount: record.componentIds.length });
const replaceSummary = (records: AdrSummary[], next: AdrSummary) => records.some(record => record.id === next.id) ? records.map(record => record.id === next.id ? next : record) : [...records, next];

export const useAdrStore = create<State>((set, get) => ({
  diagramId: null, records: [], draft: null, status: 'idle', error: null, fieldErrors: {}, canUndo: false, canRedo: false,
  load: async diagramId => { set({ diagramId, status: 'loading', error: null }); try { const records = await adrClient.list(diagramId); set({ records, status: 'idle', draft: null, fieldErrors: {}, ...historyState() }); } catch (error) { set({ status: 'failed', error: error instanceof Error ? error.message : 'Could not load ADRs.' }); } },
  select: async id => { set({ status: 'loading', error: null }); try { const record = await adrClient.get(id); const draft = history.reset({ ...record }); set({ draft, diagramId: record.diagramId, status: 'saved', error: null, fieldErrors: {}, ...historyState() }); } catch (error) { set({ status: 'failed', error: error instanceof Error ? error.message : 'Could not load ADR.' }); } },
  startNew: diagramId => { const id = diagramId ?? get().diagramId; if (!id) return; const draft = history.reset(emptyDraft(id)); set({ diagramId: id, draft, status: 'idle', error: null, fieldErrors: {}, ...historyState() }); },
  open: record => { const draft = history.reset({ ...record }); set({ diagramId: record.diagramId, draft, status: 'saved', error: null, fieldErrors: {}, ...historyState() }); },
  update: fn => { const current = get().draft; if (!current) return; const draft = history.push(copy(fn(copy(current)))); set({ draft, status: 'unsaved', error: null, fieldErrors: {}, ...historyState() }); },
  undo: () => { const draft = history.undo(); if (draft) set({ draft: copy(draft), status: 'unsaved', error: null, ...historyState() }); },
  redo: () => { const draft = history.redo(); if (draft) set({ draft: copy(draft), status: 'unsaved', error: null, ...historyState() }); },
  save: async () => {
    const draft = get().draft; if (!draft || get().status === 'saving') return false;
    const validation = adrWriteSchema.safeParse(writePayload(draft));
    if (!validation.success) { const fieldErrors = Object.fromEntries(validation.error.issues.map(issue => [issue.path.join('.') || 'form', issue.message])); set({ status: 'failed', error: 'Complete the required ADR fields before saving.', fieldErrors }); return false; }
    const snapshot = draft; set({ status: 'saving', error: null, fieldErrors: {} });
    try { const saved = snapshot.id ? await adrClient.update(snapshot.id, validation.data) : await adrClient.create(snapshot.diagramId, validation.data); if (get().draft !== snapshot) { set({ status: 'unsaved', error: null }); return false; } history.reset({ ...saved }); set(state => ({ draft: saved, status: 'saved', error: null, fieldErrors: {}, records: replaceSummary(state.records, summary(saved)), ...historyState() })); return true; }
    catch (error) { if (get().draft === snapshot) set({ status: 'failed', error: error instanceof Error ? error.message : 'Save failed. Your edits are preserved.' }); return false; }
  },
  retry: async () => get().save(),
}));

export const adrDraftPayload = writePayload;
export const adrStatuses: AdrStatus[] = ['draft', 'accepted', 'superseded', 'rejected'];
