import { describe, expect, it } from 'vitest';
import { deletionPreviewSchema, deletionConfirmationSchema, deletionImpactSchema, deletionResultSchema, deletionErrorSchema } from '../src/index';
import { componentContextFixture, componentParentFixture, populatedComponentFixture } from './component-fixtures';

const documents = [componentContextFixture(), componentParentFixture(), populatedComponentFixture()];
const summaries = documents.map(d => ({ id: d.id, name: d.name, kind: d.kind, scope: d.scope ?? null, status: d.status, createdAt: d.createdAt, updatedAt: d.updatedAt }));
const result = { rootDiagramId: documents[0].id, mode: 'trash', affectedDiagrams: summaries };
const token = 'a'.repeat(64);
describe('strict deletion boundaries', () => {
  it('keeps literal names and supports both modes/selectors', () => {
    for (const mode of ['trash', 'permanent']) for (const selector of [{ name: ' Payments \u00e9 ' }, { id: documents[0].id }]) expect(deletionPreviewSchema.parse({ selector, mode })).toEqual({ selector, mode });
  });
  it.each([{ selector: { name: ' ' }, mode: 'trash' }, { selector: { id: 'bad' }, mode: 'trash' }, { selector: { name: 'x', id: documents[0].id }, mode: 'trash' }, { selector: { name: 'x', extra: 1 }, mode: 'trash' }, { selector: { name: 'x' } }, { selector: { name: 'x' }, mode: 'trash', extra: 1 }])('rejects invalid preview %j', value => expect(deletionPreviewSchema.safeParse(value).success).toBe(false));
  it('requires strict confirmations and opaque lowercase SHA-256 tokens', () => {
    expect(deletionConfirmationSchema.parse({ mode: 'trash', confirmationToken: token })).toEqual({ mode: 'trash', confirmationToken: token });
    for (const value of ['', 'A'.repeat(64), 'a'.repeat(63)]) expect(deletionConfirmationSchema.safeParse({ mode: 'trash', confirmationToken: value }).success).toBe(false);
    expect(deletionConfirmationSchema.safeParse({ mode: 'trash', confirmationToken: token, selector: {} }).success).toBe(false);
  });
  it('requires root-first unique parent-before-child depth/UUID ordered summaries', () => {
    expect(deletionImpactSchema.parse({ ...result, confirmationToken: token }).affectedDiagrams).toHaveLength(3);
    for (const affectedDiagrams of [[], [summaries[1]], [summaries[0], summaries[0]], [...summaries].reverse(), [summaries[0], summaries[2], summaries[1]]]) expect(deletionResultSchema.safeParse({ ...result, affectedDiagrams }).success).toBe(false);
    expect(deletionResultSchema.safeParse({ ...result, extra: 1 }).success).toBe(false);
    expect(deletionResultSchema.safeParse({ ...result, affectedDiagrams: [{ ...summaries[0], extra: 1 }] }).success).toBe(false);
    const sibling = { ...summaries[1], id: 'f0000000-0000-4000-8000-000000000001' };
    expect(deletionResultSchema.safeParse({ ...result, affectedDiagrams: [summaries[0], sibling, summaries[1]] }).success).toBe(false);
    expect(deletionResultSchema.safeParse({ ...result, affectedDiagrams: [summaries[0], { ...summaries[2], scope: { ...summaries[2].scope, parentDiagramId: summaries[0].id } }] }).success).toBe(false);
  });
  it('validates structured remedies, candidates and blockers', () => {
    expect(deletionErrorSchema.parse({ message: 'Ambiguous', code: 'DELETE_NAME_AMBIGUOUS', remedy: 'Use UUID', candidates: summaries })).toMatchObject({ remedy: 'Use UUID' });
    expect(deletionErrorSchema.safeParse({ message: 'bad', code: 'unknown', remedy: 'Retry' }).success).toBe(false);
    expect(deletionErrorSchema.safeParse({ message: 'bad', code: 'DIAGRAM_DEPENDENCY', remedy: 'Repair', blockers: [{ diagramId: 'bad', artifactId: 'bad', reason: 'x', nextAction: 'x' }] }).success).toBe(false);
  });
});
