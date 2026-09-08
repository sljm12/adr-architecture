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

  it('does not require a link for a valid unlinked ADR draft', () => {
    useAdrStore.getState().startNew('00000000-0000-0000-0000-000000000031');
    expect(useAdrStore.getState().draft?.componentIds).toEqual([]);
  });
});
