import { describe, expect, it } from 'vitest';
import { buildHtmlPackage } from '../src/export/html-package';
import { exportAdrFixture, exportAdrsFixture, exportDiagramFixture, exportIds, exportTimestamp } from './html-export-fixtures';

describe('portable HTML package files', () => {
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
  });
});
