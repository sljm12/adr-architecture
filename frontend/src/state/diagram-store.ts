import { create } from 'zustand';
import { calculateGroupBounds, constrainMemberPosition, getC4ArtifactTypeLabel, isC4ArtifactType, translateGroupWithMembers, type C4ArtifactType, type DiagramDocument, type DiagramSummary, type Position, type Relationship, type RelationshipDirection } from '../../../shared/src/index';
import { diagramClient } from '../api/diagram-client';
import { BoundedHistory } from './history';

export type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'failed';
export type SavedDocumentsStatus = 'idle' | 'loading' | 'loaded' | 'failed';

type State = {
  document: DiagramDocument | null;
  status: SaveStatus;
  error: string | null;
  groupError: string | null;
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
  addComponent: (name: string, type: C4ArtifactType, description?: string | null) => boolean;
  setComponentType: (componentId: string, type: C4ArtifactType) => boolean;
  updateComponentType: (componentId: string, type: C4ArtifactType) => boolean;
  createGroup: (name: string, memberComponentIds: string[]) => boolean;
  renameGroup: (groupId: string, name: string) => boolean;
  moveGroup: (groupId: string, position: Position) => boolean;
  moveComponent: (componentId: string, position: Position) => boolean;
  removeGroupMember: (groupId: string, componentId: string) => boolean;
  ungroup: (groupId: string) => boolean;
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
const copy = (document: DiagramDocument): DiagramDocument => ({ ...structuredClone(document), groups: document.groups ?? [] });
const historyState = () => ({ canUndo: history.canUndo, canRedo: history.canRedo });
const now = () => new Date().toISOString();
const summary = (document: DiagramDocument): DiagramSummary => ({ id: document.id, name: document.name, status: document.status, updatedAt: document.updatedAt });
const replaceSummary = (items: DiagramSummary[], next: DiagramSummary) => items.some(item => item.id === next.id) ? items.map(item => item.id === next.id ? next : item) : [...items, next];
const normalizedGroupName = (name: string) => name.trim().toLocaleLowerCase();
const groupCreationError = (document: DiagramDocument, name: string, memberComponentIds: string[], editingGroupId?: string): string | null => {
  const trimmedName = name.trim();
  if (!trimmedName) return 'Group name is required.';
  if (memberComponentIds.length < 2) return 'Select at least two Software System components.';
  if (new Set(memberComponentIds).size !== memberComponentIds.length) return 'Group members must be unique.';
  const members = memberComponentIds.map(id => document.components.find(component => component.id === id));
  if (members.some(component => !component)) return 'Every selected group member must belong to this diagram.';
  if (members.some(component => component?.type !== 'software-system')) return 'Only Software System components can be grouped.';
  if (memberComponentIds.some(componentId => document.groups.some(group => group.id !== editingGroupId && group.memberComponentIds.includes(componentId)))) return 'A Software System can belong to only one group. Remove it from its current group first.';
  const nameKey = normalizedGroupName(trimmedName);
  if (document.groups.some(group => group.id !== editingGroupId && normalizedGroupName(group.name) === nameKey)) return 'A group with this name already exists.';
  return null;
};
export const componentTypeLabel = getC4ArtifactTypeLabel;

export const useDiagramStore = create<State>((set, get) => ({
  document: null,
  status: 'idle',
  error: null,
  groupError: null,
  savedDocuments: [], savedDocumentsStatus: 'idle', savedDocumentsError: null, loadError: null,
  canUndo: false,
  canRedo: false,
  open: input => {
    const document = history.reset(copy(input));
    set({ document, status: 'saved', error: null, groupError: null, loadError: null, ...historyState() });
  },
  startNew: () => set({ document: null, status: 'idle', error: null, groupError: null, canUndo: false, canRedo: false }),
  create: async name => {
    const created = await diagramClient.create(name);
    const document = history.reset(copy(created));
    set(state => ({ document, status: 'saved', error: null, loadError: null, savedDocuments: replaceSummary(state.savedDocuments, summary(document)), ...historyState() }));
  },
  update: fn => {
    const current = get().document;
    if (!current) return;
    const document = history.push(copy(fn(copy(current))));
    set({ document, status: 'unsaved', error: null, groupError: null, ...historyState() });
  },
  undo: () => {
    const document = history.undo();
    if (document) set({ document: copy(document), status: 'unsaved', error: null, groupError: null, ...historyState() });
  },
  redo: () => {
    const document = history.redo();
    if (document) set({ document: copy(document), status: 'unsaved', error: null, groupError: null, ...historyState() });
  },
  addComponent: (name, type, description = null) => {
    const document = get().document;
    if (!document || !name.trim() || !isC4ArtifactType(type)) return false;
    const timestamp = now();
    get().update(current => ({
      ...current,
      components: [...current.components, {
        id: crypto.randomUUID(), diagramId: current.id, name: name.trim(), description: description?.trim() || null, type,
        position: { x: 80 + current.components.length * 180, y: 100 + (current.components.length % 3) * 120 },
        createdAt: timestamp, updatedAt: timestamp,
      }],
    }));
    return true;
  },
  setComponentType: (componentId, type) => {
    const current = get().document;
    const component = current?.components.find(item => item.id === componentId);
    if (!current || !component || !isC4ArtifactType(type)) return false;
    const memberGroup = (current.groups ?? []).find(group => group.memberComponentIds.includes(componentId));
    if (memberGroup && type !== 'software-system') return false;
    if (component.type === type) return true;
    get().update(document => ({
      ...document,
      components: document.components.map(item => item.id === componentId ? { ...item, type, updatedAt: now() } : item),
    }));
    return true;
  },
  updateComponentType: (componentId, type) => get().setComponentType(componentId, type),
  createGroup: (name, memberComponentIds) => {
    const document = get().document;
    const validationError = document ? groupCreationError(document, name, memberComponentIds) : 'Create a diagram before grouping systems.';
    if (!document || validationError) {
      set({ groupError: validationError });
      return false;
    }
    const timestamp = now();
    const members = document.components.filter(component => memberComponentIds.includes(component.id));
    const layout = calculateGroupBounds(members);
    get().update(current => ({
      ...current,
      groups: [...current.groups, {
        id: crypto.randomUUID(),
        diagramId: current.id,
        name: name.trim(),
        memberComponentIds: [...memberComponentIds],
        ...layout,
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
    }));
    return true;
  },
  renameGroup: (groupId, name) => {
    const document = get().document;
    const group = document?.groups.find(item => item.id === groupId);
    const validationError = document ? groupCreationError(document, name, group?.memberComponentIds ?? [], groupId) : 'Create a diagram before editing a group.';
    if (!document || !group || validationError) {
      set({ groupError: !group && document ? 'The selected group no longer exists.' : validationError });
      return false;
    }
    if (group.name === name.trim()) return true;
    get().update(current => ({
      ...current,
      groups: current.groups.map(item => item.id === groupId ? { ...item, name: name.trim(), updatedAt: now() } : item),
    }));
    return true;
  },
  moveGroup: (groupId, position) => {
    const document = get().document;
    const group = document?.groups.find(item => item.id === groupId);
    if (!document || !group || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return false;
    const delta = { x: position.x - group.position.x, y: position.y - group.position.y };
    if (delta.x === 0 && delta.y === 0) return true;
    const members = group.memberComponentIds
      .map(componentId => document.components.find(component => component.id === componentId))
      .filter((component): component is NonNullable<typeof component> => Boolean(component));
    const translated = translateGroupWithMembers(group, members, delta);
    const positions = new Map(group.memberComponentIds.map((componentId, index) => [componentId, translated.memberPositions[index]]));
    get().update(current => ({
      ...current,
      groups: current.groups.map(item => item.id === groupId ? { ...item, position: translated.groupPosition, updatedAt: now() } : item),
      components: current.components.map(component => {
        const nextPosition = positions.get(component.id);
        return nextPosition ? { ...component, position: nextPosition, updatedAt: now() } : component;
      }),
    }));
    return true;
  },
  moveComponent: (componentId, position) => {
    const document = get().document;
    const component = document?.components.find(item => item.id === componentId);
    if (!document || !component || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return false;
    const group = document.groups.find(item => item.memberComponentIds.includes(componentId));
    const nextPosition = group ? constrainMemberPosition(group, position) : position;
    get().update(current => ({
      ...current,
      components: current.components.map(item => item.id === componentId ? { ...item, position: nextPosition, updatedAt: now() } : item),
    }));
    return true;
  },
  removeGroupMember: (groupId, componentId) => {
    const document = get().document;
    const group = document?.groups.find(item => item.id === groupId);
    if (!document || !group || !group.memberComponentIds.includes(componentId)) {
      set({ groupError: 'The selected component is not a member of this group.' });
      return false;
    }
    if (group.memberComponentIds.length <= 2) {
      set({ groupError: 'A group must keep at least two Software System members. Ungroup it to remove the boundary.' });
      return false;
    }
    get().update(current => ({
      ...current,
      groups: current.groups.map(item => item.id === groupId ? { ...item, memberComponentIds: item.memberComponentIds.filter(id => id !== componentId), updatedAt: now() } : item),
    }));
    return true;
  },
  ungroup: groupId => {
    const document = get().document;
    if (!document?.groups.some(group => group.id === groupId)) {
      set({ groupError: 'The selected group no longer exists.' });
      return false;
    }
    get().update(current => ({ ...current, groups: current.groups.filter(group => group.id !== groupId) }));
    return true;
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
        const normalized = copy(saved);
        set(state => ({ document: normalized, status: 'saved', error: null, savedDocuments: replaceSummary(state.savedDocuments, summary(normalized)) }));
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
