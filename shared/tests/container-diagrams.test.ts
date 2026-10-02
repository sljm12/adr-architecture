import { describe, expect, it } from 'vitest';
import { assertDiagramInvariants, diagramDocumentSchema, isC4ArtifactType } from '../src/index';
import {
  containerFixtureIds as ids,
  containerFixtureTimestamp as timestamp,
  emptyChildFixture,
  generalParentFixture,
  legacyPayloadFixture,
  populatedChildFixture,
} from './container-fixtures';

describe('C4 container document validation', () => {
  it.each(['application', 'datastore'])('retains explicit %s subtype without widening source eligibility', subtype => {
    const child = populatedChildFixture() as any;
    child.components[0].containerType = subtype;
    child.components[1].containerType = null;
    const parsed = diagramDocumentSchema.parse(child);
    expect(parsed.components[0].containerType).toBe(subtype);
    expect(isC4ArtifactType(subtype)).toBe(false);
    expect(isC4ArtifactType('container')).toBe(false);
  });

  it.each([undefined, null, 'queue', 'person', 'software-system'])('rejects unsupported internal subtype %s with a field path', subtype => {
    const child = populatedChildFixture() as any;
    child.components[0].containerType = subtype;
    child.components[1].containerType = null;
    const result = diagramDocumentSchema.safeParse(child);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some(issue => issue.path.join('.') === 'components.0.containerType')).toBe(true);
  });

  it('requires null subtype for ordinary elements and external occurrences', () => {
    const parent = generalParentFixture() as any;
    expect(diagramDocumentSchema.parse(parent).components[0].containerType).toBe(null);
    parent.components[0].containerType = 'application';
    expect(diagramDocumentSchema.safeParse(parent).success).toBe(false);
    const child = populatedChildFixture() as any;
    child.components[0].containerType = 'application';
    child.components[1].containerType = 'datastore';
    expect(diagramDocumentSchema.safeParse(child).success).toBe(false);
  });
  it('retains general kind and canonical owner scope on container documents', () => {
    const parent = diagramDocumentSchema.parse(generalParentFixture());
    const child = diagramDocumentSchema.parse(emptyChildFixture());

    expect(parent).toMatchObject({ kind: 'general', scope: null, boundary: null });
    expect(child).toMatchObject({
      kind: 'container',
      scope: { parentDiagramId: ids.parentDiagram, softwareSystemId: ids.owner },
      boundary: { position: { x: 0, y: 0 }, size: { width: 480, height: 320 } },
    });
  });

  it('accepts a populated child with a local container and source-linked external', () => {
    const parsed = diagramDocumentSchema.parse(populatedChildFixture());
    expect(parsed.components.map(component => component.role)).toEqual(['container', 'external']);
    expect(parsed.components[1]).toMatchObject({ sourceComponentId: ids.sourceSystem, technology: null });
    expect(parsed.relationships[0]).toMatchObject({ direction: 'directed', label: 'writes transactions', protocol: 'HTTPS' });
    expect(() => assertDiagramInvariants(parsed)).not.toThrow();
  });

  it('requires trimmed container name, responsibility, and technology', () => {
    const child = emptyChildFixture();
    const component = { ...(populatedChildFixture() as any).components[0], diagramId: child.id };
    for (const invalid of [
      { ...component, name: '   ' },
      { ...component, description: '  ' },
      { ...component, technology: '\t ' },
    ]) {
      expect(diagramDocumentSchema.safeParse({ ...child, components: [invalid] }).success).toBe(false);
    }
    const parsed = diagramDocumentSchema.parse({ ...child, components: [{ ...component, name: '  Payment API  ', description: ' Processes payments ', technology: ' TypeScript ' }] });
    expect(parsed.components[0]).toMatchObject({ name: 'Payment API', description: 'Processes payments', technology: 'TypeScript' });
  });

  it('rejects invalid UUIDs and non-finite feature geometry', () => {
    const child = emptyChildFixture() as any;
    expect(diagramDocumentSchema.safeParse({ ...child, scope: { ...child.scope, softwareSystemId: 'owner' } }).success).toBe(false);
    expect(diagramDocumentSchema.safeParse({ ...child, boundary: { ...child.boundary, position: { x: Number.NaN, y: 0 } } }).success).toBe(false);
    const component = (populatedChildFixture() as any).components[0];
    expect(diagramDocumentSchema.safeParse({ ...child, components: [{ ...component, size: { width: Number.POSITIVE_INFINITY, height: 80 } }] }).success).toBe(false);
  });

  it('requires directed, nonblank child relationships with valid local endpoints', () => {
    const child = populatedChildFixture() as any;
    const relationship = child.relationships[0];
    const secondExternal = {
      ...(child.components[1]),
      id: '94000000-0000-4000-8000-000000000001',
      name: 'Customer',
      type: 'person',
      sourceComponentId: ids.person,
      position: { x: 850, y: 100 },
    };
    for (const invalid of [
      { ...relationship, direction: 'undirected' },
      { ...relationship, label: '  ' },
      { ...relationship, targetComponentId: ids.person },
      { ...relationship, sourceComponentId: relationship.targetComponentId, targetComponentId: secondExternal.id },
    ]) {
      expect(diagramDocumentSchema.safeParse({ ...child, components: [...child.components, secondExternal], relationships: [invalid] }).success).toBe(false);
    }
  });

  it('rejects groups and unknown feature content in container documents', () => {
    const child = emptyChildFixture() as any;
    const invalidGroup = {
      id: ids.group,
      diagramId: child.id,
      name: 'Not allowed',
      memberComponentIds: [ids.owner, ids.sourceSystem],
      position: { x: 0, y: 0 },
      size: { width: 500, height: 500 },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    expect(diagramDocumentSchema.safeParse({ ...child, groups: [invalidGroup] }).success).toBe(false);
    expect(diagramDocumentSchema.safeParse({ ...child, scope: { ...child.scope, importedFlag: true } }).success).toBe(false);
  });

  it('normalizes only legacy general fields and preserves free-form component types', () => {
    const parsed = diagramDocumentSchema.parse(legacyPayloadFixture() as any);
    expect(parsed).toMatchObject({ kind: 'general', scope: null, boundary: null, groups: [] });
    expect(parsed.components[0]).toMatchObject({ type: 'microservice', role: 'element', technology: null, sourceComponentId: null });
  });
});
