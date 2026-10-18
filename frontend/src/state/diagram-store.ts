import { create } from 'zustand';
import { assertCanAddGroupMember, calculateGroupBounds, DEFAULT_COMPONENT_SIZE, fitGroupBoundsAfterLayout, getC4ArtifactTypeLabel, isC4ArtifactType, translateGroupWithMembers, type C4ArtifactType, type DiagramDocument, type DiagramSummary, type GroupMemberAddReason, type Position, type Relationship, type RelationshipDirection } from '../../../shared/src/index';
import { DiagramApiError, diagramClient, formatDiagramApiError } from '../api/diagram-client';
import { BoundedHistory } from './history';
import { getDiagramName, isContainerDocument } from '../../../shared/src/index';
import { reconcileParentDiagramSummaries } from './diagram-list';
import { assertDiagramInvariants, containerContextSchema, componentContextSchema, diagramDocumentSchema, fitScopedDiagramLayout, getContainerComponentMinimumSize, isContainerType, validateExternalPlacement, type ContainerContext, type ComponentContext, type ContainerType, type ComponentSize } from '../../../shared/src/index';
import { getComponentScope, getDiagramOwnerId, type ComponentAvailability } from '../../../shared/src/index';
import { useAdrStore } from './adr-store';
import { adrClient } from '../api/adr-client';

export type ContainerEdit = { name: string; description: string; technology: string; containerType: ContainerType };
export type C4ComponentEdit = { name: string; description: string; technology: string };
type SourceContext = ContainerContext | ComponentContext;
const isComponentSourceContext = (context: SourceContext): context is ComponentContext => 'containerId' in context.scope;
const isScoped = (document: DiagramDocument) => document.kind === 'container' || document.kind === 'component';
export type ComponentGeometryEdit = { id: string; position: Position; size: ComponentSize };

export type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'failed';
export type SavedDocumentsStatus = 'idle' | 'loading' | 'loaded' | 'failed';
export type SavedDocumentDeleteStatus = 'idle' | 'deleting' | 'succeeded' | 'failed';
export type ContainerOpenStatus = 'idle' | 'loading' | 'failed';

type State = {
  document: DiagramDocument | null;
  status: SaveStatus;
  error: string | null;
  dependencyError: string | null;
  groupError: string | null;
  clearGroupError: () => void;
  savedDocuments: DiagramSummary[];
  trashedDocuments: DiagramSummary[];
  savedDocumentsStatus: SavedDocumentsStatus;
  savedDocumentsError: string | null;
  savedDocumentsDeleteStatus: SavedDocumentDeleteStatus;
  savedDocumentsDeleteError: string | null;
  savedDocumentsDeleteMessage: string | null;
  deletedSavedDocumentIds: string[];
  loadError: string | null;
  navigationStatus: 'idle' | 'loading';
  savePending: boolean;
  archiveTransferActive: boolean;
  recoveryPending: boolean;
  revision: number;
  sourceContext: SourceContext | null;
  sourceContextStatus: 'idle' | 'loading' | 'loaded' | 'failed';
  sourceContextError: string | null;
  containerOpenStatus: ContainerOpenStatus;
  containerOpenError: string | null;
  containerOpenComponentId: string | null;
  componentOpenStatus: ContainerOpenStatus;
  componentOpenError: string | null;
  componentOpenComponentId: string | null;
  componentAvailability: ComponentAvailability | null;
  canUndo: boolean;
  canRedo: boolean;
  open: (document: DiagramDocument, retainHistory?: boolean) => void;
  startNew: () => void;
  create: (name: string) => Promise<void>;
  update: (fn: (document: DiagramDocument) => DiagramDocument, options?: { confirmedRemoval?: boolean }) => void | Promise<void>;
  undo: () => void | Promise<void>;
  redo: () => void | Promise<void>;
  addComponent: (name: string, type: C4ArtifactType, description?: string | null) => boolean;
  addContainer: (details: ContainerEdit) => boolean;
  editContainer: (componentId: string, details: ContainerEdit) => boolean;
  addC4Component: (details: C4ComponentEdit) => boolean;
  editC4Component: (componentId: string, details: C4ComponentEdit) => boolean;
  includeExternalParticipant: (sourceId: string, context: SourceContext) => boolean;
  applyComponentGeometry: (edits: ComponentGeometryEdit[]) => boolean;
  setComponentType: (componentId: string, type: C4ArtifactType) => boolean;
  updateComponentType: (componentId: string, type: C4ArtifactType) => boolean;
  createGroup: (name: string, memberComponentIds: string[]) => boolean;
  addGroupMember: (groupId: string, componentId: string) => boolean;
  renameGroup: (groupId: string, name: string) => boolean;
  moveGroup: (groupId: string, position: Position) => boolean;
  moveComponent: (componentId: string, position: Position) => boolean;
  resizeComponent: (componentId: string, size: { width: number; height: number }) => boolean;
  removeGroupMember: (groupId: string, componentId: string) => boolean;
  ungroup: (groupId: string) => boolean;
  addRelationship: (source: string, target: string, label: string, direction: 'directed' | 'undirected', protocol?: string | null) => boolean;
  renameComponent: (componentId: string, name: string) => boolean;
  updateRelationship: (relationshipId: string, updates: Partial<Pick<Relationship, 'sourceComponentId' | 'targetComponentId' | 'direction' | 'label' | 'protocol'>>) => boolean;
  reverseRelationship: (relationshipId: string) => boolean;
  setRelationshipDirection: (relationshipId: string, direction: RelationshipDirection) => boolean;
  removeRelationship: (relationshipId: string) => void | Promise<void>;
  save: () => Promise<void>;
  retry: () => Promise<void>;
  refreshSavedDocuments: () => Promise<void>;
  trashSavedDocument: (id: string, confirmedDiagramIds?: string[]) => Promise<boolean>;
  refreshRecoveryLists: (affectedIds?: string[]) => Promise<void>;
  registerRestoredSavedDocument: (document: DiagramDocument) => void;
  loadSavedDocument: (id: string, options?: { canCommit?: () => boolean }) => Promise<boolean>;
  createOrOpenContainerDiagram: (componentId: string, options?: { canCommit?: () => boolean }) => Promise<boolean>;
  createOrOpenComponentDiagram: (componentId: string, options?: { canCommit?: () => boolean }) => Promise<boolean>;
  applyContainerContext: (context: SourceContext) => boolean;
  refreshContainerContext: () => Promise<boolean>;
};

