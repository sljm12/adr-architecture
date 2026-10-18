import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { archiveFixture, archiveFieldInventory, emptyArchiveFixture } from './archive-fixtures';
import { ArchiveValidationError, parseArchive, archiveSchema, archiveImportRequestSchema, archiveTimestampSchema, archiveScalarSchema, archiveRevisionSchema } from '../src/archive/validation';

describe('archive preservation boundary', () => {
  it('distinguishes the depth boundary from schema rejection and never leaks rejected values', () => {
    for (const depth of [64, 65]) {
      try { parseArchive('['.repeat(depth) + '0' + ']'.repeat(depth)); throw new Error('Accepted invalid schema'); }
      catch (error) {
        expect(error).toBeInstanceOf(ArchiveValidationError);
        expect((error as Error).message).toMatch(depth === 65 ? /nesting/i : /structure|field|invalid/i);
      }
    }
    const fixture = emptyArchiveFixture(); fixture.records.diagrams[0].name = '\ud800';
    expect(() => parseArchive(JSON.stringify(fixture))).toThrow();
  });
  it('retains repeated values and escaped keys while rejecting malformed duplicate keys', () => {
    const fixture = emptyArchiveFixture();
    fixture.records.diagrams[0].name = 'same';
    const text = JSON.stringify(fixture).replace('"name"', '"na\\u006de"');
    expect(parseArchive(text)).toEqual(fixture);
    for (const duplicate of ['"name":"same","name":"same"', '"name":"same","na\\u006de":"same"']) {
      expect(() => parseArchive(JSON.stringify(fixture).replace('"name":"same"', duplicate))).toThrow(/duplicate/i);
    }
    for (const text of ['{"a":', '{"a":1,}', '{"a":"\\x00"}', '{"a":01}', '{"a":true false}']) expect(() => parseArchive(text)).toThrow();
  });
  it('reports field paths without normalizing invalid primitives', () => {
    for (const [field, value] of [['createdAt', '2023-02-29T00:00:00.000000Z'], ['deletionRevision', '9223372036854775808'], ['scopeX', 'Infinity']] as const) {
      const fixture = emptyArchiveFixture(); Object.assign(fixture.records.diagrams[0], { [field]: value });
      try { parseArchive(JSON.stringify(fixture)); throw new Error('Accepted invalid primitive'); }
      catch (error) { expect(error).toBeInstanceOf(ArchiveValidationError); expect((error as ArchiveValidationError).issues?.some(issue => issue.path.includes(field))).toBe(true); }
    }
  });
  it('covers exactly the 69 contract fields without an encoder-derived expectation', () => {
    const contract = JSON.parse(readFileSync('specs/013-diagram-archive-transfer/contracts/archive.schema.json', 'utf8'));
    const names = ['diagram','component','relationship','systemGroup','systemGroupMember','adr','adrComponentLink','adrRelationshipLink'];
    expect(Object.values(archiveFieldInventory).flat()).toHaveLength(69);
    Object.values(archiveFieldInventory).forEach((fields, i) => expect([...fields]).toEqual(contract.$defs[names[i]].required));
    expect(parseArchive(JSON.stringify(archiveFixture()))).toEqual(archiveFixture());
    expect(parseArchive(JSON.stringify(emptyArchiveFixture()))).toEqual(emptyArchiveFixture());
  });
  it('requires every field, including nullable columns, and rejects unknown fields', () => {
    for (const [collection, fields] of Object.entries(archiveFieldInventory)) for (const field of fields) {
      const fixture = archiveFixture(); const row = fixture.records[collection as keyof typeof fixture.records][0];
      delete (row as unknown as Record<string, unknown>)[field];
      expect(archiveSchema.safeParse(fixture).success, `${collection}.${field}`).toBe(false);
    }
    expect(() => parseArchive(JSON.stringify({ ...emptyArchiveFixture(), extra: true }))).toThrow();
    expect(() => parseArchive(JSON.stringify({ ...emptyArchiveFixture(), version: 2 }))).toThrow(/version/i);
  });
  it.each(['0001-01-01T00:00:00.000000Z','2000-02-29T23:59:59.999999Z', '9999-12-31T23:59:59.000001Z'])('retains valid calendar time %s', value => expect(archiveTimestampSchema.parse(value)).toBe(value));
  it.each(['0000-01-01T00:00:00.000000Z','1900-02-29T00:00:00.000000Z','2024-04-31T00:00:00.000000Z','2024-01-01T24:00:00.000000Z','2024-01-01T00:00:60.000000Z','2024-01-01T00:00:00.123Z'])('rejects invalid time %s', value => expect(archiveTimestampSchema.safeParse(value).success).toBe(false));
  it.each(['-0','0','5e-324','1.7976931348623157e+308','0.30000000000000004'])('retains canonical finite binary64 %s', value => expect(archiveScalarSchema.parse(value)).toBe(value));
  it.each(['NaN','Infinity','-Infinity','1.0','01','1e3','1e+309','-0.0','1e-324'])('rejects noncanonical layout %s', value => expect(archiveScalarSchema.safeParse(value).success).toBe(false));
  it('keeps bigint precision and range', () => {
    for (const value of ['0','9007199254740993','9223372036854775807']) expect(archiveRevisionSchema.parse(value)).toBe(value);
    for (const value of ['-1','01','9223372036854775808',9007199254740992]) expect(archiveRevisionSchema.safeParse(value).success).toBe(false);
  });
  it('rejects zero or negative dimensions', () => {
    const fixture = archiveFixture(); fixture.records.components[0].width = '-0';
    expect(() => parseArchive(JSON.stringify(fixture))).toThrow();
  });
  it('lexes duplicate decoded object keys, escaped values, invalid Unicode, depth and byte limits', () => {
    const text = JSON.stringify(emptyArchiveFixture());
    expect(() => parseArchive(text.replace('"version":1', '"version":1,"vers\\u0069on":1'))).toThrow(/duplicate/i);
    for (const value of ['\uFEFF'+text,text.replace('Architecture', '\u0000'),text.replace('Architecture', '\\ud800'), '['.repeat(65)+'0'+']'.repeat(65), ' '.repeat(8388609)]) expect(() => parseArchive(value)).toThrow();
    const fixture = emptyArchiveFixture(); fixture.records.diagrams[0].name = ' repeated "escaped" \\ 世界 ';
    expect(parseArchive(JSON.stringify(fixture))).toEqual(fixture);
    expect(() => parseArchive('{"x": [true, false, null, 1e-2], "y": {"x": "x"}}')).toThrow();
  });
  it('keeps HTTP envelopes strict without coercion/defaults', () => {
    expect(archiveImportRequestSchema.safeParse({ archiveText: '{}' }).success).toBe(false);
  });
});
