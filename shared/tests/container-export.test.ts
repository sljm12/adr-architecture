import { describe, expect, it } from 'vitest';
import { buildHtmlPackage, exportMermaid, renderDiagramSvg, validateHtmlExportSnapshot, fitContainerLayout, type DiagramDocument } from '../src/index';
import { emptyChildFixture, generalParentFixture, populatedChildFixture, containerFixtureIds as ids } from './container-fixtures';
import { layoutDiagramForSvg } from '../src/export/svg-layout';

describe('complete container exports', () => {
  it.each(['application', 'datastore'] as const)('exports %s, scope, full metadata, protocol, source identity and local anchors', subtype => {
    const child = populatedChildFixture() as unknown as DiagramDocument;
    child.name = 'Runtime <review>'; child.components[0].containerType = subtype;
    child.components[0].description = 'Processes "payments" & accounts\nUnicode 日本語';
    const mermaid = exportMermaid(child), svg = renderDiagramSvg(child, { standalone: true }), files = buildHtmlPackage({ diagram: child, adrs: [] });
    expect(mermaid).toContain(subtype === 'application' ? 'Application' : 'Datastore');
    expect(mermaid).toContain('TypeScript'); expect(mermaid).toContain('HTTPS'); expect(mermaid).toContain(ids.sourceSystem);
    expect(mermaid.indexOf(`component_${ids.externalOccurrence.replaceAll('-', '_')}`)).toBeGreaterThan(mermaid.indexOf('  end'));
    for (const output of [svg, files['index.html']]) {
      expect(output).toContain(subtype === 'application' ? 'Application' : 'Datastore'); expect(output).toContain('TypeScript'); expect(output).toContain('HTTPS'); expect(output).toContain('日本語'); expect(output).toContain('system-boundary'); expect(output).toContain('Runtime &lt;review&gt;');
    }
    expect(validateHtmlExportSnapshot({ diagram: child, adrs: [] }).diagram).toEqual(child);
    expect(files['index.html']).toContain(ids.sourceSystem);
  });
  it('exports empty boundaries in SVG and HTML and gives an actionable Mermaid alternative', () => {
    const child = emptyChildFixture() as unknown as DiagramDocument;
    expect(renderDiagramSvg(child)).toContain('system-boundary'); expect(buildHtmlPackage({ diagram: child, adrs: [] })['index.html']).toContain('system-boundary');
    try { exportMermaid(child); expect.fail('empty Mermaid must fail'); } catch (error) { expect(error).toMatchObject({ code: 'EMPTY_CONTAINER_MERMAID', message: expect.stringMatching(/SVG\/HTML/) }); }
  });
  it('rejects missing subtype, controls and broken endpoints without creating an incomplete artifact', () => {
    for (const mutate of [(d: DiagramDocument) => { delete d.components[0].containerType; }, (d: DiagramDocument) => { d.components[0].containerType = 'unsupported' as any; }, (d: DiagramDocument) => { d.components[0].role = 'unsupported' as any; }, (d: DiagramDocument) => { d.components[0].technology = '\u0001'; }, (d: DiagramDocument) => { d.scope!.softwareSystemName = '\u0001'; }, (d: DiagramDocument) => { d.components[1].description = '\u0001'; }, (d: DiagramDocument) => { d.relationships[0].protocol = '\u0001'; }, (d: DiagramDocument) => { d.relationships[0].targetComponentId = crypto.randomUUID(); }, (d: DiagramDocument) => { d.components[1].sourceComponentId = ids.owner; }]) {
      const child = populatedChildFixture() as unknown as DiagramDocument; mutate(child);
      expect(() => buildHtmlPackage({ diagram: child, adrs: [] })).toThrow(); expect(() => exportMermaid(child)).toThrow(); expect(() => renderDiagramSvg(child)).toThrow();
    }
    const missing = populatedChildFixture() as unknown as DiagramDocument; delete missing.components[0].containerType;
    expect(() => exportMermaid(missing)).toThrow(new RegExp(`${ids.container}.*containerType.*Application.*Datastore`));
    expect(() => renderDiagramSvg(missing)).toThrow(new RegExp(`${ids.container}.*containerType.*Application.*Datastore`));
  });
  it('declares parent exports to be single-diagram snapshots', () => {
    const parent = generalParentFixture() as unknown as DiagramDocument;
    expect(exportMermaid(parent)).toMatch(/single.diagram/i); expect(buildHtmlPackage({ diagram: parent, adrs: [] })['index.html']).toMatch(/not bundled/i);
  });
  it('covers long labels and all boundary/node/relationship extents without editing the domain snapshot', () => {
    const child = populatedChildFixture() as unknown as DiagramDocument;
    child.scope!.softwareSystemName = 'Wide owner 日本語 WWW '.repeat(8);
    child.components[0].description = 'Long responsibilities: 日本語 & "quoted" <text> '.repeat(25);
    child.relationships[0].label = 'Sends a full interaction description '.repeat(10);
    const second = { ...child.components[0], id: crypto.randomUUID(), position: { x: 100, y: 340 } }; child.components.push(second);
    child.boundary = fitContainerLayout(child.components.filter(c => c.role === 'container'), child.components.filter(c => c.role === 'external')).boundary;
    const before = structuredClone(child), layout = layoutDiagramForSvg(child), svg = renderDiagramSvg(child);
    expect(layout.boundaryRect).toBeDefined();
    expect(svg).toContain('Wide owner'); expect(svg).toContain('日本語');
    for (const rect of [...layout.componentRects.values(), layout.boundaryRect!]) { expect(rect.x).toBeGreaterThanOrEqual(layout.viewBox.x); expect(rect.y).toBeGreaterThanOrEqual(layout.viewBox.y); expect(rect.x + rect.width).toBeLessThanOrEqual(layout.viewBox.x + layout.viewBox.width); expect(rect.y + rect.height).toBeLessThanOrEqual(layout.viewBox.y + layout.viewBox.height); }
    expect(svg).toContain('&lt;text&gt;'); expect(svg).toContain('&quot;quoted&quot;'); expect(child).toEqual(before);
    const firstRect = layout.componentRects.get(ids.container)!, secondRect = layout.componentRects.get(second.id)!;
    expect(secondRect.y).toBeGreaterThanOrEqual(firstRect.y + firstRect.height + 24);
  });
  it('preserves offline decision links to local containers, external occurrences and relationships', () => {
    const diagram = populatedChildFixture() as unknown as DiagramDocument, id = crypto.randomUUID();
    const adr = { id, diagramId: diagram.id, title: 'Container boundary choice', context: 'Reason', decision: 'Use API', consequences: 'Effects', alternativesOrConstraints: null, status: 'accepted' as const, replacementAdrId: null, componentIds: [ids.container, ids.externalOccurrence], relationshipIds: [ids.childRelationship], createdAt: diagram.createdAt, updatedAt: diagram.updatedAt };
    const files = buildHtmlPackage({ diagram, adrs: [adr] });
    expect(files['index.html']).toContain(`adrs.html#adr-${id}`); expect(files['adrs.html']).toContain(`index.html#component-${ids.externalOccurrence}`); expect(files['adrs.html']).toContain(`index.html#relationship-${ids.childRelationship}`); expect(files[`adrs/${id}.md`]).toContain(ids.container);
  });
});
