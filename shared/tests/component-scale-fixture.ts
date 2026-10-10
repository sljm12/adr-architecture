import { fitContainerLayout, type ArchitectureDecisionRecord, type Component, type DiagramDocument } from '../src/index';
import { containerScaleFixture } from './container-scale-fixture';

const uuid = (value: number) => `92000000-0000-4000-8000-${String(value).padStart(12, '0')}`;

/** Validation volumes, not product limits. IDs and source chains are deterministic. */
export function componentScaleFixture() {
  const { parent: context, child: baseline } = containerScaleFixture();
  context.name = 'Scale Context';
  const ownerTemplate = context.components[0];
  context.components[0].name = 'Scale System 0';
  context.components.push(...[1, 2].map(index => ({ ...ownerTemplate, id: uuid(index), name: `Scale System ${index}` })));
  const containers: DiagramDocument[] = [], components: DiagramDocument[] = [];
  for (let branch = 0; branch < 3; branch++) {
    const owner = context.components.find(c => c.name === `Scale System ${branch}`)!;
    const parent = structuredClone(baseline);
    parent.id = uuid(100 + branch); parent.name = owner.name;
    parent.scope = { parentDiagramId: context.id, parentDiagramName: context.name, softwareSystemId: owner.id, softwareSystemName: owner.name, softwareSystemDescription: owner.description };
    const localIds = new Map(parent.components.map((c, i) => [c.id, uuid(10000 + branch * 1000 + i)]));
    parent.components = parent.components.map(c => ({ ...c, id: localIds.get(c.id)!, diagramId: parent.id }));
    parent.relationships = parent.relationships.map((r, i) => ({ ...r, id: uuid(20000 + branch * 1000 + i), diagramId: parent.id, sourceComponentId: localIds.get(r.sourceComponentId)!, targetComponentId: localIds.get(r.targetComponentId)! }));
    containers.push(parent);
    for (let childIndex = 0; childIndex < 2; childIndex++) {
      const childOwner = parent.components[childIndex], childId = uuid(200 + branch * 2 + childIndex);
      const internals: Component[] = parent.components.slice(0, 100).map((c, i) => ({ ...c, id: uuid(30000 + (branch * 2 + childIndex) * 1000 + i), diagramId: childId, name: `Component ${i}`, role: 'component', type: 'component', containerType: null, sourceComponentId: null }));
      // Exercise the full Component -> Container occurrence -> Context source chain.
      const externals: Component[] = parent.components.filter(c => c.role === 'external').map((c, i) => ({ ...c, id: uuid(40000 + (branch * 2 + childIndex) * 1000 + i), diagramId: childId, sourceComponentId: c.id, position: { x: 0, y: 0 } }));
      const layout = fitContainerLayout(internals, externals);
      components.push({ ...parent, id: childId, name: childOwner.name, kind: 'component', scope: { parentDiagramId: parent.id, containerId: childOwner.id, parentDiagramName: parent.name, containerName: childOwner.name, containerDescription: childOwner.description, containerTechnology: childOwner.technology!, containerType: childOwner.containerType!, systemContextDiagramId: context.id, softwareSystemId: owner.id, softwareSystemName: owner.name }, boundary: layout.boundary, components: [...internals, ...layout.externalComponents], relationships: parent.relationships.map((r, i) => ({ ...r, id: uuid(50000 + (branch * 2 + childIndex) * 1000 + i), diagramId: childId, sourceComponentId: internals[i % 100].id, targetComponentId: i < 100 ? internals[(i + 1) % 100].id : externals[i % 100].id })) });
    }
  }
  const documents = [context, ...containers, ...components];
  const adrs: ArchitectureDecisionRecord[] = documents.flatMap((d, index) => [0, 1].map(linked => ({ id: uuid(60000 + index * 2 + linked), diagramId: d.id, title: linked ? 'Linked scale decision' : 'Unlinked scale decision', context: 'Preserve the architecture', decision: 'Use stable local references', consequences: 'Portable review', alternativesOrConstraints: null, status: 'accepted', replacementAdrId: null, componentIds: linked ? [d.components[0].id] : [], relationshipIds: linked && d.relationships.length ? [d.relationships[0].id] : [], createdAt: d.createdAt, updatedAt: d.updatedAt })));
  return { context, containers, components, documents, adrs };
}

export async function sampledMedian(run: () => unknown | Promise<unknown>) {
  // Yield between samples so long synchronous rendering cannot starve runner IPC.
  const yieldToRunner = () => new Promise<void>(resolve => setTimeout(resolve, 0));
  for (let i = 0; i < 5; i++) { await run(); await yieldToRunner(); }
  const samples: number[] = [];
  for (let i = 0; i < 20; i++) { const start = performance.now(); await run(); samples.push(performance.now() - start); await yieldToRunner(); }
  const ordered = [...samples].sort((a, b) => a - b);
  return { warmups: 5, samples, medianMs: (ordered[9] + ordered[10]) / 2 };
}
