import { z } from 'zod';
import type { ArchitectureDecisionRecord, DiagramDocument } from '../domain/types';
import {
  architectureDecisionRecordListSchema,
  architectureDecisionRecordSchema,
  diagramDocumentSchema,
  uuidSchema,
} from '../validation/schemas';
import {
  assertAdrComponentOwnership,
  assertAdrInvariants,
  assertAdrRelationshipOwnership,
  assertAdrReplacement,
  assertDiagramInvariants,
} from '../domain/invariants';
import { isC4ArtifactType } from '../domain/c4';
import { hasValidXmlCharacters } from './escaping';

export type AdrExportDraft = Pick<ArchitectureDecisionRecord,
  'diagramId' | 'title' | 'context' | 'decision' | 'consequences' | 'status'
> & Partial<Pick<ArchitectureDecisionRecord,
  'id' | 'alternativesOrConstraints' | 'replacementAdrId' | 'componentIds' | 'relationshipIds' | 'createdAt' | 'updatedAt'
>>;

export type HtmlExportInput = {
  diagram: DiagramDocument;
  adrs: ArchitectureDecisionRecord[];
  draft?: AdrExportDraft | null;
  capturedAt?: string;
};

export type HtmlExportSnapshot = {
  diagram: DiagramDocument;
  adrs: ArchitectureDecisionRecord[];
  capturedAt: string;
  hasDraft: boolean;
};

export class HtmlExportError extends Error {
  readonly name = 'HtmlExportError';

  constructor(
    readonly artifactKind: 'diagram' | 'component' | 'relationship' | 'group' | 'ADR',
    readonly artifactId: string | undefined,
    readonly field: string,
    detail: string,
    remedy = 'Correct this field and try the export again.',
  ) {
    super(`${artifactKind}${artifactId ? ` ${artifactId}` : ''} field ${field}: ${detail} ${remedy}`);
  }
}

function artifactErrorFromZod(error: z.ZodError, input: unknown, kind: 'diagram' | 'ADR'): HtmlExportError {
  const issue = error.issues[0];
  const field = issue.path.map(String).join('.') || 'document';
  const root = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  if (kind === 'ADR') {
    return new HtmlExportError('ADR', typeof root.id === 'string' ? root.id : undefined, field, issue.message);
  }
  const [collection, index] = issue.path;
  const record = typeof collection === 'string' && typeof index === 'number' && Array.isArray(root[collection])
    ? (root[collection] as Array<Record<string, unknown>>)[index]
    : undefined;
  const artifactKind = collection === 'components' ? 'component' : collection === 'relationships' ? 'relationship' : collection === 'groups' ? 'group' : 'diagram';
  return new HtmlExportError(artifactKind, typeof record?.id === 'string' ? record.id : undefined, field, issue.message);
}

function invariantError(message: string, diagram: DiagramDocument): HtmlExportError {
  for (const component of diagram.components) if (message.includes(component.id)) return new HtmlExportError('component', component.id, 'layout', message);
  for (const relationship of diagram.relationships) if (message.includes(relationship.id)) return new HtmlExportError('relationship', relationship.id, 'reference', message);
  for (const group of diagram.groups ?? []) if (message.includes(group.id)) return new HtmlExportError('group', group.id, 'layout', message);
  return new HtmlExportError('diagram', diagram.id, 'document', message);
}

function validateText(value: string | null, kind: HtmlExportError['artifactKind'], id: string | undefined, field: string): void {
  if (value !== null && !hasValidXmlCharacters(value)) {
    throw new HtmlExportError(kind, id, field, 'Contains a control character that HTML and SVG cannot represent safely.');
  }
}

function assertUniqueIds(kind: HtmlExportError['artifactKind'], items: Array<{ id: string }>): void {
  const seen = new Set<string>();
  for (const item of items) {
    try { uuidSchema.parse(item.id); }
    catch { throw new HtmlExportError(kind, item.id, 'id', 'Must be a valid UUID.'); }
    if (seen.has(item.id)) throw new HtmlExportError(kind, item.id, 'id', 'Duplicate artifact identity in this export snapshot.');
    seen.add(item.id);
  }
}

function validateDiagram(input: DiagramDocument): DiagramDocument {
  let diagram: DiagramDocument;
  try { diagram = diagramDocumentSchema.parse(input) as DiagramDocument; }
  catch (error) { if (error instanceof z.ZodError) throw artifactErrorFromZod(error, input, 'diagram'); throw error; }

  assertUniqueIds('component', diagram.components);
  assertUniqueIds('relationship', diagram.relationships);
  assertUniqueIds('group', diagram.groups ?? []);
  try { assertDiagramInvariants(diagram); }
  catch (error) { throw invariantError(error instanceof Error ? error.message : 'Invalid diagram layout.', diagram); }

  validateText(diagram.name, 'diagram', diagram.id, 'name');
  for (const component of diagram.components) {
    if (component.type !== null && !isC4ArtifactType(component.type)) {
      throw new HtmlExportError('component', component.id, 'type', `Unsupported component type "${component.type}". Use Person or Software System, or clear the type.`);
    }
    validateText(component.name, 'component', component.id, 'name');
    validateText(component.description, 'component', component.id, 'description');
  }
  for (const relationship of diagram.relationships) validateText(relationship.label, 'relationship', relationship.id, 'label');
  for (const group of diagram.groups ?? []) validateText(group.name, 'group', group.id, 'name');
  return structuredClone(diagram);
}