const history = new BoundedHistory<DiagramDocument>();
let savedMetadata: DiagramDocument | null = null;
const retained = new Map<string, { document: DiagramDocument; history: ReturnType<typeof history.snapshot>; context: SourceContext | null }>();
/** Read-only export capture; never restores or advances editor history. */
export function getRetainedExportDiagrams(): Record<string, DiagramDocument> {
  return structuredClone(Object.fromEntries([...retained].map(([id, value]) => [id, value.document])));
}
export function invalidateArchiveDiagrams(ids: string[]): void {
  for (const id of ids) retained.delete(id);
  if (savedMetadata && ids.includes(savedMetadata.id)) savedMetadata = null;
  if (ids.includes(useDiagramStore.getState().document?.id ?? '')) {
    session++; loadRequest++;
    history.reset(useDiagramStore.getState().document!);
    useDiagramStore.setState({ document: null, status: 'idle', revision: 0, navigationStatus: 'idle', sourceContext: null, sourceContextStatus: 'idle', sourceContextError: null, error: null, groupError: null, canUndo: false, canRedo: false });
  }
}
const authoredContent = (document: DiagramDocument) => JSON.stringify({
  name: isScoped(document) ? undefined : document.name, boundary: document.boundary, groups: document.groups,
  components: document.components.map(({ createdAt, updatedAt, ...component }) => component.role === 'external' ? { ...component, name: undefined, description: undefined, type: undefined, technology: undefined, containerType: undefined } : component),
  relationships: document.relationships.map(({ createdAt, updatedAt, ...relationship }) => relationship),
});
let loadRequest = 0;
let savedListRequest = 0;
let recoveryRefreshes = 0;
let session = 0;
const copy = (document: DiagramDocument): DiagramDocument => ({ ...structuredClone(document), name: getDiagramName(document), groups: document.groups ?? [] });
const historyState = () => ({ canUndo: history.canUndo, canRedo: history.canRedo });
const now = () => new Date().toISOString();
const contextFromDocument = (document: DiagramDocument): SourceContext | null => isContainerDocument(document) ? {
  scope: document.scope,
  sources: document.components.filter(c => c.role === 'external').map(c => ({ id: c.sourceComponentId!, name: c.name, description: c.description, type: c.type as C4ArtifactType })),
  capturedAt: now(),
} : null;
const saveErrorMessage = (error: unknown): string => {
  if (error instanceof DiagramApiError) {
    if (Array.isArray(error.details.diagramBlockers) || Array.isArray(error.details.blockers)) return formatDiagramApiError(error);
    const fields = error.details.fields;
    if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
      const detail = Object.values(fields).find(value => typeof value === 'string' && value.trim());
      if (detail) return `${error.message}: ${detail}`;
    }
  }
  return error instanceof Error ? error.message : 'Save failed';
};
const summary = (document: DiagramDocument): DiagramSummary => ({ id: document.id, name: getDiagramName(document), status: document.status, createdAt: document.createdAt, updatedAt: document.updatedAt, kind: document.kind ?? 'general', scope: document.scope ?? null });
const replaceSummary = (items: DiagramSummary[], next: DiagramSummary) => items.some(item => item.id === next.id) ? items.map(item => item.id === next.id ? next : item) : [...items, next];
const assertSaveIdentity = (request: DiagramDocument, response: DiagramDocument) => {
  const expectedName = request.kind === 'component' ? getComponentScope(response)?.containerName : request.kind === 'container' ? response.scope?.softwareSystemName : request.name.trim();
  if (response.id !== request.id || response.name?.trim() !== expectedName || (response.kind ?? 'general') !== (request.kind ?? 'general') || response.scope?.parentDiagramId !== request.scope?.parentDiagramId || getDiagramOwnerId(response) !== getDiagramOwnerId(request)) throw new Error('The save response did not match the diagram identity, name or parent/owner association. Your draft was kept. Retry saving this diagram.');
};
const overlayContext = (document: DiagramDocument, context: SourceContext | null): DiagramDocument => {
  if (!isScoped(document)) return copy(document);
  if (!context) {
    if (!savedMetadata || savedMetadata.id !== document.id) return copy(document);
    // A loaded document supplies display metadata, but cannot identify canonical source hops.
    // Keep those identities absent until the actual source-context response arrives.
    const sources = new Map(savedMetadata.components.filter(c => c.role === 'external').map(c => [c.sourceComponentId, c]));
    return { ...copy(document), name: getDiagramName(savedMetadata), scope: structuredClone(savedMetadata.scope), components: document.components.map(component => {
      const source = component.role === 'external' ? sources.get(component.sourceComponentId) : undefined;
      return source ? { ...structuredClone(component), name: source.name, description: source.description, type: source.type, containerType: source.containerType, technology: source.technology } : structuredClone(component);
    }) };
  }
  if (context.scope.parentDiagramId !== document.scope?.parentDiagramId || (document.kind === 'component' ? !isComponentSourceContext(context) || context.scope.containerId !== getComponentScope(document)?.containerId : isComponentSourceContext(context) || context.scope.softwareSystemId !== document.scope?.softwareSystemId)) throw new Error('Source context did not match this scoped diagram. Refresh its source details.');
  const sources = new Map(context.sources.map(source => [source.id, source]));
  const canonicalIds = new Set<string>();
  return { ...copy(document), name: isComponentSourceContext(context) ? context.scope.containerName : context.scope.softwareSystemName, scope: { ...context.scope }, components: document.components.map(component => {
    if (component.role !== 'external') return structuredClone(component);
    const source = sources.get(component.sourceComponentId!);
    if (!source) throw new Error(`External participant ${component.id} no longer has an eligible parent source. Repair the source before continuing.`);
    const canonicalId = 'canonicalSourceComponentId' in source ? source.canonicalSourceComponentId : source.id;
    if (canonicalIds.has(canonicalId)) throw new Error('Include each canonical supporting source only once.');
    canonicalIds.add(canonicalId);
    return { ...structuredClone(component), name: source.name, description: source.description, type: source.type, containerType: 'containerType' in source ? source.containerType : null, technology: 'technology' in source ? source.technology : null };
  }) };
};
const normalizedGroupName = (name: string) => name.trim().toLocaleLowerCase();
const validContainerDetails = (details: ContainerEdit) => isContainerType(details.containerType) && Boolean(details.name.trim()) && details.name.trim().length <= 200 && Boolean(details.description.trim()) && Boolean(details.technology.trim()) && details.technology.trim().length <= 200;
const validComponentDetails = (details: C4ComponentEdit) => Boolean(details.name.trim()) && details.name.trim().length <= 200 && Boolean(details.description.trim()) && Boolean(details.technology.trim()) && details.technology.trim().length <= 200;
const fitChild = fitScopedDiagramLayout;
const interactionError = (document: DiagramDocument, source: string, target: string, label: string | null, direction: string, protocol: string | null | undefined): string | null => {
  const a=document.components.find(c=>c.id===source), b=document.components.find(c=>c.id===target);
  if (!a || !b || source === target) return 'Choose two different local components.';
  const internalRole = document.kind === 'component' ? 'component' : 'container';
  if (isScoped(document) && (direction !== 'directed' || !label?.trim() || (a.role !== internalRole && b.role !== internalRole))) return `Interactions require a description, a directed connection, and at least one internal ${internalRole}.`;
  if (protocol && protocol.trim().length > 200) return 'Protocol must contain at most 200 characters.';
  return null;
};
/** Destructive snapshots are checked against current server dependencies before history moves. */
const removalChecks = (current: DiagramDocument, next: DiagramDocument): Promise<void> | undefined => {
  const allRemoved = current.components.filter(c => !next.components.some(n => n.id === c.id));
  const allRelationships = current.relationships.filter(r => !next.relationships.some(n => n.id === r.id));
  const draft = useAdrStore.getState().draft;
  if (draft?.diagramId === current.id && (allRemoved.some(c => draft.componentIds.includes(c.id)) || allRelationships.some(r => draft.relationshipIds.includes(r.id)))) throw new Error(`Repair links in decision ${draft.title || 'Untitled ADR'} before removing its local artifacts.`);
  const saved = savedMetadata?.id === current.id ? savedMetadata : null;
  const removed = allRemoved.filter(c => saved?.components.some(s => s.id === c.id));
  const reclassified = current.components.filter(c => saved?.components.some(s => s.id === c.id && next.components.some(n => n.id === c.id && n.type !== c.type && (!isC4ArtifactType(n.type) || s.type === 'software-system' && n.type !== 'software-system'))));
  const relationships = allRelationships.filter(r => saved?.relationships.some(s => s.id === r.id));
  if (!removed.length && !reclassified.length && !relationships.length) return;
  return (async () => {
    for (const component of [...removed, ...reclassified]) {
      const removing = removed.includes(component);
      let dependencies;
      try { dependencies = await diagramClient.dependencyCount(current.id, component.id); }
      catch (error) {
        if (error instanceof DiagramApiError && error.status === 404 && savedMetadata?.id === current.id && !savedMetadata.components.some(c => c.id === component.id)) continue;
        throw error;
      }
      const diagramBlockers = (dependencies.diagramBlockers ?? []).filter((b) => removing || !isC4ArtifactType(next.components.find(c => c.id === component.id)?.type) || (typeof b === 'object' && b !== null && 'componentId' in b && b.componentId === component.id));
      if (diagramBlockers.length || removing && (dependencies.relationshipCount || dependencies.blockers?.length || dependencies.groupIds?.length)) throw new DiagramApiError('Repair dependent diagrams, occurrences, relationships, decisions or groups before removing or reclassifying this element.', 409, { ...dependencies, diagramBlockers });
    }
    for (const relationship of relationships) {
      if (savedMetadata?.id === current.id && !savedMetadata.relationships.some(r => r.id === relationship.id)) continue;
      const blockers = await adrClient.relationshipSummaries(current.id, relationship.id);
      if (blockers.length) throw new Error(`Repair linked decisions before removing relationship ${relationship.id}: ${blockers.map(b => `${b.title} (${b.id})`).join(', ')}.`);
    }
  })();
};
export const describeGroupSelection = (document: DiagramDocument, memberComponentIds: string[], excludedGroupId?: string): string | null => {
  if (memberComponentIds.length < 2) return 'Select at least two Software System components before grouping.';
  if (new Set(memberComponentIds).size !== memberComponentIds.length) return 'Group members must be unique; remove duplicate component selections.';
  const members = memberComponentIds.map(id => document.components.find(component => component.id === id));
  if (members.some(component => !component)) return 'The grouping selection contains a component that is no longer in this diagram.';
  const existingMembers = members.filter((component): component is NonNullable<typeof component> => Boolean(component));
  const incompatible = existingMembers.filter(component => component.type !== 'software-system');
  if (incompatible.length > 0) {
    const incompatibleTypes = [...new Set(incompatible.map(component => getC4ArtifactTypeLabel(component.type)))].join(' and ');
    const selectedTypes = [...new Set(existingMembers.map(component => getC4ArtifactTypeLabel(component.type)))].join(' and ');
    if (selectedTypes.includes('Person') && selectedTypes.includes('Software System')) {
      return `Cannot group ${selectedTypes}. Person cannot be grouped with a Software System because system groups contain only Software Systems.`;
    }
    return `Cannot group ${incompatibleTypes}. System groups contain only Software System components.`;
  }
  if (memberComponentIds.some(componentId => document.groups.some(group => group.id !== excludedGroupId && group.memberComponentIds.includes(componentId)))) {
    return 'A selected Software System already belongs to a group. Remove it from that group before creating another.';
  }
  return null;
};
const groupCreationError = (document: DiagramDocument, name: string, memberComponentIds: string[], editingGroupId?: string): string | null => {
  const trimmedName = name.trim();
  if (!trimmedName) return 'Group name is required.';
  const selectionError = describeGroupSelection(document, memberComponentIds, editingGroupId);
  if (selectionError) return selectionError;
  const nameKey = normalizedGroupName(trimmedName);
  if (document.groups.some(group => group.id !== editingGroupId && normalizedGroupName(group.name) === nameKey)) return 'A group with this name already exists.';
  return null;
};
export const componentTypeLabel = getC4ArtifactTypeLabel;

