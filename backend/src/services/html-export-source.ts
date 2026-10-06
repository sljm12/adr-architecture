import { z } from 'zod';
import {
  HtmlExportError, htmlExportSourceSchema, isC4ArtifactType, uuidSchema, validateHtmlExportSnapshot,
  type ContainerAvailability, type DiagramDocument, type HtmlExportSource, type HtmlExportSourceMember,
} from '../../../shared/src/index';
import type { AdrRepositoryLike } from '../persistence/adr-repository';
import type { ChildMembership, DiagramRepositoryLike } from '../persistence/diagram-repository';
import { GraphTransaction } from '../persistence/graph-transaction';
import { ContainerContextService } from './container-context';
import { ApiConflictError } from '../api/errors';

const codes = { 404: 'HTML_EXPORT_NOT_FOUND', 409: 'HTML_EXPORT_SOURCE_INCOMPLETE', 422: 'HTML_EXPORT_VALIDATION_FAILED', 500: 'HTML_EXPORT_SOURCE_FAILED' } as const;
export class HtmlExportSourceError extends Error {
  readonly code;
  constructor(readonly statusCode: keyof typeof codes, readonly diagramId: string,
    readonly artifactKind: HtmlExportError['artifactKind'], readonly artifactId: string | undefined,
    readonly field: string, message: string, readonly remedy: string) {
    super(message); this.name = 'HtmlExportSourceError'; this.code = codes[statusCode];
  }
  toResponse() {
    return { message: this.message, code: this.code, diagramId: this.diagramId, artifactKind: this.artifactKind,
      artifactId: this.artifactId ?? null, field: this.field, remedy: this.remedy };
  }
}
const incomplete = (diagramId: string, field: string, message: string, kind: HtmlExportError['artifactKind'] = 'diagram', artifactId = diagramId) =>
  new HtmlExportSourceError(409, diagramId, kind, artifactId, field, message, 'Repair the referenced diagram or artifact, then retry the export.');
const notFound = (id: string) => new HtmlExportSourceError(404, id, 'diagram', id, 'status', 'The selected diagram is missing or inactive.', 'Open an active diagram and retry the export.');

/** Gathers saved data only. Rendering and draft overlays run after these locks end. */
export class HtmlExportSourceService {
  private readonly graph: GraphTransaction;
  private readonly context: ContainerContextService;
  constructor(private readonly diagrams: DiagramRepositoryLike, adrs: AdrRepositoryLike) {
    this.graph = new GraphTransaction(diagrams, adrs); this.context = new ContainerContextService(diagrams);
  }

