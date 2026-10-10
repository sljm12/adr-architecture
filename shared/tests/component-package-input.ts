import type { DiagramDocument, HtmlExportSource, HtmlPackageCapture } from '../src/index';
import { componentContextFixture, componentParentFixture, populatedComponentFixture, emptyComponentFixture, componentAdrFixtures, componentFixtureTimestamp } from './component-fixtures';

export function componentPackageInput(entryLevel: 'general' | 'container' | 'component' = 'general') {
  const root = componentContextFixture(), parent = componentParentFixture(), child = populatedComponentFixture() as DiagramDocument, sibling = emptyComponentFixture('datastore') as DiagramDocument;
  const summary = (diagram: DiagramDocument) => { const { id, name, kind, status, scope, createdAt, updatedAt } = diagram; return { id, name, kind, status, scope, createdAt, updatedAt }; };
  const context = { scope: parent.scope!, sources: root.components.filter(c => c.id !== parent.scope!.softwareSystemId).map(({ id, name, description, type }) => ({ id, name, description, type })), capturedAt: componentFixtureTimestamp };
  const componentContext = (diagram: DiagramDocument) => ({ scope: diagram.scope!, sources: parent.components.filter(c => c.id !== (diagram.scope as any).containerId).map(c => {
    const canonical = c.role === 'external' ? root.components.find(s => s.id === c.sourceComponentId)! : c;
    return { id: c.id, name: canonical.name, description: canonical.description, type: canonical.type, containerType: c.containerType ?? null, technology: c.technology ?? null, canonicalSourceComponentId: canonical.id, sourceDiagramId: c.role === 'external' ? root.id : parent.id };
  }), capturedAt: componentFixtureTimestamp });
  const documents = entryLevel === 'general' ? [root, parent, child, sibling] : entryLevel === 'container' ? [parent, child, sibling] : [child];
  const availability = documents.flatMap(d => d.kind === 'general' ? d.components.filter(c => c.type === 'software-system').map(c => ({ parentDiagramId: d.id, softwareSystemId: c.id, availability: c.id === parent.scope!.softwareSystemId ? 'active' : 'none', diagram: c.id === parent.scope!.softwareSystemId ? summary(parent) : null })) : d.kind === 'container' ? [child, sibling].map(c => ({ parentDiagramId: d.id, containerId: (c.scope as any).containerId, availability: 'active', diagram: summary(c) })) : []);
  const source = { entryDiagramId: documents[0].id, sourceCapturedAt: componentFixtureTimestamp, diagrams: documents.map(diagram => ({ diagram, adrs: diagram.id === child.id ? componentAdrFixtures() : [] })), availability, sourceContexts: { [parent.id]: context, [child.id]: componentContext(child), [sibling.id]: componentContext(sibling) } } as unknown as HtmlExportSource;
  // Only included members carry context; direct Component still captures its omitted ancestors through its context.
  for (const id of Object.keys((source as any).sourceContexts)) if (!documents.some(d => d.id === id)) delete (source as any).sourceContexts[id];
  const capture: HtmlPackageCapture = { entryDiagramId: documents[0].id, capturedAt: componentFixtureTimestamp, overrides: {} };
  return { root, parent, child, sibling, source, capture };
}
