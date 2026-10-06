import type { HtmlPackageCapture, HtmlExportSource } from '../src/export/html-package-snapshot';
import { exportTimestamp, htmlPackageFixture } from './html-export-fixtures';

export function aggregateInput() {
  const fixture = htmlPackageFixture();
  const source: HtmlExportSource = { entryDiagramId: fixture.parent.id, sourceCapturedAt: exportTimestamp,
    diagrams: [fixture.parent, ...fixture.children].map(diagram => ({ diagram, adrs: fixture.adrsByDiagram[diagram.id] })),
    availability: fixture.availability, containerContext: null };
  const capture: HtmlPackageCapture = { entryDiagramId: fixture.parent.id, capturedAt: exportTimestamp,
    overrides: { [fixture.parent.id]: { diagram: structuredClone(fixture.parent) } } };
  return { fixture, source, capture };
}
