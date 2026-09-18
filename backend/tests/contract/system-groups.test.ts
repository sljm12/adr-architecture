import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildApp } from '../../src/api/app';

const component = (id: string, diagramId: string, name: string, type: 'person' | 'software-system', x: number, y: number, timestamp: string) => ({ id, diagramId, name, description: null, type, position: { x, y }, createdAt: timestamp, updatedAt: timestamp });

describe('C4 system group API contract', () => {
  it('keeps the implementation assertions anchored to the feature contract', () => {
    const contract = readFileSync(new URL('../../../specs/003-c4-system-groups/contracts/openapi.yaml', import.meta.url), 'utf8');
    expect(contract).toContain('groups:');
    expect(contract).toContain('SystemGroup:');
    expect(contract).toContain('groupIds:');
    expect(contract).toContain("text/vnd.mermaid");
  });

  it('always returns groups and accepts typed C4 components and a valid group', async () => {
    const app = buildApp(); await app.ready();
    const created = await app.inject({ method: 'POST', url: '/diagrams', payload: { name: 'Payments' } });
    const document = created.json();
    expect(document.groups).toEqual([]);
    const first = '00000000-0000-0000-0000-000000000201';
    const second = '00000000-0000-0000-0000-000000000202';
    const group = '00000000-0000-0000-0000-000000000203';
    const payload = {
      ...document,
      components: [component(first, document.id, 'Checkout', 'software-system', 100, 100, document.createdAt), component(second, document.id, 'Ledger', 'software-system', 340, 180, document.createdAt)],
      relationships: [],
      groups: [{ id: group, diagramId: document.id, name: ' Finance ', memberComponentIds: [first, second], position: { x: 68, y: 44 }, size: { width: 484, height: 240 }, createdAt: document.createdAt, updatedAt: document.createdAt }],
    };
    const saved = await app.inject({ method: 'PUT', url: `/diagrams/${document.id}`, payload });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().groups).toEqual([expect.objectContaining({ id: group, name: 'Finance', memberComponentIds: [first, second] })]);
    expect(saved.json().components).toEqual(expect.arrayContaining([expect.objectContaining({ id: first, type: 'software-system' })]));
    const exported = await app.inject({ method: 'GET', url: `/diagrams/${document.id}/export/mermaid` });
    expect(exported.statusCode).toBe(200);
    expect(exported.headers['content-type']).toContain('text/vnd.mermaid');
    await app.close();
  });

  it('returns field-addressable errors and blocks deletion of grouped components', async () => {
    const app = buildApp(); await app.ready();
    const created = await app.inject({ method: 'POST', url: '/diagrams', payload: { name: 'Validation' } });
    const document = created.json();
    const first = '00000000-0000-0000-0000-000000000211';
    const second = '00000000-0000-0000-0000-000000000212';
    const group = '00000000-0000-0000-0000-000000000213';
    const components = [component(first, document.id, 'Checkout', 'software-system', 100, 100, document.createdAt), component(second, document.id, 'Ledger', 'software-system', 340, 180, document.createdAt)];
    const valid = { ...document, components, relationships: [], groups: [{ id: group, diagramId: document.id, name: 'Finance', memberComponentIds: [first, second], position: { x: 68, y: 44 }, size: { width: 484, height: 240 }, createdAt: document.createdAt, updatedAt: document.createdAt }] };
    expect((await app.inject({ method: 'PUT', url: `/diagrams/${document.id}`, payload: { ...valid, groups: [{ ...valid.groups[0], memberComponentIds: [first] }] } })).statusCode).toBe(422);
    const invalid = await app.inject({ method: 'PUT', url: `/diagrams/${document.id}`, payload: { ...valid, groups: [{ ...valid.groups[0], name: '   ' }] } });
    expect(invalid.statusCode).toBe(422);
    expect(invalid.json()).toMatchObject({ fields: expect.objectContaining({ 'groups[0].name': expect.any(String) }) });
    expect((await app.inject({ method: 'PUT', url: `/diagrams/${document.id}`, payload: valid })).statusCode).toBe(200);
    const blocked = await app.inject({ method: 'DELETE', url: `/diagrams/${document.id}/components/${first}` });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json()).toMatchObject({ componentId: first, groupIds: [group] });
    await app.close();
  });
});
