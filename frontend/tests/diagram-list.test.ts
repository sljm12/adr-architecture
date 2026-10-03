import { describe, expect, it } from 'vitest';
import { deriveDiagramList, deriveDiagramGroups, defaultDiagramListSort, type DiagramListSort } from '../src/state/diagram-list';
import { type DiagramSummary } from '../../shared/src/index';
import {
  activeDiagramListFixtures,
  dateRangeBoundaryFixtures,
  diagramListFixtures,
} from './diagram-list-fixtures';

const sortingFixtures = [
  { id: '00000000-0000-4000-8000-000000000409', name: 'zeta', status: 'active' as const, createdAt: '2026-01-12T00:00:00.000Z', updatedAt: '2026-01-12T00:00:00.000Z' },
  { id: '00000000-0000-4000-8000-000000000407', name: 'alpha', status: 'active' as const, createdAt: '2026-01-10T00:00:00.000Z', updatedAt: '2026-01-10T00:00:00.000Z' },
  { id: '00000000-0000-4000-8000-000000000408', name: 'Beta', status: 'active' as const, createdAt: '2026-01-11T00:00:00.000Z', updatedAt: '2026-01-11T00:00:00.000Z' },
  { id: '00000000-0000-4000-8000-000000000406', name: ' Alpha ', status: 'active' as const, createdAt: '2026-01-10T00:00:00.000Z', updatedAt: '2026-01-10T00:00:00.000Z' },
];

const sort = (field: DiagramListSort['field'], direction: DiagramListSort['direction']): DiagramListSort => ({ field, direction });

describe('diagram list derivation', () => {
  it('matches trimmed, case-insensitive name substrings', () => {
    expect(deriveDiagramList(activeDiagramListFixtures, { nameQuery: '  PAYments api  ' }).items.map(item => item.id))
      .toEqual(['00000000-0000-4000-8000-000000000402']);
  });

  it('accepts either inclusive date boundary', () => {
    expect(deriveDiagramList(diagramListFixtures, { createdFrom: '2026-01-10' }).items.map(item => item.id))
      .toEqual([
        '00000000-0000-4000-8000-000000000403',
        '00000000-0000-4000-8000-000000000402',
        '00000000-0000-4000-8000-000000000401',
        '00000000-0000-4000-8000-000000000404',
      ]);
    expect(deriveDiagramList(diagramListFixtures, { createdTo: '2026-01-12' }).items.map(item => item.id))
      .toEqual([
        '00000000-0000-4000-8000-000000000402',
        '00000000-0000-4000-8000-000000000401',
        '00000000-0000-4000-8000-000000000404',
        '00000000-0000-4000-8000-000000000405',
      ]);
  });

  it('combines name and date filters with AND semantics', () => {
    const result = deriveDiagramList(activeDiagramListFixtures, {
      nameQuery: 'payments',
      createdFrom: '2026-01-10',
      createdTo: '2026-01-10',
    });
    expect(result.rangeError).toBeNull();
    expect(result.items.map(item => item.id)).toEqual([
      '00000000-0000-4000-8000-000000000401',
      '00000000-0000-4000-8000-000000000404',
    ]);
  });

  it('reports invalid ranges without returning misleading results', () => {
    expect(deriveDiagramList(activeDiagramListFixtures, { createdFrom: '2026-01-13', createdTo: '2026-01-10' }))
      .toEqual({ items: [], rangeError: 'End date must be on or after the start date.' });
    expect(deriveDiagramList(activeDiagramListFixtures, { createdFrom: 'not-a-date' }).rangeError)
      .toBe('Start date must be a valid calendar date.');
  });

  it('treats empty queries and collections as valid empty filters', () => {
    expect(deriveDiagramList(activeDiagramListFixtures, { nameQuery: '   ' }).items).toHaveLength(activeDiagramListFixtures.length);
    expect(deriveDiagramList([]).items).toEqual([]);
    expect(deriveDiagramList(activeDiagramListFixtures, { nameQuery: 'missing' }).items).toEqual([]);
  });

  it('retains creation-date data while deriving the default newest-first view', () => {
    const result = deriveDiagramList(dateRangeBoundaryFixtures, {}, defaultDiagramListSort);
    expect(result.items.map(item => [item.id, item.createdAt])).toEqual([
      ['00000000-0000-4000-8000-000000000402', '2026-01-12T23:59:59.000Z'],
      ['00000000-0000-4000-8000-000000000401', '2026-01-10T00:00:00.000Z'],
      ['00000000-0000-4000-8000-000000000404', '2026-01-10T00:00:00.000Z'],
    ]);
  });

  it('sorts names case-insensitively in both directions with deterministic UUID ties', () => {
    expect(deriveDiagramList(sortingFixtures, {}, sort('name', 'ascending')).items.map(item => item.id)).toEqual([
      '00000000-0000-4000-8000-000000000406',
      '00000000-0000-4000-8000-000000000407',
      '00000000-0000-4000-8000-000000000408',
      '00000000-0000-4000-8000-000000000409',
    ]);
    expect(deriveDiagramList(sortingFixtures, {}, sort('name', 'descending')).items.map(item => item.id)).toEqual([
      '00000000-0000-4000-8000-000000000409',
      '00000000-0000-4000-8000-000000000408',
      '00000000-0000-4000-8000-000000000406',
      '00000000-0000-4000-8000-000000000407',
    ]);
  });

  it('sorts creation dates in both directions and resolves equal dates by name then UUID', () => {
    expect(deriveDiagramList(sortingFixtures, {}, sort('createdAt', 'ascending')).items.map(item => item.id)).toEqual([
      '00000000-0000-4000-8000-000000000406',
      '00000000-0000-4000-8000-000000000407',
      '00000000-0000-4000-8000-000000000408',
      '00000000-0000-4000-8000-000000000409',
    ]);
    expect(deriveDiagramList(sortingFixtures, {}, sort('createdAt', 'descending')).items.map(item => item.id)).toEqual([
      '00000000-0000-4000-8000-000000000409',
      '00000000-0000-4000-8000-000000000408',
      '00000000-0000-4000-8000-000000000406',
      '00000000-0000-4000-8000-000000000407',
    ]);
  });

  it('sorts the filtered collection without changing which summaries match', () => {
    const result = deriveDiagramList(sortingFixtures, { nameQuery: 'a', createdFrom: '2026-01-10', createdTo: '2026-01-11' }, sort('name', 'descending'));
    expect(result.items.map(item => item.id)).toEqual([
      '00000000-0000-4000-8000-000000000408',
      '00000000-0000-4000-8000-000000000406',
      '00000000-0000-4000-8000-000000000407',
    ]);
  });
});

