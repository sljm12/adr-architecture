import { describe, expect, it } from 'vitest';
import type { DiagramDocument } from '../src/domain/types';
import { buildHtmlPackage } from '../src/export/html-package';
import { renderDiagramSvg } from '../src/export/svg-export';
import { layoutDiagramForSvg } from '../src/export/svg-layout';
import { renderDiagramStyles } from '../src/export/styles';
import { exportDiagramFixture } from './html-export-fixtures';
import { populatedComponentFixture, componentParentFixture } from './component-fixtures';

describe('export presentation', () => {
  it.each([componentParentFixture, populatedComponentFixture])('separates scoped fields and protocols into independently styled text', fixture => {
    const diagram = fixture() as DiagramDocument;
    const svg = renderDiagramSvg(diagram);
    const node = svg.match(/<g id="visual-component-[^"]+".*?<\/g>/s)![0];
    for (const name of ['component-type-label', 'component-name', 'component-description', 'component-technology']) {
      expect(node).toContain(`<text class="${name}"`);
    }
    const name = node.match(/<text class="component-name"[^>]*>(.*?)<\/text>/s)![1];
    expect(name).not.toMatch(/Technology:|Application|Component|Validates/);
    expect(svg).toContain('<text class="component-role-label"');
    expect(svg).toContain('<text class="relationship-protocol"');
    expect(svg).toContain(`diagram-level-${diagram.kind}`);
  });

  it('does not create empty optional blocks or add scoped fields to System Context', () => {
    const diagram = exportDiagramFixture();
    const svg = renderDiagramSvg(diagram);
    expect(svg).toContain('diagram-level-system-context');
    expect(svg).not.toContain('<text class="component-description"');
    diagram.components[2].type = null;
    expect(renderDiagramSvg(diagram)).toContain('>Unclassified</tspan>');
    const child = populatedComponentFixture() as DiagramDocument;
    const external = child.components.find(c => c.type === 'person')!;
    external.description = null; external.technology = null;
    const node = renderDiagramSvg(child).match(new RegExp(`<g id="visual-component-${external.id}".*?</g>`, 's'))![0];
    expect(node).not.toContain('class="component-description"');
    expect(node).not.toContain('class="component-technology"');
  });

  it.each([exportDiagramFixture, populatedComponentFixture])('fits long names without changing saved data', fixture => {
    const diagram = fixture() as DiagramDocument;
    diagram.components[0].name = 'Architecture service 数据库 WWW '.repeat(6);
    const before = structuredClone(diagram);
    const layout = layoutDiagramForSvg(diagram);
    const svg = renderDiagramSvg(diagram);
    const node = svg.match(/<g id="visual-component-[^"]+".*?<\/g>/s)![0];
    const rect = layout.componentRects.get(diagram.components[0].id)!;
    const baselines = [...node.matchAll(/<text[^>]* y="([^"]+)"[^>]*>(.*?)<\/text>/gs)].flatMap(match => {
      let y = Number(match[1]);
      return [...match[2].matchAll(/<tspan[^>]*dy="([^"]+)"/g)].map(span => y += Number(span[1]));
    });
    expect(Math.min(...baselines)).toBeGreaterThan(rect.y);
    expect(Math.max(...baselines)).toBeLessThan(rect.y + rect.height);
    expect(svg).toContain('数据库');
    expect(svg).not.toContain('…');
    expect(diagram).toEqual(before);
  });

  it('shares readable diagram CSS defaults and exposes package customization', () => {
    const files = buildHtmlPackage({ diagram: populatedComponentFixture() as DiagramDocument, adrs: [] });
    const css = files['styles.css'];
    for (const name of ['--component-outline', '--component-fill', '--component-name-size', '--component-description-size', '--export-font-mono']) expect(css).toContain(name);
    expect(css).toContain('User overrides');
    expect(css.split('\n').length).toBeGreaterThan(100);
    expect(css).toContain(renderDiagramStyles());
    expect(files['diagram.svg']).toContain(`<style>${renderDiagramStyles(true)}</style>`);
    expect(files['diagram.svg']).not.toContain('var(--');
    expect(files['index.html']).toContain('class="scope-metadata"');
    expect(files['index.html']).toContain('class="artifact-technology"');
  });

  it('keeps System Context nodes separate after typography expands their boxes', () => {
    const diagram = exportDiagramFixture();
    diagram.groups = [];
    diagram.components[0].size = { width: 140, height: 72 };
    diagram.components[0].name = 'Long architecture service name '.repeat(5);
    diagram.components[1].position = { x: diagram.components[0].position.x, y: diagram.components[0].position.y + 80 };
    const before = structuredClone(diagram);
    const layout = layoutDiagramForSvg(diagram);
    const first = layout.componentRects.get(diagram.components[0].id)!;
    const second = layout.componentRects.get(diagram.components[1].id)!;
    expect(second.y).toBeGreaterThanOrEqual(first.y + first.height + 24);
    expect(diagram).toEqual(before);
  });
});
