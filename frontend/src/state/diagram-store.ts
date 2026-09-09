import { create } from 'zustand';
import type { DiagramDocument, DiagramSummary, Relationship, RelationshipDirection } from '../../../shared/src/index';
import { diagramClient } from '../api/diagram-client';
import { BoundedHistory } from './history';

export type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'failed';
export type SavedDocumentsStatus = 'idle' | 'loading' | 'loaded' | 'failed';

type State = {
  document: DiagramDocument | null;
  status: SaveStatus;
  error: string | null;
  savedDocuments: DiagramSummary[];
  savedDocumentsStatus: SavedDocumentsStatus;
  savedDocumentsError: string | null;
  loadError: string | null;
  canUndo: boolean;
  canRedo: boolean;
  open: (document: DiagramDocument) => void;
  startNew: () => void;
  create: (name: string) => Promise<void>;
  update: (fn: (document: DiagramDocument) => DiagramDocument) => void;
  undo: () => void;
  redo: () => void;
  addComponent: (name: string) => void;
  addRelationship: (source: string, target: string, label: string, direction: 'directed' | 'undirected') => void;
  renameComponent: (componentId: string, name: string) => boolean;
  updateRelationship: (relationshipId: string, updates: Partial<Pick<Relationship, 'sourceComponentId' | 'targetComponentId' | 'direction' | 'label'>>) => boolean;
  reverseRelationship: (relationshipId: string) => boolean;
  setRelationshipDirection: (relationshipId: string, direction: RelationshipDirection) => boolean;
  removeRelationship: (relationshipId: string) => void;
  save: () => Promise<void>;
  refreshSavedDocuments: () => Promise<void>;
  loadSavedDocument: (id: string) => Promise<boolean>;
};

const history = new BoundedHistory<DiagramDocument>();
const copy = (document: DiagramDocument) => structuredClone(document);
const historyState = () => ({ canUndo: history.canUndo, canRedo: history.canRedo });
const now = () => new Date().toISOString();
const summary = (document: DiagramDocument): DiagramSummary => ({ id: document.id, name: document.name, status: document.status, updatedAt: document.updatedAt });
const replaceSummary = (items: DiagramSummary[], next: DiagramSummary) => items.some(item => item.id === next.id) ? items.map(item => item.id === next.id ? next : item) : [...items, next];

