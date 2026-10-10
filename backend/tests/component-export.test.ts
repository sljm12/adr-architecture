import { describe, expect, it } from 'vitest';
import { DiagramRepository } from '../src/persistence/diagram-repository';
import { ExportService } from '../src/services/export-service';
import { componentPackageInput } from '../../shared/tests/component-package-input';

describe('saved selected Component Mermaid', () => {
  it('hydrates the owner name without writes or recursion', async () => {
    const { root, parent, child } = componentPackageInput();
    parent.components[0].name = 'Authoritative owner';
    const repository = new DiagramRepository(); for (const d of [root, parent, child]) repository.create(d);
    const before = repository.listAll();
    const result = await new ExportService(repository).exportMermaid(child.id);
    expect(result.filename).toBe('Authoritative-owner.mmd');
    expect(result.source).toContain('Component diagram'); expect(result.source).toContain('Authoritative owner');
    expect(repository.listAll()).toEqual(before);
  });
});
