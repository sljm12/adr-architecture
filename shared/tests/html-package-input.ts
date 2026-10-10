import type { HtmlPackageCapture, HtmlExportSource } from '../src/export/html-package-snapshot';
import type { DiagramDocument } from '../src/domain/types';
import { exportTimestamp, htmlPackageFixture } from './html-export-fixtures';

export function containerPackageContexts(fixture: ReturnType<typeof htmlPackageFixture>) {
  return Object.fromEntries(fixture.children.map(child => [child.id, { scope: child.scope!, capturedAt: exportTimestamp, sources: fixture.parent.components.filter(c => c.id !== child.scope!.softwareSystemId && (c.type === 'person' || c.type === 'software-system')).map(c => ({ id: c.id, name: c.name, description: c.description, type: c.type as 'person' | 'software-system' })) }]));
}
export function containerOwnerAvailability(diagrams: DiagramDocument[]) {
  return diagrams.flatMap(diagram => diagram.components.filter(c => c.role === 'container').map(c => ({ parentDiagramId: diagram.id, containerId: c.id, availability: 'none' as const, diagram: null })));
}

export function aggregateInput() {
  const fixture = htmlPackageFixture();
  const source: HtmlExportSource = { entryDiagramId: fixture.parent.id, sourceCapturedAt: exportTimestamp,
    diagrams: [fixture.parent, ...fixture.children].map(diagram => ({ diagram, adrs: fixture.adrsByDiagram[diagram.id] })),
    availability: [...fixture.availability, ...containerOwnerAvailability(fixture.children)], sourceContexts: containerPackageContexts(fixture) };
  const capture: HtmlPackageCapture = { entryDiagramId: fixture.parent.id, capturedAt: exportTimestamp,
    overrides: { [fixture.parent.id]: { diagram: structuredClone(fixture.parent) } } };
  return { fixture, source, capture };
}
