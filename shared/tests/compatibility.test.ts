import { describe, expect, it } from 'vitest';
import { diagramDocumentSchema } from '../src/validation/schemas';
import type { DiagramDocument } from '../src/domain/types';

const document: DiagramDocument = {
  id: '00000000-0000-0000-0000-000000000001', name: 'System', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', trashedAt: null,
  components: [{ id: '00000000-0000-0000-0000-000000000002', diagramId: '00000000-0000-0000-0000-000000000001', name: 'API', description: null, type: null, position: { x: 10, y: 20 }, size: { width: 180, height: 72 }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }], relationships: [], groups: [],
};

type FutureAdrComponentLink = { adrId: string; componentId: string };

describe('future ADR link compatibility', () => {
  it('validates a document whose component identity can be linked directly', () => {
    const link: FutureAdrComponentLink = { adrId: '00000000-0000-0000-0000-000000000010', componentId: document.components[0].id };
    expect(diagramDocumentSchema.parse(document).components[0].id).toBe(link.componentId);
  });

  it('keeps a component UUID stable through ordinary edits', () => {
    const edited = { ...document, components: [{ ...document.components[0], name: 'Public API', position: { x: 80, y: 120 } }] };
    expect(edited.components[0].id).toBe(document.components[0].id);
  });

  it('normalizes legacy documents to the current component size without changing identity', () => {
    const legacy = { ...document, components: document.components.map(({ size: _size, ...component }) => component) };
    const parsed = diagramDocumentSchema.parse(legacy);
    expect(parsed.components[0]).toMatchObject({ id: document.components[0].id, size: { width: 180, height: 72 } });
  });

  it.each([
    [{ width: 0, height: 72 }],
    [{ width: -1, height: 72 }],
    [{ width: 180, height: Number.POSITIVE_INFINITY }],
    [{ width: Number.NaN, height: 72 }],
  ])('rejects invalid component dimensions %o', size => {
    expect(diagramDocumentSchema.safeParse({ ...document, components: [{ ...document.components[0], size }] }).success).toBe(false);
  });
});