export const describeGroupMemberAddError = (document: DiagramDocument, reason: GroupMemberAddReason): string => {
  const group = document.groups.find(item => item.id === reason.groupId);
  const component = document.components.find(item => item.id === reason.componentId);
  const currentGroup = reason.currentGroupId ? document.groups.find(item => item.id === reason.currentGroupId) : undefined;
  const componentName = component?.name ?? `Component ${reason.componentId}`;
  const groupName = group?.name ?? `Group ${reason.groupId}`;
  if (reason.code === 'already-member') return `${componentName} is already in ${groupName}. It cannot be added again.`;
  if (reason.code === 'already-in-other-group') return `${componentName} already belongs to ${currentGroup?.name ?? `another group (${reason.currentGroupId})`} and cannot be added to ${groupName}. A component can belong to only one group.`;
  if (reason.code === 'ineligible-component') return `${componentName} is not a Software System and cannot be added to a system group.`;
  return reason.message;
};

export const useDiagramStore = create<State>((set, get) => ({
  document: null,
  status: 'idle',
  error: null,
  dependencyError: null,
  groupError: null,
  clearGroupError: () => set({ groupError: null }),
  savedDocuments: [], trashedDocuments: [], savedDocumentsStatus: 'idle', savedDocumentsError: null,
  savedDocumentsDeleteStatus: 'idle', savedDocumentsDeleteError: null, savedDocumentsDeleteMessage: null,
  deletedSavedDocumentIds: [],
  loadError: null,
  navigationStatus: 'idle', savePending: false, archiveTransferActive: false, recoveryPending: false, revision: 0,
  sourceContext: null, sourceContextStatus: 'idle', sourceContextError: null,
  containerOpenStatus: 'idle',
  containerOpenError: null,
  containerOpenComponentId: null,
  componentOpenStatus: 'idle', componentOpenError: null, componentOpenComponentId: null, componentAvailability: null,
  canUndo: false,
  canRedo: false,
  open: (input, retainHistory = false) => {
    set({ dependencyError: null });
    const current = get().document;
    if (retainHistory && current && current.id !== input.id) {
      if (get().status === 'saved') retained.set(current.id, { document: copy(current), history: history.snapshot(), context: get().sourceContext });
      else retained.delete(current.id);
    }
    session++; loadRequest++;
    set({ componentOpenStatus: 'idle', componentOpenError: null, componentOpenComponentId: null, componentAvailability: null });
    const document = copy(input);
    savedMetadata = copy(document);
    let sourceContext = contextFromDocument(document);
    const previous = retainHistory ? retained.get(input.id) : undefined;
    if (previous && authoredContent(previous.document) === authoredContent(document)) {
      if (sourceContext && previous.context) sourceContext = { ...sourceContext, sources: [...new Map([...previous.context.sources, ...sourceContext.sources].map(source => [source.id, source])).values()] } as SourceContext;
      else if (document.kind === 'component' && previous.context && isComponentSourceContext(previous.context)) {
        sourceContext = { ...previous.context, scope: getComponentScope(document)!, sources: previous.context.sources.map(source => {
          const occurrence = document.components.find(c => c.role === 'external' && c.sourceComponentId === source.id);
          return occurrence ? { ...source, name: occurrence.name, description: occurrence.description, type: occurrence.type as ComponentContext['sources'][number]['type'], technology: occurrence.technology ?? null, containerType: occurrence.containerType ?? null } : source;
        }) };
      }
      history.restore(previous.history);
      try { history.map(entry => overlayContext(entry, sourceContext)); } catch { history.reset(document); }
    } else history.reset(document);
    set({ document, status: 'saved', revision: 0, navigationStatus: 'idle', sourceContext, sourceContextStatus: 'idle', sourceContextError: null, error: null, groupError: null, loadError: null, containerOpenStatus: 'idle', containerOpenError: null, containerOpenComponentId: null, ...historyState() });
  },
  startNew: () => { retained.clear(); session++; loadRequest++; set({ document: null, status: 'idle', revision: 0, navigationStatus: 'idle', sourceContext: null, sourceContextStatus: 'idle', sourceContextError: null, error: null, groupError: null, containerOpenStatus: 'idle', containerOpenError: null, containerOpenComponentId: null, componentOpenStatus: 'idle', componentOpenError: null, componentOpenComponentId: null, componentAvailability: null, canUndo: false, canRedo: false }); },
  create: async name => {
    const created = await diagramClient.create(name);
    get().open(created);
    set(state => ({ savedDocuments: replaceSummary(state.savedDocuments, summary(created)) }));
  },
  update: (fn, options) => {
    const current = get().document;
    if (!current) return;
    try {
      let next = copy(fn(copy(current)));
      if (isScoped(current)) {
        if (next.kind !== current.kind || next.id !== current.id || next.scope?.parentDiagramId !== current.scope?.parentDiagramId || getDiagramOwnerId(next) !== getDiagramOwnerId(current)) throw new Error('Scoped diagram ownership cannot be changed.');
        for (const previous of current.components) {
          const incoming = next.components.find(c => c.id === previous.id);
          if (incoming && (incoming.role !== previous.role || incoming.sourceComponentId !== previous.sourceComponentId)) throw new Error('Component roles and immediate source identities cannot be reassigned.');
        }
        const geometry = (document: DiagramDocument) => JSON.stringify(document.components.map(({ id, role, position, size }) => ({ id, role, position, size })));
        next = diagramDocumentSchema.parse(geometry(next) === geometry(current) ? next : fitChild(next)) as DiagramDocument;
        assertDiagramInvariants(next);
      }
      if (JSON.stringify(next) === JSON.stringify(current)) return;
      const revision = get().revision;
      const commit = () => {
        if (get().document !== current || get().revision !== revision) return;
        const document = history.push(next);
        set(state => ({ document, revision: state.revision + 1, status: 'unsaved', error: null, dependencyError: null, groupError: null, ...historyState() }));
      };
      let checks: Promise<void> | undefined;
      try { checks = options?.confirmedRemoval ? undefined : removalChecks(current, next); }
      catch (error) { set({ error: saveErrorMessage(error), dependencyError: saveErrorMessage(error) }); return; }
      if (checks) return checks.then(commit).catch(error => { if (get().document === current && get().revision === revision) set({ error: saveErrorMessage(error), dependencyError: saveErrorMessage(error) }); });
      commit();
    } catch (error) { set({ error: saveErrorMessage(error) }); }
  },
  undo: () => {
    const current = get().document, target = history.peekUndo(), revision = get().revision;
    if (!current || !target) return;
    try {
      const document = overlayContext(target, get().sourceContext);
      const commit = () => { if (get().document !== current || get().revision !== revision) return; history.undo(); set({ document, revision: revision + 1, status: 'unsaved', error: null, dependencyError: null, groupError: null, ...historyState() }); };
      const checks = removalChecks(current, document);
      if (checks) return checks.then(commit).catch(error => { if (get().document === current && get().revision === revision) set({ error: saveErrorMessage(error), dependencyError: saveErrorMessage(error) }); });
      commit();
    } catch (error) { set({ error: saveErrorMessage(error), dependencyError: saveErrorMessage(error) }); }
  },
  redo: () => {
    const current = get().document, target = history.peekRedo(), revision = get().revision;
    if (!current || !target) return;
    try {
      const document = overlayContext(target, get().sourceContext);
      const commit = () => { if (get().document !== current || get().revision !== revision) return; history.redo(); set({ document, revision: revision + 1, status: 'unsaved', error: null, dependencyError: null, groupError: null, ...historyState() }); };
      const checks = removalChecks(current, document);
      if (checks) return checks.then(commit).catch(error => { if (get().document === current && get().revision === revision) set({ error: saveErrorMessage(error), dependencyError: saveErrorMessage(error) }); });
      commit();
    } catch (error) { set({ error: saveErrorMessage(error), dependencyError: saveErrorMessage(error) }); }
  },
  addComponent: (name, type, description = null) => {
    const document = get().document;
    if (document && isScoped(document)) { set({error:document.kind === 'component' ? 'Use the Component form with name, responsibilities and technology.' : 'Use Application or Datastore to add an internal container.'}); return false; }
    if (!document || !name.trim() || !isC4ArtifactType(type)) return false;
    const timestamp = now();
    get().update(current => ({
      ...current,
      components: [...current.components, {
        id: crypto.randomUUID(), diagramId: current.id, name: name.trim(), description: description?.trim() || null, type,
        position: { x: 80 + current.components.length * 180, y: 100 + (current.components.length % 3) * 120 },
        size: { ...DEFAULT_COMPONENT_SIZE },
        createdAt: timestamp, updatedAt: timestamp,
      }],
    }));
    return true;
  },
  addContainer: details => {
    const document=get().document;
    if (document?.kind !== 'container' || !validContainerDetails(details)) { set({error:'Choose Application or Datastore and provide name, responsibilities and technology.'}); return false; }
    const timestamp=now();
    get().update(current=>({...current,components:[...current.components,{
      id:crypto.randomUUID(),diagramId:current.id,name:details.name.trim(),description:details.description.trim(),technology:details.technology.trim(),containerType:details.containerType,type:'container',role:'container',sourceComponentId:null,
      position:{x:100+current.components.filter(c=>c.role==='container').length*340,y:100},size:getContainerComponentMinimumSize(details),createdAt:timestamp,updatedAt:timestamp,
    }]}));
    return get().document !== document;
  },
  editContainer: (componentId,details) => {
    const document=get().document, component=document?.components.find(c=>c.id===componentId);
    if(document?.kind!=='container'||component?.role!=='container'||!validContainerDetails(details)){set({error:'Choose Application or Datastore and provide name, responsibilities and technology.'});return false;}
    const minimum=getContainerComponentMinimumSize(details);
    get().update(current=>({...current,components:current.components.map(c=>c.id===componentId?{...c,name:details.name.trim(),description:details.description.trim(),technology:details.technology.trim(),containerType:details.containerType,size:{width:Math.max(c.size.width,minimum.width),height:Math.max(c.size.height,minimum.height)},updatedAt:now()}:c)}));
    return get().document!==document;
  },
  addC4Component: details => {
    const document = get().document;
    if (document?.kind !== 'component' || !validComponentDetails(details)) { set({ error: 'Provide a Component name, responsibilities and technology (name and technology at most 200 characters).' }); return false; }
    const timestamp = now();
    get().update(current => ({ ...current, components: [...current.components, {
      id: crypto.randomUUID(), diagramId: current.id, name: details.name.trim(), description: details.description.trim(), technology: details.technology.trim(), type: 'component', role: 'component', containerType: null, sourceComponentId: null,
      position: { x: 100 + current.components.filter(c => c.role === 'component').length * 480, y: 100 }, size: getContainerComponentMinimumSize(details), createdAt: timestamp, updatedAt: timestamp,
    }] }));
    return get().document !== document;
  },
  editC4Component: (componentId, details) => {
    const document = get().document, component = document?.components.find(c => c.id === componentId);
    if (document?.kind !== 'component' || component?.role !== 'component' || !validComponentDetails(details)) { set({ error: 'Provide a Component name, responsibilities and technology (name and technology at most 200 characters).' }); return false; }
    const minimum = getContainerComponentMinimumSize(details);
    get().update(current => ({ ...current, components: current.components.map(c => c.id === componentId ? { ...c, name: details.name.trim(), description: details.description.trim(), technology: details.technology.trim(), size: { width: Math.max(c.size.width, minimum.width), height: Math.max(c.size.height, minimum.height) }, updatedAt: now() } : c) }));
    return get().document !== document;
  },
  includeExternalParticipant: (sourceId,input) => {
    const document=get().document;
    const parsed=document?.kind === 'component' ? componentContextSchema.safeParse(input) : containerContextSchema.safeParse(input);
    if(!document || !isScoped(document) || !parsed.success){set({error:'Choose a valid source context for this diagram.'});return false;}
    const context=parsed.data,source=context.sources.find(c=>c.id===sourceId);
    const ownerId = getDiagramOwnerId(document);
    const contextOwner = 'containerId' in context.scope ? context.scope.containerId : context.scope.softwareSystemId;
    const canonical = (id: string) => { const source = context.sources.find(s => s.id === id); return source && 'canonicalSourceComponentId' in source ? source.canonicalSourceComponentId : id; };
    if(!source||context.scope.parentDiagramId!==document.scope?.parentDiagramId||contextOwner!==ownerId||sourceId===ownerId||document.components.some(c=>c.sourceComponentId && canonical(c.sourceComponentId)===canonical(sourceId))){set({error:'Choose an eligible parent participant that is not already included.'});return false;}
    const timestamp=now(),boundary=document.boundary!;
    const technology = 'technology' in source ? source.technology : null;
    get().update(current=>overlayContext({...current,components:[...current.components,{diagramId:current.id,name:source.name,description:source.description,type:source.type,id:crypto.randomUUID(),sourceComponentId:sourceId,role:'external',containerType:'containerType' in source ? source.containerType : null,technology,position:{x:boundary.position.x+boundary.size.width+24,y:boundary.position.y},size:getContainerComponentMinimumSize({...source,technology}),createdAt:timestamp,updatedAt:timestamp}]},context));
    if (get().document !== document) get().applyContainerContext(context);
    return get().document!==document;
  },
  applyComponentGeometry: edits => {
    const document=get().document;if(!document)return false;
    const byId=new Map(edits.map(e=>[e.id,e]));
    try {
      for(const edit of edits){const c=document.components.find(c=>c.id===edit.id);if(!c)throw new Error('The component no longer exists.');if(![edit.position.x,edit.position.y,edit.size.width,edit.size.height].every(Number.isFinite)||edit.size.width<=0||edit.size.height<=0)throw new Error('Use finite positions and positive sizes.');if(isScoped(document)&&c.role==='external')validateExternalPlacement(document.boundary!,edit);}
      set({error:null});
      get().update(current=>({...current,components:current.components.map(c=>{const e=byId.get(c.id);if(!e||JSON.stringify(c.position)===JSON.stringify(e.position)&&JSON.stringify(c.size)===JSON.stringify(e.size))return c;const minimum=c.role==='container'||c.role==='component'?getContainerComponentMinimumSize(c):null;return {...c,position:e.position,size:minimum?{width:Math.max(e.size.width,minimum.width),height:Math.max(e.size.height,minimum.height)}:e.size,updatedAt:now()};})}));
      return !get().error;
    }catch(error){set({error:saveErrorMessage(error)});return false;}
  },
  setComponentType: (componentId, type) => {
    const current = get().document;
    const component = current?.components.find(item => item.id === componentId);
    if (!current || isScoped(current) || !component || !isC4ArtifactType(type)) return false;
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
    if (document && isScoped(document)) { set({groupError:'Scoped diagrams cannot contain system groups.'}); return false; }
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
  addGroupMember: (groupId, componentId) => {
    const document = get().document;
    if (!document) {
      set({ groupError: 'Create or open a diagram before adding a component to a group.' });
      return false;
    }
    const reason = assertCanAddGroupMember(document, groupId, componentId);
    if (reason) {
      set({ groupError: describeGroupMemberAddError(document, reason) });
      return false;
    }
    const timestamp = now();
    get().update(current => {
      const group = current.groups.find(item => item.id === groupId);
      if (!group) return current;
      const memberComponentIds = [...group.memberComponentIds, componentId];
      const members = memberComponentIds.flatMap(memberId => {
        const member = current.components.find(component => component.id === memberId);
        return member ? [{ position: member.position, size: member.size }] : [];
      });
      return {
        ...current,
        groups: current.groups.map(item => item.id === groupId
          ? { ...item, memberComponentIds, ...fitGroupBoundsAfterLayout(members), updatedAt: timestamp }
          : item),
      };
    });
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
    if (isScoped(document)) return get().applyComponentGeometry([{id:componentId,position,size:component.size}]);
    get().update(current => ({
      ...current,
      components: current.components.map(item => item.id === componentId ? { ...item, position, updatedAt: now() } : item),
      groups: current.groups.map(group => {
        if (!group.memberComponentIds.includes(componentId)) return group;
        const members=group.memberComponentIds.flatMap(memberId=>{
          const member=current.components.find(item=>item.id===memberId);
          if(!member)return [];
          return [{ position: memberId===componentId ? position : member.position, size: member.size }];
        });
        return { ...group, ...fitGroupBoundsAfterLayout(members), updatedAt: now() };
      }),
    }));
    return true;
  },
  resizeComponent: (componentId, size) => {
    const document = get().document;
    const component = document?.components.find(item => item.id === componentId);
    if (!document || !component || !Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width <= 0 || size.height <= 0) return false;
    if (isScoped(document)) return get().applyComponentGeometry([{id:componentId,position:component.position,size}]);
    get().update(current => ({
      ...current,
      components: current.components.map(item => item.id === componentId ? { ...item, size: { ...size }, updatedAt: now() } : item),
      groups: current.groups.map(item => {
        if (!item.memberComponentIds.includes(componentId)) return item;
        const members=item.memberComponentIds.flatMap(memberId=>{
          const member=current.components.find(candidate=>candidate.id===memberId);
          if(!member)return [];
          return [{ position: member.position, size: memberId===componentId ? size : member.size }];
        });
        return { ...item, ...fitGroupBoundsAfterLayout(members), updatedAt: now() };
      }),
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
      groups: current.groups.map(item => {
        if (item.id !== groupId) return item;
        const memberComponentIds=item.memberComponentIds.filter(id => id !== componentId);
        const members=memberComponentIds.flatMap(memberId=>{
          const member=current.components.find(candidate=>candidate.id===memberId);
          return member ? [{ position: member.position, size: member.size }] : [];
        });
        return { ...item, memberComponentIds, ...fitGroupBoundsAfterLayout(members), updatedAt: now() };
      }),
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
  addRelationship: (sourceComponentId, targetComponentId, label, direction, protocol = null) => {
    const document = get().document;
    if (!document) return false;
    const error=interactionError(document,sourceComponentId,targetComponentId,label,direction,protocol);
    if(error){set({error});return false;}
    const timestamp = now();
    get().update(current => ({
      ...current,
      relationships: [...current.relationships, {
        id: crypto.randomUUID(), diagramId: current.id, sourceComponentId, targetComponentId,
        label: label.trim() || null, direction, protocol:protocol?.trim() || null, createdAt: timestamp, updatedAt: timestamp,
      }],
    }));
    return get().document !== document;
  },
  renameComponent: (componentId, name) => {
    const trimmedName = name.trim();
    if (!trimmedName || !get().document?.components.some(component => component.id === componentId)) return false;
    const component=get().document!.components.find(c=>c.id===componentId)!;
    if(component.role==='external')return false;
    if(component.role==='component')return get().editC4Component(componentId,{name,description:component.description!,technology:component.technology!});
    if(component.role==='container')return get().editContainer(componentId,{name,description:component.description!,technology:component.technology!,containerType:component.containerType!});
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
    const error=interactionError(current,sourceComponentId,targetComponentId,updates.label===undefined?relationship.label:updates.label,updates.direction??relationship.direction,updates.protocol===undefined?relationship.protocol:updates.protocol);
    if(error){set({error});return false;}
    get().update(document => ({
      ...document,
      relationships: document.relationships.map(item => item.id === relationshipId
        ? {
          ...item,
          sourceComponentId,
          targetComponentId,
          direction: updates.direction ?? item.direction,
          label: updates.label === undefined ? item.label : updates.label?.trim() || null,
          protocol: updates.protocol === undefined ? item.protocol : updates.protocol?.trim() || null,
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
    return get().update(current => ({
      ...current,
      relationships: current.relationships.filter(relationship => relationship.id !== relationshipId),
    }));
  },
  save: async () => {
    if (get().savePending || get().status === 'saving' || get().navigationStatus === 'loading' || get().containerOpenStatus === 'loading' || get().componentOpenStatus === 'loading') return;
    const documentAtSaveStart = get().document;
    if (!documentAtSaveStart) return;
    const captured = copy(documentAtSaveStart), revision = get().revision, saveSession = session;
    set({ status: 'saving', savePending: true, error: null });
    try {
      const response = await diagramClient.save(captured);
      assertSaveIdentity(captured, response);
      const saved = diagramDocumentSchema.parse(response) as DiagramDocument;
      if (session === saveSession) {
        set(state => {
          let sourceContext: SourceContext | null = state.sourceContext;
          savedMetadata = copy(saved);
          if (isContainerDocument(saved)) {
            const sources = new Map<string, ContainerContext['sources'][number]>(sourceContext && !isComponentSourceContext(sourceContext) ? sourceContext.sources.map(source => [source.id, source]) : []);
            for (const occurrence of saved.components.filter(c => c.role === 'external')) sources.set(occurrence.sourceComponentId!, { id: occurrence.sourceComponentId!, name: occurrence.name, description: occurrence.description, type: occurrence.type as C4ArtifactType });
            sourceContext = { scope: saved.scope, sources: [...sources.values()], capturedAt: now() };
          } else if (saved.kind === 'component' && sourceContext && isComponentSourceContext(sourceContext)) {
            sourceContext = { ...sourceContext, scope: getComponentScope(saved)!, capturedAt: now(), sources: sourceContext.sources.map(source => {
              const occurrence = saved.components.find(c => c.role === 'external' && c.sourceComponentId === source.id);
              return occurrence ? { ...source, name: occurrence.name, description: occurrence.description, type: occurrence.type as ComponentContext['sources'][number]['type'], containerType: occurrence.containerType ?? null, technology: occurrence.technology ?? null } : source;
            }) };
          }
          history.map(entry => overlayContext(entry, sourceContext));
          return { sourceContext,
            savedDocuments: reconcileParentDiagramSummaries(replaceSummary(state.savedDocuments, summary(saved)), saved),
            trashedDocuments: reconcileParentDiagramSummaries(state.trashedDocuments, saved),
            ...(state.revision === revision ? { document: overlayContext(saved, sourceContext), status: 'saved' as const, error: null } : { document: state.document ? overlayContext(state.document, sourceContext) : null }),
          };
        });
      }
    } catch (error) {
      if (session === saveSession) set({ ...(get().revision === revision ? { status: 'failed' as const } : {}), error: saveErrorMessage(error) });
    } finally { set({ savePending: false }); }
  },
  retry: async () => { await get().save(); },
  refreshSavedDocuments: async () => {
    if (recoveryRefreshes) return;
    const listRequest = ++savedListRequest;
    const before = new Map(get().savedDocuments.map(document => [document.id, document]));
    set({ savedDocumentsStatus: 'loading', savedDocumentsError: null });
    try {
      const savedDocuments = await diagramClient.list();
      if (listRequest !== savedListRequest) return;
      const deletedIds = new Set(get().deletedSavedDocumentIds ?? []);
      const changed = get().savedDocuments.filter(document => before.get(document.id) !== document);
      const changedById = new Map(changed.map(document => [document.id, document]));
      const reconciled = savedDocuments.map(document => changedById.get(document.id) ?? document);
      for (const document of changed) if (!reconciled.some(item => item.id === document.id)) reconciled.push(document);
      set({ savedDocuments: reconciled.filter(document => !deletedIds.has(document.id)), savedDocumentsStatus: 'loaded', savedDocumentsError: null });
    }
    catch (error) { if (listRequest === savedListRequest) set({ savedDocumentsStatus: 'failed', savedDocumentsError: error instanceof Error ? error.message : 'Could not load saved diagrams.' }); }
  },
  refreshRecoveryLists: async (affectedIds = []) => {
    const listRequest = ++savedListRequest;
    recoveryRefreshes++;
    try {
      const [savedDocuments, trashedDocuments] = await Promise.all([diagramClient.list(), diagramClient.listTrash()]);
      if (listRequest !== savedListRequest) return;
      set(state => ({ savedDocuments, trashedDocuments, deletedSavedDocumentIds: state.deletedSavedDocumentIds.filter(id => !affectedIds.includes(id)), savedDocumentsStatus: 'loaded', savedDocumentsError: null }));
    } finally { recoveryRefreshes--; }
  },
  trashSavedDocument: async (id, confirmedDiagramIds) => {
    if (get().savedDocumentsDeleteStatus === 'deleting') return false;
    if (!get().savedDocuments.some(document => document.id === id)) {
      set({ savedDocumentsDeleteStatus: 'failed', savedDocumentsDeleteError: 'That diagram is no longer available. Refresh the list and try again.', savedDocumentsDeleteMessage: null });
      return false;
    }
    set({ savedDocumentsDeleteStatus: 'deleting', savedDocumentsDeleteError: null, savedDocumentsDeleteMessage: null });
    try {
      if (confirmedDiagramIds) await diagramClient.trash(id, confirmedDiagramIds); else await diagramClient.trash(id);
      set(state => ({
        savedDocuments: state.savedDocuments.filter(document => !(confirmedDiagramIds ?? [id]).includes(document.id)),
        deletedSavedDocumentIds: [...new Set([...(state.deletedSavedDocumentIds ?? []), ...(confirmedDiagramIds ?? [id])])],
        savedDocumentsDeleteStatus: 'succeeded',
        savedDocumentsDeleteError: null,
        savedDocumentsDeleteMessage: 'Diagram moved to recoverable trash.',
      }));
      return true;
    } catch (error) {
      set({ savedDocumentsDeleteStatus: 'failed', savedDocumentsDeleteError: error instanceof Error ? error.message : 'Could not move the diagram to trash. Try again.', savedDocumentsDeleteMessage: null });
      return false;
    }
  },
  registerRestoredSavedDocument: document => set(state => ({
    savedDocuments: replaceSummary(state.savedDocuments, summary(document)),
    deletedSavedDocumentIds: (state.deletedSavedDocumentIds ?? []).filter(id => id !== document.id),
    savedDocumentsDeleteStatus: 'idle',
    savedDocumentsDeleteError: null,
    savedDocumentsDeleteMessage: null,
  })),
  loadSavedDocument: async (id, options = {}) => {
    if (get().savePending || get().status === 'saving' || get().containerOpenStatus === 'loading' || get().componentOpenStatus === 'loading') return false;
    const request = ++loadRequest, source = get().document, revision = get().revision, loadSession = session;
    set({ loadError: null, navigationStatus: 'loading' });
    try {
      const document = await diagramClient.get(id);
      if (document.id !== id) throw new Error('The selected diagram identity did not match the requested diagram.');
      if (request !== loadRequest) return false;
      if (session !== loadSession || get().document?.id !== source?.id || get().revision !== revision || options.canCommit?.() === false) throw new Error('Your diagram or decision changed while loading. Your work was kept; review Save, Discard or Cancel before continuing.');
      const known = get().savedDocuments.find(item => item.id === id);
      if (known && ((known.kind ?? 'general') !== (document.kind ?? 'general') || known.scope && (known.scope.parentDiagramId !== document.scope?.parentDiagramId || getDiagramOwnerId(known) !== getDiagramOwnerId(document)))) throw new Error('The loaded diagram did not match its saved level or original parent/owner association. Refresh the library and retry.');
      get().open(document, true);
      set(state => ({ savedDocuments: replaceSummary(state.savedDocuments, summary(document)) }));
      return true;
    }
    catch (error) { if (request === loadRequest) set({ loadError: error instanceof Error ? error.message : 'Could not load the selected diagram.' }); return false; }
    finally { if (request === loadRequest) set({ navigationStatus: 'idle' }); }
  },
  applyContainerContext: input => {
    const document = get().document;
    if (!document || !isScoped(document)) return false;
    try {
      const context = document.kind === 'component' ? componentContextSchema.parse(input) : containerContextSchema.parse(input);
      const refreshed = overlayContext(document, context);
      assertDiagramInvariants(refreshed);
      // Validate all retained snapshots before changing either history or current state.
      history.map(entry => overlayContext(entry, context));
      set(state => ({ document: refreshed, sourceContext: context, sourceContextStatus: 'loaded', sourceContextError: null, savedDocuments: state.savedDocuments.map(item => item.id === document.id ? { ...item, name: getDiagramName(refreshed), scope: context.scope } : item) }));
      return true;
    } catch (error) { set({ sourceContextStatus: 'failed', sourceContextError: saveErrorMessage(error) }); return false; }
  },
  refreshContainerContext: async () => {
    const document = get().document;
    if (!document || !isScoped(document) || get().sourceContextStatus === 'loading') return false;
    const contextSession = session;
    set({ sourceContextStatus: 'loading', sourceContextError: null });
    try {
      const context = await (document.kind === 'component' ? diagramClient.componentContext(document.id) : diagramClient.containerContext(document.id));
      if (contextSession !== session) return false;
      return get().applyContainerContext(context);
    } catch (error) { if (contextSession === session) set({ sourceContextStatus: 'failed', sourceContextError: saveErrorMessage(error) }); return false; }
  },
  createOrOpenContainerDiagram: async (componentId, options = {}) => {
    if (get().containerOpenStatus === 'loading' || get().componentOpenStatus === 'loading' || get().savePending || get().status === 'saving' || get().navigationStatus === 'loading') return false;
    const sourceDocument = get().document;
    const component = sourceDocument?.components.find(item => item.id === componentId);
    const isOwnerElement = (sourceDocument?.kind ?? 'general') === 'general' && (component?.role ?? 'element') === 'element' && component?.type === 'software-system';
    const isExternalSystem = (sourceDocument?.kind === 'container' || sourceDocument?.kind === 'component') && component?.role === 'external' && component.type === 'software-system';
    if (!sourceDocument || !component || (!isOwnerElement && !isExternalSystem)) {
      set({ containerOpenStatus: 'failed', containerOpenError: 'Select a Software System to open its container diagram.' });
      return false;
    }
    if (sourceDocument.status !== 'active' || get().status !== 'saved') {
      set({ containerOpenStatus: 'failed', containerOpenError: 'Save the current diagram before opening a container diagram.' });
      return false;
    }
    set({ containerOpenStatus: 'loading', containerOpenError: null, containerOpenComponentId: componentId });
    try {
      const availability = await diagramClient.containerAvailability(sourceDocument.id, componentId);
      if (get().document !== sourceDocument || get().status !== 'saved' || options.canCommit?.() === false) throw new Error('The current diagram or decision changed while availability was loading. Try again from the current selection.');
      if (availability.availability === 'trashed') {
        const name = availability.diagram?.name ?? component.name;
        if (availability.diagram && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('adr:recover-diagram', { detail: { kind: 'restore', id: availability.diagram.id } }));
        throw new Error(`The container diagram “${name}” is in Trash. Restore it before opening; no replacement was created.`);
      }
      if (get().document !== sourceDocument || get().status !== 'saved' || options.canCommit?.() === false) throw new Error('The current diagram or decision changed while availability was loading. Try again from the current selection.');
      const createdOrExisting = await diagramClient.createOrOpenContainerDiagram(sourceDocument.id, componentId);
      if (get().document !== sourceDocument || get().status !== 'saved' || options.canCommit?.() === false) throw new Error('The current diagram or decision changed while the container diagram was opening. It is safe to retry.');
      const loaded = await diagramClient.get(createdOrExisting.id);
      if (get().document !== sourceDocument || get().status !== 'saved' || options.canCommit?.() === false) throw new Error('The current diagram or decision changed while loading. Your current work was kept; try opening again.');
      if (loaded.id !== createdOrExisting.id || loaded.kind !== 'container' || loaded.scope?.parentDiagramId !== availability.parentDiagramId || loaded.scope?.softwareSystemId !== availability.softwareSystemId) {
        throw new Error('The loaded container diagram did not match the selected Software System. Try again.');
      }
      const opened = copy(loaded);
      get().open(opened, true);
      set(state => ({ savedDocuments: replaceSummary(state.savedDocuments, summary(opened)) }));
      void get().refreshSavedDocuments();
      return true;
    } catch (error) {
      const recoveryDiagram = error instanceof DiagramApiError ? error.details.diagram : undefined;
      if (error instanceof DiagramApiError && error.details.code === 'RESTORE_REQUIRED' && typeof recoveryDiagram === 'object' && recoveryDiagram !== null && 'id' in recoveryDiagram && typeof recoveryDiagram.id === 'string' && get().document === sourceDocument && options.canCommit?.() !== false && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('adr:recover-diagram', { detail: { kind: 'restore', id: recoveryDiagram.id } }));
      set({ containerOpenStatus: 'failed', containerOpenError: saveErrorMessage(error) });
      return false;
    }
  },
  createOrOpenComponentDiagram: async (componentId, options = {}) => {
    if (get().componentOpenStatus === 'loading' || get().containerOpenStatus === 'loading' || get().savePending || get().status === 'saving' || get().navigationStatus === 'loading') return false;
    const sourceDocument = get().document;
    const component = sourceDocument?.components.find(c => c.id === componentId);
    const eligible = component?.type === 'container' && isContainerType(component.containerType) && (sourceDocument?.kind === 'container' ? component.role === 'container' : sourceDocument?.kind === 'component' && component.role === 'external' && !!component.sourceComponentId);
    if (!sourceDocument || !eligible || get().status !== 'saved' || sourceDocument.status !== 'active') {
      set({ componentOpenStatus: 'failed', componentOpenComponentId: componentId, componentOpenError: 'Select a saved Application or Datastore. Save the current diagram before opening its Component diagram.' });
      return false;
    }
    const requestSession = session;
    const unchanged = () => session === requestSession && get().document === sourceDocument && get().status === 'saved' && options.canCommit?.() !== false;
    set({ componentOpenStatus: 'loading', componentOpenError: null, componentOpenComponentId: componentId, componentAvailability: null });
    try {
      const availability = await diagramClient.componentAvailability(sourceDocument.id, componentId);
      if (!unchanged()) throw new Error('Your diagram or decision changed while checking availability. Your work was kept; retry from the current selection.');
      const expectedParentId = sourceDocument.kind === 'container' ? sourceDocument.id : sourceDocument.scope?.parentDiagramId;
      const expectedOwnerId = sourceDocument.kind === 'container' ? component.id : component.sourceComponentId;
      if (availability.parentDiagramId !== expectedParentId || availability.containerId !== expectedOwnerId) throw new Error('Component availability did not match the selected canonical container. Refresh its source and retry.');
      set({ componentAvailability: availability });
      if (availability.availability === 'trashed') {
        if (availability.diagram && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('adr:recover-diagram', { detail: { kind: 'restore', id: availability.diagram.id } }));
        throw new Error('This container has a Component diagram in Trash. Restore it before opening.');
      }
      const target = availability.availability === 'active' && availability.diagram ? availability.diagram : await diagramClient.createOrOpenComponentDiagram(availability.parentDiagramId, availability.containerId);
      if (!unchanged()) throw new Error('Your diagram or decision changed during creation. Your work was kept; retry to open the canonical child.');
      const loaded = await diagramClient.get(target.id);
      if (!unchanged()) throw new Error('Your diagram or decision changed while loading. Your work was kept; retry opening.');
      const scope = getComponentScope(loaded);
      if (!scope || loaded.id !== target.id || scope.parentDiagramId !== availability.parentDiagramId || scope.containerId !== availability.containerId) throw new Error('The loaded Component diagram did not match the selected container. Retry opening its canonical child.');
      get().open(loaded, true);
      set(state => ({ savedDocuments: replaceSummary(state.savedDocuments, summary(loaded)) }));
      void get().refreshSavedDocuments();
      return true;
    } catch (error) {
      if (session === requestSession) {
        const recoveryDiagram = error instanceof DiagramApiError ? error.details.diagram : undefined;
        if (error instanceof DiagramApiError && error.details.code === 'RESTORE_REQUIRED' && unchanged() && typeof recoveryDiagram === 'object' && recoveryDiagram !== null && 'id' in recoveryDiagram && typeof recoveryDiagram.id === 'string' && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('adr:recover-diagram', { detail: { kind: 'restore', id: recoveryDiagram.id } }));
        set({ componentOpenStatus: 'failed', componentOpenError: saveErrorMessage(error) });
      }
      return false;
    }
  },
}));
