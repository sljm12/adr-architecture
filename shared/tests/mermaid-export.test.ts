import { describe, expect, it } from 'vitest';
import { exportMermaid } from '../src/export/mermaid-export';
import type { DiagramDocument } from '../src/domain/types';

const document: DiagramDocument = {
  id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301', name: 'System', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', trashedAt: null,
  components: [
    { id: '3f2504e0-4f89-41d3-9a0c-0305e82c3302', diagramId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301', name: 'API [public]', description: null, type: null, position: { x: 0, y: 0 }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: '3f2504e0-4f89-41d3-9a0c-0305e82c3303', diagramId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301', name: 'API [public]', description: null, type: null, position: { x: 1, y: 1 }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: '3f2504e0-4f89-41d3-9a0c-0305e82c3304', diagramId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301', name: '数据服务', description: null, type: null, position: { x: 2, y: 2 }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  ],
  relationships: [
    { id: '3f2504e0-4f89-41d3-9a0c-0305e82c3305', diagramId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301', sourceComponentId: '3f2504e0-4f89-41d3-9a0c-0305e82c3302', targetComponentId: '3f2504e0-4f89-41d3-9a0c-0305e82c3304', direction: 'directed', label: 'reads | writes', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: '3f2504e0-4f89-41d3-9a0c-0305e82c3306', diagramId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301', sourceComponentId: '3f2504e0-4f89-41d3-9a0c-0305e82c3303', targetComponentId: '3f2504e0-4f89-41d3-9a0c-0305e82c3304', direction: 'undirected', label: 'sync', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  ],
};

describe('Mermaid export', () => {
  it('covers every node and relationship with stable unique Mermaid IDs', () => {
    const source = exportMermaid(document);
    expect(source).toContain('flowchart TD');
    expect(source).toContain('component_3f2504e0_4f89_41d3_9a0c_0305e82c3302["API [public]"]');
    expect(source).toContain('component_3f2504e0_4f89_41d3_9a0c_0305e82c3303["API [public]"]');
    expect(source).toContain('component_3f2504e0_4f89_41d3_9a0c_0305e82c3304["数据服务"]');
    expect(source).toContain('-->|reads #124; writes|');
    expect(source).toContain('---|sync|');
  });

  it('escapes supported punctuation and rejects unsafe control characters with entity context', () => {
    expect(exportMermaid({ ...document, components: [{ ...document.components[0], name: 'API "public"' }, ...document.components.slice(1)] })).toContain('API #quot;public#quot;');
    expect(() => exportMermaid({ ...document, components: [{ ...document.components[0], name: 'Unsafe\u0000 name' }] })).toThrow('Component 3f2504e0-4f89-41d3-9a0c-0305e82c3302');
  });
});
