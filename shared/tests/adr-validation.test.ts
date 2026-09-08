import { describe, expect, it } from 'vitest';
import { adrComponentsWriteSchema, adrWriteSchema, architectureDecisionRecordSchema } from '../src/index';
import { completeAdrFixture } from './adr-fixtures';

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
});
