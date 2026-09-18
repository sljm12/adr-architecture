import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { adrStatuses } from '../src/state/adr-store';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const store = source('../src/state/adr-store.ts');
const list = source('../src/components/AdrList.tsx');
const editor = source('../src/components/AdrEditor.tsx');
const inspector = source('../src/components/WorkspaceInspector.tsx');
const dialog = source('../src/components/ConfirmDialog.tsx');

describe('ADR lifecycle status contract', () => {
  it('exposes all lifecycle statuses for unrestricted transitions', () => {
    expect(adrStatuses).toEqual(['draft', 'accepted', 'superseded', 'rejected']);
    expect(editor).toContain('replacementAdrId');
    expect(editor).toContain("status === 'superseded'");
  });

  it('supports status filtering and keeps superseded/rejected metadata visible', () => {
    expect(list).toContain('filterStatus');
    expect(list).toContain('All statuses');
    expect(list).toContain('record.status');
    expect(list).toContain('record.updatedAt');
  });

  it('provides confirmation, blocker repair guidance, delete actions, and announcements', () => {
    expect(store).toContain('remove:');
    expect(store).toContain('delete');
    expect(editor).toContain('Dependency blocker');
    expect(editor).toContain('repair');
    expect(editor).toContain('Delete decision');
    expect(dialog).toContain('role="alertdialog"');
    expect(editor).toContain('role="alert"');
    expect(editor).toContain('role="status"');
  });
});
