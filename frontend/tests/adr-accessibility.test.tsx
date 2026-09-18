import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const editor = source('../src/components/AdrEditor.tsx');
const picker = source('../src/components/AdrLinkPicker.tsx');
const componentSummary = source('../src/components/ComponentAdrSummary.tsx');
const relationshipSummary = source('../src/components/RelationshipAdrSummary.tsx');
const styles = source('../src/styles.css');

describe('ADR workflow accessibility contract', () => {
  it('keeps the complete ADR form keyboard-submit friendly and field-addressable', () => {
    expect(editor).toContain('<form className="adr-editor"');
    expect(editor).toContain('onSubmit={event => { event.preventDefault(); void save(); }}');
    expect(editor).toContain('onKeyDown={event => { if ((event.metaKey || event.ctrlKey)');
    expect(editor).toContain('htmlFor={`adr-${name}`}');
    expect(editor).toContain('htmlFor="adr-alternatives"');
    expect(editor).toContain('htmlFor="adr-status"');
    expect(editor).toContain('aria-invalid={Boolean(fieldErrors');
    expect(editor).toContain('aria-describedby={messageId(');
    expect(editor).toContain('role="alert"');
    expect(editor).toContain('role="status" aria-live="polite"');
  });

  it('gives link selection, unlinking, and direct navigation readable names', () => {
    expect(picker).toContain('aria-labelledby="adr-link-picker-heading"');
    expect(picker).toContain('htmlFor="adr-component-search"');
    expect(picker).toContain('role="group" aria-label="Available components and relationships"');
    expect(picker).toContain('type="checkbox" aria-label={component.name}');
    expect(picker).toContain('aria-label={`Remove ${component.name}`}');
    expect(picker).toContain('>View</button>');
  });

  it('keeps component and relationship summaries distinguishable and actionable', () => {
    expect(componentSummary).toContain('aria-labelledby="component-adr-summary-heading"');
    expect(componentSummary).toContain('role="status"');
    expect(componentSummary).toContain('role="alert"');
    expect(componentSummary).toContain('aria-label={`Open ADR: ${summary.title}`}');
    expect(relationshipSummary).toContain('aria-labelledby="relationship-adr-summary-heading"');
    expect(relationshipSummary).toContain('No linked ADRs for this relationship.');
    expect(relationshipSummary).toContain('aria-label={`Open ADR: ${summary.title}`}');
  });

  it('retains focus treatment, readable overflow, responsive breakpoints, and touch targets', () => {
    expect(styles).toContain('button:focus-visible');
    expect(styles).toContain('min-height:44px');
    expect(styles).toContain('overflow-wrap:anywhere');
    expect(styles).toContain('@media(max-width:1068px)');
    expect(styles).toContain('@media(max-width:833px)');
    expect(styles).toContain('@media(max-width:640px)');
  });
});
