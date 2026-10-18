import { z } from 'zod';
import { assertDiagramInvariants, assertAdrInvariants, assertAdrReplacement, assertAdrComponentOwnership, assertAdrRelationshipOwnership } from '../domain/invariants';
import type { DiagramDocument, ArchitectureDecisionRecord, ComponentScope } from '../domain/types';
import type { Archive, ArchiveRecords, ArchiveErrorBody } from './types';

export const ARCHIVE_MAX_BYTES = 8_388_608;
export const ARCHIVE_MAX_DEPTH = 64;
export const ARCHIVE_MAX_REVISION = 9223372036854775807n;
export const archiveUuidSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
export const archiveSha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
export function canonicalArchiveScalar(value: number): string {
  if (!Number.isFinite(value)) throw new Error('Archive layout must be finite');
  return Object.is(value, -0) ? '-0' : String(value);
}
export const archiveScalarSchema = z.string().max(32).refine(value => Number.isFinite(Number(value)) && canonicalArchiveScalar(Number(value)) === value, 'Expected canonical finite binary64 text');
const positiveScalar = archiveScalarSchema.refine(value => Number(value) > 0, 'Dimensions must be positive');
export const archiveRevisionSchema = z.string().max(19).regex(/^(0|[1-9][0-9]*)$/).refine(value => /^(0|[1-9][0-9]*)$/.test(value) && value.length <= 19 && BigInt(value) <= ARCHIVE_MAX_REVISION, 'Revision exceeds PostgreSQL bigint range');
export const archiveTimestampSchema = z.string().refine(value => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{6})Z$/.exec(value);
  if (!match) return false;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,31,30,31,30,31,31,30,31,30,31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month-1] && hour < 24 && minute < 60 && second < 60;
}, 'Expected a calendar-valid UTC timestamp with six fractional digits');
const uuid = archiveUuidSchema, time = archiveTimestampSchema;
const name = z.string().min(1).max(200).refine(value => Boolean(value.trim()), 'Name must not be blank');
const times = { createdAt: time, updatedAt: time };
const layout = { x: archiveScalarSchema, y: archiveScalarSchema, width: positiveScalar, height: positiveScalar };
export const archiveDiagramSchema = z.object({ id: uuid, name, status: z.enum(['active','trashed']), kind: z.enum(['general','container','component']), ...times, trashedAt: time.nullable(), parentDiagramId: uuid.nullable(), ownerComponentId: uuid.nullable(), scopeX: archiveScalarSchema.nullable(), scopeY: archiveScalarSchema.nullable(), scopeWidth: positiveScalar.nullable(), scopeHeight: positiveScalar.nullable(), trashBatchId: uuid.nullable(), trashRootDiagramId: uuid.nullable(), deletionRevision: archiveRevisionSchema }).strict();
export const archiveComponentSchema = z.object({ id: uuid, diagramId: uuid, name, description: z.string().nullable(), type: z.string().max(100).nullable(), role: z.enum(['element','container','component','external']), containerType: z.enum(['application','datastore']).nullable(), technology: z.string().max(200).nullable(), sourceComponentId: uuid.nullable(), ...layout, ...times }).strict();
export const archiveRelationshipSchema = z.object({ id: uuid, diagramId: uuid, sourceComponentId: uuid, targetComponentId: uuid, direction: z.enum(['directed','undirected']), label: z.string().nullable(), protocol: z.string().max(200).nullable(), ...times }).strict();
export const archiveSystemGroupSchema = z.object({ id: uuid, diagramId: uuid, name, ...layout, ...times }).strict();
export const archiveSystemGroupMemberSchema = z.object({ groupId: uuid, componentId: uuid, createdAt: time }).strict();
export const archiveAdrSchema = z.object({ id: uuid, diagramId: uuid, title: z.string().min(1).max(300), context: z.string(), decision: z.string(), consequences: z.string(), alternativesOrConstraints: z.string().nullable(), status: z.enum(['draft','accepted','superseded','rejected']), replacementAdrId: uuid.nullable(), ...times }).strict();
export const archiveAdrComponentLinkSchema = z.object({ adrId: uuid, componentId: uuid, createdAt: time }).strict();
export const archiveAdrRelationshipLinkSchema = z.object({ adrId: uuid, relationshipId: uuid, createdAt: time }).strict();
export const archiveRowSchemas = { diagrams: archiveDiagramSchema, components: archiveComponentSchema, relationships: archiveRelationshipSchema, systemGroups: archiveSystemGroupSchema, systemGroupMembers: archiveSystemGroupMemberSchema, adrs: archiveAdrSchema, adrComponentLinks: archiveAdrComponentLinkSchema, adrRelationshipLinks: archiveAdrRelationshipLinkSchema };
export const archiveCollections = Object.keys(archiveRowSchemas) as Array<keyof typeof archiveRowSchemas>;
export const archiveRecordsSchema = z.object({ diagrams: z.array(archiveDiagramSchema), components: z.array(archiveComponentSchema), relationships: z.array(archiveRelationshipSchema), systemGroups: z.array(archiveSystemGroupSchema), systemGroupMembers: z.array(archiveSystemGroupMemberSchema), adrs: z.array(archiveAdrSchema), adrComponentLinks: z.array(archiveAdrComponentLinkSchema), adrRelationshipLinks: z.array(archiveAdrRelationshipLinkSchema) }).strict();
export const archiveSchema = z.object({ format: z.literal('adr-diagram-archive'), version: z.literal(1), purpose: z.enum(['diagram','recovery']), exportedAt: time, selectedDiagramId: uuid, seedDiagramIds: z.array(uuid).min(1), includedDiagramIds: z.array(uuid).min(1), recoveryForFileSha256: archiveSha256Schema.nullable(), records: archiveRecordsSchema.refine(rows => rows.diagrams.length > 0, 'At least one diagram is required') }).strict();
export const archiveScopeItemSchema = z.object({ id: uuid, name: z.string(), kind: z.enum(['general','container','component']), status: z.enum(['active','trashed']), reason: z.enum(['selected-hierarchy','reference-dependency','recovery-seed']) }).strict();
const count = z.number().int().nonnegative();
export const archiveRecordCountsSchema = z.object({ diagrams: count, components: count, relationships: count, systemGroups: count, systemGroupMembers: count, adrs: count, adrComponentLinks: count, adrRelationshipLinks: count }).strict();
export const archiveDeltaCountsSchema = z.object({ added: count, replaced: count, removed: count, unchanged: count }).strict();
export const archiveCollectionDeltasSchema = z.object({ diagrams: archiveDeltaCountsSchema, components: archiveDeltaCountsSchema, relationships: archiveDeltaCountsSchema, systemGroups: archiveDeltaCountsSchema, systemGroupMembers: archiveDeltaCountsSchema, adrs: archiveDeltaCountsSchema, adrComponentLinks: archiveDeltaCountsSchema, adrRelationshipLinks: archiveDeltaCountsSchema }).strict();
export const archiveRecordChangeSchema = z.object({ collection: z.enum(['diagrams','components','relationships','systemGroups','systemGroupMembers','adrs','adrComponentLinks','adrRelationshipLinks']), identity: z.array(uuid).min(1).max(2), diagramId: uuid, name: z.string().nullable(), action: z.enum(['added','replaced','removed','unchanged']), collision: z.boolean() }).strict();
export const preparedArchiveSchema = z.object({ archiveText: z.string(), fileSha256: archiveSha256Schema, byteLength: z.number().int().min(1).max(ARCHIVE_MAX_BYTES), scope: z.array(archiveScopeItemSchema).min(1), counts: archiveRecordCountsSchema }).strict();
export const archivePreviewRequestSchema = z.object({ archiveText: z.string() }).strict();
export const archiveImportRequestSchema = z.object({ archiveText: z.string(), previewedAt: time, previewToken: archiveSha256Schema, overrideExisting: z.boolean(), recoverySaved: z.boolean(), recoveryFileSha256: archiveSha256Schema.nullable() }).strict();
export const archiveImportPreviewSchema = z.object({ fileSha256: archiveSha256Schema, previewedAt: time, previewToken: archiveSha256Schema, includedDiagrams: z.array(archiveScopeItemSchema).min(1), changes: z.array(archiveRecordChangeSchema).min(1), totals: archiveDeltaCountsSchema, byCollection: archiveCollectionDeltasSchema, requiresOverride: z.boolean(), requiresRecovery: z.boolean(), recovery: preparedArchiveSchema.nullable() }).strict();
export const archiveImportResultSchema = z.object({ committed: z.literal(true), fileSha256: archiveSha256Schema, affectedDiagramIds: z.array(uuid).refine(ids => new Set(ids.map(id => id.toLowerCase())).size === ids.length, 'Duplicate identities'), includedDiagrams: z.array(archiveScopeItemSchema).min(1), totals: archiveDeltaCountsSchema, byCollection: archiveCollectionDeltasSchema }).strict();
export const archiveErrorSchema = z.object({ code: z.enum(['ARCHIVE_REQUEST_INVALID','ARCHIVE_JSON_INVALID','ARCHIVE_NOT_FOUND','ARCHIVE_PREVIEW_CHANGED','ARCHIVE_DEPENDENCY','ARCHIVE_OWNERSHIP','ARCHIVE_CONFIRMATION_REQUIRED','ARCHIVE_TOO_LARGE','ARCHIVE_MEDIA_TYPE','ARCHIVE_VERSION_UNSUPPORTED','ARCHIVE_INVALID','ARCHIVE_FAILED']), message: z.string(), remedy: z.string(), issues: z.array(z.object({ path: z.string(), message: z.string(), diagramId: uuid.optional(), artifactIdentity: z.array(uuid).min(1).max(2).optional() }).strict()).optional() }).strict();

