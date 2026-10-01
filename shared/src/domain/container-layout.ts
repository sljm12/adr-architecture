import type { Component, ComponentSize, GroupBoundaryLayout, Position } from './types';

export const CONTAINER_BOUNDARY_PADDING = 24;
export const CONTAINER_BOUNDARY_HEADER_HEIGHT = 44;
export const CONTAINER_BOUNDARY_MINIMUM_SIZE = { width: 480, height: 320 } as const;
export const EXTERNAL_BOUNDARY_CLEARANCE = 24;
const TOP_PADDING = CONTAINER_BOUNDARY_PADDING + CONTAINER_BOUNDARY_HEADER_HEIGHT;

type Geometry = Pick<Component, 'position' | 'size'>;
type LayoutExternal = Pick<Component, 'id' | 'position' | 'size'>;

function assertGeometry({ position, size }: Geometry): void {
  if (![position.x, position.y, size.width, size.height].every(Number.isFinite) || size.width <= 0 || size.height <= 0) {
    throw new Error('Container layout requires finite positions and positive finite component sizes.');
  }
}

/** Fits a boundary around internal components, retaining the C4 header and minimum empty size. */
export function fitContainerBoundary(containers: Geometry[]): GroupBoundaryLayout {
  if (containers.length === 0) return { position: { x: 0, y: 0 }, size: { ...CONTAINER_BOUNDARY_MINIMUM_SIZE } };
  containers.forEach(assertGeometry);
  const minX = Math.min(...containers.map(component => component.position.x));
  const minY = Math.min(...containers.map(component => component.position.y));
  const right = Math.max(...containers.map(component => component.position.x + component.size.width));
  const bottom = Math.max(...containers.map(component => component.position.y + component.size.height));
  const position = { x: minX - CONTAINER_BOUNDARY_PADDING, y: minY - TOP_PADDING };
  const size = {
    width: Math.max(CONTAINER_BOUNDARY_MINIMUM_SIZE.width, right - minX + CONTAINER_BOUNDARY_PADDING * 2),
    height: Math.max(CONTAINER_BOUNDARY_MINIMUM_SIZE.height, bottom - minY + TOP_PADDING + CONTAINER_BOUNDARY_PADDING),
  };
  return { position, size };
}

/** True when the full external rectangle leaves the boundary's 24-unit clearance envelope. */
export function isExternalOutsideBoundary(
  boundary: GroupBoundaryLayout,
  position: Position,
  size: ComponentSize,
  clearance = EXTERNAL_BOUNDARY_CLEARANCE,
): boolean {
  const boundaryRight = boundary.position.x + boundary.size.width;
  const boundaryBottom = boundary.position.y + boundary.size.height;
  return position.x + size.width <= boundary.position.x - clearance
    || position.x >= boundaryRight + clearance
    || position.y + size.height <= boundary.position.y - clearance
    || position.y >= boundaryBottom + clearance;
}

export function validateExternalPlacement(
  boundary: GroupBoundaryLayout,
  external: Pick<Component, 'position' | 'size'>,
): void {
  assertGeometry(external);
  if (!isExternalOutsideBoundary(boundary, external.position, external.size)) {
    throw new Error(`External participants must remain outside the Software System boundary with ${EXTERNAL_BOUNDARY_CLEARANCE} units of clearance.`);
  }
}

function rectanglesOverlap(a: LayoutExternal, b: LayoutExternal): boolean {
  return a.position.x < b.position.x + b.size.width
    && a.position.x + a.size.width > b.position.x
    && a.position.y < b.position.y + b.size.height
    && a.position.y + a.size.height > b.position.y;
}

function compareUuid(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }

/** Fits one boundary and relocates only external rectangles that violate its clearance or collide. */
export function fitContainerLayout<T extends LayoutExternal>(
  containers: Geometry[],
  externalComponents: T[],
): { boundary: GroupBoundaryLayout; externalComponents: T[] } {
  const boundary = fitContainerBoundary(containers);
  const originals = new Map(externalComponents.map(component => [component.id, component]));
  const placed = new Map<string, T>();
  for (const external of [...externalComponents].sort((a, b) => compareUuid(a.id, b.id))) {
    assertGeometry(external);
    const alreadyPlaced = [...placed.values()];
    const overlaps = !isExternalOutsideBoundary(boundary, external.position, external.size)
      || alreadyPlaced.some(other => rectanglesOverlap(external, other));
    if (!overlaps) {
      placed.set(external.id, external);
      continue;
    }

    const x = boundary.position.x + boundary.size.width + EXTERNAL_BOUNDARY_CLEARANCE;
    let y = boundary.position.y;
    let candidate: T = { ...external, position: { x, y } };
    const occupied = externalComponents.filter(item => item.id !== external.id).map(item => originals.get(item.id)!);
    while ([...occupied, ...placed.values()].some(other => rectanglesOverlap(candidate, other))) {
      const colliding = [...occupied, ...placed.values()].filter(other => rectanglesOverlap(candidate, other));
      y = Math.max(...colliding.map(other => other.position.y + other.size.height)) + EXTERNAL_BOUNDARY_CLEARANCE;
      candidate = { ...external, position: { x, y } };
    }
    placed.set(external.id, candidate);
  }
  return { boundary, externalComponents: externalComponents.map(component => placed.get(component.id) ?? component) };
}
