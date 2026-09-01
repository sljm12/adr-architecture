import { create } from 'zustand';
import type { DiagramDocument } from '../../../../shared/src/index';
import { diagramClient } from '../api/diagram-client';
import { BoundedHistory } from './history';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';
type State = { document: DiagramDocument | null; status: SaveStatus; error: string | null; canUndo: boolean; canRedo: boolean; open: (d: DiagramDocument) => void; create: (name: string) => Promise<void>; update: (fn: (d: DiagramDocument) => DiagramDocument) => void; undo: () => void; redo: () => void; addComponent: (name: string) => void; addRelationship: (source: string, target: string, label: string, direction: 'directed' | 'undirected') => void; save: () => Promise<void> };
let timer: ReturnType<typeof setTimeout> | undefined;
const history = new BoundedHistory<DiagramDocument>();
const copy = (document: DiagramDocument) => structuredClone(document);
const historyState = () => ({ canUndo: history.canUndo, canRedo: history.canRedo });
const now = () => new Date().toISOString();

export const useDiagramStore = create<State>((set, get) => ({
  document: null, status: 'idle', error: null, canUndo: false, canRedo: false,
  open: d => { const document = history.reset(copy(d)); set({ document, status: 'saved', error: null, ...historyState() }); },
  create: async name => { const d = await diagramClient.create(name); const document = history.reset(copy(d)); set({ document, status: 'saved', error: null, ...historyState() }); },
  update: fn => { const current = get().document; if (!current) return; const document = history.push(copy(fn(copy(current)))); set({ document, status: 'saving', error: null, ...historyState() }); clearTimeout(timer); timer = setTimeout(() => void get().save(), 300); },
  undo: () => { const document = history.undo(); if (document) set({ document: copy(document), status: 'saving', error: null, ...historyState() }); },
  redo: () => { const document = history.redo(); if (document) set({ document: copy(document), status: 'saving', error: null, ...historyState() }); },
  addComponent: name => { const d = get().document; if (!d || !name.trim()) return; const timestamp = now(); get().update(x => ({ ...x, components: [...x.components, { id: crypto.randomUUID(), diagramId: x.id, name: name.trim(), description: null, type: null, position: { x: 80 + x.components.length * 180, y: 100 + (x.components.length % 3) * 120 }, createdAt: timestamp, updatedAt: timestamp }] })); },
  addRelationship: (sourceComponentId, targetComponentId, label, direction) => { const d = get().document; if (!d || sourceComponentId === targetComponentId) return; const timestamp = now(); get().update(x => ({ ...x, relationships: [...x.relationships, { id: crypto.randomUUID(), diagramId: x.id, sourceComponentId, targetComponentId, label: label.trim() || null, direction, createdAt: timestamp, updatedAt: timestamp }] })); },
  save: async () => { const d = get().document; if (!d) return; set({ status: 'saving' }); try { const saved = await diagramClient.save(d); set({ document: saved, status: 'saved', error: null }); } catch (e) { set({ status: 'failed', error: e instanceof Error ? e.message : 'Save failed' }); } }
}));
