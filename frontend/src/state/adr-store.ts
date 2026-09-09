import { create } from 'zustand';
import type { AdrStatus, AdrSummary, AdrWritePayload, ArchitectureDecisionRecord, ComponentAdrSummary, RelationshipAdrSummary } from '../../../shared/src/index';
import { adrWriteSchema } from '../../../shared/src/index';
import { adrClient } from '../api/adr-client';
import { BoundedHistory } from './history';

export type AdrSaveStatus = 'idle' | 'loading' | 'unsaved' | 'saving' | 'saved' | 'failed';
export type AdrDraft = AdrWritePayload & { id?: string; diagramId: string; componentIds: string[]; relationshipIds: string[]; createdAt?: string; updatedAt?: string };
type State = {
  diagramId: string | null;
  records: AdrSummary[];
  draft: AdrDraft | null;
  status: AdrSaveStatus;
  error: string | null;
  fieldErrors: Record<string, string>;
  componentSummaries: ComponentAdrSummary[];
  componentSummaryComponentId: string | null;
  componentSummaryStatus: 'idle' | 'loading' | 'loaded' | 'failed';
  componentSummaryError: string | null;
  relationshipSummaries: RelationshipAdrSummary[];
  relationshipSummaryRelationshipId: string | null;
  relationshipSummaryStatus: 'idle' | 'loading' | 'loaded' | 'failed';
  relationshipSummaryError: string | null;
  canUndo: boolean;
  canRedo: boolean;
  load: (diagramId: string) => Promise<void>;
  select: (id: string) => Promise<void>;
  startNew: (diagramId?: string) => void;
  open: (record: ArchitectureDecisionRecord) => void;
  update: (fn: (draft: AdrDraft) => AdrDraft) => void;
  setComponentIds: (componentIds: string[]) => void;
  addComponentLink: (componentId: string) => void;
  removeComponentLink: (componentId: string) => void;
  setRelationshipIds: (relationshipIds: string[]) => void;
  addRelationshipLink: (relationshipId: string) => void;
  removeRelationshipLink: (relationshipId: string) => void;
  undo: () => void;
  redo: () => void;
  save: () => Promise<boolean>;
  retry: () => Promise<boolean>;
  loadComponentSummary: (diagramId: string, componentId: string) => Promise<void>;
  loadRelationshipSummary: (diagramId: string, relationshipId: string) => Promise<void>;
};

const history = new BoundedHistory<AdrDraft>();
const copy = (draft: AdrDraft) => structuredClone(draft);
const historyState = () => ({ canUndo: history.canUndo, canRedo: history.canRedo });
const emptyDraft = (diagramId: string): AdrDraft => ({ diagramId, title: '', context: '', decision: '', consequences: '', alternativesOrConstraints: null, status: 'draft', replacementAdrId: null, componentIds: [], relationshipIds: [] });
const writePayload = (draft: AdrDraft): AdrWritePayload => ({ title: draft.title, context: draft.context, decision: draft.decision, consequences: draft.consequences, alternativesOrConstraints: draft.alternativesOrConstraints ?? null, status: draft.status, replacementAdrId: draft.replacementAdrId ?? null });
const normalizeRecord = (record: ArchitectureDecisionRecord): ArchitectureDecisionRecord => ({ ...record, componentIds: record.componentIds ?? [], relationshipIds: record.relationshipIds ?? [] });
const summary = (record: ArchitectureDecisionRecord): AdrSummary => ({ id: record.id, title: record.title, status: record.status, updatedAt: record.updatedAt, componentCount: record.componentIds.length, relationshipCount: record.relationshipIds.length });
const replaceSummary = (records: AdrSummary[], next: AdrSummary) => records.some(record => record.id === next.id) ? records.map(record => record.id === next.id ? next : record) : [...records, next];
const sameIds = (left: string[], right: string[]) => left.length === right.length && left.every((id, index) => id === right[index]);

