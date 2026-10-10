import type { Component, DiagramDocument, Position, Relationship } from '../domain/types';
import { fitContainerLayout } from '../domain/container-layout';
import { componentLabelBlocks, relationshipLabelBlocks, exportLabelHeight, exportTypography, wrapExportText } from './container-labels';
import { getDiagramName } from '../domain/diagram-name';

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
  boundaryRect?: ExportRect;
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
  let boundaryRect: ExportRect | undefined;
  const scoped = diagram.kind === 'container' || diagram.kind === 'component';
  diagram = { ...diagram, components: diagram.components.map(component => {
    const width = Math.max(component.size.width, scoped ? 280 : 140);
    const person = !scoped && component.type === 'person';
    const textHeight = exportLabelHeight(componentLabelBlocks(component, person ? width * .85 : width, scoped));
    const height = Math.max(component.size.height, person ? textHeight / .7 + 24 : textHeight + 40);
    return { ...component, size: { width, height } };
  }) };
  const internalRole = diagram.kind === 'component' ? 'component' : 'container';
  const labelGap = Math.max(24, ...diagram.relationships.map(relationship => 24 + exportLabelHeight(relationshipLabelBlocks(relationship, scoped))));
  const placed: Component[] = [];
  for (const component of diagram.components.filter(c => !scoped || c.role === internalRole).sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x || a.id.localeCompare(b.id))) {
    let candidate = component;
    for (;;) {
      const collisions = placed.filter(other => candidate.position.x < other.position.x + other.size.width && candidate.position.x + candidate.size.width > other.position.x && candidate.position.y < other.position.y + other.size.height && candidate.position.y + candidate.size.height > other.position.y);
      if (!collisions.length) break;
      candidate = { ...candidate, position: { x: candidate.position.x, y: Math.max(...collisions.map(other => other.position.y + other.size.height)) + labelGap } };
    }
    placed.push(candidate);
  }
  const placedById = new Map(placed.map(component => [component.id, component]));
  diagram = { ...diagram, components: diagram.components.map(component => placedById.get(component.id) ?? component) };
  if (diagram.kind === 'container' || diagram.kind === 'component') {
    const grown = diagram.components;
    const internal = grown.filter(c => c.role === internalRole);
    let fitted = fitContainerLayout(internal, grown.filter(c => c.role === 'external'));
    const headerLines = wrapExportText(getDiagramName(diagram) ?? '', fitted.boundary.size.width, exportTypography['system-group-label'].fontSize);
    const extraHeaderHeight = Math.max(0, headerLines.length - 1) * exportTypography['system-group-label'].lineHeight;
    if (extraHeaderHeight) {
      // A render-only envelope reserves every owner-label line while retaining the original body bounds.
      const { position, size } = fitted.boundary;
      fitted = fitContainerLayout([...internal, { position: { x: position.x + 24, y: position.y + 68 - extraHeaderHeight }, size: { width: size.width - 48, height: size.height - 92 + extraHeaderHeight } }], grown.filter(c => c.role === 'external'));
    }
    const externalById = new Map(fitted.externalComponents.map(c => [c.id, c]));
    diagram = { ...diagram, components: grown.map(c => externalById.get(c.id) ?? c) };
    boundaryRect = { ...fitted.boundary.position, ...fitted.boundary.size };
  }
  const componentRects = new Map(diagram.components.map(component => [component.id, { ...component.position, ...component.size }]));
  const groupRects = new Map((diagram.groups ?? []).map(group => {
    const members = group.memberComponentIds.map(id => componentRects.get(id)!);
    const right = Math.max(group.position.x + group.size.width, ...members.map(rect => rect.x + rect.width + 24));
    const width = right - group.position.x;
    const headingHeight = 24 + wrapExportText(group.name, width, exportTypography['system-group-label'].fontSize).length * exportTypography['system-group-label'].lineHeight;
    const y = Math.min(group.position.y, ...members.map(rect => rect.y - headingHeight));
    const bottom = Math.max(group.position.y + group.size.height, y + headingHeight, ...members.map(rect => rect.y + rect.height + 24));
    return [group.id, { x: group.position.x, y, width, height: bottom - y }];
  }));
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
  // Labels are drawn behind nodes. Keep their full multiline envelope clear of
  // component bodies, boundary headings and earlier labels so no words are hidden.
  const labelObstacles: ExportRect[] = [
    ...componentRects.values(),
    ...(diagram.groups ?? []).map(group => {
      const rect = groupRects.get(group.id)!;
      return { ...rect, height: 24 + wrapExportText(group.name, rect.width, exportTypography['system-group-label'].fontSize).length * exportTypography['system-group-label'].lineHeight };
    }),
    ...(boundaryRect ? [{ ...boundaryRect, height: 24 + wrapExportText(getDiagramName(diagram) ?? '', boundaryRect.width, exportTypography['system-group-label'].fontSize).length * exportTypography['system-group-label'].lineHeight }] : []),
  ];
  for (const route of relationshipRoutes) {
    const blocks = relationshipLabelBlocks(route.relationship, Boolean(diagram.scope));
    if (!blocks.length) continue;
    const height = exportLabelHeight(blocks);
    let labelRect = { x: route.label.x - 130, y: route.label.y - 14, width: 260, height };
    for (;;) {
      const collisions = labelObstacles.filter(rect => labelRect.x < rect.x + rect.width && labelRect.x + labelRect.width > rect.x && labelRect.y < rect.y + rect.height && labelRect.y + labelRect.height > rect.y);
      if (!collisions.length) break;
      labelRect = { ...labelRect, y: Math.min(...collisions.map(rect => rect.y)) - height - 12 };
    }
    route.label = { x: route.label.x, y: labelRect.y + 14 };
    labelObstacles.push(labelRect);
  }
  const points: ExportPoint[] = [];
  for (const rect of [...componentRects.values(), ...groupRects.values()]) {
    points.push({ x: rect.x, y: rect.y }, { x: rect.x + rect.width, y: rect.y + rect.height });
  }
  if (boundaryRect) points.push({ x: boundaryRect.x, y: boundaryRect.y }, { x: boundaryRect.x + boundaryRect.width, y: boundaryRect.y + boundaryRect.height });
  for (const route of relationshipRoutes) {
    points.push(route.start, route.control, route.end, route.label);
    const labelHeight = exportLabelHeight(relationshipLabelBlocks(route.relationship, Boolean(diagram.scope)));
    points.push({ x: route.label.x - 130, y: route.label.y - 14 }, { x: route.label.x + 130, y: route.label.y - 14 + labelHeight });
    if (route.arrow) points.push(...route.arrow);
  }
  if (!points.length) return { viewBox: { x: 0, y: 0, width: 640, height: 320 }, componentRects, groupRects, relationshipRoutes };
  const padding = 40;
  const minX = Math.min(...points.map(point => point.x)) - padding;
  const minY = Math.min(...points.map(point => point.y)) - padding;
  const maxX = Math.max(...points.map(point => point.x)) + padding;
  const maxY = Math.max(...points.map(point => point.y)) + padding;
  return { viewBox: { x: minX, y: minY, width: maxX - minX, height: maxY - minY }, componentRects, groupRects, relationshipRoutes, boundaryRect };
}

export const formatSvgNumber = numberText;