export class ArchiveValidationError extends Error {
  constructor(readonly code: ArchiveErrorBody['code'], message: string, readonly issues?: ArchiveErrorBody['issues'], readonly remedy = 'Repair the indicated archive field or saved reference, then prepare a new file.') { super(message); }
}
function invalid(path: string, message: string): never { throw new ArchiveValidationError('ARCHIVE_INVALID', message, [{ path, message }]); }
const lower = (id: string) => id.toLowerCase();

/** Only a lexical guard: native JSON.parse remains responsible for JSON grammar. */
function checkArchiveLexically(text: string): void {
  if (new TextEncoder().encode(text).byteLength > ARCHIVE_MAX_BYTES) throw new ArchiveValidationError('ARCHIVE_TOO_LARGE', 'Archive exceeds 8 MiB');
  const fail = (message: string): never => { throw new ArchiveValidationError('ARCHIVE_JSON_INVALID', message); };
  if (text.charCodeAt(0) === 0xfeff) fail('UTF-8 BOM is unsupported');
  const stack: Array<{ object: boolean; keys: Set<string> }> = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '{' || c === '[') {
      stack.push({ object: c === '{', keys: new Set() });
      if (stack.length > ARCHIVE_MAX_DEPTH) fail('Archive nesting exceeds 64 levels');
    } else if (c === '}' || c === ']') stack.pop();
    else if (c === '"') {
      const start = i++;
      for (; i < text.length && text[i] !== '"'; i++) if (text[i] === '\\') i++;
      let value: string;
      try { value = JSON.parse(text.slice(start, i + 1)); } catch { fail('Malformed JSON string'); }
      for (let j = 0; j < value!.length; j++) {
        const unit = value!.charCodeAt(j);
        if (unit === 0) fail('NUL is unsupported');
        if (unit >= 0xd800 && unit <= 0xdbff) { const next = value!.charCodeAt(++j); if (!(next >= 0xdc00 && next <= 0xdfff)) fail('Unpaired Unicode surrogate'); }
        else if (unit >= 0xdc00 && unit <= 0xdfff) fail('Unpaired Unicode surrogate');
      }
      let next = i + 1; while (/\s/.test(text[next] ?? '') && next < text.length) next++;
      const frame = stack.at(-1);
      if (frame?.object && text[next] === ':') {
        if (frame.keys.has(value!)) fail('Duplicate JSON object key');
        frame.keys.add(value!);
      }
    } else if (c === '\0' || (c.charCodeAt(0) >= 0xd800 && c.charCodeAt(0) <= 0xdfff)) fail('Invalid JSON Unicode');
  }
}

