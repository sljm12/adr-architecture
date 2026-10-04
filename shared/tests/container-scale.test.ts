import { performance } from 'node:perf_hooks';
import { describe, expect, it, vi } from 'vitest';
import { assertDiagramInvariants, buildHtmlPackage, diagramDocumentSchema, exportMermaid, fitContainerLayout, isExternalOutsideBoundary, layoutDiagramForSvg, renderDiagramSvg } from '../src/index';
import { containerScaleFixture } from './container-scale-fixture';
import { DiagramRepository } from '../../backend/src/persistence/diagram-repository';
import { ContainerContextService } from '../../backend/src/services/container-context';

describe('container scale validation envelope (100 internal, 100 external, 300 relationships)', () => {
  it('validates, deterministically displaces externals and exports every artifact without mutating the source', () => {
    const { child, general } = containerScaleFixture();
    const before = structuredClone(child);
    const timings: Record<string, Record<string, number>> = {};
    for (const [kind, document] of [['container', child], ['general', general]] as const) {
      const measure = <T>(name: string, run: () => T): T => {
        const started = performance.now(), result = run();
        (timings[kind] ??= {})[name] = Number((performance.now() - started).toFixed(2));
        return result;
      };
      measure('validationMs', () => { diagramDocumentSchema.parse(document); assertDiagramInvariants(document); });
      const layout = measure('svgLayoutMs', () => layoutDiagramForSvg(document));
      const mermaid = measure('mermaidMs', () => exportMermaid(document));
      const svg = measure('svgMs', () => renderDiagramSvg(document));
      const files = measure('htmlMs', () => buildHtmlPackage({ diagram: document, adrs: [] }));
      expect(layout.componentRects.size).toBe(200);
      expect(layout.relationshipRoutes).toHaveLength(300);
      for (const component of document.components) {
        expect(mermaid).toContain(`component_${component.id.replaceAll('-', '_')}`);
        expect(svg).toContain(`data-artifact-id="${component.id}"`);
        expect(files['index.html']).toContain(`id="component-${component.id}"`);
      }
      for (const relationship of document.relationships) {
        expect(mermaid).toContain(relationship.label!);
        expect(svg).toContain(`data-artifact-id="${relationship.id}"`);
        expect(files['index.html']).toContain(`id="relationship-${relationship.id}"`);
      }
      for (const rect of layout.componentRects.values()) {
        expect(rect.x).toBeGreaterThanOrEqual(layout.viewBox.x);
        expect(rect.y).toBeGreaterThanOrEqual(layout.viewBox.y);
        expect(rect.x + rect.width).toBeLessThanOrEqual(layout.viewBox.x + layout.viewBox.width);
        expect(rect.y + rect.height).toBeLessThanOrEqual(layout.viewBox.y + layout.viewBox.height);
      }
    }
    const internal = child.components.filter(component => component.role === 'container');
    const external = child.components.filter(component => component.role === 'external');
    const started = performance.now();
    const displaced = fitContainerLayout(internal, external.map(component => ({ ...component, position: { x: 0, y: 0 } })));
    timings.container.domainLayoutMs = Number((performance.now() - started).toFixed(2));
    const reversed = fitContainerLayout(internal, [...external].reverse().map(component => ({ ...component, position: { x: 0, y: 0 } })));
    expect(displaced.boundary).toEqual(reversed.boundary);
    expect(displaced.externalComponents).toEqual([...reversed.externalComponents].reverse());
    for (const component of external) expect(isExternalOutsideBoundary(child.boundary!, component.position, component.size)).toBe(true);
    for (let index = 1; index < external.length; index++) expect(external[index].position.y).toBeGreaterThanOrEqual(external[index - 1].position.y + external[index - 1].size.height + 24);
    expect(child).toEqual(before);
    console.info('Spec 009 scale timing (single local sample, milliseconds):', JSON.stringify(timings));
  });

  it('resolves 100 current source projections from one parent read and lists from one snapshot', async () => {
    const { parent, child } = containerScaleFixture();
    const repository = new DiagramRepository();
    repository.create(parent); repository.create(child);
    const get = vi.spyOn(repository, 'get'), find = vi.spyOn(repository, 'findComponent'), list = vi.spyOn(repository, 'listAll');
    const service = new ContainerContextService(repository);
    const stale = structuredClone(child);
    stale.components = stale.components.map(component => component.role === 'external' ? { ...component, name: 'Stale cache', description: null } : component);
    const started = performance.now();
    const resolved = await service.hydrateAndValidateDocument(stale, repository);
    expect(get).toHaveBeenCalledTimes(1); expect(get).toHaveBeenCalledWith(parent.id);
    expect(find).not.toHaveBeenCalled();
    expect(resolved.components.filter(component => component.role === 'external').map(component => component.name)).toEqual(Array.from({ length: 100 }, (_, index) => `Participant ${index}`));
    expect(resolved.components.map(component => [component.id, component.position, component.sourceComponentId])).toEqual(child.components.map(component => [component.id, component.position, component.sourceComponentId]));
    const summaries = await service.summaries('active');
    expect(summaries).toHaveLength(2); expect(list).toHaveBeenCalledTimes(1); expect(get).toHaveBeenCalledTimes(1);
    console.info('Spec 009 scale source resolution:', JSON.stringify({ elapsedMs: Number((performance.now() - started).toFixed(2)), parentReads: get.mock.calls.length, sourceLookups: find.mock.calls.length, listSnapshots: list.mock.calls.length }));
  });
});
