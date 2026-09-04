import { create } from 'zustand';
import type { DiagramDocument } from '../../../../shared/src/index';
import { diagramClient } from '../api/diagram-client';
import { BoundedHistory } from './history';

export type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'failed';

type State = {
  document: DiagramDocument | null;
  status: SaveStatus;
  error: string | null;
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
  removeRelationship: (relationshipId: string) => void;
  save: () => Promise<void>;
};

const history = new BoundedHistory<DiagramDocument>();
const copy = (document: DiagramDocument) => structuredClone(document);
const historyState = () => ({ canUndo: history.canUndo, canRedo: history.canRedo });
const now = () => new Date().toISOString();

export const useDiagramStore = create<State>((set, get) => ({
  document: null,
  status: 'idle',
  error: null,
  canUndo: false,
  canRedo: false,
  open: input => {
    const document = history.reset(copy(input));
    set({ document, status: 'saved', error: null, ...historyState() });
  },
  startNew: () => set({ document: null, status: 'idle', error: null, canUndo: false, canRedo: false }),
  create: async name => {
    const created = await diagramClient.create(name);
    const document = history.reset(copy(created));
    set({ document, status: 'saved', error: null, ...historyState() });
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
        set({ document: saved, status: 'saved', error: null });
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
}));