export function parseArchive(text: string): Archive {
  checkArchiveLexically(text);
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new ArchiveValidationError('ARCHIVE_JSON_INVALID', 'Malformed archive JSON'); }
  if (value && typeof value === 'object' && 'version' in value && value.version !== 1) throw new ArchiveValidationError('ARCHIVE_VERSION_UNSUPPORTED', 'Unsupported archive version');
  const parsed = archiveSchema.safeParse(value);
  if (!parsed.success) throw new ArchiveValidationError('ARCHIVE_INVALID', 'Invalid archive fields', parsed.error.issues.map(issue => ({ path: issue.path.join('.'), message: ['invalid_enum_value', 'invalid_literal', 'invalid_type', 'unrecognized_keys'].includes(issue.code) ? 'Invalid or unexpected archive field; use the version-1 schema.' : issue.message })));
  validateArchiveGraph(parsed.data.records);
  const archive = parsed.data;
  const uniqueIds = (ids: string[], path: string) => { const result = ids.map(lower); if (new Set(result).size !== result.length) invalid(path, 'Duplicate diagram identity'); return result; };
  const manifest = uniqueIds(archive.includedDiagramIds, 'includedDiagramIds');
  if (JSON.stringify(manifest) !== JSON.stringify(archive.records.diagrams.map(d => lower(d.id)).sort())) invalid('includedDiagramIds', 'Manifest must exactly list all diagrams in identity order');
  const seeds = uniqueIds(archive.seedDiagramIds, 'seedDiagramIds');
  if (!seeds.includes(lower(archive.selectedDiagramId)) || seeds.some(id => !manifest.includes(id))) invalid('seedDiagramIds', 'Selected diagram and all seeds must occur in the file');
  if (archive.purpose === 'diagram' ? seeds.length !== 1 || archive.recoveryForFileSha256 !== null : archive.recoveryForFileSha256 === null) invalid('purpose', 'Purpose, seeds and recovery digest are inconsistent');
  if (archive.purpose === 'recovery' && lower(archive.selectedDiagramId) !== [...seeds].sort()[0]) invalid('selectedDiagramId', 'Recovery must select the first seed in identity order');
  if (discoverArchiveScope(archive.records, seeds).size !== manifest.length) invalid('records.diagrams', 'Archive includes unrelated hierarchies outside seed dependency closure');
  return archive;
}

