import { describe, expect, it } from 'vitest';
import { renderDiagramSvg } from '../src/export/svg-export';
import { layoutDiagramForSvg } from '../src/export/svg-layout';
import { wrapExportText } from '../src/export/container-labels';
import { exportDiagramFixture, exportIds, htmlPackageFixture } from './html-export-fixtures';

describe('domain-based SVG rendering', () => {
  it('keeps complete multiline relationship labels clear of component shapes', () => {
    const fixture = htmlPackageFixture();
    for (const diagram of [fixture.parent, fixture.children.find(item => item.components.length)!]) {
      const layout = layoutDiagramForSvg(diagram);
      for (const route of layout.relationshipRoutes) {
        const text = [route.relationship.label, ...(diagram.kind === 'container' ? [route.relationship.protocol] : [])].filter(Boolean).join('\n');
        const lines = wrapExportText(text, 260);
        const label = { x: route.label.x - 130, y: route.label.y - 14, width: 260, height: lines.length * 18 };
        for (const rect of layout.componentRects.values()) {
          expect(label.x < rect.x + rect.width && label.x + label.width > rect.x && label.y < rect.y + rect.height && label.y + label.height > rect.y).toBe(false);
        }
      }
    }
  });

  it('normalizes the standalone viewport for editors without losing negative-position artifacts', () => {
    const diagram = exportDiagramFixture();
    diagram.components[2].position.x = -400;
    const inline = renderDiagramSvg(diagram);
    const standalone = renderDiagramSvg(diagram, { standalone: true });
    const bounds = inline.match(/viewBox="([^"]+)"/)![1].split(' ').map(Number);
    expect(standalone).toContain(`viewBox="0 0 ${bounds[2]} ${bounds[3]}"`);
    expect(standalone).toContain(`width="${bounds[2]}" height="${bounds[3]}"`);
    expect(standalone).toContain(`class="diagram-viewport" transform="translate(${-bounds[0]} ${-bounds[1]})"`);
    expect(standalone).toContain(`id="component-${diagram.components[2].id}"`);
  });

  it('retains editable child types, responsibilities, technologies, external identity, directed descriptions and protocols', () => {
    const child = htmlPackageFixture().children.find(diagram => diagram.components.length)!;
    const before = structuredClone(child);
    const svg = renderDiagramSvg(child, { standalone: true });
    for (const text of ['Application', 'Datastore', 'Stores payment records', 'PostgreSQL', 'stores records', 'SQL']) expect(svg).toContain(text);
    for (const component of child.components) {
      expect(svg).toContain(`id="component-${component.id}"`);
      if (component.sourceComponentId) expect(svg).toContain(`data-source-component-id="${component.sourceComponentId}"`);
    }
    expect(svg.match(/class="relationship-arrow"/g)).toHaveLength(child.relationships.filter(item => item.direction === 'directed').length);
    expect(svg).toContain(`data-parent-diagram-id="${child.scope!.parentDiagramId}"`);
    expect(child).toEqual(before);
  });

  it('renders an empty child with a visible owner boundary and a positive view box', () => {
    const child = htmlPackageFixture().children.find(diagram => !diagram.components.length)!;
    const svg = renderDiagramSvg(child, { standalone: true });
    expect(svg).toContain('class="system-boundary"');
    expect(svg).toContain(child.scope!.softwareSystemName);
    const dimensions = svg.match(/viewBox="([^"]+)"/)![1].split(' ').map(Number);
    expect(dimensions[2]).toBeGreaterThan(0);
    expect(dimensions[3]).toBeGreaterThan(0);
    expect(svg).not.toContain('<image');
  });

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

  it('keeps every word in long and non-Latin component labels without an ellipsis', () => {
    const diagram = exportDiagramFixture();
    diagram.components[0].name = `${'Architecture service label '.repeat(6)}数据库`;
    const svg = renderDiagramSvg(diagram);
    const componentName = svg.match(/<text class="component-name"[^>]*>(.*?)<\/text>/s)?.[1] ?? '';

    expect(componentName).toContain('Architecture service label');
    expect(componentName.match(/<tspan\b/g)).toHaveLength(7);
    expect(componentName).toContain('数据库');
    expect(svg).not.toContain('…');
  });
});
