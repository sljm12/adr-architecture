import { describe, expect, it } from 'vitest';
import { buildHtmlPackage, exportMermaid, renderDiagramSvg, validatePackageReferences, type DiagramDocument } from '../src/index';
import { componentAdrFixtures, emptyComponentFixture, populatedComponentFixture, componentFixtureIds as ids } from './component-fixtures';

describe('selected Component exports', () => {
  it('preserves scope, responsibilities, technology, supporting subtype, protocol and exact local ADRs', () => {
    const diagram = populatedComponentFixture() as DiagramDocument;
    diagram.components[0].name = 'Handler <script> & "quoted"';
    const files = buildHtmlPackage({ diagram, adrs: componentAdrFixtures() });
    validatePackageReferences(files);
    const mermaid = exportMermaid(diagram), svg = renderDiagramSvg(diagram, { standalone: true });
    for (const output of [files['index.html'], svg, mermaid]) {
      expect(output).toContain('Component diagram');
      expect(output).toContain('Validates and records requests');
      expect(output).toContain('TypeScript');
      expect(output).toContain('Datastore');
      expect(output).toContain('SQL');
      expect(output).toContain('&lt;script&gt;');
    }
    expect(files['adrs.html']).toContain(`index.html#component-${ids.childPerson}`);
    expect(files['adrs.html']).toContain('Component diagram');
    expect(Object.keys(files).some(path => path.startsWith('diagrams/'))).toBe(false);
    expect(files['index.html']).not.toContain('Open component diagram');
    expect(mermaid).toContain(`subgraph container_${ids.application.replaceAll('-', '_')}`);
  });
  it('keeps the empty boundary in HTML/SVG and gives an explicit Mermaid remedy', () => {
    const diagram = emptyComponentFixture() as DiagramDocument;
    expect(renderDiagramSvg(diagram)).toContain('system-boundary');
    expect(buildHtmlPackage({ diagram, adrs: [] })['index.html']).toContain('system-boundary');
    expect(() => exportMermaid(diagram)).toThrow(/Component.*SVG\/HTML/i);
    try { exportMermaid(diagram); } catch (error) { expect(error).toMatchObject({ code: 'EMPTY_COMPONENT_MERMAID' }); }
  });
  it('rejects incomplete metadata, controls in owner scope, endpoints and local ADR references', () => {
    for (const mutate of [(d: DiagramDocument) => { d.components[0].technology = ''; }, (d: DiagramDocument) => { (d.scope as any).containerName = '\u0001'; }, (d: DiagramDocument) => { d.relationships[0].targetComponentId = crypto.randomUUID(); }]) {
      const diagram = populatedComponentFixture() as DiagramDocument; mutate(diagram);
      expect(() => buildHtmlPackage({ diagram, adrs: [] })).toThrow();
      expect(() => exportMermaid(diagram)).toThrow();
      expect(() => renderDiagramSvg(diagram)).toThrow();
    }
    const adrs = componentAdrFixtures(); adrs[0].componentIds = [ids.canonicalPerson];
    expect(() => buildHtmlPackage({ diagram: populatedComponentFixture() as DiagramDocument, adrs })).toThrow();
  });
});