/** Identity and graph checks also serve proposed destination unions (without a file manifest). */
export function validateArchiveGraph(input: ArchiveRecords): void {
  // Normalize only this validation projection; raw values remain untouched.
  const rows = archiveRecordsSchema.parse(input);
  for (const collection of archiveCollections) {
    const ids = new Set<string>();
    for (const [index, row] of rows[collection].entries()) {
      for (const [key, value] of Object.entries(row)) if (typeof value === 'string' && (key === 'id' || key.endsWith('Id'))) (row as unknown as Record<string, unknown>)[key] = lower(value);
      const identity = 'id' in row ? row.id : 'groupId' in row ? `${row.groupId}/${row.componentId}` : 'componentId' in row ? `${row.adrId}/${row.componentId}` : `${row.adrId}/${row.relationshipId}`;
      if (ids.has(identity)) invalid(`records.${collection}.${index}`, `Duplicate ${collection} identity ${identity}`);
      ids.add(identity);
    }
  }
  const diagrams = new Map(rows.diagrams.map(d => [d.id, d])), components = new Map(rows.components.map(c => [c.id, c])), groups = new Map(rows.systemGroups.map(g => [g.id, g]));
  const relationships = new Map(rows.relationships.map(r => [r.id, r])), adrs = new Map(rows.adrs.map(a => [a.id, a]));
  const owners = new Set<string>();
  for (const d of rows.diagrams) {
    const path = `records.diagrams.${d.id}`;
    if (d.kind === 'general') {
      if ([d.parentDiagramId,d.ownerComponentId,d.scopeX,d.scopeY,d.scopeWidth,d.scopeHeight].some(v => v !== null)) invalid(path, 'General diagram must have null parent, owner and boundary');
    } else {
      const parent = d.parentDiagramId && diagrams.get(d.parentDiagramId), owner = d.ownerComponentId && components.get(d.ownerComponentId);
      if (!parent || !owner || parent.kind !== (d.kind === 'container' ? 'general' : 'container') || owner.diagramId !== parent.id || (d.kind === 'container' ? owner.role !== 'element' || owner.type !== 'software-system' : owner.role !== 'container')) invalid(path, 'Missing or incompatible parent/owner hierarchy');
      if ([d.scopeX,d.scopeY,d.scopeWidth,d.scopeHeight].some(v => v === null)) invalid(path, 'Child diagram needs its complete boundary');
      if (owners.has(owner.id)) invalid(path, `Duplicate diagram owner ${owner.id}`); owners.add(owner.id);
      if (d.status === 'active' && parent.status !== 'active') invalid(path, 'Active child has an inactive ancestor');
    }
    if (d.status === 'active') {
      if ([d.trashedAt,d.trashBatchId,d.trashRootDiagramId].some(v => v !== null)) invalid(path, 'Active diagram has Trash provenance');
    } else {
      if (!d.trashedAt || Boolean(d.trashBatchId) !== Boolean(d.trashRootDiagramId)) invalid(path, 'Trashed diagram requires a deletion time and paired recovery provenance');
      if (d.trashRootDiagramId) {
        const root = diagrams.get(d.trashRootDiagramId);
        if (!root || root.status !== 'trashed' || root.trashBatchId !== d.trashBatchId || root.trashRootDiagramId !== root.id) invalid(path, 'Trash recovery root or batch is inconsistent');
      }
    }
  }
  for (const c of rows.components) {
    const diagram = diagrams.get(c.diagramId); if (!diagram) invalid(`records.components.${c.id}`, 'Missing owning diagram');
    const responsibility = Boolean(c.description?.trim() && c.technology?.trim());
    const metadataValid = c.role === 'element' ? c.containerType === null && c.technology === null && c.sourceComponentId === null
      : c.role === 'container' ? c.type === 'container' && c.containerType !== null && responsibility && c.sourceComponentId === null
      : c.role === 'component' ? c.type === 'component' && c.containerType === null && responsibility && c.sourceComponentId === null
      : c.sourceComponentId !== null && (c.type === 'container' ? c.containerType !== null && responsibility : ['person','software-system'].includes(c.type ?? '') && c.containerType === null && c.technology === null);
    if (!metadataValid) invalid(`records.components.${c.id}`, 'Unsupported saved role, subtype or source metadata');
    if (c.sourceComponentId) {
      const source = components.get(c.sourceComponentId), parent = diagram.parentDiagramId ? diagrams.get(diagram.parentDiagramId) : undefined;
      const allowed = source && source.diagramId === parent?.id && (diagram.kind === 'container' ? source.role === 'element' && ['person','software-system'].includes(source.type ?? '') : diagram.kind === 'component' && (source.role === 'container' || source.role === 'external'));
      if (!allowed || source?.id === diagram.ownerComponentId || c.role !== 'external') invalid(`records.components.${c.id}.sourceComponentId`, 'Missing or ineligible canonical source');
    }
  }
  for (const row of [...rows.relationships,...rows.systemGroups,...rows.adrs]) if (!diagrams.has(row.diagramId)) invalid('records', `Missing owner of artifact ${row.id}`);
  for (const m of rows.systemGroupMembers) if (!groups.has(m.groupId) || !components.has(m.componentId)) invalid('records.systemGroupMembers', `Missing endpoint ${m.groupId}/${m.componentId}`);
  for (const link of rows.adrComponentLinks) if (!adrs.has(link.adrId) || !components.has(link.componentId)) invalid('records.adrComponentLinks', `Missing endpoint ${link.adrId}/${link.componentId}`);
  for (const link of rows.adrRelationshipLinks) if (!adrs.has(link.adrId) || !relationships.has(link.relationshipId)) invalid('records.adrRelationshipLinks', `Missing endpoint ${link.adrId}/${link.relationshipId}`);
  for (const d of rows.diagrams) {
    const parent = d.parentDiagramId && diagrams.get(d.parentDiagramId), owner = d.ownerComponentId && components.get(d.ownerComponentId);
    let scope: DiagramDocument['scope'] = null;
    if (parent && owner) {
      if (d.kind === 'container') scope = { parentDiagramId: parent.id, softwareSystemId: owner.id, parentDiagramName: parent.name, softwareSystemName: owner.name, softwareSystemDescription: owner.description };
      else {
        const context = diagrams.get(parent.parentDiagramId!)!, system = components.get(parent.ownerComponentId!)!;
        scope = { parentDiagramId: parent.id, containerId: owner.id, parentDiagramName: system.name, containerName: owner.name, containerDescription: owner.description, containerTechnology: owner.technology!, containerType: owner.containerType!, systemContextDiagramId: context.id, softwareSystemId: system.id, softwareSystemName: system.name } satisfies ComponentScope;
      }
    }
    const projectedComponents = rows.components.filter(c => c.diagramId === d.id).map(c => {
      let source = c.sourceComponentId && components.get(c.sourceComponentId);
      if (source && source.role === 'external' && source.sourceComponentId) source = components.get(source.sourceComponentId);
      return { ...c, ...(source ? { name: source.name, description: source.description, type: source.type, containerType: source.containerType, technology: source.technology } : {}), position: { x: Number(c.x), y: Number(c.y) }, size: { width: Number(c.width), height: Number(c.height) } };
    });
    const document: DiagramDocument = { ...d, scope, boundary: d.kind === 'general' ? null : { position: { x: Number(d.scopeX), y: Number(d.scopeY) }, size: { width: Number(d.scopeWidth), height: Number(d.scopeHeight) } }, components: projectedComponents, relationships: rows.relationships.filter(r => r.diagramId === d.id), groups: rows.systemGroups.filter(g => g.diagramId === d.id).map(g => ({ ...g, position: { x: Number(g.x), y: Number(g.y) }, size: { width: Number(g.width), height: Number(g.height) }, memberComponentIds: rows.systemGroupMembers.filter(m => m.groupId === g.id).map(m => m.componentId) })) };
    try { assertDiagramInvariants(document); } catch (error) { invalid(`records.diagrams.${d.id}`, error instanceof Error ? error.message : 'Invalid diagram graph'); }
    const decisions: ArchitectureDecisionRecord[] = rows.adrs.filter(a => a.diagramId === d.id).map(a => ({ ...a, componentIds: rows.adrComponentLinks.filter(l => l.adrId === a.id).map(l => l.componentId), relationshipIds: rows.adrRelationshipLinks.filter(l => l.adrId === a.id).map(l => l.relationshipId) }));
    for (const adr of decisions) try { assertAdrInvariants(adr); assertAdrReplacement(adr, adr.replacementAdrId ? decisions.find(a => a.id === adr.replacementAdrId) : undefined); assertAdrComponentOwnership(adr, document.components); assertAdrRelationshipOwnership(adr, document.relationships); } catch (error) { invalid(`records.adrs.${adr.id}`, error instanceof Error ? error.message : 'Invalid ADR references'); }
  }
}

export function discoverArchiveScope(rows: ArchiveRecords, seedIds: string[]): Set<string> {
  const diagrams = new Map(rows.diagrams.map(d => [lower(d.id), d]));
  const included = new Set(seedIds.map(lower));
  let previous = -1;
  while (previous !== included.size) {
    previous = included.size;
    for (const id of [...included]) {
      const d = diagrams.get(id); if (!d) invalid('seedDiagramIds', `Missing diagram ${id}`);
      if (d.parentDiagramId) included.add(lower(d.parentDiagramId));
      if (d.trashRootDiagramId) included.add(lower(d.trashRootDiagramId));
    }
    for (const d of rows.diagrams) if (d.parentDiagramId && included.has(lower(d.parentDiagramId))) included.add(lower(d.id));
    for (const c of rows.components) if (included.has(lower(c.diagramId)) && c.sourceComponentId) {
      const source = rows.components.find(s => lower(s.id) === lower(c.sourceComponentId!));
      if (!source) invalid(`records.components.${c.id}`, 'Missing source dependency');
      included.add(lower(source.diagramId));
    }
  }
  return included;
}
