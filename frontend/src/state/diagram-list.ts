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

export interface DiagramLibraryGroup {
  parentId: string;
  parentName: string;
  parent: DiagramSummary | null;
  parentMatches: boolean;
  children: DiagramSummary[];
}

/** Filtering applies to each own artifact; parent headings provide context only. */
export function deriveDiagramGroups(diagrams: readonly DiagramSummary[], filters: DiagramListFilters = {}, sort: DiagramListSort = defaultDiagramListSort): DiagramListView & { groups: DiagramLibraryGroup[] } {
  const view = deriveDiagramList(diagrams, filters, sort);
  if (view.rangeError) return { ...view, groups: [] };
  const parents = new Map(diagrams.filter(d => d.kind !== 'container').map(d => [d.id, d]));
  const matches = new Set(view.items.map(d => d.id));
  const groups = new Map<string, DiagramLibraryGroup>();
  // Pick scope fallback from the full set, independent of filtering/input order.
  for (const child of diagrams.filter(d => d.kind === 'container').slice().sort((a, b) => compareText(a.id, b.id))) {
    const parentId = child.scope?.parentDiagramId ?? child.id;
    if (groups.has(parentId)) continue;
    const parent = parents.get(parentId) ?? null;
    groups.set(parentId, { parentId, parentName: parent?.name ?? child.scope?.parentDiagramName ?? 'Unknown parent', parent, parentMatches: Boolean(parent && matches.has(parent.id)), children: [] });
  }
  for (const diagram of view.items) {
    if (diagram.kind === 'container') groups.get(diagram.scope?.parentDiagramId ?? diagram.id)!.children.push(diagram);
    else if (!groups.has(diagram.id)) groups.set(diagram.id, { parentId: diagram.id, parentName: diagram.name, parent: diagram, parentMatches: true, children: [] });
  }
  const fallbackSummary = (group: DiagramLibraryGroup): DiagramSummary => group.parent ?? { id: group.parentId, name: group.parentName, status: 'active', createdAt: '', updatedAt: '' };
  return { ...view, groups: [...groups.values()].filter(g => g.parentMatches || g.children.length > 0).sort((a, b) => compareSummaries(fallbackSummary(a), fallbackSummary(b), sort)) };
}
