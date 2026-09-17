import { describe, expect, it } from 'vitest';
import { deriveDiagramList, defaultDiagramListSort } from '../src/state/diagram-list';
import {
  activeDiagramListFixtures,
  dateRangeBoundaryFixtures,
  diagramListFixtures,
} from './diagram-list-fixtures';

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
});
