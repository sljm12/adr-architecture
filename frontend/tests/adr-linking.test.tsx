import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { useAdrStore } from '../src/state/adr-store';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('ADR component linking', () => {
  it('exposes stable-ID link actions and an explicit unlinked representation', () => {
    const store = source('../src/state/adr-store.ts');
    expect(store).toContain('componentIds: string[]');
    expect(store).toContain('setComponentIds');
    expect(store).toContain('replaceLinks');
    expect(store).toContain('componentIds: []');
  });

  it('provides accessible picker, chips, unlink controls, and navigation callbacks', () => {
    const picker = source('../src/components/AdrLinkPicker.tsx');
    const editor = source('../src/components/AdrEditor.tsx');
    const workspace = source('../src/components/DiagramWorkspace.tsx');
    expect(picker).toContain('Search components');
    expect(picker).toContain('Remove');
    expect(picker).toContain('onSelectComponent');
    expect(editor).toContain('AdrLinkPicker');
    expect(workspace).toContain('selectedComponentId');
  });

  it('supports mixed component and relationship links with stable relationship navigation', () => {
    const picker = source('../src/components/AdrLinkPicker.tsx');
    const editor = source('../src/components/AdrEditor.tsx');
    const workspace = source('../src/components/WorkspaceInspector.tsx');
    const canvas = source('../src/components/DiagramCanvas.tsx');
    const store = source('../src/state/adr-store.ts');
    expect(picker).toContain('relationshipIds');
    expect(picker).toContain('onSelectRelationship');
    expect(editor).toContain('relationships={relationships}');
    expect(workspace).toContain('RelationshipAdrSummary');
    expect(canvas).toContain('selectedRelationshipId');
    expect(store).toContain('replaceRelationshipLinks');
    expect(store).toContain('loadRelationshipSummary');
  });

  it('does not require a link for a valid unlinked ADR draft', () => {
    useAdrStore.getState().startNew('00000000-0000-0000-0000-000000000031');
    expect(useAdrStore.getState().draft?.componentIds).toEqual([]);
    expect(useAdrStore.getState().draft?.relationshipIds).toEqual([]);
  });
});
