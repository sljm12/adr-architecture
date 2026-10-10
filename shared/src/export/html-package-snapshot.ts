import type { ArchitectureDecisionRecord, ContainerAvailability, ComponentAvailability, ContainerContext, ComponentContext, DiagramDocument } from '../domain/types';
import type { AdrExportDraft, HtmlExportSnapshot } from './html-snapshot';
import { HtmlExportError, mergeExportAdrDraft, validateExportAdrs, validateExportDiagram } from './html-snapshot';
import { htmlExportSourceSchema, uuidSchema } from '../validation/schemas';
import { getDiagramOwnerId, isC4ArtifactType, isContainerType } from '../domain/c4';

/** Cloned drafts actually retained by the session, keyed by stable saved identity. */
export interface HtmlPackageOverride { diagram: DiagramDocument; draft?: AdrExportDraft | null }
export interface HtmlPackageCapture { entryDiagramId: string; capturedAt: string; overrides: Record<string, HtmlPackageOverride> }
export interface HtmlExportSourceMember { diagram: DiagramDocument; adrs: ArchitectureDecisionRecord[] }
export type ExportAvailability = ContainerAvailability | ComponentAvailability;
export type ExportSourceContext = ContainerContext | ComponentContext;
/** Detached saved subtree plus context-only ancestor/source projections. */
export interface HtmlExportSource {
  entryDiagramId: string; sourceCapturedAt: string; diagrams: HtmlExportSourceMember[];
  availability: ExportAvailability[]; sourceContexts: Record<string, ExportSourceContext>;
}
export interface HtmlPackageSnapshot {
  entryDiagramId: string; capturedAt: string; diagrams: HtmlExportSnapshot[];
  ownerChildren: Record<string, string>; availability: ExportAvailability[];
}

function fail(diagramId: string, field: string, detail: string, kind: HtmlExportError['artifactKind'] = 'diagram', id = diagramId): never {
  throw new HtmlExportError(kind, id, field, detail, 'Repair the referenced artifact or field and retry the export.', diagramId);
}
function scoped<T>(diagramId: string, action: () => T): T {
  try { return action(); }
  catch (error) {
    if (error instanceof HtmlExportError && !error.diagramId) throw new HtmlExportError(error.artifactKind, error.artifactId, error.field, error.detail, error.remedy, diagramId);
    throw error;
  }
}
const ownerKey = (value: ExportAvailability) => 'containerId' in value ? value.containerId : value.softwareSystemId;

