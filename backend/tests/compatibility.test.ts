import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DiagramRepository } from '../src/persistence/diagram-repository';
import type { DiagramDocument } from '../../shared/src/domain/types';

const document: DiagramDocument = {
  id: '00000000-0000-0000-0000-000000000011', name: 'System', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', trashedAt: null,
  components: [{ id: '00000000-0000-0000-0000-000000000012', diagramId: '00000000-0000-0000-0000-000000000011', name: 'API', description: null, type: null, position: { x: 10, y: 20 }, size: { width: 180, height: 72 }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }], relationships: [], groups: [],
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

  it('keeps the additive ADR migration and schema boundaries explicit', () => {
    const migration = readFileSync(new URL('../drizzle/0002_adrs.sql', import.meta.url), 'utf8');
    expect(migration).toContain('CREATE TABLE adrs');
    expect(migration).toContain('CREATE TABLE adr_component_links');
    expect(migration).toContain('PRIMARY KEY (adr_id, component_id)');
    expect(migration).toContain('CREATE TABLE adr_relationship_links');
    expect(migration).toContain('PRIMARY KEY (adr_id, relationship_id)');
    expect(migration).not.toContain('ON DELETE CASCADE');
  });

  it('normalizes legacy component rows and declares additive dimension defaults', () => {
    const repository = new DiagramRepository();
    const legacy = { ...document, components: document.components.map(({ size: _size, ...component }) => component) } as unknown as DiagramDocument;
    repository.create(legacy);
    expect(repository.get(document.id)?.components[0].size).toEqual({ width: 180, height: 72 });

    const migration = readFileSync(new URL('../drizzle/0004_component_dimensions.sql', import.meta.url), 'utf8');
    expect(migration).toMatch(/ADD COLUMN width double precision NOT NULL DEFAULT 180/i);
    expect(migration).toMatch(/ADD COLUMN height double precision NOT NULL DEFAULT 72/i);
  });
});