describe('container library grouping', () => {
  const parent: DiagramSummary = { ...sortingFixtures[1], name: 'Overview', kind: 'general', scope: null };
  const otherParent = { ...parent, id: sortingFixtures[3].id };
  const child: DiagramSummary = { ...sortingFixtures[2], name: 'Runtime', kind: 'container', scope: { parentDiagramId: parent.id, softwareSystemId: '00000000-0000-4000-8000-000000000501', parentDiagramName: parent.name, softwareSystemName: 'Payments', softwareSystemDescription: null } };
  const sibling = { ...child, id: sortingFixtures[0].id, name: 'Sibling', createdAt: '2026-01-12T00:00:00.000Z' };
  const otherChild = { ...child, id: '00000000-0000-4000-8000-000000000410', scope: { ...child.scope!, parentDiagramId: otherParent.id } };
  const all = [sibling, otherChild, otherParent, child, parent];

  it('keys duplicate parent, owner and child names by UUID and does not mutate input', () => {
    const before = structuredClone(all);
    const view = deriveDiagramGroups(all, {}, sort('name', 'ascending'));
    expect(view.items).toHaveLength(5); expect(view.groups.map(g => g.parentId)).toEqual([otherParent.id, parent.id]);
    expect(view.groups.map(g => g.children.map(c => c.id))).toEqual([[otherChild.id], [child.id, sibling.id]]);
    expect(all).toEqual(before);
  });
  it('counts child-only own-name/date matches without counting contextual parent headings or siblings', () => {
    const view = deriveDiagramGroups(all, { nameQuery: 'runtime', createdFrom: '2026-01-11', createdTo: '2026-01-11' });
    expect(view.items).toHaveLength(2); expect(view.groups).toHaveLength(2);
    expect(view.groups.every(g => !g.parentMatches && g.parent && g.children.length === 1)).toBe(true);
    const parents = deriveDiagramGroups(all, { nameQuery: 'overview' });
    expect(parents.items).toHaveLength(2); expect(parents.groups.every(g => g.parentMatches && g.children.length === 0)).toBe(true);
  });
  it('uses source scope for unavailable parent context and never promotes children to parent rows', () => {
    const view = deriveDiagramGroups([child, sibling]);
    expect(view.groups).toHaveLength(1); expect(view.groups[0]).toMatchObject({ parentId: parent.id, parent: null, parentName: 'Overview', parentMatches: false });
    expect(view.groups[0].children.map(c => c.id)).toEqual([sibling.id, child.id]);
  });
  it('uses parent comparators for groups and deterministic sibling UUID ties for either direction', () => {
    const twin = { ...child, id: '00000000-0000-4000-8000-000000000411' };
    for (const direction of ['ascending', 'descending'] as const) expect(deriveDiagramGroups([twin, child, parent], {}, sort('name', direction)).groups[0].children.map(c => c.id)).toEqual([child.id, twin.id]);
    expect(deriveDiagramGroups(all, { createdFrom: '2026-02-31' })).toMatchObject({ items: [], groups: [], rangeError: 'Start date must be a valid calendar date.' });
    expect(deriveDiagramGroups(all, { nameQuery: '' }).items).toHaveLength(all.length);
  });
});
