import { describe, expect, it } from 'vitest';
import { buildAggregateHtmlPackage } from '../src/export/html-package';
import { validatePackageReferences } from '../src/export/package-links';
import { aggregateInput } from './html-package-input';

describe('parent and container package rendering', () => {
  it('includes all required files, full C4 visuals, exact local ADRs and UUID owner/source actions', () => {
    const { source, capture, fixture } = aggregateInput();
    const files = buildAggregateHtmlPackage(capture, source);
    expect(Object.keys(files).sort()).toEqual(fixture.expected.filePaths.sort());
    expect(() => validatePackageReferences(files)).not.toThrow();
    const child = fixture.children.find(d => d.components.length)!;
    const page = files[`diagrams/${child.id}/index.html`];
    for (const text of ['Container diagram', 'Application', 'Datastore', 'TypeScript', 'PostgreSQL', 'HTTPS', 'SQL', 'system-boundary', 'Return to System context', '../../styles.css']) expect(page).toContain(text);
    expect(page).toContain(`../../index.html#component-${child.scope!.softwareSystemId}`);
    const localAdr = fixture.adrsByDiagram[child.id].find(a => a.relationshipIds.includes(child.relationships[0].id))!;
    const details = page.split(`id="relationship-${child.relationships[0].id}"`)[1].split('</section>')[0];
    expect(details).toContain(`../../adrs.html#adr-${localAdr.id}`);
    for (const adr of fixture.adrsByDiagram[fixture.parent.id]) expect(page).not.toContain(`adr-${adr.id}`);
    expect(files['adrs.html']).toContain(`diagrams/${child.id}/index.html#relationship-${child.relationships[0].id}`);
    expect(files[`adrs/${localAdr.id}.md`]).toContain(`../diagrams/${child.id}/index.html#relationship-${child.relationships[0].id}`);
    expect(files['index.html']).toContain('No active container diagram is included');
    expect(files['index.html']).toContain('trashed');
    const empty = fixture.children.find(d => !d.components.length)!;
    expect(files[`diagrams/${empty.id}/index.html`]).toContain('system-boundary');
    expect(files[`diagrams/${empty.id}/index.html`]).toContain('No ADRs belong to this diagram');
  });
  it('keeps no-child and direct-child packages at the root without parent/sibling actions', () => {
    const { source, capture } = aggregateInput();
    source.diagrams = [source.diagrams[0]];
    source.availability = source.availability.map(a => ({ ...a, availability: 'none', diagram: null }));
    const files = buildAggregateHtmlPackage(capture, source);
    expect(Object.keys(files).some(p => p.startsWith('diagrams/'))).toBe(false);
    expect(files['index.html']).not.toContain('Open container diagram</a>');
  });
});
