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

  it('accepts a complete-document PUT that adds an existing component to an existing group', async () => {
    const app = buildApp(); await app.ready();
    const created = await app.inject({ method: 'POST', url: '/diagrams', payload: { name: 'Add member' } });
    const document = created.json();
    const first = '00000000-0000-0000-0000-000000000221';
    const second = '00000000-0000-0000-0000-000000000222';
    const outside = '00000000-0000-0000-0000-000000000223';
    const group = '00000000-0000-0000-0000-000000000224';
    const initial = {
      ...document,
      components: [component(first, document.id, 'Checkout', 'software-system', 100, 100, document.createdAt), component(second, document.id, 'Ledger', 'software-system', 340, 180, document.createdAt), component(outside, document.id, 'Notifications', 'software-system', 620, 260, document.createdAt)],
      relationships: [],
      groups: [{ id: group, diagramId: document.id, name: 'Platform', memberComponentIds: [first, second], position: { x: 68, y: 44 }, size: { width: 484, height: 240 }, createdAt: document.createdAt, updatedAt: document.createdAt }],
    };
    expect((await app.inject({ method: 'PUT', url: `/diagrams/${document.id}`, payload: initial })).statusCode).toBe(200);
    const added = await app.inject({ method: 'PUT', url: `/diagrams/${document.id}`, payload: { ...initial, groups: [{ ...initial.groups[0], memberComponentIds: [first, second, outside], position: { x: 68, y: 44 }, size: { width: 764, height: 320 } }] } });
    expect(added.statusCode).toBe(200);
    expect(added.json().groups[0]).toMatchObject({ id: group, memberComponentIds: [first, second, outside] });
    expect(added.json().components).toEqual(expect.arrayContaining([expect.objectContaining({ id: outside, name: 'Notifications' })]));
    await app.close();
  });

  it('returns 422 and preserves the stored document for duplicate, conflicting, ineligible, and invalid-boundary memberships', async () => {
    const app = buildApp(); await app.ready();
    const created = await app.inject({ method: 'POST', url: '/diagrams', payload: { name: 'Rejected memberships' } });
    const document = created.json();
    const first = '00000000-0000-0000-0000-000000000231';
    const second = '00000000-0000-0000-0000-000000000232';
    const outside = '00000000-0000-0000-0000-000000000233';
    const fourth = '00000000-0000-0000-0000-000000000234';
    const person = '00000000-0000-0000-0000-000000000235';
    const targetGroup = '00000000-0000-0000-0000-000000000236';
    const currentGroup = '00000000-0000-0000-0000-000000000237';
    const initial = {
      ...document,
      components: [
        component(first, document.id, 'Billing', 'software-system', 100, 100, document.createdAt),
        component(second, document.id, 'Ledger', 'software-system', 340, 180, document.createdAt),
        component(outside, document.id, 'Reporting', 'software-system', 620, 260, document.createdAt),
        component(fourth, document.id, 'Support', 'software-system', 860, 340, document.createdAt),
        component(person, document.id, 'Operator', 'person', 20, 20, document.createdAt),
      ],
      relationships: [],
      groups: [
        { id: targetGroup, diagramId: document.id, name: 'Platform', memberComponentIds: [first, second], position: { x: 68, y: 44 }, size: { width: 484, height: 240 }, createdAt: document.createdAt, updatedAt: document.createdAt },
        { id: currentGroup, diagramId: document.id, name: 'Operations', memberComponentIds: [outside, fourth], position: { x: 588, y: 204 }, size: { width: 484, height: 240 }, createdAt: document.createdAt, updatedAt: document.createdAt },
      ],
    };
    expect((await app.inject({ method: 'PUT', url: `/diagrams/${document.id}`, payload: initial })).statusCode).toBe(200);
    const stored = (await app.inject({ method: 'GET', url: `/diagrams/${document.id}` })).json();
    const invalidDocuments = [
      { ...initial, groups: [{ ...initial.groups[0], memberComponentIds: [first, second, first] }, initial.groups[1]] },
      { ...initial, groups: [{ ...initial.groups[0], memberComponentIds: [first, second, outside] }, initial.groups[1]] },
      { ...initial, groups: [{ ...initial.groups[0], memberComponentIds: [first, second, person] }, initial.groups[1]] },
      { ...initial, groups: [{ ...initial.groups[0], size: { width: 100, height: 100 } }, initial.groups[1]] },
    ];
    for (const invalid of invalidDocuments) {
      expect((await app.inject({ method: 'PUT', url: `/diagrams/${document.id}`, payload: invalid })).statusCode).toBe(422);
      expect((await app.inject({ method: 'GET', url: `/diagrams/${document.id}` })).json()).toEqual(stored);
    }
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
