import type { ArchitectureDecisionRecord, ContainerAvailability, ContainerContext, DiagramDocument } from '../domain/types';
import type { AdrExportDraft, HtmlExportSnapshot } from './html-snapshot';
import { HtmlExportError, mergeExportAdrDraft, validateExportAdrs, validateExportDiagram } from './html-snapshot';
import { htmlExportSourceSchema, uuidSchema } from '../validation/schemas';
import { isC4ArtifactType } from '../domain/c4';

/** Transient cloned editor state. Providers contribute only drafts they actually retain. */
export interface HtmlPackageOverride {
  diagram: DiagramDocument;
  draft?: AdrExportDraft | null;
}
export interface HtmlPackageCapture {
  entryDiagramId: string;
  capturedAt: string;
  overrides: Record<string, HtmlPackageOverride>;
}
export interface HtmlExportSourceMember {
  diagram: DiagramDocument;
  adrs: ArchitectureDecisionRecord[];
}
/** Saved data only, detached after the coordinated graph read completes. */
export interface HtmlExportSource {
  entryDiagramId: string;
  sourceCapturedAt: string;
  diagrams: HtmlExportSourceMember[];
  availability: ContainerAvailability[];
  containerContext: ContainerContext | null;
}
export interface HtmlPackageSnapshot {
  entryDiagramId: string;
  capturedAt: string;
  diagrams: HtmlExportSnapshot[];
  ownerChildren: Record<string, string>;
  availability: ContainerAvailability[];
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

/** Assemble detached saved members with only the retained overrides frozen at export start. */
export function assembleHtmlPackageSnapshot(captureInput: HtmlPackageCapture, sourceInput: HtmlExportSource): HtmlPackageSnapshot {
  const capture = structuredClone(captureInput);
  if (!uuidSchema.safeParse(capture.entryDiagramId).success) fail(capture.entryDiagramId, 'entryDiagramId', 'The selected identity must be a UUID.');
  if (!Number.isFinite(Date.parse(capture.capturedAt))) fail(capture.entryDiagramId, 'capturedAt', 'A valid capture timestamp is required.');
  const parsed = htmlExportSourceSchema.safeParse(sourceInput);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const index = issue.path[0] === 'diagrams' && typeof issue.path[1] === 'number' ? issue.path[1] : 0;
    const member = sourceInput?.diagrams?.[index];
    const collection = issue.path.findIndex(part => ['components', 'relationships', 'groups', 'adrs'].includes(String(part)));
    const kind = collection < 0 ? 'diagram' : ({ components: 'component', relationships: 'relationship', groups: 'group', adrs: 'ADR' } as const)[issue.path[collection] as 'components' | 'relationships' | 'groups' | 'adrs'];
    let artifact: unknown = sourceInput;
    if (collection >= 0) for (const part of issue.path.slice(0, collection + 2)) artifact = artifact && typeof artifact === 'object' ? Reflect.get(artifact, part) : undefined;
    const id = collection >= 0 && artifact && typeof artifact === 'object' && 'id' in artifact ? String(artifact.id) : member?.diagram.id;
    fail(member?.diagram.id ?? capture.entryDiagramId, issue.path.join('.') || 'source', issue.message, kind, id);
  }
  const source = parsed.data;
  if (source.entryDiagramId !== capture.entryDiagramId || source.diagrams[0].diagram.id !== capture.entryDiagramId) fail(capture.entryDiagramId, 'entryDiagramId', 'Source and capture do not identify the same entry.');
  const savedEntry = source.diagrams[0].diagram;
  const ids = new Map<string, Set<string>>();
  const unique = (diagramId: string, kind: HtmlExportError['artifactKind'], artifacts: Array<{ id: string }>) => {
    const seen = ids.get(kind) ?? new Set<string>(); ids.set(kind, seen);
    for (const artifact of artifacts) {
      if (seen.has(artifact.id)) fail(diagramId, 'id', 'Duplicate artifact identity across the included package.', kind, artifact.id);
      seen.add(artifact.id);
    }
  };
  const members = new Map(source.diagrams.map(member => [member.diagram.id, member]));
  for (const member of source.diagrams) unique(member.diagram.id, 'diagram', [member.diagram]);
  if (savedEntry.kind === 'container') {
    if (source.diagrams.length !== 1 || source.availability.length) fail(savedEntry.id, 'diagrams', 'Direct child export must contain only itself.');
    const scope = source.containerContext?.scope;
    if (!scope || scope.parentDiagramId !== savedEntry.scope?.parentDiagramId || scope.softwareSystemId !== savedEntry.scope?.softwareSystemId) fail(savedEntry.id, 'scope', 'Direct child source context does not match its canonical owner.');
  } else if (source.containerContext !== null) fail(savedEntry.id, 'containerContext', 'A System context cannot carry direct-child context.');

