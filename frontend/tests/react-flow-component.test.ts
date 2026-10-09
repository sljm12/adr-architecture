import { describe, expect, it } from 'vitest';
import { toReactFlow, fromReactFlow } from '../src/adapters/react-flow/diagram-adapter';
import { populatedComponentFixture } from '../../shared/tests/component-fixtures';
import type { DiagramDocument } from '../../shared/src/index';
describe('Component React Flow adapter', () => {
  it('projects roles/details and keeps synthetic scope separate from absolute artifact geometry', () => {
    const input = populatedComponentFixture() as DiagramDocument; const visual = toReactFlow(input);
    expect(visual.nodes[0]).toMatchObject({ connectable: false, selectable: false, focusable: false, data: { scopeKind: 'component' } });
    expect(visual.nodes[1].data).toMatchObject({ role: 'component', type: 'component', description: input.components[0].description, technology: 'TypeScript' });
    expect(visual.nodes[2].data).toMatchObject({ role: 'external', containerType: 'datastore', technology: 'PostgreSQL' });
    expect(visual.nodes.slice(1).every(n => n.parentId === undefined)).toBe(true);
    expect(visual.edges[0]).toMatchObject({ source: input.components[0].id, target: input.components[1].id, label: 'Records payment', data: { protocol: 'SQL' }, markerEnd: { type: 'arrowclosed' } });
    expect(fromReactFlow(input, visual.nodes)).toEqual(input);
    expect(fromReactFlow(input, visual.nodes).components.some(c => c.id === visual.nodes[0].id)).toBe(false);
  });
});