  async gather(entryDiagramId: string): Promise<HtmlExportSource> {
    if (!uuidSchema.safeParse(entryDiagramId).success) throw new HtmlExportSourceError(422, entryDiagramId, 'diagram', entryDiagramId, 'id', 'Diagram ID must be a UUID.', 'Select a valid diagram and retry the export.');
    return this.scoped(entryDiagramId, async () => {
      const initial = await this.diagrams.get(entryDiagramId);
      if (!initial || initial.status !== 'active') throw notFound(entryDiagramId);
      if (initial.kind === 'container' && !initial.scope) throw incomplete(entryDiagramId, 'scope', 'The container is missing its canonical owner scope.');
      const parentId = initial.kind === 'container' ? initial.scope!.parentDiagramId : entryDiagramId;
      if (!uuidSchema.safeParse(parentId).success) throw incomplete(entryDiagramId, 'scope.parentDiagramId', 'The canonical parent identity is invalid.');
      return this.graph.run(parentId, entryDiagramId === parentId ? [] : [entryDiagramId], async ({ diagrams, adrs }) => {
        const entry = await diagrams.get(entryDiagramId);
        if (!entry || entry.status !== 'active') throw notFound(entryDiagramId);
        if ((entry.kind ?? 'general') !== (initial.kind ?? 'general')) throw incomplete(entry.id, 'kind', 'The selected diagram kind changed during source gathering.');
        if (entry.kind === 'container' && (entry.scope?.parentDiagramId !== parentId || entry.scope?.softwareSystemId !== initial.scope?.softwareSystemId)) {
          throw incomplete(entry.id, entry.scope?.parentDiagramId !== parentId ? 'scope.parentDiagramId' : 'scope.softwareSystemId', 'The selected container association changed during source gathering.');
        }
        if (!adrs) throw new Error('Missing transaction-scoped ADR repository');
        const member = async (document: DiagramDocument): Promise<HtmlExportSourceMember> => this.scoped(document.id, async () => {
          const savedAdrs = await adrs.listFull(document.id);
          const validated = validateHtmlExportSnapshot({ diagram: document, adrs: savedAdrs });
          return { diagram: validated.diagram, adrs: validated.adrs };
        });
        if (entry.kind === 'container') {
          const parent = await diagrams.get(parentId);
          this.assertChildGraph(entry, parent);
          return this.finish(entry.id, [await member(await this.context.hydrateDocument(entry, diagrams))], [], await this.context.contextFromRepository(entry, diagrams));
        }
        const members = [await member(entry)];
        const membership = await diagrams.findChildMembership(entry.id);
        const byOwner = new Map<string, ChildMembership>();
        const hydrated = new Map<string, DiagramDocument>();
        for (const expected of [...membership].sort((a, b) => a.id.localeCompare(b.id))) {
          await this.scoped(expected.id, async () => {
            if (expected.parentDiagramId !== entry.id || !expected.ownerComponentId || byOwner.has(expected.ownerComponentId)) throw incomplete(expected.id, 'scope', 'Child membership has a missing or duplicate canonical owner.');
            const owner = members[0].diagram.components.find(component => component.id === expected.ownerComponentId);
            if (!owner || owner.type !== 'software-system' || (owner.role ?? 'element') !== 'element') throw incomplete(expected.id, 'scope.softwareSystemId', 'The saved child membership has a missing or ineligible owner.', 'component', expected.ownerComponentId);
            byOwner.set(expected.ownerComponentId, expected);
            // Trashed members are excluded from content, but their raw identity and
            // association still drive explicit availability summaries.
            if (expected.status === 'trashed') return;
            const child = await diagrams.get(expected.id);
            if (!child) throw incomplete(expected.id, 'diagram', 'An expected active container could not be loaded.');
            if (child.id !== expected.id || child.status !== 'active' || child.scope?.parentDiagramId !== expected.parentDiagramId || child.scope?.softwareSystemId !== expected.ownerComponentId) throw incomplete(expected.id, 'scope', 'The expected child does not match its saved membership.');
            this.assertChildGraph(child, members[0].diagram);
            const resolved = await this.context.hydrateDocument(child, diagrams);
            members.push(await member(resolved)); hydrated.set(child.id, resolved);
          });
        }
        const availability: ContainerAvailability[] = [];
        for (const owner of members[0].diagram.components.filter(component => component.type === 'software-system' && (component.role ?? 'element') === 'element')) {
          const child = byOwner.get(owner.id);
          if (!child) { availability.push({ parentDiagramId: entry.id, softwareSystemId: owner.id, availability: 'none', diagram: null }); continue; }
          const document = hydrated.get(child.id);
          // No trashed document hydration is needed to describe an exclusion.
          const summary = document ?? { id: child.id, name: owner.name, status: 'trashed' as const,
            kind: 'container' as const, createdAt: child.createdAt, updatedAt: child.updatedAt,
            scope: { parentDiagramId: entry.id, softwareSystemId: owner.id, parentDiagramName: entry.name, softwareSystemName: owner.name, softwareSystemDescription: owner.description } };
          availability.push({ parentDiagramId: entry.id, softwareSystemId: owner.id, availability: child.status,
            diagram: { id: summary.id, name: summary.name, status: summary.status, kind: summary.kind, scope: summary.scope,
              createdAt: summary.createdAt, updatedAt: summary.updatedAt } });
        }
        return this.finish(entry.id, members, availability, null);
      });
    });
  }

