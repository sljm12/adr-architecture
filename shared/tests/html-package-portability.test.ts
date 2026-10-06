import { describe, expect, it } from 'vitest';
import { buildAggregateHtmlPackage, buildHtmlPackage } from '../src/export/html-package';
import { assembleHtmlPackageSnapshot } from '../src/export/html-package-snapshot';
import { validatePackageReferences } from '../src/export/package-links';
import { aggregateInput } from './html-package-input';
import { exportAdrFixture, exportAdrsFixture, exportDiagramFixture, exportIds, exportTimestamp } from './html-export-fixtures';

describe('portable HTML package files', () => {
  it('emits exactly one vector per included diagram and one safe Markdown per scoped ADR', () => {
    const { fixture, capture, source } = aggregateInput();
    const before = structuredClone({ capture, source });
    const files = buildAggregateHtmlPackage(capture, source);
    expect(Object.keys(files).sort()).toEqual([...fixture.expected.filePaths].sort());
    expect(() => validatePackageReferences(files)).not.toThrow();
    expect({ capture, source }).toEqual(before);
    const snapshot = assembleHtmlPackageSnapshot(capture, source);
    for (const { diagram, adrs } of snapshot.diagrams) {
      const htmlPath = diagram.id === snapshot.entryDiagramId ? 'index.html' : `diagrams/${diagram.id}/index.html`;
      for (const adr of adrs) {
        const markdown = files[`adrs/${adr.id}.md`];
        expect(markdown).toContain(`- Diagram: [${diagram.name} (${diagram.id})](../${htmlPath})`);
        expect(markdown).toContain(`- Level: ${diagram.kind === 'container' ? 'Container diagram' : 'System context'}`);
        expect(markdown).toContain(`- ADR ID: ${adr.id}`);
        expect(markdown).toContain(`- Status: ${adr.status}`);
        for (const field of ['context', 'decision', 'consequences', 'alternativesOrConstraints'] as const) {
          if (adr[field]) expect(markdown).toContain(adr[field]!.replace(/\./g, '\\.'));
        }
        expect(markdown).toContain(adr.createdAt.replace(/[-.]/g, '\\$&'));
        expect(markdown).toContain(adr.updatedAt.replace(/[-.]/g, '\\$&'));
        for (const id of adr.componentIds) {
          const component = diagram.components.find(item => item.id === id)!;
          expect(markdown).toContain(`[${component.name} (${id})](../${htmlPath}#component-${id})`);
        }
        for (const id of adr.relationshipIds) {
          const relationship = diagram.relationships.find(item => item.id === id)!;
          expect(markdown).toContain(`[${relationship.label} (${id})](../${htmlPath}#relationship-${id})`);
        }
        if (adr.replacementAdrId) {
          expect(adrs.some(item => item.id === adr.replacementAdrId)).toBe(true);
          expect(markdown).toContain(`../adrs.html#adr-${adr.replacementAdrId}`);
        }
        if (!adr.componentIds.length && !adr.relationshipIds.length) expect(markdown).toContain('This ADR is not linked to a diagram artifact.');
      }
    }
  });

  it('preserves every inline vector primitive, label and geometry in standalone root and child SVGs', () => {
    const { capture, source } = aggregateInput();
    const files = buildAggregateHtmlPackage(capture, source);
    const snapshot = assembleHtmlPackageSnapshot(capture, source);
    // Standalone selection wrappers/default styles may differ; authored shapes, text and routes may not.
    const primitives = (svg: string) => svg.match(/<(?:rect|ellipse|path|polygon|text)\b[^>]*(?:\/>|>.*?<\/text>)/gs) ?? [];
    for (const { diagram } of snapshot.diagrams) {
      const prefix = diagram.id === snapshot.entryDiagramId ? '' : `diagrams/${diagram.id}/`;
      const inline = files[`${prefix}index.html`].match(/<svg\b.*?<\/svg>/s)![0];
      const standalone = files[`${prefix}diagram.svg`];
      expect(primitives(standalone)).toEqual(primitives(inline));
      const bounds = inline.match(/viewBox="([^"]+)"/)![1].split(' ').map(Number);
      expect(standalone).toContain(`viewBox="0 0 ${bounds[2]} ${bounds[3]}"`);
      expect(standalone).toContain(`transform="translate(${-bounds[0]} ${-bounds[1]})"`);
      expect(standalone).toContain('<style>');
      expect(standalone).not.toMatch(/<(?:image|script|foreignObject)\b|var\(--component/);
      expect(standalone.match(/class="diagram-component"|class="diagram-component /g) ?? []).toHaveLength(diagram.components.length);
      if (diagram.kind === 'container') {
        expect(standalone).toContain('class="system-boundary"');
        expect(standalone).toContain(`data-owner-component-id="${diagram.scope!.softwareSystemId}"`);
      }
      expect(files[`${prefix}index.html`]).toContain(`href="${prefix ? '../../' : ''}styles.css"`);
    }
    expect(files['styles.css']).toContain('all root and nested HTML diagrams');
    expect(files['styles.css']).toContain('Standalone SVG');
  });

  it('escapes authored Markdown in diagram scope, artifact names and every decision field', () => {
    const { capture, source } = aggregateInput();
    const hostile = '<script>x</script> [run](javascript:alert(1)) & *bold*';
    capture.overrides[source.entryDiagramId].diagram.name = hostile;
    const member = source.diagrams.find(item => item.diagram.components.some(c => c.role === 'container'))!;
    member.diagram.components.find(c => c.role === 'container')!.name = hostile;
    const adr = member.adrs.find(item => item.status === 'accepted')!;
    Object.assign(adr, { title: hostile, context: hostile, decision: hostile, consequences: hostile, alternativesOrConstraints: hostile });
    const files = buildAggregateHtmlPackage(capture, source);
    for (const path of Object.keys(files).filter(path => path.endsWith('.md'))) {
      expect(files[path]).not.toContain('<script>');
      expect(files[path]).not.toContain('[run](javascript:');
    }
    const markdown = files[`adrs/${adr.id}.md`];
    expect(markdown).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(markdown).toContain('\\[run\\]\\(javascript:alert\\(1\\)\\) &amp; \\*bold\\*');
    expect(() => validatePackageReferences(files)).not.toThrow();
  });

  it('includes the fixed manifest and one UUID-named Markdown file for every ADR', () => {
    const files = buildHtmlPackage({ diagram: exportDiagramFixture(), adrs: exportAdrsFixture(), capturedAt: exportTimestamp });

    expect(Object.keys(files).sort()).toEqual([
      'adrs.html',
      `adrs/${exportIds.adr}.md`,
      `adrs/${exportIds.relationshipAdr}.md`,
      `adrs/${exportIds.unlinkedAdr}.md`,
      'diagram.svg',
      'index.html',
      'styles.css',
    ].sort());
    expect(files[`adrs/${exportIds.adr}.md`]).toContain(`ADR ID: ${exportIds.adr}`);
  });

  it('writes readable Markdown fields and stable links while neutralizing Markdown and HTML syntax', () => {
    const files = buildHtmlPackage({
      diagram: exportDiagramFixture(),
      adrs: exportAdrsFixture().map(adr => adr.id === exportIds.adr ? {
        ...adr,
        title: 'Use [Payments] #1',
        context: 'First line\n<script>alert("no")</script> and [link](javascript:alert(1))',
      } : adr),
      capturedAt: exportTimestamp,
    });
    const markdown = files[`adrs/${exportIds.adr}.md`];

    expect(markdown).toContain('# Use \\[Payments\\] \\#1');
    expect(markdown).toContain('- Status: accepted');
    expect(markdown).toContain('- Created:');
    expect(markdown).toContain('Context');
    expect(markdown).toContain('First line');
    expect(markdown).not.toContain('<script');
    expect(markdown).not.toContain('[link](javascript:');
    expect(markdown).toContain(`../index.html#component-${exportIds.systemA}`);
    expect(markdown).toContain(`Payments &lt;Core&gt; (${exportIds.systemA})`);
    expect(files[`adrs/${exportIds.unlinkedAdr}.md`]).toContain('This ADR is not linked to a diagram artifact.');
  });

  it('keeps the standalone SVG editable and uses documented component color variables in HTML CSS', () => {
    const files = buildHtmlPackage({ diagram: exportDiagramFixture(), adrs: exportAdrsFixture(), capturedAt: exportTimestamp });
    const svg = files['diagram.svg'];
    const styles = files['styles.css'];

    expect(svg).toMatch(/<svg[^>]+viewBox="[^"]+"/);
    expect(svg).toContain('class="system-group"');
    expect(svg).toContain('class="diagram-relationships"');
    expect(svg).toContain('class="diagram-components"');
    expect(svg).toContain('class="relationship-path"');
    expect(svg).toContain('<style>');
    expect(styles.indexOf('--component-outline')).toBeLessThan(styles.indexOf('a{'));
    expect(styles).toMatch(/--component-outline:\s*#[0-9a-f]{3,8}/i);
    expect(styles).toMatch(/--component-fill:\s*#[0-9a-f]{3,8}/i);
    expect(styles).toContain('stroke:var(--component-outline)');
    expect(styles).toContain('fill:var(--component-fill)');
    expect(styles).toContain('a:focus-visible');
    expect(styles).toContain('.artifact-detail:target');
    expect(styles).toContain('.empty-value{color:#5f6368;font-style:italic}');
  });
});
