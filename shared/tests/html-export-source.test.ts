import { describe, expect, it } from 'vitest';
import { htmlExportSourceSchema } from '../src/index';
import type { ArchitectureDecisionRecord } from '../src/index';
import { exportTimestamp, htmlPackageFixture } from './html-export-fixtures';

function source() {
  const fixture = htmlPackageFixture();
  return { entryDiagramId: fixture.parent.id, sourceCapturedAt: exportTimestamp,
    diagrams: [fixture.parent, ...fixture.children].map(diagram => ({ diagram, adrs: fixture.adrsByDiagram[diagram.id] })),
    availability: fixture.availability, sourceContexts: {} };
}

describe('HTML export source wire schema', () => {
  it('parses complete members, lifecycle fields, availability and legacy general defaults', () => {
    const input = source();
    delete input.diagrams[0].diagram.kind;
    const parsed = htmlExportSourceSchema.parse(input);
    expect(parsed.diagrams[0].diagram.kind).toBe('general');
    expect(parsed.diagrams.flatMap(member => member.adrs)).toHaveLength(8);
    expect(parsed.availability.map(item => item.availability)).toEqual(['active', 'active', 'none', 'trashed']);
  });
  it('parses a direct child with unused eligible source context', () => {
    const fixture = htmlPackageFixture(), child = fixture.children[0];
    const input = { entryDiagramId: child.id, sourceCapturedAt: exportTimestamp,
      diagrams: [{ diagram: child, adrs: fixture.adrsByDiagram[child.id] }], availability: [],
      sourceContexts: { [child.id]: { scope: child.scope, capturedAt: exportTimestamp, sources: [{ id: fixture.parent.components[0].id, name: 'Source', description: null, type: 'person' }] } } };
    expect(htmlExportSourceSchema.parse(input).sourceContexts[child.id].sources).toHaveLength(1);
  });
  it.each([
    ['entry UUID', (input: ReturnType<typeof source>) => { input.entryDiagramId = 'invalid'; }],
    ['capture date', (input: ReturnType<typeof source>) => { input.sourceCapturedAt = 'yesterday'; }],
    ['empty members', (input: ReturnType<typeof source>) => { input.diagrams = []; }],
    ['summary ADR', (input: ReturnType<typeof source>) => { Object.assign(input.diagrams[0].adrs, { 0: { id: input.diagrams[0].adrs[0].id, title: 'Summary', status: 'accepted' } }); }],
    ['missing nullable ADR field', (input: ReturnType<typeof source>) => { delete (input.diagrams[0].adrs[0] as Partial<ArchitectureDecisionRecord>).alternativesOrConstraints; }],
    ['ADR UUID', (input: ReturnType<typeof source>) => { input.diagrams[0].adrs[0].componentIds = ['invalid']; }],
    ['ADR date', (input: ReturnType<typeof source>) => { input.diagrams[0].adrs[0].updatedAt = 'invalid'; }],
    ['diagram date', (input: ReturnType<typeof source>) => { input.diagrams[0].diagram.updatedAt = 'invalid'; }],
    ['member geometry', (input: ReturnType<typeof source>) => { (input.diagrams[1].diagram.boundary!).size.width = -1; }],
    ['availability', (input: ReturnType<typeof source>) => { Object.assign(input.availability[0], { availability: 'unknown' }); }],
    ['context shape', (input: ReturnType<typeof source>) => { Object.assign(input.sourceContexts, { [input.entryDiagramId]: { scope: {}, sources: [], capturedAt: exportTimestamp } }); }],
    ['extra root field', (input: ReturnType<typeof source>) => { Object.assign(input, { partial: true }); }],
  ])('rejects malformed %s', (_name, mutate) => {
    const input = source(); mutate(input);
    expect(htmlExportSourceSchema.safeParse(input).success).toBe(false);
  });
  it('leaves aggregate membership and local reference integrity to graph validation', () => {
    const input = source();
    input.diagrams[0].adrs[0].componentIds = [input.diagrams[1].diagram.id];
    input.diagrams.push(structuredClone(input.diagrams[0]));
    expect(htmlExportSourceSchema.safeParse(input).success).toBe(true);
  });
});