  private assertChildGraph(child: DiagramDocument, parent: DiagramDocument | undefined) {
    if (child.kind !== 'container' || !child.scope) throw incomplete(child.id, 'scope', 'The required child is missing its container scope.');
    if (!parent || parent.status !== 'active' || (parent.kind ?? 'general') !== 'general') throw incomplete(child.id, 'scope.parentDiagramId', 'The canonical parent is missing, inactive or ineligible.');
    const owner = parent.components.find(component => component.id === child.scope!.softwareSystemId);
    if (!owner || owner.diagramId !== parent.id || owner.type !== 'software-system' || (owner.role ?? 'element') !== 'element') throw incomplete(child.id, 'scope.softwareSystemId', 'The owning Software System is missing or ineligible.', 'component', child.scope.softwareSystemId);
    for (const occurrence of child.components.filter(component => component.role === 'external')) {
      const source = parent.components.find(component => component.id === occurrence.sourceComponentId);
      if (!source || source.diagramId !== parent.id || source.id === owner.id || (source.role ?? 'element') !== 'element' || !isC4ArtifactType(source.type)) throw incomplete(child.id, 'sourceComponentId', 'An external occurrence has a missing or ineligible source.', 'component', occurrence.id);
    }
  }

  private finish(entryDiagramId: string, diagrams: HtmlExportSourceMember[], availability: ContainerAvailability[], containerContext: HtmlExportSource['containerContext']): HtmlExportSource {
    const seen = new Map<string, Set<string>>();
    for (const member of diagrams) {
      for (const [kind, artifacts] of [['diagram', [member.diagram]], ['component', member.diagram.components], ['relationship', member.diagram.relationships], ['group', member.diagram.groups], ['ADR', member.adrs]] as const) {
        const ids = seen.get(kind) ?? new Set<string>(); seen.set(kind, ids);
        for (const artifact of artifacts) {
          if (ids.has(artifact.id)) throw new HtmlExportSourceError(422, member.diagram.id, kind, artifact.id, 'id', 'An artifact identity is duplicated in the saved package.', 'Assign unique artifact identities and retry the export.');
          ids.add(artifact.id);
        }
      }
    }
    const response = { entryDiagramId, sourceCapturedAt: new Date().toISOString(), diagrams, availability, containerContext };
    const parsed = htmlExportSourceSchema.safeParse(response);
    if (!parsed.success) {
      const issue = parsed.error.issues[0], index = issue.path[0] === 'diagrams' && typeof issue.path[1] === 'number' ? issue.path[1] : 0;
      throw this.validationError(diagrams[index]?.diagram.id ?? entryDiagramId, parsed.error, response);
    }
    return structuredClone(parsed.data);
  }

  private validationError(diagramId: string, error: z.ZodError, input?: unknown) {
    const issue = error.issues[0];
    let artifactKind: HtmlExportError['artifactKind'] = 'diagram', artifactId: string | undefined = diagramId;
    const path = issue.path;
    const collection = path.findIndex(part => ['components', 'relationships', 'groups', 'adrs'].includes(String(part)));
    if (collection >= 0) {
      artifactKind = ({ components: 'component', relationships: 'relationship', groups: 'group', adrs: 'ADR' } as const)[path[collection] as 'components' | 'relationships' | 'groups' | 'adrs'];
      let record: unknown = input;
      for (const part of path.slice(0, collection + 2)) record = record && typeof record === 'object' ? Reflect.get(record, part) : undefined;
      artifactId = record && typeof record === 'object' && 'id' in record && typeof record.id === 'string' ? record.id : undefined;
    }
    return new HtmlExportSourceError(422, diagramId, artifactKind, artifactId, path.map(String).join('.') || 'document', issue.message, 'Correct the saved artifact field and retry the export.');
  }

  private async scoped<T>(diagramId: string, action: () => Promise<T>): Promise<T> {
    try { return await action(); }
    catch (error) {
      if (error instanceof HtmlExportSourceError) throw error;
      if (error instanceof HtmlExportError) throw new HtmlExportSourceError(422, diagramId, error.artifactKind, error.artifactId, error.field, error.message, 'Correct the saved artifact field and retry the export.');
      if (error instanceof z.ZodError) throw this.validationError(diagramId, error);
      if (error instanceof ApiConflictError) throw incomplete(diagramId, 'scope', error.message);
      throw new HtmlExportSourceError(500, diagramId, 'diagram', diagramId, 'source', 'The saved export source could not be read.', 'Retry the export. If the problem persists, check the API service.');
    }
  }
}