/** Verify saved membership first, then hydrate overlays ancestor-first independently of output order. */
export function assembleHtmlPackageSnapshot(captureInput: HtmlPackageCapture, sourceInput: HtmlExportSource): HtmlPackageSnapshot {
  const capture = structuredClone(captureInput);
  if (!uuidSchema.safeParse(capture.entryDiagramId).success) fail(capture.entryDiagramId, 'entryDiagramId', 'The selected identity must be a UUID.');
  if (!Number.isFinite(Date.parse(capture.capturedAt))) fail(capture.entryDiagramId, 'capturedAt', 'A valid capture timestamp is required.');
  const parsed = htmlExportSourceSchema.safeParse(sourceInput);
  if (!parsed.success) {
    const issue = parsed.error.issues[0], index = issue.path[0] === 'diagrams' && typeof issue.path[1] === 'number' ? issue.path[1] : 0;
    const member = sourceInput?.diagrams?.[index];
    const collection = issue.path.findIndex(part => ['components', 'relationships', 'groups', 'adrs'].includes(String(part)));
    const kind = collection < 0 ? 'diagram' : ({ components: 'component', relationships: 'relationship', groups: 'group', adrs: 'ADR' } as const)[issue.path[collection] as 'components' | 'relationships' | 'groups' | 'adrs'];
    let artifact: unknown = sourceInput;
    if (collection >= 0) for (const part of issue.path.slice(0, collection + 2)) artifact = artifact && typeof artifact === 'object' ? Reflect.get(artifact, part) : undefined;
    const id = collection >= 0 && artifact && typeof artifact === 'object' && 'id' in artifact ? String(artifact.id) : member?.diagram.id;
    fail(member?.diagram.id ?? capture.entryDiagramId, issue.path.join('.') || 'source', issue.message, kind, id);
  }
  const source = parsed.data as HtmlExportSource;
  if (source.entryDiagramId !== capture.entryDiagramId || source.diagrams[0].diagram.id !== capture.entryDiagramId) fail(capture.entryDiagramId, 'entryDiagramId', 'Source and capture do not identify the same entry.');
  const ids = new Map<string, Set<string>>();
  const unique = (diagramId: string, kind: HtmlExportError['artifactKind'], artifacts: Array<{ id: string }>) => {
    const seen = ids.get(kind) ?? new Set<string>(); ids.set(kind, seen);
    for (const artifact of artifacts) { if (seen.has(artifact.id)) fail(diagramId, 'id', 'Duplicate artifact identity across the included package.', kind, artifact.id); seen.add(artifact.id); }
  };
  const members = new Map(source.diagrams.map(m => [m.diagram.id, m]));
  const ownerChildren: Record<string, string> = {}, available = new Map<string, ExportAvailability>();
  for (const member of source.diagrams) unique(member.diagram.id, 'diagram', [member.diagram]);
  for (const availability of source.availability) {
    const ownerId = ownerKey(availability), parent = members.get(availability.parentDiagramId)?.diagram;
    if (!parent || available.has(ownerId) || parent.kind === 'component' || ('containerId' in availability) !== (parent.kind === 'container')) fail(parent?.id ?? source.entryDiagramId, 'availability', 'Availability has an unrelated or duplicated owner or level.');
    const owner = parent.components.find(c => c.id === ownerId);
    if (!owner || (parent.kind === 'container' ? owner.role !== 'container' || owner.type !== 'container' : (owner.role ?? 'element') !== 'element' || owner.type !== 'software-system')) fail(parent.id, 'availability', 'An availability owner is missing or ineligible.');
    available.set(ownerId, availability);
    const summary = availability.diagram;
    if (availability.availability === 'none') { if (summary) fail(parent.id, 'availability', 'A missing child must not have a destination.'); continue; }
    if (!summary || summary.status !== availability.availability || summary.kind !== (parent.kind === 'container' ? 'component' : 'container') || summary.scope?.parentDiagramId !== parent.id || getDiagramOwnerId(summary) !== ownerId) fail(summary?.id ?? parent.id, 'availability', 'Child summary does not match its canonical membership.');
    if (availability.availability === 'active') {
      const child = members.get(summary.id)?.diagram;
      if (!child || child.status !== 'active' || child.kind !== summary.kind || child.scope?.parentDiagramId !== parent.id || getDiagramOwnerId(child) !== ownerId) fail(summary.id, 'scope', 'A required active child is missing or has mismatched ownership.');
      ownerChildren[ownerId] = child.id;
    } else if (members.has(summary.id)) fail(summary.id, 'status', 'A trashed child cannot be included.');
  }
  for (const member of source.diagrams) {
    const saved = member.diagram;
    for (const owner of saved.components.filter(c => saved.kind === 'container' ? c.role === 'container' && c.type === 'container' : saved.kind !== 'component' && (c.role ?? 'element') === 'element' && c.type === 'software-system')) if (!available.has(owner.id)) fail(saved.id, 'availability', 'Availability must describe every saved eligible owner.');
    if (saved.id !== source.entryDiagramId && (!saved.scope || !members.has(saved.scope.parentDiagramId) || ownerChildren[getDiagramOwnerId(saved)!] !== saved.id)) fail(saved.id, 'diagrams', 'An unrelated diagram cannot be included.');
    const context = source.sourceContexts[saved.id];
    if (saved.scope) {
      if (!context || context.scope.parentDiagramId !== saved.scope.parentDiagramId || getDiagramOwnerId({ kind: saved.kind, scope: context.scope }) !== getDiagramOwnerId(saved) || ('containerId' in context.scope) !== (saved.kind === 'component')) fail(saved.id, 'scope', 'Source context does not match canonical parent and owner.');
      if (saved.kind === 'component' && 'containerId' in context.scope && 'containerId' in saved.scope && (context.scope.systemContextDiagramId !== saved.scope.systemContextDiagramId || context.scope.softwareSystemId !== saved.scope.softwareSystemId)) fail(saved.id, 'scope', 'Component context changed its ancestor identity.');
      if (new Set(context.sources.map(s => s.id)).size !== context.sources.length) fail(saved.id, 'sources', 'Duplicate source identities in captured context.');
      if ('containerId' in context.scope) {
        const componentSources = (context as ComponentContext).sources;
        if (new Set(componentSources.map(s => s.canonicalSourceComponentId)).size !== componentSources.length) fail(saved.id, 'sources', 'Duplicate canonical source identities.');
        for (const s of componentSources) if (s.id === context.scope.containerId || (s.type === 'container' ? !isContainerType(s.containerType) || !s.technology?.trim() || !s.description?.trim() || s.id !== s.canonicalSourceComponentId || s.sourceDiagramId !== context.scope.parentDiagramId : s.containerType !== null || s.technology !== null || s.sourceDiagramId !== context.scope.systemContextDiagramId)) fail(saved.id, 'sources', 'Invalid supporting source context.');
      }
    } else if (context) fail(saved.id, 'sourceContexts', 'A System context cannot carry scoped source context.');
  }
  for (const id of Object.keys(source.sourceContexts)) if (!members.has(id)) fail(id, 'sourceContexts', 'Context-only ancestors cannot be included as package destinations.');
  const resolved = new Map<string, HtmlExportSnapshot>(), visiting = new Set<string>();
  const hydrate = (id: string): HtmlExportSnapshot => scoped(id, () => {
    const previous = resolved.get(id); if (previous) return previous;
    if (visiting.has(id)) fail(id, 'scope', 'Cyclic package hierarchy.'); visiting.add(id);
    const member = members.get(id)!;
    const saved = validateExportDiagram(member.diagram);
    if (saved.status !== 'active') fail(id, 'status', 'Included diagrams must be active.');
    const savedAdrs = validateExportAdrs(member.adrs, saved);
    const override = capture.overrides[id];
    let diagram = override ? structuredClone(override.diagram) : saved;
    if (diagram.id !== id || (diagram.kind ?? 'general') !== (saved.kind ?? 'general')) fail(id, 'kind', 'A retained override cannot change canonical identity or kind.');
    if (diagram.status !== 'active') fail(id, 'status', 'The captured diagram must remain active.');
    if (diagram.scope?.parentDiagramId !== saved.scope?.parentDiagramId || getDiagramOwnerId(diagram) !== getDiagramOwnerId(saved)) fail(id, 'scope', 'A retained override cannot change canonical parent or owner identity.');
    if (diagram.scope && saved.scope && 'containerId' in diagram.scope && 'containerId' in saved.scope && (diagram.scope.systemContextDiagramId !== saved.scope.systemContextDiagramId || diagram.scope.softwareSystemId !== saved.scope.softwareSystemId)) fail(id, 'scope', 'A retained override cannot change ancestor identities.');
    for (const component of diagram.components) {
      const original = saved.components.find(c => c.id === component.id);
      if (original && ((component.role ?? 'element') !== (original.role ?? 'element') || (component.sourceComponentId ?? null) !== (original.sourceComponentId ?? null))) fail(id, 'sourceComponentId', 'A retained override cannot change a role or source identity.', 'component', component.id);
    }
    if (saved.scope) {
      const parent = members.has(saved.scope.parentDiagramId) ? hydrate(saved.scope.parentDiagramId).diagram : null;
      const context = source.sourceContexts[id];
      if (saved.kind === 'container') {
        const owner = parent?.components.find(c => c.id === getDiagramOwnerId(saved));
        if (parent && ((parent.kind ?? 'general') !== 'general' || !owner || owner.type !== 'software-system' || (owner.role ?? 'element') !== 'element')) fail(id, 'scope.softwareSystemId', 'A required owner was removed or reclassified.');
        const scope = parent ? { parentDiagramId: parent.id, softwareSystemId: owner!.id, parentDiagramName: parent.name, softwareSystemName: owner!.name, softwareSystemDescription: owner!.description } : (context as ContainerContext).scope;
        const sources = parent ? parent.components.filter(c => c.id !== scope.softwareSystemId && (c.role ?? 'element') === 'element' && isC4ArtifactType(c.type)) : (context as ContainerContext).sources;
        diagram = { ...diagram, name: scope.softwareSystemName, scope, components: diagram.components.map(c => {
          if (c.role !== 'external') return c;
          const source = sources.find(s => s.id === c.sourceComponentId && s.id !== scope.softwareSystemId);
          if (!source) fail(id, 'sourceComponentId', 'An external occurrence has no eligible source in captured context.', 'component', c.id);
          return { ...c, name: source.name, description: source.description, type: source.type };
        }) };
      } else if (saved.kind === 'component') {
        const capturedContext = context as ComponentContext;
        const owner = parent?.components.find(c => c.id === getDiagramOwnerId(saved));
        if (parent && (parent.kind !== 'container' || !owner || owner.role !== 'container' || owner.type !== 'container' || !isContainerType(owner.containerType) || !owner.technology?.trim() || !owner.description?.trim())) fail(id, 'scope.containerId', 'A required container owner was removed or reclassified.');
        const scope = parent ? { ...capturedContext.scope, parentDiagramId: parent.id, containerId: owner!.id, parentDiagramName: parent.name, containerName: owner!.name, containerDescription: owner!.description, containerTechnology: owner!.technology!, containerType: owner!.containerType!, systemContextDiagramId: parent.scope!.parentDiagramId, softwareSystemId: parent.scope!.softwareSystemId, softwareSystemName: parent.scope!.softwareSystemName } : capturedContext.scope;
        const canonical = new Set<string>();
        diagram = { ...diagram, name: scope.containerName, scope, components: diagram.components.map(c => {
          if (c.role !== 'external') return c;
          const source = parent ? parent.components.find(s => s.id === c.sourceComponentId && s.id !== scope.containerId) : capturedContext.sources.find(s => s.id === c.sourceComponentId);
          if (!source) fail(id, 'sourceComponentId', 'A supporting occurrence has no eligible immediate source in captured context.', 'component', c.id);
          const sourceId = 'canonicalSourceComponentId' in source ? source.canonicalSourceComponentId : source.role === 'external' ? source.sourceComponentId! : source.id;
          if (canonical.has(sourceId)) fail(id, 'sourceComponentId', 'Include each canonical supporting source only once.', 'component', c.id); canonical.add(sourceId);
          return { ...c, name: source.name, description: source.description, type: source.type, containerType: source.containerType ?? null, technology: source.technology ?? null };
        }) };
      }
    }
    diagram = validateExportDiagram(diagram);
    const draft = override?.draft, adrs = validateExportAdrs(mergeExportAdrDraft(savedAdrs, draft, capture.capturedAt), diagram);
    for (const [kind, artifacts] of [['component', diagram.components], ['relationship', diagram.relationships], ['group', diagram.groups], ['ADR', adrs]] as const) unique(id, kind, artifacts);
    const snapshot = { diagram, adrs, capturedAt: capture.capturedAt, hasDraft: !!draft };
    visiting.delete(id); resolved.set(id, snapshot); return snapshot;
  });
  for (const member of source.diagrams) hydrate(member.diagram.id);
  const ordered = [source.diagrams[0], ...source.diagrams.slice(1).sort((a,b) => a.diagram.id.localeCompare(b.diagram.id))].map(m => resolved.get(m.diagram.id)!);
  // Newly authored eligible owners have no included saved child. Navigation never creates one.
  const availability = ordered.flatMap(({ diagram }) => diagram.components.filter(c => diagram.kind === 'container' ? c.role === 'container' && c.type === 'container' : diagram.kind !== 'component' && (c.role ?? 'element') === 'element' && c.type === 'software-system').map(owner => {
    const saved = available.get(owner.id);
    if (!saved) return diagram.kind === 'container' ? { parentDiagramId: diagram.id, containerId: owner.id, availability: 'none' as const, diagram: null } : { parentDiagramId: diagram.id, softwareSystemId: owner.id, availability: 'none' as const, diagram: null };
    const child = saved.diagram && resolved.get(saved.diagram.id)?.diagram;
    return { ...saved, diagram: child ? { id: child.id, name: child.name, kind: child.kind, status: child.status, scope: child.scope, createdAt: child.createdAt, updatedAt: child.updatedAt } : saved.diagram };
  }));
  return structuredClone({ entryDiagramId: capture.entryDiagramId, capturedAt: capture.capturedAt, diagrams: ordered, ownerChildren, availability });
}
