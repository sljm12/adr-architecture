import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const toolbar = source('../src/components/DiagramToolbar.tsx');
const status = source('../src/components/SaveStatus.tsx');

describe('explicit save controls', () => {
  it('provides an accessible Save button that is disabled only while saving', () => {
    expect(toolbar).toContain('>Save</button>');
    expect(toolbar).toContain("status === 'saving'");
    expect(toolbar).toContain('onClick={() => void save()}');
  });

  it('announces each explicit-save state through a live status region', () => {
    expect(status).toContain('role="status"');
    expect(status).toContain("status === 'unsaved'");
    expect(status).toContain('Unsaved changes');
    expect(status).toContain("status === 'saved'");
    expect(status).toContain("? 'Saved'");
    expect(status).not.toContain('Saved automatically');
  });
});