export const useAdrStore = create<State>((set, get) => ({
  diagramId: null, records: [], draft: null, status: 'idle', error: null, fieldErrors: {}, componentSummaries: [], componentSummaryComponentId: null, componentSummaryStatus: 'idle', componentSummaryError: null, relationshipSummaries: [], relationshipSummaryRelationshipId: null, relationshipSummaryStatus: 'idle', relationshipSummaryError: null, canUndo: false, canRedo: false,
  load: async diagramId => { set({ diagramId, status: 'loading', error: null }); try { const records = await adrClient.list(diagramId); set(state => { const keepDraft = state.draft?.diagramId === diagramId; return { records, status: keepDraft ? state.status : 'idle', draft: keepDraft ? state.draft : null, fieldErrors: keepDraft ? state.fieldErrors : {}, ...historyState() }; }); } catch (error) { set({ status: 'failed', error: error instanceof Error ? error.message : 'Could not load ADRs.' }); } },
  select: async id => { set({ status: 'loading', error: null }); try { const record = normalizeRecord(await adrClient.get(id)); const draft = history.reset({ ...record }); set({ draft, diagramId: record.diagramId, status: 'saved', error: null, fieldErrors: {}, ...historyState() }); } catch (error) { set({ status: 'failed', error: error instanceof Error ? error.message : 'Could not load ADR.' }); } },
  startNew: diagramId => { const id = diagramId ?? get().diagramId; if (!id) return; const draft = history.reset(emptyDraft(id)); set({ diagramId: id, draft, status: 'idle', error: null, fieldErrors: {}, ...historyState() }); },
  open: record => { const normalized = normalizeRecord(record); const draft = history.reset({ ...normalized }); set({ diagramId: normalized.diagramId, draft, status: 'saved', error: null, fieldErrors: {}, ...historyState() }); },
  update: fn => { const current = get().draft; if (!current) return; const draft = history.push(copy(fn(copy(current)))); set({ draft, status: 'unsaved', error: null, fieldErrors: {}, ...historyState() }); },
  setComponentIds: componentIds => { const unique = [...new Set(componentIds)]; get().update(current => ({ ...current, componentIds: unique })); },
  addComponentLink: componentId => { const current = get().draft; if (!current || current.componentIds.includes(componentId)) return; get().setComponentIds([...current.componentIds, componentId]); },
  removeComponentLink: componentId => { const current = get().draft; if (!current || !current.componentIds.includes(componentId)) return; get().setComponentIds(current.componentIds.filter(id => id !== componentId)); },
  setRelationshipIds: relationshipIds => { const unique = [...new Set(relationshipIds)]; get().update(current => ({ ...current, relationshipIds: unique })); },
  addRelationshipLink: relationshipId => { const current = get().draft; if (!current || current.relationshipIds.includes(relationshipId)) return; get().setRelationshipIds([...current.relationshipIds, relationshipId]); },
  removeRelationshipLink: relationshipId => { const current = get().draft; if (!current || !current.relationshipIds.includes(relationshipId)) return; get().setRelationshipIds(current.relationshipIds.filter(id => id !== relationshipId)); },
  undo: () => { const draft = history.undo(); if (draft) set({ draft: copy(draft), status: 'unsaved', error: null, ...historyState() }); },
  redo: () => { const draft = history.redo(); if (draft) set({ draft: copy(draft), status: 'unsaved', error: null, ...historyState() }); },
  save: async () => {
    const draft = get().draft; if (!draft || get().status === 'saving') return false;
    const validation = adrWriteSchema.safeParse(writePayload(draft));
    if (!validation.success) { const fieldErrors = Object.fromEntries(validation.error.issues.map(issue => [issue.path.join('.') || 'form', issue.message])); set({ status: 'failed', error: 'Complete the required ADR fields before saving.', fieldErrors }); return false; }
    const snapshot = draft; set({ status: 'saving', error: null, fieldErrors: {} });
    let saved: ArchitectureDecisionRecord | null = null;
    try {
      saved = normalizeRecord(snapshot.id ? await adrClient.update(snapshot.id, validation.data) : await adrClient.create(snapshot.diagramId, validation.data));
      if (!sameIds(snapshot.componentIds, saved.componentIds)) saved = normalizeRecord(await adrClient.replaceLinks(saved.id, { componentIds: snapshot.componentIds }));
      if (!sameIds(snapshot.relationshipIds, saved.relationshipIds)) saved = normalizeRecord(await adrClient.replaceRelationshipLinks(saved.id, { relationshipIds: snapshot.relationshipIds }));
      if (get().draft !== snapshot) { set({ status: 'unsaved', error: null }); return false; }
      history.reset({ ...saved }); set(state => ({ draft: saved, status: 'saved', error: null, fieldErrors: {}, records: replaceSummary(state.records, summary(saved!)), ...historyState() })); return true;
    }
    catch (error) {
      if (get().draft === snapshot) {
        const draft = saved && !snapshot.id ? { ...saved, componentIds: snapshot.componentIds, relationshipIds: snapshot.relationshipIds } : undefined;
        set({ ...(draft ? { draft } : {}), status: 'failed', error: error instanceof Error ? error.message : 'Save failed. Your edits are preserved.' });
      }
      return false;
    }
  },
  retry: async () => get().save(),
  loadComponentSummary: async (diagramId, componentId) => {
    set({ componentSummaries: [], componentSummaryComponentId: componentId, componentSummaryStatus: 'loading', componentSummaryError: null });
    try {
      const summaries = await adrClient.componentSummaries(diagramId, componentId);
      if (get().componentSummaryComponentId !== componentId) return;
      set({ componentSummaries: summaries, componentSummaryStatus: 'loaded', componentSummaryError: null });
    } catch (error) {
      if (get().componentSummaryComponentId !== componentId) return;
      set({ componentSummaryStatus: 'failed', componentSummaryError: error instanceof Error ? error.message : 'Could not load linked ADRs.' });
    }
  },
  loadRelationshipSummary: async (diagramId, relationshipId) => {
    set({ relationshipSummaries: [], relationshipSummaryRelationshipId: relationshipId, relationshipSummaryStatus: 'loading', relationshipSummaryError: null });
    try {
      const summaries = await adrClient.relationshipSummaries(diagramId, relationshipId);
      if (get().relationshipSummaryRelationshipId !== relationshipId) return;
      set({ relationshipSummaries: summaries, relationshipSummaryStatus: 'loaded', relationshipSummaryError: null });
    } catch (error) {
      if (get().relationshipSummaryRelationshipId !== relationshipId) return;
      set({ relationshipSummaryStatus: 'failed', relationshipSummaryError: error instanceof Error ? error.message : 'Could not load linked ADRs.' });
    }
  },
}));

export const adrDraftPayload = writePayload;
export const adrStatuses: AdrStatus[] = ['draft', 'accepted', 'superseded', 'rejected'];
