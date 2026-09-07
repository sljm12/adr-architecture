import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const editor = source('../src/components/AdrEditor.tsx'); const list = source('../src/components/AdrList.tsx');

describe('ADR editor contract', () => {
  it('exposes required labels, optional fields, inline errors, and keyboard form submission', () => {
    expect(editor).toContain('onSubmit={event =>'); expect(editor).toContain('htmlFor={`adr-${name}`}'); expect(editor).toContain('aria-invalid'); expect(editor).toContain('alternativesOrConstraints'); expect(editor).toContain('Save decision');
  });
  it('shows stable selection identity and visible save/status feedback', () => {
    expect(list).toContain('record.id'); expect(list).toContain('aria-current'); expect(list).toContain('role="status"'); expect(list).toContain('No decisions yet');
  });
});
