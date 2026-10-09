import { getDiagramName, getComponentScope, getContainerScope, type DiagramDocument, type DiagramSummary } from '../../../shared/src/index';

/** Reconcile only children owned by UUIDs in this parent; never change local timestamps. */
export function reconcileParentDiagramSummaries(diagrams: readonly DiagramSummary[], parent: DiagramDocument): DiagramSummary[] {
  if (parent.kind === 'component') return [...diagrams];
  const owners = new Map(parent.components.map(c => [c.id, c]));
  return diagrams.map(diagram => {
    const componentScope = getComponentScope(diagram);
    if (componentScope && parent.kind === 'container' && componentScope.parentDiagramId === parent.id) {
      const owner = owners.get(componentScope.containerId);
      if (owner?.role !== 'container' || owner.type !== 'container' || !owner.containerType || !owner.technology) return diagram;
      return { ...diagram, name: owner.name, scope: { ...componentScope, parentDiagramName: getDiagramName(parent), softwareSystemName: parent.scope!.softwareSystemName, containerName: owner.name, containerDescription: owner.description, containerTechnology: owner.technology, containerType: owner.containerType } };
    }
    const scope = getContainerScope(diagram);
    if (scope && scope.parentDiagramId === parent.id && parent.kind !== 'container') {
      const owner = owners.get(scope.softwareSystemId);
      if (owner?.type !== 'software-system' || (owner.role ?? 'element') !== 'element') return diagram;
      return { ...diagram, name: owner.name, scope: { ...scope, parentDiagramName: parent.name, softwareSystemName: owner.name, softwareSystemDescription: owner.description } };
    }
    if (componentScope && componentScope.systemContextDiagramId === parent.id && parent.kind !== 'container') {
      const owner = owners.get(componentScope.softwareSystemId);
      if (owner?.type === 'software-system' && (owner.role ?? 'element') === 'element') return { ...diagram, scope: { ...componentScope, softwareSystemName: owner.name, parentDiagramName: owner.name } };
    }
    return diagram;
  });
}

/** Draft names are a view over saved data, so undo/discard and failed saves remain accurate. */
export function deriveDiagramLibraryDisplay(diagrams: readonly DiagramSummary[], draft: DiagramDocument | null): DiagramSummary[] {
  const resolved = diagrams.map(diagram => ({ ...diagram, name: getDiagramName(diagram) }));
  return draft ? reconcileParentDiagramSummaries(resolved, draft) : resolved;
}

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
  branches: DiagramLibraryBranch[];
}

export interface DiagramLibraryBranch {
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
  const byId = new Map(diagrams.map(d => [d.id, d]));
  const matches = new Set(view.items.map(d => d.id));
  const groups = new Map<string, DiagramLibraryGroup>();
  const rootGroup = (id: string, fallback: string) => {
    if (!groups.has(id)) { const parent = byId.get(id); const context = parent && parent.kind !== 'container' && parent.kind !== 'component' ? parent : null;
      groups.set(id, { parentId: id, parentName: context?.name ?? fallback, parent: context, parentMatches: Boolean(context && matches.has(id)), children: [], branches: [] }); }
    return groups.get(id)!;
  };
  for (const diagram of diagrams.slice().sort((a, b) => compareText(a.id, b.id))) {
    const scope = getComponentScope(diagram);
    if (scope) {
      const parentScope = getContainerScope(byId.get(scope.parentDiagramId) ?? { kind: 'general', scope: null });
      const group = rootGroup(scope.systemContextDiagramId, parentScope?.parentDiagramName ?? 'System Context unavailable');
      let branch = group.branches.find(b => b.parentId === scope.parentDiagramId);
      if (!branch) { const parent = byId.get(scope.parentDiagramId) ?? null; branch = { parentId: scope.parentDiagramId, parentName: parent?.name ?? scope.parentDiagramName, parent, parentMatches: Boolean(parent && matches.has(parent.id)), children: [] }; group.branches.push(branch); }
      if (matches.has(diagram.id)) branch.children.push(diagram);
    } else if (diagram.kind === 'container') {
      const group = rootGroup(diagram.scope?.parentDiagramId ?? diagram.id, diagram.scope?.parentDiagramName ?? 'Unknown parent');
      const existing = group.branches.find(b => b.parentId === diagram.id);
      if (existing) Object.assign(existing, { parent: diagram, parentName: diagram.name, parentMatches: matches.has(diagram.id) });
      else group.branches.push({ parentId: diagram.id, parentName: diagram.name, parent: diagram, parentMatches: matches.has(diagram.id), children: [] });
      if (matches.has(diagram.id)) group.children.push(diagram);
    } else rootGroup(diagram.id, diagram.name);
  }
  for (const group of groups.values()) {
    group.children.sort((a, b) => compareSummaries(a, b, sort));
    group.branches = group.branches.filter(b => b.parentMatches || b.children.length).sort((a, b) => compareSummaries(a.parent ?? { id: a.parentId, name: a.parentName, status: 'active', createdAt: '', updatedAt: '' }, b.parent ?? { id: b.parentId, name: b.parentName, status: 'active', createdAt: '', updatedAt: '' }, sort));
    for (const branch of group.branches) branch.children.sort((a, b) => compareSummaries(a, b, sort));
  }
  const fallbackSummary = (group: DiagramLibraryGroup): DiagramSummary => group.parent ?? { id: group.parentId, name: group.parentName, status: 'active', createdAt: '', updatedAt: '' };
  return { ...view, groups: [...groups.values()].filter(g => g.parentMatches || g.branches.length > 0).sort((a, b) => compareSummaries(fallbackSummary(a), fallbackSummary(b), sort)) };
}
