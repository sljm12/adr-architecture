import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import { createDatabase } from '../../src/persistence/database';
import { PostgresDiagramRepository } from '../../src/persistence/diagram-repository';

const cleanupPostgresDiagram = async (pool: { query: (text: string, values?: unknown[]) => Promise<unknown> }, id: string) => {
  await pool.query('DELETE FROM relationships WHERE diagram_id = $1', [id]);
  await pool.query('DELETE FROM components WHERE diagram_id = $1', [id]);
  await pool.query('DELETE FROM diagrams WHERE id = $1', [id]);
};

describe('diagram API', () => it('creates and reopens a diagram', async () => {
  const app = buildApp(); await app.ready();
  const created = await app.inject({ method: 'POST', url: '/diagrams', payload: { name: 'System' } });
  expect(created.statusCode).toBe(201);
  const body = created.json();
  const reopened = await app.inject({ method: 'GET', url: `/diagrams/${body.id}` });
  expect(reopened.statusCode).toBe(200); expect(reopened.json().id).toBe(body.id);
  await app.close();
}));

describe('saved-document API', () => it('lists active summaries, excludes trashed documents, and loads by stable ID', async () => {
  const app = buildApp(); await app.ready();
  const first = await app.inject({ method: 'POST', url: '/diagrams', payload: { name: 'System' } });
  const second = await app.inject({ method: 'POST', url: '/diagrams', payload: { name: 'System' } });
  await app.inject({ method: 'DELETE', url: `/diagrams/${second.json().id}` });

  const listed = await app.inject({ method: 'GET', url: '/diagrams' });
  expect(listed.statusCode).toBe(200);
  expect(listed.json()).toEqual([expect.objectContaining({ id: first.json().id, name: 'System', status: 'active', updatedAt: expect.any(String) })]);
  expect(listed.json()[0]).not.toHaveProperty('components');

  const loaded = await app.inject({ method: 'GET', url: `/diagrams/${first.json().id}` });
  expect(loaded.statusCode).toBe(200);
  expect(loaded.json()).toMatchObject({ id: first.json().id, name: 'System' });
  await app.close();
}));

describe('saved-document API', () => it('returns an empty list when no active documents exist', async () => {
  const app = buildApp(); await app.ready();
  const listed = await app.inject({ method: 'GET', url: '/diagrams' });
  expect(listed.statusCode).toBe(200);
  expect(listed.json()).toEqual([]);
  await app.close();
}));

describe.skipIf(!process.env.DATABASE_URL)('PostgreSQL diagram API', () => it('persists through POST/PUT and loads through GET from a fresh API instance', async () => {
  const first = createDatabase(process.env.DATABASE_URL!);
  const firstApp = buildApp(new PostgresDiagramRepository(first.db)); await firstApp.ready();
  const created = await firstApp.inject({ method: 'POST', url: '/diagrams', payload: { name: 'System' } });
  expect(created.statusCode).toBe(201);
  const document = created.json();
  const componentA = crypto.randomUUID();
  const componentB = crypto.randomUUID();
  const relationshipId = crypto.randomUUID();
  document.components = [
    { id: componentA, diagramId: document.id, name: 'API', description: null, type: 'service', position: { x: 12, y: 34 }, createdAt: document.createdAt, updatedAt: document.updatedAt },
    { id: componentB, diagramId: document.id, name: 'DB', description: null, type: 'store', position: { x: 56, y: 78 }, createdAt: document.createdAt, updatedAt: document.updatedAt },
  ];
  document.relationships = [{ id: relationshipId, diagramId: document.id, sourceComponentId: componentA, targetComponentId: componentB, direction: 'undirected', label: 'reads and writes', createdAt: document.createdAt, updatedAt: document.updatedAt }];
  const saved = await firstApp.inject({ method: 'PUT', url: `/diagrams/${document.id}`, payload: document });
  expect(saved.statusCode).toBe(200);
  await firstApp.close();

  const second = createDatabase(process.env.DATABASE_URL!);
  const secondApp = buildApp(new PostgresDiagramRepository(second.db)); await secondApp.ready();
  const reopened = await secondApp.inject({ method: 'GET', url: `/diagrams/${document.id}` });
  expect(reopened.statusCode).toBe(200);
  expect(reopened.json()).toMatchObject({ id: document.id, name: 'System' });
  expect(reopened.json().components).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: componentA, name: 'API', position: { x: 12, y: 34 } }),
    expect.objectContaining({ id: componentB, name: 'DB', position: { x: 56, y: 78 } }),
  ]));
  expect(reopened.json().relationships).toEqual([expect.objectContaining({
    id: relationshipId, sourceComponentId: componentA,
    targetComponentId: componentB, direction: 'undirected', label: 'reads and writes',
  })]);
  await secondApp.close(); await cleanupPostgresDiagram(first.pool, document.id); await first.pool.end(); await second.pool.end();
}));
