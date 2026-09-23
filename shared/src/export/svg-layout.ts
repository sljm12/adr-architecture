import type { Component, DiagramDocument, Position, Relationship } from '../domain/types';

export type ExportRect = Position & { width: number; height: number };
export type ExportPoint = Position;
export type RelationshipRoute = {
  relationship: Relationship;
  start: ExportPoint;
  control: ExportPoint;
  end: ExportPoint;
  label: ExportPoint;
  arrow: [ExportPoint, ExportPoint, ExportPoint] | null;
  path: string;
};
export type DiagramSvgLayout = {
  viewBox: ExportRect;
  componentRects: Map<string, ExportRect>;
  groupRects: Map<string, ExportRect>;
  relationshipRoutes: RelationshipRoute[];
};

const numberText = (value: number) => Number(value.toFixed(2)).toString();
const center = (rect: ExportRect): ExportPoint => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });

function boxBoundary(rect: ExportRect, toward: ExportPoint): ExportPoint {
  const origin = center(rect);
  const dx = toward.x - origin.x;
  const dy = toward.y - origin.y;
  if (dx === 0 && dy === 0) return { x: origin.x + rect.width / 2, y: origin.y };
  const scale = Math.min(
    dx === 0 ? Number.POSITIVE_INFINITY : rect.width / 2 / Math.abs(dx),
    dy === 0 ? Number.POSITIVE_INFINITY : rect.height / 2 / Math.abs(dy),
  );
  return { x: origin.x + dx * scale, y: origin.y + dy * scale };
}

function arrowPoints(control: ExportPoint, end: ExportPoint): [ExportPoint, ExportPoint, ExportPoint] {
  const dx = end.x - control.x;
  const dy = end.y - control.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const unit = { x: dx / length, y: dy / length };
  const normal = { x: -unit.y, y: unit.x };
  const base = { x: end.x - unit.x * 12, y: end.y - unit.y * 12 };
  return [
    end,
    { x: base.x + normal.x * 5, y: base.y + normal.y * 5 },
    { x: base.x - normal.x * 5, y: base.y - normal.y * 5 },
  ];
}

function pairKey(relationship: Relationship): string {
  return [relationship.sourceComponentId, relationship.targetComponentId].sort().join(':');
}

function createRoute(relationship: Relationship, components: Map<string, Component>, laneOffset: number): RelationshipRoute {
  const source = components.get(relationship.sourceComponentId);
  const target = components.get(relationship.targetComponentId);
  if (!source || !target) throw new Error(`Relationship ${relationship.id} has a missing endpoint.`);
  const sourceRect = { ...source.position, ...source.size };
  const targetRect = { ...target.position, ...target.size };
  const sourceCenter = center(sourceRect);
  const targetCenter = center(targetRect);
  const start = boxBoundary(sourceRect, targetCenter);
  const end = boxBoundary(targetRect, sourceCenter);
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const orientation = relationship.sourceComponentId.localeCompare(relationship.targetComponentId) <= 0 ? 1 : -1;
  const control = {
    x: (start.x + end.x) / 2 - (dy / length) * laneOffset * orientation,
    y: (start.y + end.y) / 2 + (dx / length) * laneOffset * orientation,
  };
  const label = {
    x: 0.25 * start.x + 0.5 * control.x + 0.25 * end.x,
    y: 0.25 * start.y + 0.5 * control.y + 0.25 * end.y - 9,
  };
  const path = `M ${numberText(start.x)} ${numberText(start.y)} Q ${numberText(control.x)} ${numberText(control.y)} ${numberText(end.x)} ${numberText(end.y)}`;
  return {
    relationship,
    start,
    control,
    end,
    label,
    arrow: relationship.direction === 'directed' ? arrowPoints(control, end) : null,
    path,
  };
}

/** Calculates a stable SVG layout using validated domain positions and sizes. */
export function layoutDiagramForSvg(diagram: DiagramDocument): DiagramSvgLayout {
  const componentRects = new Map(diagram.components.map(component => [component.id, { ...component.position, ...component.size }]));
  const groupRects = new Map((diagram.groups ?? []).map(group => [group.id, { ...group.position, ...group.size }]));
  const components = new Map(diagram.components.map(component => [component.id, component]));
  const byPair = new Map<string, Relationship[]>();
  for (const relationship of diagram.relationships) {
    const pair = byPair.get(pairKey(relationship)) ?? [];
    pair.push(relationship);
    byPair.set(pairKey(relationship), pair);
  }
  const laneById = new Map<string, number>();
  for (const relationships of byPair.values()) {
    const ordered = [...relationships].sort((left, right) => left.id.localeCompare(right.id));
    ordered.forEach((relationship, index) => laneById.set(relationship.id, (index - (ordered.length - 1) / 2) * 34));
  }
  const relationshipRoutes = diagram.relationships.map(relationship => createRoute(relationship, components, laneById.get(relationship.id) ?? 0));
  const points: ExportPoint[] = [];
  for (const rect of [...componentRects.values(), ...groupRects.values()]) {
    points.push({ x: rect.x, y: rect.y }, { x: rect.x + rect.width, y: rect.y + rect.height });
  }
  for (const route of relationshipRoutes) {
    points.push(route.start, route.control, route.end, route.label);
    if (route.arrow) points.push(...route.arrow);
  }
  if (!points.length) return { viewBox: { x: 0, y: 0, width: 640, height: 320 }, componentRects, groupRects, relationshipRoutes };
  const padding = 40;
  const minX = Math.min(...points.map(point => point.x)) - padding;
  const minY = Math.min(...points.map(point => point.y)) - padding;
  const maxX = Math.max(...points.map(point => point.x)) + padding;
  const maxY = Math.max(...points.map(point => point.y)) + padding;
  return { viewBox: { x: minX, y: minY, width: maxX - minX, height: maxY - minY }, componentRects, groupRects, relationshipRoutes };
}

export const formatSvgNumber = numberText;