export const useDiagramStore = create<State>((set, get) => ({
  document: null,
  status: 'idle',
  error: null,
  savedDocuments: [], savedDocumentsStatus: 'idle', savedDocumentsError: null, loadError: null,
  canUndo: false,
  canRedo: false,
  open: input => {
    const document = history.reset(copy(input));
    set({ document, status: 'saved', error: null, loadError: null, ...historyState() });
  },
  startNew: () => set({ document: null, status: 'idle', error: null, canUndo: false, canRedo: false }),
  create: async name => {
    const created = await diagramClient.create(name);
    const document = history.reset(copy(created));
    set(state => ({ document, status: 'saved', error: null, loadError: null, savedDocuments: replaceSummary(state.savedDocuments, summary(document)), ...historyState() }));
  },
  update: fn => {
    const current = get().document;
    if (!current) return;
    const document = history.push(copy(fn(copy(current))));
    set({ document, status: 'unsaved', error: null, ...historyState() });
  },
  undo: () => {
    const document = history.undo();
    if (document) set({ document: copy(document), status: 'unsaved', error: null, ...historyState() });
  },
  redo: () => {
    const document = history.redo();
    if (document) set({ document: copy(document), status: 'unsaved', error: null, ...historyState() });
  },
  addComponent: name => {
    const document = get().document;
    if (!document || !name.trim()) return;
    const timestamp = now();
    get().update(current => ({
      ...current,
      components: [...current.components, {
        id: crypto.randomUUID(), diagramId: current.id, name: name.trim(), description: null, type: null,
        position: { x: 80 + current.components.length * 180, y: 100 + (current.components.length % 3) * 120 },
        createdAt: timestamp, updatedAt: timestamp,
      }],
    }));
  },
  addRelationship: (sourceComponentId, targetComponentId, label, direction) => {
    const document = get().document;
    if (!document || sourceComponentId === targetComponentId) return;
    const timestamp = now();
    get().update(current => ({
      ...current,
      relationships: [...current.relationships, {
        id: crypto.randomUUID(), diagramId: current.id, sourceComponentId, targetComponentId,
        label: label.trim() || null, direction, createdAt: timestamp, updatedAt: timestamp,
      }],
    }));
  },
  renameComponent: (componentId, name) => {
    const trimmedName = name.trim();
    if (!trimmedName || !get().document?.components.some(component => component.id === componentId)) return false;
    get().update(current => ({
      ...current,
      components: current.components.map(component => component.id === componentId
        ? { ...component, name: trimmedName, updatedAt: now() }
        : component),
    }));
    return true;
  },
  updateRelationship: (relationshipId, updates) => {
    const current = get().document;
    const relationship = current?.relationships.find(item => item.id === relationshipId);
    if (!current || !relationship) return false;
    const sourceComponentId = updates.sourceComponentId ?? relationship.sourceComponentId;
    const targetComponentId = updates.targetComponentId ?? relationship.targetComponentId;
    if (sourceComponentId === targetComponentId
      || !current.components.some(component => component.id === sourceComponentId)
      || !current.components.some(component => component.id === targetComponentId)) return false;
    if (updates.direction && updates.direction !== 'directed' && updates.direction !== 'undirected') return false;
    get().update(document => ({
      ...document,
      relationships: document.relationships.map(item => item.id === relationshipId
        ? {
          ...item,
          sourceComponentId,
          targetComponentId,
          direction: updates.direction ?? item.direction,
          label: updates.label === undefined ? item.label : updates.label.trim() || null,
          updatedAt: now(),
        }
        : item),
    }));
    return true;
  },
  reverseRelationship: relationshipId => {
    const relationship = get().document?.relationships.find(item => item.id === relationshipId);
    if (!relationship) return false;
    return get().updateRelationship(relationshipId, {
      sourceComponentId: relationship.targetComponentId,
      targetComponentId: relationship.sourceComponentId,
    });
  },
  setRelationshipDirection: (relationshipId, direction) => get().updateRelationship(relationshipId, { direction }),
  removeRelationship: relationshipId => {
    const document = get().document;
    if (!document || !document.relationships.some(relationship => relationship.id === relationshipId)) return;
    get().update(current => ({
      ...current,
      relationships: current.relationships.filter(relationship => relationship.id !== relationshipId),
    }));
  },
  save: async () => {
    if (get().status === 'saving') return;
    const documentAtSaveStart = get().document;
    if (!documentAtSaveStart) return;
    set({ status: 'saving', error: null });
    try {
      const saved = await diagramClient.save(documentAtSaveStart);
      if (get().document === documentAtSaveStart) {
        set(state => ({ document: saved, status: 'saved', error: null, savedDocuments: replaceSummary(state.savedDocuments, summary(saved)) }));
      } else {
        set({ status: 'unsaved', error: null });
      }
    } catch (error) {
      if (get().document === documentAtSaveStart) {
        set({ status: 'failed', error: error instanceof Error ? error.message : 'Save failed' });
      } else {
        set({ status: 'unsaved', error: null });
      }
    }
  },
  refreshSavedDocuments: async () => {
    set({ savedDocumentsStatus: 'loading', savedDocumentsError: null });
    try { const savedDocuments = await diagramClient.list(); set({ savedDocuments, savedDocumentsStatus: 'loaded', savedDocumentsError: null }); }
    catch (error) { set({ savedDocumentsStatus: 'failed', savedDocumentsError: error instanceof Error ? error.message : 'Could not load saved diagrams.' }); }
  },
  loadSavedDocument: async id => {
    set({ loadError: null });
    try { const document = await diagramClient.get(id); get().open(document); return true; }
    catch (error) { set({ loadError: error instanceof Error ? error.message : 'Could not load the selected diagram.' }); return false; }
  },
}));
