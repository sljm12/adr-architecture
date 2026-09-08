import { describe, expect, it } from 'vitest';
import { adrComponentsWriteSchema, adrWriteSchema, architectureDecisionRecordSchema, assertAdrComponentOwnership, componentAdrSummaryListSchema } from '../src/index';
import { adrComponentFixtures, completeAdrFixture } from './adr-fixtures';

describe('ADR validation schemas', () => {
  it('normalizes optional text and validates stable record shape', () => {
    const result = adrWriteSchema.parse({ title: ' Title ', context: 'Context', decision: 'Decision', consequences: 'Consequences', alternativesOrConstraints: '  ', status: 'draft' });
    expect(result).toMatchObject({ title: 'Title', alternativesOrConstraints: null, replacementAdrId: null });
    expect(architectureDecisionRecordSchema.parse(completeAdrFixture()).id).toBe(completeAdrFixture().id);
  });

  it('reports every required field and rejects duplicate or incomplete links', () => {
    const result = adrWriteSchema.safeParse({ title: '', context: '', decision: '', consequences: '', status: 'draft' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map(issue => issue.path[0])).toEqual(expect.arrayContaining(['title', 'context', 'decision', 'consequences']));
    expect(adrWriteSchema.safeParse({ ...completeAdrFixture(), status: 'superseded', replacementAdrId: null }).success).toBe(false);
    expect(adrComponentsWriteSchema.safeParse({ componentIds: [completeAdrFixture().componentIds[0], completeAdrFixture().componentIds[0]] }).success).toBe(false);
  });

  it('accepts zero, one, and many stable component UUID links', () => {
    const adr = completeAdrFixture();
    expect(adrComponentsWriteSchema.parse({ componentIds: [] })).toEqual({ componentIds: [] });
    expect(adrComponentsWriteSchema.parse({ componentIds: [adrComponentFixtures[0].id] })).toEqual({ componentIds: [adrComponentFixtures[0].id] });
    expect(adrComponentsWriteSchema.parse({ componentIds: adrComponentFixtures.slice(0, 2).map(component => component.id) }).componentIds).toHaveLength(2);
    expect(() => assertAdrComponentOwnership({ ...adr, componentIds: ['00000000-0000-0000-0000-000000000299'] }, adrComponentFixtures)).toThrow('missing component');
    expect(() => assertAdrComponentOwnership({ ...adr, componentIds: [adrComponentFixtures[2].id] }, adrComponentFixtures)).toThrow('different diagram');
  });

  it('keeps links keyed by component ID when a component is renamed or repositioned', () => {
    const adr = completeAdrFixture({ componentIds: [adrComponentFixtures[0].id] });
    const renamed = { ...adrComponentFixtures[0], name: 'Renamed gateway', position: { x: 640, y: 280 } };
    expect(adr.componentIds).toEqual([renamed.id]);
    expect(() => assertAdrComponentOwnership(adr, [renamed])).not.toThrow();
  });

  it('validates component-scoped summaries without losing stable identity or metadata', () => {
    const summary = { id: completeAdrFixture().id, title: completeAdrFixture().title, status: 'accepted', updatedAt: '2026-01-02T00:00:00.000Z' };
    expect(componentAdrSummaryListSchema.parse([summary])).toEqual([summary]);
    expect(componentAdrSummaryListSchema.parse([])).toEqual([]);
    expect(componentAdrSummaryListSchema.safeParse([{ ...summary, id: 'not-a-uuid' }]).success).toBe(false);
    expect(componentAdrSummaryListSchema.safeParse([{ ...summary, status: 'unknown' }]).success).toBe(false);
  });
});