  const ownerChildren: Record<string, string> = {};
  const available = new Map<string, ContainerAvailability>();
  if (savedEntry.kind !== 'container') {
    const owners = savedEntry.components.filter(c => c.type === 'software-system' && (c.role ?? 'element') === 'element');
    for (const availability of source.availability) {
      const owner = owners.find(c => c.id === availability.softwareSystemId);
      if (!owner || availability.parentDiagramId !== savedEntry.id || available.has(owner.id)) fail(savedEntry.id, 'availability', 'Availability has an unrelated or duplicated owner.');
      available.set(owner.id, availability);
      const summary = availability.diagram;
      if (availability.availability === 'none') {
        if (summary !== null) fail(savedEntry.id, 'availability', 'A missing child must not have a destination.');
        continue;
      }
      if (!summary || summary.status !== availability.availability || summary.kind !== 'container' || summary.scope?.parentDiagramId !== savedEntry.id || summary.scope.softwareSystemId !== owner.id) fail(summary?.id ?? savedEntry.id, 'availability', 'Child summary does not match its canonical membership.');
      if (availability.availability === 'active') {
        const child = members.get(summary.id)?.diagram;
        if (!child || child.kind !== 'container' || child.status !== 'active' || child.scope?.parentDiagramId !== savedEntry.id || child.scope.softwareSystemId !== owner.id) fail(summary.id, 'scope', 'A required active child is missing or has mismatched ownership.');
        ownerChildren[owner.id] = child.id;
      } else if (members.has(summary.id)) fail(summary.id, 'status', 'A trashed child cannot be included.');
    }
    if (available.size !== owners.length) fail(savedEntry.id, 'availability', 'Availability must describe every saved Software System.');
    const requiredIds = new Set([savedEntry.id, ...Object.values(ownerChildren)]);
    for (const member of source.diagrams) if (!requiredIds.has(member.diagram.id)) fail(member.diagram.id, 'diagrams', 'An unrelated child cannot be included.');
  }

  const overlaid = new Map<string, DiagramDocument>();
  const savedAdrs = new Map<string, ArchitectureDecisionRecord[]>();
  for (const member of source.diagrams) scoped(member.diagram.id, () => {
    const saved = validateExportDiagram(member.diagram);
    if (saved.status !== 'active') fail(saved.id, 'status', 'Included diagrams must be active.');
    savedAdrs.set(saved.id, validateExportAdrs(member.adrs, saved));
    const override = capture.overrides[saved.id];
    const diagram = override ? structuredClone(override.diagram) : saved;
    if (diagram.id !== saved.id || (diagram.kind ?? 'general') !== saved.kind) fail(saved.id, 'kind', 'A retained override cannot change canonical identity or kind.');
    if (diagram.status !== 'active') fail(saved.id, 'status', 'The captured diagram must remain active.');
    if (saved.kind === 'container' && (diagram.scope?.parentDiagramId !== saved.scope?.parentDiagramId || diagram.scope?.softwareSystemId !== saved.scope?.softwareSystemId)) fail(saved.id, 'scope', 'A retained override cannot change canonical parent or owner identity.');
    overlaid.set(saved.id, diagram);
  });

  const parent = savedEntry.kind === 'container' ? null : scoped(savedEntry.id, () => validateExportDiagram(overlaid.get(savedEntry.id)!));
  if (parent) overlaid.set(parent.id, parent);
  const snapshots: HtmlExportSnapshot[] = [];
  const ordered = [source.diagrams[0], ...source.diagrams.slice(1).sort((a, b) => a.diagram.id.localeCompare(b.diagram.id))];
  for (const member of ordered) scoped(member.diagram.id, () => {
    let diagram = overlaid.get(member.diagram.id)!;
    if (member.diagram.kind === 'container') {
      const owner = parent?.components.find(c => c.id === member.diagram.scope!.softwareSystemId);
      if (parent && (!owner || owner.type !== 'software-system' || (owner.role ?? 'element') !== 'element')) fail(diagram.id, 'scope.softwareSystemId', 'A required owner was removed or reclassified.', 'component', member.diagram.scope!.softwareSystemId);
      const scope = parent ? { parentDiagramId: parent.id, softwareSystemId: owner!.id, parentDiagramName: parent.name, softwareSystemName: owner!.name, softwareSystemDescription: owner!.description } : source.containerContext!.scope;
      const sources = parent ? parent.components.filter(c => c.id !== scope.softwareSystemId && (c.role ?? 'element') === 'element' && isC4ArtifactType(c.type)) : source.containerContext!.sources;
      if (new Set(sources.map(s => s.id)).size !== sources.length) fail(diagram.id, 'sources', 'Duplicate source identities in container context.');
      diagram = { ...diagram, name: scope.softwareSystemName, scope: structuredClone(scope), components: diagram.components.map(component => {
        if (component.role !== 'external') return component;
        const resolved = sources.find(s => s.id === component.sourceComponentId && s.id !== scope.softwareSystemId);
        if (!resolved) fail(diagram.id, 'sourceComponentId', 'An external occurrence has no eligible source in the captured context.', 'component', component.id);
        return { ...component, name: resolved.name, description: resolved.description, type: resolved.type };
      }) };
    }
    diagram = validateExportDiagram(diagram);
    const draft = capture.overrides[diagram.id]?.draft;
    const adrs = validateExportAdrs(mergeExportAdrDraft(savedAdrs.get(diagram.id)!, draft, capture.capturedAt), diagram);
    for (const [kind, artifacts] of [['component', diagram.components], ['relationship', diagram.relationships], ['group', diagram.groups], ['ADR', adrs]] as const) unique(diagram.id, kind, artifacts);
    snapshots.push({ diagram, adrs, capturedAt: capture.capturedAt, hasDraft: !!draft });
  });
  const availability = parent ? snapshots[0].diagram.components.filter(c => c.type === 'software-system' && (c.role ?? 'element') === 'element').map(owner => {
    const saved = available.get(owner.id);
    if (!saved) return { parentDiagramId: parent.id, softwareSystemId: owner.id, availability: 'none' as const, diagram: null };
    return { ...saved, diagram: saved.diagram ? { ...saved.diagram, name: owner.name, scope: { parentDiagramId: parent.id, softwareSystemId: owner.id, parentDiagramName: parent.name, softwareSystemName: owner.name, softwareSystemDescription: owner.description } } : null };
  }) : [];
  return structuredClone({ entryDiagramId: capture.entryDiagramId, capturedAt: capture.capturedAt, diagrams: snapshots, ownerChildren, availability });
}
