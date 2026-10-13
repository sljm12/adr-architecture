import { describe, expect, it } from 'vitest';
import { collectionTargetSchema, collectionPreviewSchema, collectionConfirmationSchema, collectionImpactSchema, collectionResultSchema, deletionResultSchema } from '../src/index';
import { componentContextFixture, componentParentFixture, populatedComponentFixture } from './component-fixtures';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import Ajv from 'ajv';

const affectedDiagrams = [componentContextFixture(), componentParentFixture(), populatedComponentFixture()].map(d => ({ id: d.id, name: d.name, kind: d.kind, scope: d.scope ?? null, status: d.status, createdAt: d.createdAt, updatedAt: d.updatedAt }));
const target = { kind: 'all-matches', name: affectedDiagrams[0].name, mode: 'trash' };
const roots = [affectedDiagrams[0].id];
const token = 'a'.repeat(64);
const result = { target, mode: 'trash', rootDiagramIds: roots, affectedDiagrams, affectedCount: 3 };
describe('strict collection deletion boundaries', () => {
  it('validates parsed boundaries against the OpenAPI collection definitions', () => {
    const path = resolve('specs/012-cli-delete-diagrams/contracts/openapi.json');
    const dereference = (value: any, source = path): any => {
      if (Array.isArray(value)) return value.map(v => dereference(v, source));
      if (!value || typeof value !== 'object') return value;
      if (value.$ref) {
        const [file, pointer] = value.$ref.split('#'); const targetPath = file ? resolve(dirname(source), file) : source;
        const text = readFileSync(targetPath, 'utf8');
        const document = targetPath.endsWith('.yaml') ? JSON.parse(readFileSync(resolve('backend/tests/contract/diagram-deletion-summary-contract.json'), 'utf8')) : JSON.parse(text);
        if (targetPath.endsWith('.yaml')) expect(createHash('sha256').update(text).digest('hex')).toBe(document.sourceSha256);
        return dereference(pointer.split('/').slice(1).reduce((v: any, key: string) => v[key], document), targetPath);
      }
      return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, dereference(v, source)]));
    };
    const contract = JSON.parse(readFileSync(path, 'utf8'));
    const ajv = new Ajv({ strict: false, validateFormats: false });
    for (const action of [target, { kind: 'clear-trash' }]) {
      const impact = action.kind === 'clear-trash' ? { target: action, mode: 'permanent', rootDiagramIds: [], affectedDiagrams: [], affectedCount: 0 } : result;
      const boundaries = {
        CollectionTarget: collectionTargetSchema.parse(action),
        CollectionPreview: collectionPreviewSchema.parse({ target: action }),
        CollectionConfirmation: collectionConfirmationSchema.parse({ target: action, rootDiagramIds: impact.rootDiagramIds, confirmationToken: token }),
        CollectionImpact: collectionImpactSchema.parse({ ...impact, confirmationToken: token }),
        CollectionResult: collectionResultSchema.parse(impact),
      };
      for (const [name, boundary] of Object.entries(boundaries)) {
        const check = ajv.compile(dereference(contract.components.schemas[name]));
        expect(check(boundary), JSON.stringify(check.errors)).toBe(true);
      }
    }
  });
  it('preserves literal names and accepts both modes and empty Trash', () => {
    for (const mode of ['trash', 'permanent']) expect(collectionPreviewSchema.parse({ target: { ...target, name: ' Payments é ', mode } }).target.name).toBe(' Payments é ');
    const empty = { target: { kind: 'clear-trash' }, mode: 'permanent', rootDiagramIds: [], affectedDiagrams: [], affectedCount: 0 };
    expect(collectionResultSchema.parse(empty)).toEqual(empty);
    expect(collectionImpactSchema.parse({ ...empty, confirmationToken: token }).affectedCount).toBe(0);
    expect(collectionConfirmationSchema.parse({ target: empty.target, rootDiagramIds: [], confirmationToken: token }).rootDiagramIds).toEqual([]);
    expect(deletionResultSchema.parse({ rootDiagramId: roots[0], mode: 'trash', affectedDiagrams }).affectedDiagrams).toHaveLength(3);
  });
  it('requires strict targets, previews and reviewed sorted unique roots', () => {
    for (const value of [{ ...target, name: ' ' }, { ...target, id: roots[0] }, { kind: 'clear-trash', mode: 'permanent' }, { kind: 'clear-trash', name: 'x' }, { kind: 'other' }]) expect(collectionTargetSchema.safeParse(value).success).toBe(false);
    expect(collectionPreviewSchema.safeParse({ target, extra: 1 }).success).toBe(false);
    for (const rootDiagramIds of [[], [roots[0], roots[0]], ['bad'], ['f0000000-0000-4000-8000-000000000001', roots[0]]]) expect(collectionConfirmationSchema.safeParse({ target, rootDiagramIds, confirmationToken: token }).success).toBe(false);
    for (const confirmationToken of ['', 'A'.repeat(64), 'a'.repeat(63)]) expect(collectionConfirmationSchema.safeParse({ target, rootDiagramIds: roots, confirmationToken }).success).toBe(false);
    expect(collectionConfirmationSchema.safeParse({ target, rootDiagramIds: roots, confirmationToken: token, mode: 'trash' }).success).toBe(false);
  });
  it('enforces identity, count, mode, eligibility and depth/UUID order', () => {
    expect(collectionImpactSchema.parse({ ...result, confirmationToken: token }).affectedCount).toBe(3);
    const invalid = [
      { ...result, affectedCount: 2 }, { ...result, affectedCount: 3.5 }, { ...result, mode: 'permanent' },
      { ...result, extra: 1 }, { ...result, rootDiagramIds: [] },
      { ...result, rootDiagramIds: ['f0000000-0000-4000-8000-000000000001'] },
      { ...result, affectedDiagrams: [] }, { ...result, affectedDiagrams: [affectedDiagrams[0], affectedDiagrams[0], affectedDiagrams[2]] },
      { ...result, affectedDiagrams: [...affectedDiagrams].reverse() },
      { ...result, affectedDiagrams: affectedDiagrams.map(d => ({ ...d, status: 'trashed' })) },
      { ...result, affectedDiagrams: [affectedDiagrams[0], affectedDiagrams[1], { ...affectedDiagrams[2], scope: { ...affectedDiagrams[2].scope, parentDiagramId: roots[0] } }] },
      { ...result, target: { kind: 'clear-trash' }, mode: 'permanent' },
      { ...result, target: { kind: 'clear-trash' }, mode: 'permanent', rootDiagramIds: [] },
    ];
    for (const value of invalid) expect(collectionResultSchema.safeParse(value).success).toBe(false);
    const sibling = { ...affectedDiagrams[1], id: 'f0000000-0000-4000-8000-000000000001' };
    expect(collectionResultSchema.safeParse({ ...result, affectedDiagrams: [affectedDiagrams[0], sibling, affectedDiagrams[1]], affectedCount: 3 }).success).toBe(false);
    const nestedRoots = [affectedDiagrams[0].id, affectedDiagrams[1].id].sort();
    const nested = { ...result, rootDiagramIds: nestedRoots, affectedDiagrams: affectedDiagrams.map((d, i) => i === 1 ? { ...d, name: target.name } : d) };
    expect(collectionResultSchema.parse(nested).rootDiagramIds).toEqual(nestedRoots);
    expect(collectionResultSchema.safeParse({ ...nested, rootDiagramIds: roots }).success).toBe(false);
    expect(collectionResultSchema.parse({ ...result, target: { kind: 'clear-trash' }, mode: 'permanent', rootDiagramIds: [], affectedDiagrams: affectedDiagrams.map(d => ({ ...d, status: 'trashed' })) }).affectedCount).toBe(3);
  });
});
