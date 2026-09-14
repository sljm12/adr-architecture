import { describe, expect, it } from 'vitest';
import { calculateGroupBounds, MermaidExportError, exportMermaid, type DiagramDocument } from '../src/index';

const diagramId = '00000000-0000-4000-8000-000000000401';
const personId = '00000000-0000-4000-8000-000000000402';
const firstId = '00000000-0000-4000-8000-000000000403';
const secondId = '00000000-0000-4000-8000-000000000404';
const relationshipId = '00000000-0000-4000-8000-000000000405';
const groupId = '00000000-0000-4000-8000-000000000406';
const timestamp = '2026-01-01T00:00:00.000Z';

const document = (): DiagramDocument => {
  const components = [
    { id: personId, diagramId, name: 'Operator', description: null, type: 'person' as const, position: { x: 20, y: 20 }, createdAt: timestamp, updatedAt: timestamp },
    { id: firstId, diagramId, name: 'Checkout', description: null, type: 'software-system' as const, position: { x: 180, y: 140 }, createdAt: timestamp, updatedAt: timestamp },
    { id: secondId, diagramId, name: 'Ledger & Store', description: null, type: 'software-system' as const, position: { x: 420, y: 220 }, createdAt: timestamp, updatedAt: timestamp },
  ];
  return {
    id: diagramId, name: 'Payments', status: 'active', createdAt: timestamp, updatedAt: timestamp, trashedAt: null,
    components,
    relationships: [{ id: relationshipId, diagramId, sourceComponentId: personId, targetComponentId: firstId, direction: 'directed', label: 'uses | audits', createdAt: timestamp, updatedAt: timestamp }],
    groups: [{ id: groupId, diagramId, name: 'Payments & Core', memberComponentIds: [firstId, secondId], ...calculateGroupBounds(components.slice(1).map(component => component.position)), createdAt: timestamp, updatedAt: timestamp }],
  };
};

describe('C4 Mermaid group export', () => {
  it('renders typed shapes, stable labeled subgraphs, and each relationship exactly once', () => {
    const source = exportMermaid(document());

    expect(source).toContain('%% Semantic group membership is preserved; exact canvas positions are not exported.');
    expect(source).toContain(`component_${personId.replaceAll('-', '_')}(\("Operator"\))`);
    expect(source).toContain(`subgraph group_${groupId.replaceAll('-', '_')}["Payments &amp; Core"]`);
    expect(source.match(new RegExp(`component_${firstId.replaceAll('-', '_')}`, 'g'))).toHaveLength(2);
    expect(source.match(new RegExp(`component_${secondId.replaceAll('-', '_')}`, 'g'))).toHaveLength(1);
    expect(source).toContain('uses #124; audits');
    expect(source.match(/-->/g)).toHaveLength(1);
  });

  it('returns a group-specific validation error and never emits incomplete group output', () => {
    const invalid = document();
    invalid.groups[0].memberComponentIds = [firstId, personId];

    try {
      exportMermaid(invalid);
      throw new Error('Expected Mermaid export to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(MermaidExportError);
      expect(error).toMatchObject({ fields: { 'groups[0].memberComponentIds': expect.stringMatching(/Software System/) } });
    }
  });

  it('reports unsafe group names at the group field rather than silently dropping the group', () => {
    const invalid = document();
    invalid.groups[0].name = 'Bad\u0000Group';
    expect(() => exportMermaid(invalid)).toThrowError(MermaidExportError);
    try { exportMermaid(invalid); } catch (error) {
      expect(error).toMatchObject({ fields: { 'groups[0].name': 'Remove control characters before exporting.' } });
    }
  });
});
