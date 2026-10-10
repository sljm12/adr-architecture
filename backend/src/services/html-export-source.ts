import { z } from 'zod';
import {
  HtmlExportError, htmlExportSourceSchema, isC4ArtifactType, uuidSchema, validateHtmlExportSnapshot,
  getDiagramOwnerId, type ComponentAvailability, type ContainerAvailability, type DiagramDocument, type HtmlExportSource, type HtmlExportSourceMember,
} from '../../../shared/src/index';
import type { AdrRepositoryLike } from '../persistence/adr-repository';
import type { ChildMembership, DiagramRepositoryLike } from '../persistence/diagram-repository';
import { GraphTransaction } from '../persistence/graph-transaction';
import { ContainerContextService } from './container-context';
import { ComponentContextService } from './component-context';
import { ApiConflictError } from '../api/errors';

const codes = { 404: 'HTML_EXPORT_NOT_FOUND', 409: 'HTML_EXPORT_INCOMPLETE', 422: 'HTML_EXPORT_INCOMPLETE', 500: 'HTML_EXPORT_INCOMPLETE' } as const;
export class HtmlExportSourceError extends Error {
  readonly code: string;
  constructor(readonly statusCode: keyof typeof codes, readonly diagramId: string,
    readonly artifactKind: HtmlExportError['artifactKind'], readonly artifactId: string | undefined,
    readonly field: string, message: string, readonly remedy: string, code?: string) {
    super(message); this.name = 'HtmlExportSourceError'; this.code = code ?? codes[statusCode];
  }
  toResponse() {
    return { message: this.message, code: this.code, diagramId: this.diagramId, artifactKind: this.artifactKind,
      artifactId: this.artifactId ?? null, field: this.field, remedy: this.remedy };
  }
}
const incomplete = (diagramId: string, field: string, message: string, kind: HtmlExportError['artifactKind'] = 'diagram', artifactId = diagramId) =>
  new HtmlExportSourceError(409, diagramId, kind, artifactId, field, message, 'Repair the referenced diagram or artifact, then retry the export.');
const notFound = (id: string) => new HtmlExportSourceError(404, id, 'diagram', id, 'status', 'The selected diagram is missing or inactive.', 'Open an active diagram and retry the export.');

/** Captures saved subtree data once under the highest Context root lock. */
export class HtmlExportSourceService {
  private readonly graph: GraphTransaction;
  constructor(private readonly diagrams: DiagramRepositoryLike, adrs: AdrRepositoryLike) { this.graph = new GraphTransaction(diagrams, adrs); }

