import { describe, expect, it } from 'vitest';
import type { ArchitectureDecisionRecord, DiagramDocument } from '../src/domain/types';
import { buildHtmlPackage } from '../src/export/html-package';

const timestamp = '2026-01-01T00:00:00.000Z';
const uuid = (value: number) => `00000000-0000-4000-8000-${value.toString(16).padStart(12, '0')}`;

function largeSnapshotInput() {
  const diagramId = uuid(1);
  const components: DiagramDocument['components'] = Array.from({ length: 100 }, (_, index) => ({
    id: uuid(1000 + index), diagramId, name: `Component ${index + 1}`, description: null, type: 'software-system',
    position: { x: (index % 10) * 300, y: Math.floor(index / 10) * 180 }, size: { width: 180, height: 72 }, createdAt: timestamp, updatedAt: timestamp,
  }));
  const relationships: DiagramDocument['relationships'] = Array.from({ length: 200 }, (_, index) => {
    const sourceIndex = index % 100;
    const targetIndex = (sourceIndex + (index < 100 ? 1 : 2)) % 100;
    return { id: uuid(2000 + index), diagramId, sourceComponentId: components[sourceIndex].id, targetComponentId: components[targetIndex].id, direction: 'directed', label: `Relationship ${index + 1}`, createdAt: timestamp, updatedAt: timestamp };
  });
  const adrs: ArchitectureDecisionRecord[] = Array.from({ length: 100 }, (_, index) => ({
    id: uuid(3000 + index), diagramId, title: `Scale ADR ${index + 1}`, context: `Context for scale ADR ${index + 1}.`, decision: `Decision ${index + 1}.`, consequences: `Consequences ${index + 1}.`, alternativesOrConstraints: null,
    status: 'accepted', replacementAdrId: null, componentIds: [components[index].id], relationshipIds: [relationships[index * 2].id], createdAt: timestamp, updatedAt: timestamp,
  }));
  const diagram: DiagramDocument = { id: diagramId, name: 'Scale architecture', status: 'active', createdAt: timestamp, updatedAt: timestamp, trashedAt: null, components, relationships, groups: [] };
  return { diagram, adrs, capturedAt: timestamp };
}

describe('HTML package scale', () => {
  it('renders a complete 100-component, 200-relationship, 100-ADR package within ten seconds', () => {
    const startedAt = performance.now();
    const files = buildHtmlPackage(largeSnapshotInput());
    const elapsedMs = performance.now() - startedAt;

    expect(Object.keys(files)).toHaveLength(104);
    expect(Object.keys(files).filter(path => /^adrs\/[0-9a-f-]+\.md$/i.test(path))).toHaveLength(100);
    expect((files['index.html'].match(/class="artifact-detail"/g) ?? [])).toHaveLength(300);
    expect((files['diagram.svg'].match(/class="diagram-component-link"/g) ?? [])).toHaveLength(100);
    expect((files['diagram.svg'].match(/class="diagram-relationship-link"/g) ?? [])).toHaveLength(200);
    expect((files['adrs.html'].match(/class="adr-detail"/g) ?? [])).toHaveLength(100);
    expect(elapsedMs).toBeLessThan(10_000);
  });
});
