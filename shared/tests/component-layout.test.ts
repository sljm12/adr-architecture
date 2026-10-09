import { describe, expect, it } from 'vitest';
import { fitScopedDiagramLayout, isExternalOutsideBoundary, validateExternalPlacement } from '../src/index';
import { populatedComponentFixture, emptyComponentFixture } from './component-fixtures';
import type { DiagramDocument } from '../src/index';

describe('Component scoped layout', () => {
  it('retains the origin and minimum empty boundary', () => {
    expect(fitScopedDiagramLayout(emptyComponentFixture() as DiagramDocument).boundary).toEqual({ position: { x: 0, y: 0 }, size: { width: 480, height: 320 } });
  });
  it('fits internal Components with side/bottom 24 and top 68 insets, preserving references', () => {
    const input = populatedComponentFixture() as DiagramDocument;
    input.components[0].position = { x: -100.5, y: -200.25 };
    input.components[0].size = { width: 800, height: 500 };
    const before = structuredClone(input);
    const fitted = fitScopedDiagramLayout(input);
    expect(fitted.boundary).toEqual({ position: { x: -124.5, y: -268.25 }, size: { width: 848, height: 592 } });
    expect(fitted.components.map(c => c.id)).toEqual(input.components.map(c => c.id));
    expect(fitted.relationships).toEqual(input.relationships);
    expect(input).toEqual(before);
    for (const supporting of fitted.components.slice(1)) expect(isExternalOutsideBoundary(fitted.boundary!, supporting.position, supporting.size)).toBe(true);
    expect(fitted.components[1].sourceComponentId).toBe(input.components[1].sourceComponentId);
    expect(fitScopedDiagramLayout(input)).toEqual(fitted);
  });
  it('rejects nonfinite geometry and direct supporting placement within the clearance', () => {
    const input = populatedComponentFixture() as DiagramDocument;
    input.components[0].position.x = Infinity;
    expect(() => fitScopedDiagramLayout(input)).toThrow(/finite/);
    input.components[0].position.x = Number.MAX_VALUE; input.components[0].size.width = Number.MAX_VALUE;
    expect(() => fitScopedDiagramLayout(input)).toThrow(/finite/);
    expect(() => validateExternalPlacement(input.boundary!, { position: { x: 503, y: 0 }, size: { width: 180, height: 72 } })).toThrow(/24/);
    expect(() => validateExternalPlacement(input.boundary!, { position: { x: 504, y: 0 }, size: { width: 180, height: 72 } })).not.toThrow();
  });
});