  async gather(entryDiagramId: string): Promise<HtmlExportSource> {
    if (!uuidSchema.safeParse(entryDiagramId).success) throw new HtmlExportSourceError(422, entryDiagramId, 'diagram', entryDiagramId, 'id', 'Diagram ID must be a UUID.', 'Select a valid diagram and retry the export.', 'HTML_EXPORT_VALIDATION_FAILED');
    return this.scoped(entryDiagramId, async () => {
      const initial = await this.diagrams.get(entryDiagramId);
      if (!initial || initial.status !== 'active') throw notFound(entryDiagramId);
      if ((initial.kind ?? 'general') !== 'general' && !initial.scope) throw incomplete(entryDiagramId, 'scope', 'The diagram is missing its canonical owner scope.');
      const parentId = initial.scope?.parentDiagramId ?? entryDiagramId;
      return this.graph.run(parentId, entryDiagramId === parentId ? [] : [entryDiagramId], async ({ diagrams, adrs }) => {
        if (!adrs) throw new Error('Missing transaction-scoped ADR repository');
        const cache = new Map<string, DiagramDocument>(), pending = new Map<string, Promise<DiagramDocument>>();
        const read = async (id: string): Promise<DiagramDocument> => this.scoped(id, async () => {
          const cached = cache.get(id); if (cached) return cached;
          const document = await diagrams.get(id);
          if (!document) throw incomplete(id, 'diagram', 'An expected active diagram could not be loaded.');
          cache.set(id, document); return document;
        });
        const cachedRepository = new Proxy(diagrams, { get(target, key) {
          if (key === 'get') return read;
          const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
        } });
        const containerContext = new ContainerContextService(cachedRepository), componentContext = new ComponentContextService(cachedRepository);
        const resolve = (id: string, chain: string[] = []): Promise<DiagramDocument> => {
          if (chain.includes(id) || chain.length > 2) throw incomplete(id, 'scope', 'The hierarchy is cyclic or deeper than Component level.');
          const existing = pending.get(id); if (existing) return existing;
          const operation = this.scoped(id, async () => {
            let document = await read(id);
            if (document.status !== 'active') throw incomplete(id, 'status', 'A required member or ancestor is inactive.');
            if (document.scope) await resolve(document.scope.parentDiagramId, [...chain, id]);
            if (document.kind === 'container' && document.scope) {
              const parent = cache.get(document.scope.parentDiagramId)!;
              const owner = parent.components.find(c => c.id === document.scope!.softwareSystemId);
              if (!owner || owner.type !== 'software-system' || (owner.role ?? 'element') !== 'element') throw incomplete(id, 'scope.softwareSystemId', 'The owning Software System is missing or ineligible.', 'component', document.scope.softwareSystemId);
              for (const occurrence of document.components.filter(c => c.role === 'external')) {
                const source = parent.components.find(c => c.id === occurrence.sourceComponentId);
                if (!source || source.id === owner.id || (source.role ?? 'element') !== 'element' || !isC4ArtifactType(source.type)) throw incomplete(id, 'sourceComponentId', 'An external occurrence has a missing or ineligible source.', 'component', occurrence.id);
              }
            }
            if (document.kind === 'component') document = await componentContext.hydrateDocument(document, cachedRepository);
            else if (document.kind === 'container') document = await containerContext.hydrateDocument(document, cachedRepository);
            cache.set(id, document); return document;
          });
          pending.set(id, operation); return operation;
        };
        const entry = await diagrams.get(entryDiagramId);
        if (!entry || entry.status !== 'active') throw notFound(entryDiagramId);
        if ((entry.kind ?? 'general') !== (initial.kind ?? 'general')) throw incomplete(entry.id, 'kind', 'The selected kind changed during source gathering.');
        if (entry.scope?.parentDiagramId !== initial.scope?.parentDiagramId) throw incomplete(entry.id, 'scope.parentDiagramId', 'The selected parent changed during source gathering.');
        if (getDiagramOwnerId(entry) !== getDiagramOwnerId(initial)) throw incomplete(entry.id, entry.kind === 'component' ? 'scope.containerId' : 'scope.softwareSystemId', 'The selected owner changed during source gathering.');
        cache.set(entry.id, entry);
        const members: HtmlExportSourceMember[] = [], availability: Array<ContainerAvailability | ComponentAvailability> = [];
        const sourceContexts: HtmlExportSource['sourceContexts'] = {};
        const visited = new Set<string>();
        const visit = async (id: string): Promise<void> => this.scoped(id, async () => {
          if (visited.has(id)) throw incomplete(id, 'id', 'Duplicate diagram identity in hierarchy.'); visited.add(id);
          const document = await resolve(id);
          const snapshot = validateHtmlExportSnapshot({ diagram: document, adrs: await adrs.listFull(id) });
          members.push({ diagram: snapshot.diagram, adrs: snapshot.adrs });
          if (document.kind === 'container') sourceContexts[id] = await containerContext.contextFromRepository(document, cachedRepository);
          if (document.kind === 'component') sourceContexts[id] = await componentContext.contextFromRepository(document, cachedRepository);
          const membership = await diagrams.findChildMembership(id);
          if (document.kind === 'component') { if (membership.length) throw incomplete(id, 'scope', 'Component diagrams cannot own deeper diagrams.'); return; }
          const owners = document.components.filter(c => document.kind === 'container' ? c.role === 'container' && c.type === 'container' : (c.role ?? 'element') === 'element' && c.type === 'software-system');
          const byOwner = new Map<string, ChildMembership>();
          for (const expected of membership) {
            if (expected.parentDiagramId !== id || !expected.ownerComponentId || byOwner.has(expected.ownerComponentId)) throw incomplete(expected.id, 'scope', 'Child membership has a missing or duplicate owner.');
            if (!owners.some(o => o.id === expected.ownerComponentId)) throw incomplete(expected.id, document.kind === 'container' ? 'scope.containerId' : 'scope.softwareSystemId', 'The saved child has a missing or ineligible owner.', 'component', expected.ownerComponentId);
            byOwner.set(expected.ownerComponentId, expected);
            if (expected.status === 'trashed') continue;
            const child = await read(expected.id);
            if (child.status !== 'active' || child.kind !== (document.kind === 'container' ? 'component' : 'container') || child.scope?.parentDiagramId !== id || getDiagramOwnerId(child) !== expected.ownerComponentId) throw incomplete(expected.id, 'scope', 'The child does not match its saved membership.');
          }
          for (const owner of owners) {
            const expected = byOwner.get(owner.id);
            const scope = document.kind === 'container' ? { parentDiagramId: id, containerId: owner.id, parentDiagramName: document.name, containerName: owner.name, containerDescription: owner.description, containerTechnology: owner.technology!, containerType: owner.containerType!, systemContextDiagramId: document.scope!.parentDiagramId, softwareSystemId: document.scope!.softwareSystemId, softwareSystemName: document.scope!.softwareSystemName }
              : { parentDiagramId: id, softwareSystemId: owner.id, parentDiagramName: document.name, softwareSystemName: owner.name, softwareSystemDescription: owner.description };
            const summary = expected ? { id: expected.id, name: owner.name, status: expected.status, kind: document.kind === 'container' ? 'component' as const : 'container' as const, scope, createdAt: expected.createdAt, updatedAt: expected.updatedAt } : null;
            const common = { parentDiagramId: id, availability: expected?.status ?? 'none' as const, diagram: summary };
            availability.push(document.kind === 'container' ? { ...common, containerId: owner.id } : { ...common, softwareSystemId: owner.id });
          }
          for (const expected of [...membership].sort((a,b) => a.id.localeCompare(b.id))) if (expected.status === 'active') await visit(expected.id);
        });
        await visit(entryDiagramId);
        const ordered = [members[0], ...members.slice(1).sort((a,b) => a.diagram.id.localeCompare(b.diagram.id))];
        const seen = new Map<string, Set<string>>();
        for (const member of ordered) for (const [kind, artifacts] of [['diagram', [member.diagram]], ['component', member.diagram.components], ['relationship', member.diagram.relationships], ['group', member.diagram.groups], ['ADR', member.adrs]] as const) {
          const ids = seen.get(kind) ?? new Set<string>(); seen.set(kind, ids);
          for (const artifact of artifacts) {
            if (ids.has(artifact.id)) throw new HtmlExportSourceError(422, member.diagram.id, kind, artifact.id, 'id', 'An artifact identity is duplicated in the saved package.', 'Assign unique identities and retry the export.');
            ids.add(artifact.id);
          }
        }
        const response = { entryDiagramId, sourceCapturedAt: new Date().toISOString(), diagrams: ordered, availability, sourceContexts };
        const parsed = htmlExportSourceSchema.safeParse(response);
        if (!parsed.success) { const path = parsed.error.issues[0].path; const index = path[0] === 'diagrams' && typeof path[1] === 'number' ? path[1] : 0; throw this.validationError(ordered[index]?.diagram.id ?? entryDiagramId, parsed.error, response); }
        return structuredClone(parsed.data);
      });
    });
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
