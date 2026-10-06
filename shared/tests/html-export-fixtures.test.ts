import { describe, expect, it } from 'vitest';
import { assertDiagramInvariants } from '../src/domain/invariants';
import { validateHtmlExportSnapshot } from '../src/export/html-snapshot';
import { htmlPackageFixture, htmlPackageFixtureIds as ids } from './html-export-fixtures';

describe('parent and container export fixtures', () => {
  it('provides deterministic detached documents with valid geometry and local ADR references', () => {
    const fixture = htmlPackageFixture();
    expect(fixture).toEqual(htmlPackageFixture());
    const documents = [fixture.parent, ...fixture.children, fixture.trashedChild, fixture.unrelatedParent, fixture.unrelatedChild];
    for (const diagram of documents) {
      expect(() => assertDiagramInvariants(diagram)).not.toThrow();
      if (diagram.status === 'active') {
        expect(() => validateHtmlExportSnapshot({ diagram, adrs: fixture.adrsByDiagram[diagram.id] ?? [] })).not.toThrow();
      }
    }
    fixture.children.find(child => child.id === ids.populatedChild)!.components[0].name = 'Later edit';
    expect(htmlPackageFixture().children.find(child => child.id === ids.populatedChild)!.components[0].name).toBe('Payments');
  });

  it('distinguishes active, empty, absent, trashed and unrelated child membership by UUID', () => {
    const fixture = htmlPackageFixture();
    expect(fixture.expected.diagramIds).toEqual([ids.parentDiagram, ...[ids.populatedChild, ids.emptyChild].sort()]);
    expect(fixture.children.find(child => child.id === ids.emptyChild)?.components).toEqual([]);
    expect(fixture.availability.map(item => [item.softwareSystemId, item.availability])).toEqual([
      [ids.owner, 'active'], [ids.duplicateOwner, 'active'], [ids.sourceSystem, 'none'], [ids.trashedOwner, 'trashed'],
    ]);
    expect(fixture.expected.excludedDiagramIds).toEqual([ids.trashedChild, ids.unrelatedParent, ids.unrelatedChild]);
    expect(fixture.expected.filePaths).toHaveLength(16);
  });

  it('exposes exact local ADR and sibling/parent link sets despite repeated names', () => {
    const fixture = htmlPackageFixture();
    const decisions = Object.values(fixture.adrsByDiagram).flat();
    expect(new Set(decisions.map(adr => adr.id)).size).toBe(8);
    expect(new Set(decisions.map(adr => adr.status))).toEqual(new Set(['draft', 'accepted', 'superseded', 'rejected']));
    expect(new Set(decisions.map(adr => adr.title)).size).toBe(1);
    expect(fixture.expected.directAdrIds[ids.externalOccurrence]).toEqual([ids.childDraftAdr]);
    expect(fixture.expected.directAdrIds[ids.datastore]).toEqual([]);
    expect(fixture.expected.directAdrIds[ids.childRelationship]).toEqual([ids.childSupersededAdr]);
    expect(fixture.expected.siblingLinks).toEqual([{ fromDiagramId: ids.populatedChild, componentId: ids.externalOccurrence, toDiagramId: ids.emptyChild }]);
    for (const adr of decisions.filter(adr => adr.replacementAdrId)) {
      expect(decisions.find(other => other.id === adr.replacementAdrId)).toMatchObject({ diagramId: adr.diagramId, status: 'accepted' });
    }
  });
});
