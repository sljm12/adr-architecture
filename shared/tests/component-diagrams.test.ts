import type * as Domain from '../src/index';
import { describe, expect, it } from 'vitest';
import { assertDiagramInvariants, diagramDocumentSchema, diagramSummarySchema, isC4ArtifactType, getComponentTypeLabel } from '../src/index';
import type { DiagramDocument } from '../src/index';
import { emptyComponentFixture, populatedComponentFixture, componentFixtureIds as ids } from './component-fixtures';
import { legacyPayloadFixture, populatedChildFixture } from './container-fixtures';

describe('Component document foundations', () => {
  it.each(['application', 'datastore'] as const)('accepts empty %s-owned scope without losing identities', owner => {
    const input = emptyComponentFixture(owner);
    expect(diagramDocumentSchema.parse(input)).toEqual(input);
    expect(() => assertDiagramInvariants(input as DiagramDocument)).not.toThrow();
    expect(diagramSummarySchema.parse(input)).toMatchObject({ kind: 'component', scope: input.scope });
  });
  it('retains immediate source identities, metadata, geometry and local endpoints', () => {
    const child = diagramDocumentSchema.parse(populatedComponentFixture());
    expect(child.components[2].sourceComponentId).toBe(ids.personOccurrence);
    expect(child.components[1]).toMatchObject({ type: 'container', containerType: 'datastore', technology: 'PostgreSQL' });
    expect(() => assertDiagramInvariants(child as DiagramDocument)).not.toThrow();
    expect(isC4ArtifactType('component')).toBe(false);
    expect(getComponentTypeLabel(child.components[0])).toBe('Component');
  });
  it.each(['name', 'description', 'technology'] as const)('rejects blank internal %s', field => {
    const child = populatedComponentFixture(); child.components[0][field] = '  ';
    expect(diagramDocumentSchema.safeParse(child).success).toBe(false);
    expect(() => assertDiagramInvariants(child as DiagramDocument)).toThrow();
  });
  it.each(['name', 'technology'] as const)('enforces the 200-character %s limit', field => {
    const child = populatedComponentFixture(); child.components[0][field] = 'a'.repeat(201);
    expect(diagramDocumentSchema.safeParse(child).success).toBe(false);
  });
  it.each([NaN, Infinity, -Infinity])('rejects nonfinite layout %s', value => {
    const child = populatedComponentFixture(); child.boundary.position.x = value;
    expect(diagramDocumentSchema.safeParse(child).success).toBe(false);
    child.boundary.position.x = 0; child.components[0].size.width = value;
    expect(diagramDocumentSchema.safeParse(child).success).toBe(false);
  });
  it('rejects owner sources, role variants, duplicate sources and groups', () => {
    for (const mutate of [
      (d: Domain.DiagramDocument) => { d.components[1].sourceComponentId = ids.application; },
      (d: Domain.DiagramDocument) => { d.components[0].role = 'container'; },
      (d: Domain.DiagramDocument) => { d.components[0].type = 'container'; },
      (d: Domain.DiagramDocument) => { d.components[0].containerType = 'application'; },
      (d: Domain.DiagramDocument) => { d.components[2].sourceComponentId = d.components[3].sourceComponentId; },
      (d: Domain.DiagramDocument) => { d.components[1].technology = null; },
      (d: Domain.DiagramDocument) => { d.components[2].containerType = 'datastore'; },
      (d: Domain.DiagramDocument) => { d.components[0].position.x = -1; },
      (d: Domain.DiagramDocument) => { d.components[1].position.x = 480; },
      (d: Domain.DiagramDocument) => { d.scope!.parentDiagramId = d.id; },
      (d: Domain.DiagramDocument) => { d.components.push(structuredClone(d.components[0])); },
    ]) {
      const child = populatedComponentFixture(); mutate(child);
      expect(diagramDocumentSchema.safeParse(child).success).toBe(false);
      expect(() => assertDiagramInvariants(child as DiagramDocument)).toThrow();
    }
    const child = emptyComponentFixture(); Object.assign(child, { groups: [{ id: ids.relationship }] });
    expect(diagramDocumentSchema.safeParse(child).success).toBe(false);
  });
  it('rejects self, missing, boundary, supporting-only, undirected and overlong-protocol interactions', () => {
    for (const mutate of [
      (r: Domain.Relationship) => { r.targetComponentId = r.sourceComponentId; },
      (r: Domain.Relationship) => { r.targetComponentId = ids.child; },
      (r: Domain.Relationship) => { r.sourceComponentId = ids.childPerson; },
      (r: Domain.Relationship) => { r.direction = 'undirected'; },
      (r: Domain.Relationship) => { r.label = ' '; },
      (r: Domain.Relationship) => { r.protocol = 'p'.repeat(201); },
    ]) {
      const child = populatedComponentFixture(); mutate(child.relationships[0]);
      expect(diagramDocumentSchema.safeParse(child).success).toBe(false);
      expect(() => assertDiagramInvariants(child as DiagramDocument)).toThrow();
    }
  });
  it('retains legacy missing-kind/free-form and Container compatibility', () => {
    expect(diagramDocumentSchema.parse(legacyPayloadFixture())).toMatchObject({ kind: 'general', components: [{ type: 'microservice' }] });
    expect(diagramDocumentSchema.parse(populatedChildFixture())).toMatchObject({ kind: 'container', scope: { softwareSystemId: ids.system } });
    expect(diagramSummarySchema.parse({ ...populatedChildFixture(), scope: null })).toMatchObject({ kind: 'container', scope: null });
    expect(diagramSummarySchema.safeParse({ ...emptyComponentFixture(), scope: null }).success).toBe(false);
    expect(getComponentTypeLabel({ role: 'element', type: 'container', containerType: null })).toBe('container');
    expect(getComponentTypeLabel({ role: 'external', type: 'container', containerType: 'datastore' })).toBe('Datastore');
  });
});
