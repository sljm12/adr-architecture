import { describe, expect, it } from 'vitest';
import { fitContainerBoundary, fitContainerLayout, validateExternalPlacement } from '../src/domain/container-layout';
import type { Component, GroupBoundaryLayout } from '../src/domain/types';
import { containerFixtureIds as ids, containerFixtureTimestamp as timestamp } from './container-fixtures';

const childId = '91000000-0000-4000-8000-000000000001';
const container = (id: string, x: number, y: number, width: number, height: number): Component => ({
  id, diagramId: childId, name: id, description: 'service', type: 'container', role: 'container', technology: 'TypeScript', sourceComponentId: null,
  position: { x, y }, size: { width, height }, createdAt: timestamp, updatedAt: timestamp,
});
const external = (id: string, x: number, y: number, width = 120, height = 80): Component => ({
  id, diagramId: childId, name: id, description: null, type: 'software-system', role: 'external', technology: null, sourceComponentId: ids.sourceSystem,
  position: { x, y }, size: { width, height }, createdAt: timestamp, updatedAt: timestamp,
});

describe('container boundary layout', () => {
  it('uses the origin and minimum size for an empty child', () => {
    expect(fitContainerBoundary([])).toEqual({ position: { x: 0, y: 0 }, size: { width: 480, height: 320 } });
  });

  it('fits container bounds with 24-unit horizontal/bottom padding and a 44-unit header', () => {
    const fitted = fitContainerBoundary([container(ids.container, 100.25, 100.5, 620, 400)]);
    expect(fitted).toEqual({ position: { x: 76.25, y: 32.5 }, size: { width: 668, height: 492 } });
  });

  it('keeps minimum dimensions when fitted content is small', () => {
    expect(fitContainerBoundary([container(ids.container, 20, 80, 100, 50)]).size).toEqual({ width: 480, height: 320 });
  });

  it('relocates overlapping external occurrences in UUID order and avoids collisions', () => {
    const [lowerId, higherId] = ['92000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000002'];
    const layout = fitContainerLayout(
      [container(ids.container, 0, 0, 700, 400)],
      [external(higherId, 20, 20), external(lowerId, 20, 20)],
    );
    const low = layout.externalComponents.find(item => item.id === lowerId)!;
    const high = layout.externalComponents.find(item => item.id === higherId)!;
    expect(low.position.x).toBe(layout.boundary.position.x + layout.boundary.size.width + 24);
    expect(low.position.y).toBe(layout.boundary.position.y);
    expect(high.position.y).toBeGreaterThan(low.position.y + low.size.height + 23.999);
    expect(low.position.x).toBe(high.position.x);
  });

  it('moves a displaced external past an existing participant collision', () => {
    const existing = external('93000000-0000-4000-8000-000000000001', 748, -68);
    const displaced = external('93000000-0000-4000-8000-000000000002', 20, 20);
    const layout = fitContainerLayout([container(ids.container, 0, 0, 700, 400)], [existing, displaced]);
    const moved = layout.externalComponents.find(item => item.id === displaced.id)!;
    expect(moved.position.x).toBe(existing.position.x);
    expect(moved.position.y).toBeGreaterThan(existing.position.y + existing.size.height + 23.999);
  });

  it('preserves fractional coordinates and rejects direct placement inside required clearance', () => {
    const boundary: GroupBoundaryLayout = { position: { x: 76.25, y: 32.5 }, size: { width: 600, height: 400 } };
    expect(fitContainerBoundary([container(ids.container, 100.25, 100.5, 600, 400)]).position.x).toBe(76.25);
    expect(() => validateExternalPlacement(boundary, external(ids.externalOccurrence, 699, 200))).toThrow(/24/);
    expect(() => validateExternalPlacement(boundary, external(ids.externalOccurrence, 700.25, 200))).not.toThrow();
  });
});
