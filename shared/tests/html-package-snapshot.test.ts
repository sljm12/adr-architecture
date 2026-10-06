import { describe, expect, it } from 'vitest';
import { assembleHtmlPackageSnapshot, type HtmlExportSource } from '../src/export/html-package-snapshot';
import { exportTimestamp } from './html-export-fixtures';

import { aggregateInput } from './html-package-input';

describe('aggregate HTML snapshot', () => {
  it('overlays included retained documents and ADRs without retaining mutable input or including stale overrides', () => {
    const { fixture, source, capture } = aggregateInput();
    capture.overrides[fixture.parent.id].diagram.components[0].name = 'Captured owner';
    const child = fixture.children.find(d => d.components.length)!;
    capture.overrides[child.id] = { diagram: structuredClone(child), draft: { ...fixture.adrsByDiagram[child.id][0], title: 'Captured ADR' } };
    capture.overrides[fixture.trashedChild.id] = { diagram: fixture.trashedChild };
    const before = structuredClone({ source, capture });
    const result = assembleHtmlPackageSnapshot(capture, source);
    expect({ source, capture }).toEqual(before);
    capture.overrides[child.id].draft!.title = 'Later edit';
    expect(result.diagrams.find(d => d.diagram.id === child.id)?.adrs[0].title).toBe('Captured ADR');
    expect(result.diagrams.find(d => d.diagram.id === child.id)?.diagram.name).toBe('Captured owner');
    expect(result.diagrams.map(d => d.diagram.id)).toEqual(fixture.expected.diagramIds);
    expect(result.ownerChildren).toEqual(fixture.expected.ownerChildren);
  });
  it('resolves renamed/reclassified eligible sources from the captured parent with local geometry and identities', () => {
    const { fixture, source, capture } = aggregateInput();
    const child = fixture.children.find(d => d.components.length)!;
    const occurrence = child.components.find(c => c.role === 'external')!;
    const parentSource = capture.overrides[fixture.parent.id].diagram.components.find(c => c.id === occurrence.sourceComponentId)!;
    Object.assign(parentSource, { name: 'Captured source', description: 'Current responsibility' });
    const resolved = assembleHtmlPackageSnapshot(capture, source).diagrams.find(d => d.diagram.id === child.id)!.diagram.components.find(c => c.id === occurrence.id)!;
    expect(resolved).toMatchObject({ id: occurrence.id, name: 'Captured source', description: 'Current responsibility', type: 'software-system', position: occurrence.position });
  });
  it('validates saved links against saved data and repaired draft links against deleted draft artifacts', () => {
    const { fixture, source, capture } = aggregateInput();
    const parent = capture.overrides[fixture.parent.id].diagram;
    // The rejected ADR is unlinked; give it a saved link to a deletable person.
    const person = parent.components.find(c => c.type === 'person')!;
    const saved = source.diagrams[0].adrs.find(a => a.status === 'rejected')!;
    saved.componentIds = [person.id];
    parent.components = parent.components.filter(c => c.id !== person.id);
    parent.relationships = parent.relationships.filter(r => r.sourceComponentId !== person.id && r.targetComponentId !== person.id);
    capture.overrides[parent.id].draft = { ...saved, componentIds: [] };
    expect(assembleHtmlPackageSnapshot(capture, source).diagrams[0].adrs.find(a => a.id === saved.id)?.componentIds).toEqual([]);
    capture.overrides[parent.id].draft = null;
    expect(() => assembleHtmlPackageSnapshot(capture, source)).toThrow(/componentIds/);
  });
  it('creates one package-local ID for a new ADR without modifying the draft', () => {
    const { source, capture } = aggregateInput();
    const { id: _id, ...draft } = source.diagrams[0].adrs[0];
    capture.overrides[capture.entryDiagramId].draft = draft;
    const result = assembleHtmlPackageSnapshot(capture, source);
    expect(result.diagrams[0].adrs).toHaveLength(5);
    expect(result.diagrams[0].adrs[4].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(capture.overrides[capture.entryDiagramId].draft).not.toHaveProperty('id');
  });
  it('allows eligible source reclassification in the captured parent without changing the local occurrence', () => {
    const { fixture, source, capture } = aggregateInput();
    const child = fixture.children.find(d => d.components.length)!;
    const parent = capture.overrides[fixture.parent.id].diagram;
    const person = parent.components.find(c => c.type === 'person')!;
    person.type = 'software-system'; person.name = 'Captured service';
    const draftChild = structuredClone(child);
    draftChild.components.find(c => c.role === 'external')!.sourceComponentId = person.id;
    capture.overrides[child.id] = { diagram: draftChild };
    const snapshot = assembleHtmlPackageSnapshot(capture, source);
    expect(snapshot.diagrams.find(d => d.diagram.id === child.id)!.diagram.components.find(c => c.role === 'external')).toMatchObject({ id: draftChild.components.find(c => c.role === 'external')!.id, name: 'Captured service', type: 'software-system', sourceComponentId: person.id });
    expect(snapshot.availability.find(a => a.softwareSystemId === person.id)?.availability).toBe('none');
  });
  it('rejects a broken saved link even when the captured draft would remove it', () => {
    const { source, capture } = aggregateInput();
    source.diagrams[0].adrs[0].componentIds = [crypto.randomUUID()];
    capture.overrides[capture.entryDiagramId].draft = { ...source.diagrams[0].adrs[0], componentIds: [] };
    expect(() => assembleHtmlPackageSnapshot(capture, source)).toThrow(/componentIds/);
  });
  it('does not let a retained override alter parent identity or borrow a foreign ADR draft', () => {
    const { source, capture } = aggregateInput();
    capture.overrides[capture.entryDiagramId].diagram.id = crypto.randomUUID();
    expect(() => assembleHtmlPackageSnapshot(capture, source)).toThrow(/identity/);
    capture.overrides[capture.entryDiagramId].diagram.id = capture.entryDiagramId;
    capture.overrides[capture.entryDiagramId].draft = { ...source.diagrams[0].adrs[0], diagramId: source.diagrams[1].diagram.id };
    expect(() => assembleHtmlPackageSnapshot(capture, source)).toThrow(/diagramId/);
  });
  it.each(['owner removal', 'owner type', 'source removal', 'kind', 'owner identity', 'missing child', 'duplicate diagram', 'duplicate component', 'duplicate relationship', 'duplicate ADR', 'foreign endpoint', 'foreign ADR link', 'foreign replacement', 'inactive child', 'missing availability'])(
    'rejects %s with diagram identity and an actionable scoped error', failure => {
      const { fixture, source, capture } = aggregateInput();
      const child = source.diagrams.find(d => d.diagram.components.some(c => c.role === 'external'))!;
      const parent = capture.overrides[capture.entryDiagramId].diagram;
      if (failure === 'owner removal') parent.components = parent.components.filter(c => c.id !== child.diagram.scope!.softwareSystemId);
      if (failure === 'owner type') parent.components.find(c => c.id === child.diagram.scope!.softwareSystemId)!.type = 'person';
      if (failure === 'source removal') parent.components = parent.components.filter(c => c.id !== child.diagram.components.find(c => c.role === 'external')!.sourceComponentId);
      if (failure === 'kind') capture.overrides[parent.id].diagram.kind = 'container';
      if (failure === 'owner identity') { capture.overrides[child.diagram.id] = { diagram: structuredClone(child.diagram) }; capture.overrides[child.diagram.id].diagram.scope!.softwareSystemId = crypto.randomUUID(); }
      if (failure === 'missing child') source.diagrams = source.diagrams.filter(d => d !== child);
      if (failure === 'duplicate diagram') source.diagrams.push(structuredClone(child));
      if (failure === 'duplicate component') {
        const old = child.diagram.components[0].id, id = parent.components[0].id;
        child.diagram.components[0].id = id;
        for (const relationship of child.diagram.relationships) { if (relationship.sourceComponentId === old) relationship.sourceComponentId = id; if (relationship.targetComponentId === old) relationship.targetComponentId = id; }
        for (const adr of child.adrs) adr.componentIds = adr.componentIds.map(value => value === old ? id : value);
      }
      if (failure === 'duplicate relationship') {
        const old = child.diagram.relationships[0].id, id = parent.relationships[0].id;
        child.diagram.relationships[0].id = id;
        for (const adr of child.adrs) adr.relationshipIds = adr.relationshipIds.map(value => value === old ? id : value);
      }
      if (failure === 'duplicate ADR') { const old = child.adrs[0].id; child.adrs[0].id = source.diagrams[0].adrs[0].id; for (const adr of child.adrs) if (adr.replacementAdrId === old) adr.replacementAdrId = child.adrs[0].id; }
      if (failure === 'foreign endpoint') child.diagram.relationships[0].targetComponentId = fixture.parent.components[0].id;
      if (failure === 'foreign ADR link') child.adrs[0].componentIds = [fixture.parent.components[0].id];
      if (failure === 'foreign replacement') child.adrs.find(a => a.status === 'superseded')!.replacementAdrId = source.diagrams[0].adrs[0].id;
      if (failure === 'inactive child') child.diagram.status = 'trashed';
      if (failure === 'missing availability') source.availability = [];
      try { assembleHtmlPackageSnapshot(capture, source); expect.fail('must reject'); }
      catch (error) { expect(error).toMatchObject({ diagramId: expect.any(String), artifactKind: expect.any(String), field: expect.any(String), remedy: expect.any(String) }); expect((error as Error).message).toMatch(/retry|try|correct|repair/i); }
    });
  it('exports a direct child using consistent source context and no parent membership', () => {
    const { fixture } = aggregateInput();
    const child = fixture.children.find(d => d.components.length)!;
    const source: HtmlExportSource = { entryDiagramId: child.id, sourceCapturedAt: exportTimestamp, diagrams: [{ diagram: child, adrs: fixture.adrsByDiagram[child.id] }], availability: [],
      containerContext: { scope: { ...child.scope!, softwareSystemName: 'Fresh owner' }, capturedAt: exportTimestamp,
        sources: fixture.parent.components.filter(c => c.id !== child.scope!.softwareSystemId && (c.type === 'person' || c.type === 'software-system')).map(c => ({ id: c.id, name: c.name, description: c.description, type: c.type as 'person' | 'software-system' })) } };
    const draft = structuredClone(child);
    const person = fixture.parent.components.find(c => c.type === 'person')!;
    draft.components.push({ ...draft.components.find(c => c.role === 'external')!, id: crypto.randomUUID(), sourceComponentId: person.id, name: 'Cached name', position: { x: 1000, y: 100 } });
    const capture = { entryDiagramId: child.id, capturedAt: exportTimestamp, overrides: { [child.id]: { diagram: draft } } };
    const result = assembleHtmlPackageSnapshot(capture, source);
    expect(result).toMatchObject({ ownerChildren: {}, diagrams: [{ diagram: { name: 'Fresh owner' } }] });
    expect(result.diagrams[0].diagram.components.at(-1)).toMatchObject({ name: person.name, type: 'person', sourceComponentId: person.id, id: draft.components.at(-1)!.id });
    source.containerContext!.scope.softwareSystemId = crypto.randomUUID();
    expect(() => assembleHtmlPackageSnapshot(capture, source)).toThrow(/scope/);
  });
});
