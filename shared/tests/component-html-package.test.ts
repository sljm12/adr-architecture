import { describe, expect, it } from 'vitest';
import { assembleHtmlPackageSnapshot, renderAggregateHtmlPackage, validatePackageReferences } from '../src/index';
import { componentPackageInput } from './component-package-input';
import { componentFixtureIds as ids } from './component-fixtures';

describe('three-level Component packages', () => {
  it.each(['general', 'container', 'component'] as const)('exports exactly the %s entry subtree with flat paths and included-only returns', level => {
    const { source, capture, parent, child, sibling } = componentPackageInput(level);
    const snapshot = assembleHtmlPackageSnapshot(capture, source), files = renderAggregateHtmlPackage(snapshot);
    validatePackageReferences(files);
    expect(snapshot.diagrams).toHaveLength(level === 'general' ? 4 : level === 'container' ? 3 : 1);
    const childPage = level === 'component' ? 'index.html' : `diagrams/${child.id}/index.html`;
    expect(files[childPage]).toContain('Component diagram');
    expect(files[childPage]).not.toContain('Create component');
    expect(files[childPage]).toContain(level === 'general' ? `../${parent.id}/index.html#component-${ids.application}` : level === 'container' ? `../../index.html#component-${ids.application}` : 'Single-diagram snapshot.');
    if (level !== 'component') expect(files[childPage]).toContain(`../${sibling.id}/index.html`);
    else expect(files['index.html']).not.toContain('Open component diagram</a>');
    expect(files['adrs.html']).toContain(`component-${ids.childPerson}`);
  });
  it('hydrates captured ancestor drafts before children regardless of transport UUID ordering and leaves inputs intact', () => {
    const { source, capture, root, parent, child } = componentPackageInput();
    root.components.find(c => c.id === ids.system)!.name = 'Draft system';
    parent.components.find(c => c.id === ids.application)!.name = 'Draft container';
    capture.overrides[root.id] = { diagram: root }; capture.overrides[parent.id] = { diagram: parent };
    source.diagrams = [source.diagrams[0], ...source.diagrams.slice(1).reverse()];
    const before = structuredClone({ source, capture });
    const result = assembleHtmlPackageSnapshot(capture, source);
    expect(result.diagrams.find(d => d.diagram.id === child.id)?.diagram).toMatchObject({ name: 'Draft container', scope: { parentDiagramName: 'Draft system', softwareSystemName: 'Draft system' } });
    expect({ source, capture }).toEqual(before);
  });
  it('routes a supporting Software System through its immediate Container occurrence to an included canonical child', () => {
    const { source, capture, root, parent, child } = componentPackageInput();
    const owner = root.components.find(c => c.id === ids.canonicalSystem)!;
    const systemChild = { ...structuredClone(parent), id: 'b0000000-0000-4000-8000-000000000001', name: owner.name, scope: { parentDiagramId: root.id, parentDiagramName: root.name, softwareSystemId: owner.id, softwareSystemName: owner.name, softwareSystemDescription: owner.description }, components: [], relationships: [], groups: [] };
    source.diagrams.push({ diagram: systemChild, adrs: [] });
    const availability = source.availability.find(a => 'softwareSystemId' in a && a.softwareSystemId === owner.id)!;
    availability.availability = 'active'; availability.diagram = systemChild;
    source.sourceContexts[systemChild.id] = { scope: systemChild.scope, capturedAt: capture.capturedAt, sources: root.components.filter(c => c.id !== owner.id && (c.type === 'person' || c.type === 'software-system')).map(c => ({ id: c.id, name: c.name, description: c.description, type: c.type as 'person' | 'software-system' })) };
    const files = renderAggregateHtmlPackage(assembleHtmlPackageSnapshot(capture, source));
    expect(files[`diagrams/${child.id}/index.html`]).toContain(`href="../${systemChild.id}/index.html">Open container diagram`);
    validatePackageReferences(files);
  });
  it('reconciles a captured Context source rename through both occurrence hops without changing local ADR targets', () => {
    const { source, capture, root, child } = componentPackageInput();
    const draft = structuredClone(root); draft.components.find(c => c.id === ids.canonicalPerson)!.name = 'Captured customer';
    capture.overrides[root.id] = { diagram: draft };
    const before = structuredClone({ source, capture }), result = assembleHtmlPackageSnapshot(capture, source);
    const exported = result.diagrams.find(d => d.diagram.id === child.id)!;
    expect(exported.diagram.components.find(c => c.id === ids.childPerson)).toMatchObject({ name: 'Captured customer', sourceComponentId: ids.personOccurrence });
    expect(exported.adrs[0].componentIds).toContain(ids.childPerson);
    expect({ source, capture }).toEqual(before);
  });
  it.each(['missing', 'scope', 'source', 'availability', 'identity'] as const)('rejects %s without a partial package', invalid => {
    const { source, capture, parent, child } = componentPackageInput();
    if (invalid === 'missing') source.diagrams = source.diagrams.filter(d => d.diagram.id !== child.id);
    if (invalid === 'scope') (child.scope as any).containerId = ids.datastore;
    if (invalid === 'source') { const draft = structuredClone(parent); draft.components = draft.components.filter(c => c.id !== ids.personOccurrence); capture.overrides[parent.id] = { diagram: draft }; }
    if (invalid === 'availability') source.availability.pop();
    if (invalid === 'identity') { const draft = structuredClone(child); draft.components[1].sourceComponentId = ids.application; capture.overrides[child.id] = { diagram: draft }; }
    expect(() => renderAggregateHtmlPackage(assembleHtmlPackageSnapshot(capture, source))).toThrow();
  });
});
