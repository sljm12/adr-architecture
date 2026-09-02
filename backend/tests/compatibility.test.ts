import { describe, expect, it } from 'vitest';
import { DiagramRepository } from '../src/persistence/diagram-repository';
import type { DiagramDocument } from '../../shared/src/domain/types';

const document: DiagramDocument = {
  id: '00000000-0000-0000-0000-000000000011', name: 'System', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', trashedAt: null,
  components: [{ id: '00000000-0000-0000-0000-000000000012', diagramId: '00000000-0000-0000-0000-000000000011', name: 'API', description: null, type: null, position: { x: 10, y: 20 }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }], relationships: [],
};

describe('backend ADR link compatibility', () => {
  it('resolves a future ADR component link after rename and reposition', () => {
    const repository = new DiagramRepository();
    repository.create(document);
    const link = { adrId: '00000000-0000-0000-0000-000000000013', componentId: document.components[0].id };
    repository.replace({ ...document, components: [{ ...document.components[0], name: 'Public API', position: { x: 80, y: 120 } }] });
    const resolved = repository.get(document.id)?.components.find(component => component.id === link.componentId);
    expect(resolved?.name).toBe('Public API');
    expect(resolved?.id).toBe(link.componentId);
  });
});
