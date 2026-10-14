import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import Ajv from 'ajv';
import { expect } from 'vitest';
import { collectionImpactSchema, collectionResultSchema } from '../../../shared/src/index';

const contractPath = resolve('specs/012-cli-delete-diagrams/contracts/openapi.json');
const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
function dereference(value: unknown, path = contractPath): unknown {
  if (Array.isArray(value)) return value.map(v => dereference(v, path));
  if (!value || typeof value !== 'object') return value;
  if ('$ref' in value && typeof value.$ref === 'string') {
    const [file, pointer] = value.$ref.split('#');
    const target = file ? resolve(dirname(path), file) : path;
    const source = readFileSync(target, 'utf8');
    const document = target.endsWith('.yaml') ? JSON.parse(readFileSync(new URL('./diagram-deletion-summary-contract.json', import.meta.url), 'utf8')) : JSON.parse(source);
    if (target.endsWith('.yaml')) expect(createHash('sha256').update(source).digest('hex')).toBe(document.sourceSha256);
    return dereference(pointer.split('/').slice(1).reduce((v: unknown, key: string) => (v as Record<string, unknown>)[key], document), target);
  }
  return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, dereference(v, path)]));
}
const ajv = new Ajv({ strict: false, validateFormats: false });
export function validateCollectionContract(name: string, body: unknown) {
  const check = ajv.compile(dereference(contract.components.schemas[name]) as object);
  expect(check(body), JSON.stringify(check.errors)).toBe(true);
  if (name === 'CollectionImpact') collectionImpactSchema.parse(body);
  if (name === 'CollectionResult') collectionResultSchema.parse(body);
}