function validateAdrs(values: unknown, diagram: DiagramDocument): ArchitectureDecisionRecord[] {
  let parsed: ArchitectureDecisionRecord[];
  try { parsed = architectureDecisionRecordListSchema.parse(values) as ArchitectureDecisionRecord[]; }
  catch (error) {
    if (error instanceof z.ZodError) {
      const issue = error.issues[0];
      const index = typeof issue.path[0] === 'number' ? issue.path[0] : -1;
      const record = Array.isArray(values) && index >= 0 ? values[index] : undefined;
      throw artifactErrorFromZod(error, record, 'ADR');
    }
    throw error;
  }
  assertUniqueIds('ADR', parsed);
  const components = new Map(diagram.components.map(component => [component.id, component]));
  const relationships = new Map(diagram.relationships.map(relationship => [relationship.id, relationship]));
  for (const adr of parsed) {
    if (adr.diagramId !== diagram.id) throw new HtmlExportError('ADR', adr.id, 'diagramId', `Belongs to diagram ${adr.diagramId}, not ${diagram.id}.`);
    try {
      assertAdrInvariants(adr);
      assertAdrComponentOwnership(adr, [...components.values()]);
      assertAdrRelationshipOwnership(adr, [...relationships.values()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid ADR reference.';
      const field = message.toLowerCase().includes('component') ? 'componentIds' : message.toLowerCase().includes('relationship') ? 'relationshipIds' : message.toLowerCase().includes('replacement') ? 'replacementAdrId' : 'record';
      throw new HtmlExportError('ADR', adr.id, field, message);
    }
    validateText(adr.title, 'ADR', adr.id, 'title');
    validateText(adr.context, 'ADR', adr.id, 'context');
    validateText(adr.decision, 'ADR', adr.id, 'decision');
    validateText(adr.consequences, 'ADR', adr.id, 'consequences');
    validateText(adr.alternativesOrConstraints, 'ADR', adr.id, 'alternativesOrConstraints');
  }
  const byId = new Map(parsed.map(adr => [adr.id, adr]));
  for (const adr of parsed) {
    if (!adr.replacementAdrId) continue;
    const replacement = byId.get(adr.replacementAdrId);
    if (!replacement) throw new HtmlExportError('ADR', adr.id, 'replacementAdrId', `Replacement ADR ${adr.replacementAdrId} is missing from this diagram's export set.`);
    try { assertAdrReplacement(adr, replacement); }
    catch (error) { throw new HtmlExportError('ADR', adr.id, 'replacementAdrId', error instanceof Error ? error.message : 'Replacement ADR is invalid.'); }
  }
  return parsed;
}

export function validateHtmlExportSnapshot(input: HtmlExportInput): HtmlExportSnapshot {
  const capturedAt = input.capturedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(capturedAt))) throw new HtmlExportError('diagram', input.diagram?.id, 'capturedAt', 'Must be a valid timestamp.');
  const diagram = validateDiagram(input.diagram);
  const savedAdrs = validateAdrs(input.adrs, diagram);
  const byId = new Map(savedAdrs.map((adr, index) => [adr.id, index]));

  if (input.draft) {
    const draft = input.draft;
    const existingIndex = draft.id ? byId.get(draft.id) : undefined;
    if (draft.id && existingIndex === undefined) {
      throw new HtmlExportError('ADR', draft.id, 'id', 'The saved ADR is no longer part of this diagram. Reload the diagram and try again.');
    }
    const existing = existingIndex === undefined ? undefined : savedAdrs[existingIndex];
    const draftRecord = {
      ...draft,
      id: draft.id ?? crypto.randomUUID(),
      diagramId: draft.diagramId,
      alternativesOrConstraints: draft.alternativesOrConstraints ?? null,
      replacementAdrId: draft.replacementAdrId ?? null,
      componentIds: draft.componentIds ?? [],
      relationshipIds: draft.relationshipIds ?? [],
      createdAt: existing?.createdAt ?? draft.createdAt ?? capturedAt,
      updatedAt: existing?.updatedAt ?? draft.updatedAt ?? capturedAt,
    };
    let parsedDraft: ArchitectureDecisionRecord;
    try { parsedDraft = architectureDecisionRecordSchema.parse(draftRecord) as ArchitectureDecisionRecord; }
    catch (error) { if (error instanceof z.ZodError) throw artifactErrorFromZod(error, draftRecord, 'ADR'); throw error; }
    if (existingIndex === undefined) savedAdrs.push(parsedDraft);
    else savedAdrs[existingIndex] = parsedDraft;
  }

  const adrs = validateAdrs(savedAdrs, diagram);
  return { diagram, adrs, capturedAt, hasDraft: input.draft !== null && input.draft !== undefined };
}
