import { describe, expect, it, vi } from 'vitest';
import { assertDiagramInvariants, assembleHtmlPackageSnapshot, buildHtmlPackage, diagramDocumentSchema, exportMermaid, fitContainerLayout, renderAggregateHtmlPackage, renderDiagramSvg, validatePackageReferences } from '../src/index';
import { componentScaleFixture, sampledMedian } from './component-scale-fixture';
import { DiagramRepository } from '../../backend/src/persistence/diagram-repository';
import { AdrRepository } from '../../backend/src/persistence/adr-repository';
import { ComponentContextService } from '../../backend/src/services/component-context';
import { HtmlExportSourceService } from '../../backend/src/services/html-export-source';

describe('Component scale and three-level validation envelope', () => {
  it('preserves every artifact and compares warmed Component/Container operations', async () => {
    const fixture = componentScaleFixture(), before = structuredClone(fixture);
    expect(fixture.documents).toHaveLength(10);
    const timings: Record<string, unknown> = {};
    for (const d of [fixture.containers[0], fixture.components[0]]) {
      expect(d.components.filter(c => c.role !== 'external')).toHaveLength(100);
      expect(d.components.filter(c => c.role === 'external')).toHaveLength(100);
      expect(d.relationships).toHaveLength(300);
      const operations = {
        validation: () => { diagramDocumentSchema.parse(d); assertDiagramInvariants(d); },
        fit: () => fitContainerLayout(d.components.filter(c => c.role !== 'external'), d.components.filter(c => c.role === 'external')),
        mermaid: () => exportMermaid(d), svg: () => renderDiagramSvg(d),
        html: () => buildHtmlPackage({ diagram: d, adrs: fixture.adrs.filter(a => a.diagramId === d.id) }),
      };
      for (const [name, run] of Object.entries(operations)) timings[`${d.kind}.${name}`] = await sampledMedian(run);
      const mermaid = exportMermaid(d), svg = renderDiagramSvg(d), html = operations.html();
      for (const c of d.components) { expect(mermaid).toContain(`component_${c.id.replaceAll('-', '_')}`); expect(svg).toContain(`data-artifact-id="${c.id}"`); expect(html['index.html']).toContain(`id="component-${c.id}"`); }
      for (const r of d.relationships) { expect(mermaid).toContain(r.label!); expect(html['index.html']).toContain(`id="relationship-${r.id}"`); }
      validatePackageReferences(html);
    }
    expect(fixture).toEqual(before);
    console.info('Spec 010 warmed scale operations:', JSON.stringify(timings));
  }, 120_000);

  it('batch hydrates 100 two-hop sources and exports exactly 10 diagrams with linked/unlinked ADRs', async () => {
    const { context, documents, components, adrs: decisions } = componentScaleFixture();
    const diagrams = new DiagramRepository(), adrs = new AdrRepository();
    documents.forEach(d => diagrams.create(d)); decisions.forEach(a => adrs.registerAdr(a));
    const get = vi.spyOn(diagrams, 'get'), find = vi.spyOn(diagrams, 'findComponent');
    const hydrated = await new ComponentContextService(diagrams).hydrateAndValidateDocument(components[0], diagrams);
    expect(get.mock.calls.map(([id]) => id)).toEqual([components[0].scope!.parentDiagramId, context.id]);
    expect(find).not.toHaveBeenCalled();
    expect(hydrated.components.map(c => [c.id, c.sourceComponentId, c.position])).toEqual(components[0].components.map(c => [c.id, c.sourceComponentId, c.position]));
    const source = await new HtmlExportSourceService(diagrams, adrs).gather(context.id);
    expect(source.diagrams).toHaveLength(10);
    expect(source.diagrams.flatMap(d => d.adrs)).toHaveLength(20);
    const snapshot = assembleHtmlPackageSnapshot({ entryDiagramId: context.id, capturedAt: context.updatedAt, overrides: {} }, source);
    const timings = await sampledMedian(() => renderAggregateHtmlPackage(snapshot));
    const files = renderAggregateHtmlPackage(snapshot);
    validatePackageReferences(files);
    for (const member of source.diagrams) {
      const path = member.diagram.id === context.id ? 'index.html' : `diagrams/${member.diagram.id}/index.html`;
      for (const c of member.diagram.components) expect(files[path]).toContain(`id="component-${c.id}"`);
      for (const a of member.adrs) expect(files).toHaveProperty(`adrs/${a.id}.md`);
    }
    console.info('Spec 010 1/3/6 hierarchy package:', JSON.stringify({ ...timings, files: Object.keys(files).length, diagrams: 10, adrs: 20, hydrationAncestorReads: 2, sourceLookups: 0 }));
  }, 120_000);
});
