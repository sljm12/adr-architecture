import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('C4 artifact type accessibility contract', () => {
  it('exposes readable type choices, descriptions, and compatibility labels', () => {
    const inspector = source('../src/components/WorkspaceInspector.tsx');
    const node = source('../src/components/ComponentNode.tsx');
    const metadata = source('../../shared/src/domain/c4.ts');
    expect(inspector).toContain('C4 artifact type');
    expect(inspector).toContain('Person');
    expect(inspector).toContain('Software System');
    expect(metadata).toContain('A user, actor, role, or persona interacting with systems.');
    expect(inspector).toContain('Legacy type: Unclassified');
    expect(node).toContain('aria-label={`Component ${data.label}, ${typeLabel}`}');
    expect(node).toContain('component-type-label');
  });

  it('keeps creation validation and cancellation side-effect-free', () => {
    const inspector = source('../src/components/WorkspaceInspector.tsx');
    const store = source('../src/state/diagram-store.ts');
    expect(inspector).toContain('onSubmit={add}');
    expect(inspector).toContain('Choose Person or Software System before adding the component.');
    expect(inspector).toContain('type="button" onClick={onClose}>Cancel');
    expect(store).toContain('if (!document || !name.trim() || !isC4ArtifactType(type)) return false;');
    expect(store).toContain('type,');
  });
});
