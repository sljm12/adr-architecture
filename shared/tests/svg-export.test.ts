import { describe, expect, it } from 'vitest';
import { renderDiagramSvg } from '../src/export/svg-export';
import { exportDiagramFixture, exportIds } from './html-export-fixtures';

describe('domain-based SVG rendering', () => {
  it('renders resized components, system groups, type cues, and an explicit view box', () => {
    const svg = renderDiagramSvg(exportDiagramFixture());
    expect(svg).toContain('viewBox=');
    expect(svg).toContain('Finance &amp; ledger');
    expect(svg).toContain('width="260"');
    expect(svg).toContain('height="130"');
    expect(svg).toContain('component-type-person');
    expect(svg).toContain('component-type-software-system');
    expect(svg).toContain(`visual-component-${exportIds.systemA}`);
  });

  it('keeps labels escaped and routes parallel relationships on separate paths', () => {
    const svg = renderDiagramSvg(exportDiagramFixture());
    expect(svg).toContain('Payments &lt;Core&gt;');
    expect(svg).toContain('writes &lt;events&gt;');
    expect(svg).toContain('Payments &amp; Ledger');
    const paths = [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map(match => match[1]);
    expect(paths).toHaveLength(2);
    expect(new Set(paths).size).toBe(2);
    expect(svg).toContain('<polygon');
  });

  it('uses artifact UUIDs rather than duplicate names for interactive anchors', () => {
    const diagram = exportDiagramFixture();
    diagram.components[1].name = diagram.components[0].name;
    const svg = renderDiagramSvg(diagram);
    expect(svg).toContain(`href="#component-${exportIds.systemA}"`);
    expect(svg).toContain(`href="#component-${exportIds.systemB}"`);
    expect(svg.match(/href="#component-/g)).toHaveLength(3);
  });
});
