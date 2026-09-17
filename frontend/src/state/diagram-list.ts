import type { DiagramSummary } from '../../../shared/src/index';

export type DiagramListSortField = 'name' | 'createdAt';
export type DiagramListSortDirection = 'ascending' | 'descending';

export interface DiagramListFilters {
  nameQuery?: string;
  createdFrom?: string;
  createdTo?: string;
}

export interface DiagramListSort {
  field: DiagramListSortField;
  direction: DiagramListSortDirection;
}

export interface DiagramListView {
  items: DiagramSummary[];
  rangeError: string | null;
}

export const defaultDiagramListSort: DiagramListSort = { field: 'createdAt', direction: 'descending' };

const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const normalizeName = (name: string) => name.trim().toLocaleLowerCase();
const compareText = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const compareTimestamp = (left: string, right: string) => {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) return leftTime < rightTime ? -1 : leftTime > rightTime ? 1 : 0;
  return compareText(left, right);
};

const normalizeBound = (value: string | undefined) => value?.trim() || '';
const isValidCalendarDate = (value: string) => {
  if (!calendarDatePattern.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.getUTCFullYear() === year && parsed.getUTCMonth() + 1 === month && parsed.getUTCDate() === day;
};
const creationCalendarDate = (value: string) => value.slice(0, 10);

function rangeError(filters: DiagramListFilters): string | null {
  const from = normalizeBound(filters.createdFrom);
  const to = normalizeBound(filters.createdTo);
  if (from && !isValidCalendarDate(from)) return 'Start date must be a valid calendar date.';
  if (to && !isValidCalendarDate(to)) return 'End date must be a valid calendar date.';
  if (from && to && to < from) return 'End date must be on or after the start date.';
  return null;
}

function compareSummaries(left: DiagramSummary, right: DiagramSummary, sort: DiagramListSort): number {
  const primary = sort.field === 'name'
    ? compareText(normalizeName(left.name), normalizeName(right.name))
    : compareTimestamp(left.createdAt, right.createdAt);
  const directed = primary * (sort.direction === 'ascending' ? 1 : -1);
  if (directed !== 0) return directed;
  const nameTie = compareText(normalizeName(left.name), normalizeName(right.name));
  return nameTie || compareText(left.id, right.id);
}

/** Derive the panel view without mutating server-backed summaries. */
export function deriveDiagramList(diagrams: readonly DiagramSummary[], filters: DiagramListFilters = {}, sort: DiagramListSort = defaultDiagramListSort): DiagramListView {
  const error = rangeError(filters);
  if (error) return { items: [], rangeError: error };
  const nameQuery = normalizeName(filters.nameQuery ?? '');
  const from = normalizeBound(filters.createdFrom);
  const to = normalizeBound(filters.createdTo);
  const items = diagrams
    .filter(diagram => {
      const nameMatches = !nameQuery || normalizeName(diagram.name).includes(nameQuery);
      const date = creationCalendarDate(diagram.createdAt);
      const startMatches = !from || date >= from;
      const endMatches = !to || date <= to;
      return nameMatches && startMatches && endMatches;
    })
    .slice()
    .sort((left, right) => compareSummaries(left, right, sort));
  return { items, rangeError: null };
}

export const filterAndSortDiagrams = deriveDiagramList;
