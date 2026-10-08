import { assertDiagramInvariants, diagramDocumentSchema, getComponentScope, getContainerScope, isC4ArtifactType, isContainerType, type ComponentContext, type ComponentScope, type ComponentSourceSummary, type DiagramDocument } from '../../../shared/src/index';
import type { DiagramRepositoryLike } from '../persistence/diagram-repository';
import { GraphTransaction } from '../persistence/graph-transaction';
import { ApiConflictError, ApiValidationError } from '../api/errors';
import { resolveContainerScope } from './container-context';

const brokenSource = (message: string): never => { throw new ApiConflictError(`${message} Repair the immediate Container source and its System Context reference.`, 'DIAGRAM_REFERENCE_BROKEN'); };

/** Resolves at most Container -> Context, with one hydrated read per ancestor. */
export class ComponentContextService {
  constructor(private readonly repository: DiagramRepositoryLike) {}

  async context(diagramId: string): Promise<ComponentContext> {
    return new GraphTransaction(this.repository).run(diagramId, [], async ({ diagrams }) => {
      const child = await diagrams.get(diagramId);
      if (!child || child.kind !== 'component') throw new ApiValidationError({ diagramId: 'Component source context requires a saved Component diagram.' });
      return this.contextFromRepository(child, diagrams);
    });
  }

  async contextFromRepository(child: DiagramDocument, repository: DiagramRepositoryLike): Promise<ComponentContext> {
    const resolved = await this.resolve(child, repository);
    const canonicalIds = new Set<string>();
    const sources = resolved.parent.components.filter(c => c.id !== resolved.scope.containerId).map(source => this.sourceSummary(source, resolved.parent, resolved.context));
    for (const source of sources) {
      if (canonicalIds.has(source.canonicalSourceComponentId)) brokenSource(`Canonical source ${source.canonicalSourceComponentId} appears more than once in the parent.`);
      canonicalIds.add(source.canonicalSourceComponentId);
    }
    return { scope: resolved.scope, sources, capturedAt: new Date().toISOString() };
  }

  async hydrateDocument(child: DiagramDocument, repository: DiagramRepositoryLike): Promise<DiagramDocument> {
    if (child.kind !== 'component') return child;
    const context = await this.contextFromRepository(child, repository);
    const byId = new Map(context.sources.map(source => [source.id, source])); const included = new Set<string>();
    const components = child.components.map((component, index) => {
      if (component.role !== 'external') return component;
      const source = component.sourceComponentId && byId.get(component.sourceComponentId);
      if (!source) return brokenSource(`Supporting participant ${component.id} has a missing, owner or wrong-level source.`);
      if (included.has(source.canonicalSourceComponentId)) throw new ApiValidationError({ [`components[${index}].sourceComponentId`]: 'Include each canonical supporting source only once.' });
      included.add(source.canonicalSourceComponentId);
      return { ...component, name: source.name, description: source.description, type: source.type, containerType: source.containerType, technology: source.technology };
    });
    return { ...child, name: context.scope.containerName, scope: context.scope, components };
  }

  async hydrateAndValidateDocument(child: DiagramDocument, repository: DiagramRepositoryLike): Promise<DiagramDocument> {
    const hydrated = await this.hydrateDocument(child, repository);
    const document = diagramDocumentSchema.parse(hydrated) as DiagramDocument;
    assertDiagramInvariants(document);
    return document;
  }

  private async resolve(child: DiagramDocument, repository: DiagramRepositoryLike) {
    const scope = getComponentScope(child);
    if (!scope) return brokenSource('The Component diagram is missing its ComponentScope.');
    const parent = await repository.get(scope.parentDiagramId);
    if (!parent || parent.kind !== 'container' || parent.id === child.id) return brokenSource('The Component parent is missing or is not a Container diagram.');
    if (parent.status !== 'active') throw new ApiConflictError('Restore the parent Container before accessing this Component diagram.', 'PARENT_INACTIVE');
    const parentScope = getContainerScope(parent);
    if (!parentScope || parentScope.parentDiagramId === child.id || parentScope.parentDiagramId === parent.id) return brokenSource('The ancestor chain is cyclic or has the wrong level.');
    const context = await repository.get(parentScope.parentDiagramId);
    const ancestor = resolveContainerScope(parent, context);
    const owner = parent.components.find(c => c.id === scope.containerId);
    if (!owner || owner.diagramId !== parent.id || owner.role !== 'container' || owner.type !== 'container' || !isContainerType(owner.containerType) || !owner.technology?.trim() || !owner.description?.trim()) return brokenSource('The owning Application/Datastore is missing or ineligible.');
    const resolved: ComponentScope = { parentDiagramId: parent.id, containerId: owner.id, parentDiagramName: ancestor.owner.name, containerName: owner.name, containerDescription: owner.description, containerTechnology: owner.technology, containerType: owner.containerType, systemContextDiagramId: ancestor.parent.id, softwareSystemId: ancestor.owner.id, softwareSystemName: ancestor.owner.name };
    return { parent, context: ancestor.parent, scope: resolved };
  }

  private sourceSummary(source: DiagramDocument['components'][number], parent: DiagramDocument, context: DiagramDocument): ComponentSourceSummary {
    if (source.diagramId !== parent.id) return brokenSource(`Source ${source.id} belongs to the wrong parent.`);
    if (source.role === 'container' && source.type === 'container' && isContainerType(source.containerType) && source.technology?.trim() && source.description?.trim() && !source.sourceComponentId) {
      return { id: source.id, name: source.name, description: source.description, type: 'container', containerType: source.containerType, technology: source.technology, canonicalSourceComponentId: source.id, sourceDiagramId: parent.id };
    }
    if (source.role !== 'external' || !source.sourceComponentId || !isC4ArtifactType(source.type) || source.containerType != null || source.technology != null) return brokenSource(`Source ${source.id} is not an eligible Container participant.`);
    const canonical = context.components.find(c => c.id === source.sourceComponentId);
    if (!canonical || canonical.diagramId !== context.id || (canonical.role ?? 'element') !== 'element' || !isC4ArtifactType(canonical.type) || canonical.sourceComponentId || canonical.id === parent.scope?.softwareSystemId) return brokenSource(`Source ${source.id} has a broken, cyclic or ineligible canonical source.`);
    return { id: source.id, name: canonical.name, description: canonical.description, type: canonical.type, containerType: null, technology: null, canonicalSourceComponentId: canonical.id, sourceDiagramId: context.id };
  }
}
