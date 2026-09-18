import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api/app';
import { createDatabase } from '../../src/persistence/database';
import { PostgresAdrRepository } from '../../src/persistence/adr-repository';
import { PostgresDiagramRepository } from '../../src/persistence/diagram-repository';

const enabled = Boolean(process.env.DATABASE_URL);

describe.skipIf(!enabled)('PostgreSQL quickstart acceptance scenarios', () => {
  const database = enabled ? createDatabase(process.env.DATABASE_URL!) : undefined;

  afterAll(async () => {
    await database?.pool.end();
  });

  it('executes scenarios 1 through 10 against migrated PostgreSQL data', async () => {
    const runId = crypto.randomUUID();
    await cleanupPrefix(database!.pool, '__T096_ACCEPTANCE__');
    const app = buildApp(
      new PostgresDiagramRepository(database!.db),
      new PostgresAdrRepository(database!.db),
    );
    await app.ready();

    const firstDiagram = (await app.inject({ method: 'POST', url: '/diagrams', payload: { name: `__T096_ACCEPTANCE__${runId}` } })).json();
    const secondDiagram = (await app.inject({ method: 'POST', url: '/diagrams', payload: { name: `__T096_ACCEPTANCE_OTHER__${runId}` } })).json();
    const componentA = crypto.randomUUID();
    const componentB = crypto.randomUUID();
    const componentC = crypto.randomUUID();
    const externalComponent = crypto.randomUUID();
    const externalComponentB = crypto.randomUUID();
    const relationshipOne = crypto.randomUUID();
    const relationshipTwo = crypto.randomUUID();
    const externalRelationship = crypto.randomUUID();
    const timestamp = firstDiagram.createdAt;
    const component = (id: string, diagramId: string, name: string) => ({
      id, diagramId, name, description: null, type: 'service', position: { x: 0, y: 0 },
      createdAt: timestamp, updatedAt: timestamp,
    });
    const relationship = (id: string, diagramId: string, sourceComponentId: string, targetComponentId: string, label: string) => ({
      id, diagramId, sourceComponentId, targetComponentId, direction: 'directed' as const, label,
      createdAt: timestamp, updatedAt: timestamp,
    });
    const firstDocument = {
      ...firstDiagram,
      components: [component(componentA, firstDiagram.id, 'API'), component(componentB, firstDiagram.id, 'Database'), component(componentC, firstDiagram.id, 'Unlinked worker')],
      relationships: [
        relationship(relationshipOne, firstDiagram.id, componentA, componentB, 'queries'),
        relationship(relationshipTwo, firstDiagram.id, componentC, componentB, 'publishes'),
      ],
    };
    const secondDocument = {
      ...secondDiagram,
      components: [component(externalComponent, secondDiagram.id, 'External API'), component(externalComponentB, secondDiagram.id, 'External DB')],
      relationships: [relationship(externalRelationship, secondDiagram.id, externalComponent, externalComponentB, 'external')],
    };

    const createdFirst = await app.inject({ method: 'PUT', url: `/diagrams/${firstDiagram.id}`, payload: firstDocument });
    const createdSecond = await app.inject({ method: 'PUT', url: `/diagrams/${secondDiagram.id}`, payload: secondDocument });
    expect(createdFirst.statusCode).toBe(200);
    expect(createdSecond.statusCode).toBe(200);

    const completePayload = {
      title: 'Use an explicit service boundary',
      context: 'The system needs an explicit boundary for external calls.',
      decision: 'Route external calls through the service boundary.',
      consequences: 'The service owns retries and provider integration.',
      alternativesOrConstraints: 'Keep the provider adapter replaceable.',
      status: 'draft' as const,
      replacementAdrId: null,
    };

    // 1–2: create/reopen and validate each required field independently.
    const created = await app.inject({ method: 'POST', url: `/diagrams/${firstDiagram.id}/adrs`, payload: completePayload });
    expect(created.statusCode).toBe(201);
    const adr = created.json();
    const reopened = await app.inject({ method: 'GET', url: `/adrs/${adr.id}` });
    expect(reopened.statusCode).toBe(200);
    expect(reopened.json()).toMatchObject({ id: adr.id, diagramId: firstDiagram.id, ...completePayload, createdAt: expect.any(String), updatedAt: expect.any(String) });
    const baselineIds = (await app.inject({ method: 'GET', url: `/diagrams/${firstDiagram.id}/adrs` })).json().map((item: { id: string }) => item.id);
    for (const field of ['title', 'context', 'decision', 'consequences']) {
      const invalid = await app.inject({ method: 'POST', url: `/diagrams/${firstDiagram.id}/adrs`, payload: { ...completePayload, [field]: '' } });
      expect(invalid.statusCode).toBe(422);
      expect(invalid.json().fields[field]).toEqual(expect.any(String));
    }
    expect((await app.inject({ method: 'GET', url: `/diagrams/${firstDiagram.id}/adrs` })).json().map((item: { id: string }) => item.id)).toEqual(baselineIds);

    // 3: zero, one, and multiple links; unlinking one preserves the other link of each type.
    expect(adr.componentIds).toEqual([]);
    const multipleLinks = await app.inject({ method: 'PUT', url: `/adrs/${adr.id}/components`, payload: { componentIds: [componentA, componentB] } });
    expect(multipleLinks.statusCode).toBe(200);
    const multipleRelationshipLinks = await app.inject({ method: 'PUT', url: `/adrs/${adr.id}/relationships`, payload: { relationshipIds: [relationshipOne, relationshipTwo] } });
    expect(multipleRelationshipLinks.statusCode).toBe(200);
    const partialLinks = await app.inject({ method: 'PUT', url: `/adrs/${adr.id}/components`, payload: { componentIds: [componentA] } });
    const partialRelationshipLinks = await app.inject({ method: 'PUT', url: `/adrs/${adr.id}/relationships`, payload: { relationshipIds: [relationshipOne] } });
    expect(partialLinks.json().componentIds).toEqual([componentA]);
    expect(partialRelationshipLinks.json().relationshipIds).toEqual([relationshipOne]);

    // 4–6: stable IDs survive edits, and linked/unlinked summaries are distinct.
    const editedDocument = (await app.inject({ method: 'GET', url: `/diagrams/${firstDiagram.id}` })).json();
    editedDocument.components = editedDocument.components.map((item: typeof firstDocument.components[number]) => item.id === componentA ? { ...item, name: 'Gateway' } : item);
    editedDocument.relationships = editedDocument.relationships.map((item: typeof firstDocument.relationships[number]) => item.id === relationshipOne ? { ...item, sourceComponentId: componentB, targetComponentId: componentA, direction: 'undirected', label: 'publishes events' } : item);
    const edited = await app.inject({ method: 'PUT', url: `/diagrams/${firstDiagram.id}`, payload: editedDocument });
    expect(edited.statusCode).toBe(200);
    expect(edited.json().components).toEqual(expect.arrayContaining([expect.objectContaining({ id: componentA, name: 'Gateway' })]));
    expect(edited.json().relationships).toEqual(expect.arrayContaining([expect.objectContaining({ id: relationshipOne, sourceComponentId: componentB, targetComponentId: componentA, direction: 'undirected', label: 'publishes events' })]));
    const componentSummary = await app.inject({ method: 'GET', url: `/diagrams/${firstDiagram.id}/components/${componentA}/adrs` });
    const relationshipSummary = await app.inject({ method: 'GET', url: `/diagrams/${firstDiagram.id}/relationships/${relationshipOne}/adrs` });
    expect(componentSummary.json()).toEqual([expect.objectContaining({ id: adr.id, title: completePayload.title, status: 'draft' })]);
    expect(relationshipSummary.json()).toEqual([expect.objectContaining({ id: adr.id, title: completePayload.title, status: 'draft' })]);
    expect((await app.inject({ method: 'GET', url: `/diagrams/${firstDiagram.id}/components/${componentC}/adrs` })).json()).toEqual([]);
    expect((await app.inject({ method: 'GET', url: `/diagrams/${firstDiagram.id}/relationships/${relationshipTwo}/adrs` })).json()).toEqual([]);

    // 7: missing and cross-diagram links are rejected without changing existing links.
    for (const [path, payload, field] of [
      [`/adrs/${adr.id}/components`, { componentIds: [externalComponent] }, 'componentIds'],
      [`/adrs/${adr.id}/components`, { componentIds: [crypto.randomUUID()] }, 'componentIds'],
      [`/adrs/${adr.id}/relationships`, { relationshipIds: [externalRelationship] }, 'relationshipIds'],
      [`/adrs/${adr.id}/relationships`, { relationshipIds: [crypto.randomUUID()] }, 'relationshipIds'],
    ] as const) {
      const invalid = await app.inject({ method: 'PUT', url: path, payload });
      expect(invalid.statusCode).toBe(422);
      expect(invalid.json().fields[field]).toEqual(expect.any(String));
    }
    expect((await app.inject({ method: 'GET', url: `/adrs/${adr.id}` })).json()).toMatchObject({ componentIds: [componentA], relationshipIds: [relationshipOne] });

    // 8: linked artifact deletion is blocked until both links are repaired.
    const blockedRelationship = await app.inject({ method: 'DELETE', url: `/diagrams/${firstDiagram.id}/relationships/${relationshipOne}` });
    expect(blockedRelationship.statusCode).toBe(409);
    expect(blockedRelationship.json().blockers).toEqual([expect.objectContaining({ adrId: adr.id, title: completePayload.title })]);
    const blockedComponent = await app.inject({ method: 'DELETE', url: `/diagrams/${firstDiagram.id}/components/${componentA}` });
    expect(blockedComponent.statusCode).toBe(409);
    expect(blockedComponent.json().blockers).toEqual([expect.objectContaining({ adrId: adr.id, title: completePayload.title })]);
    await app.inject({ method: 'PUT', url: `/adrs/${adr.id}/components`, payload: { componentIds: [] } });
    await app.inject({ method: 'PUT', url: `/adrs/${adr.id}/relationships`, payload: { relationshipIds: [] } });
    expect((await app.inject({ method: 'DELETE', url: `/diagrams/${firstDiagram.id}/relationships/${relationshipOne}` })).statusCode).toBe(200);
    expect((await app.inject({ method: 'DELETE', url: `/diagrams/${firstDiagram.id}/components/${componentA}` })).statusCode).toBe(200);

    // 9: superseded ADRs require a same-diagram replacement and remain discoverable.
    const replacement = (await app.inject({ method: 'POST', url: `/diagrams/${firstDiagram.id}/adrs`, payload: { ...completePayload, title: 'Use the replacement boundary', status: 'accepted' } })).json();
    const invalidSuperseded = await app.inject({ method: 'PATCH', url: `/adrs/${adr.id}`, payload: { ...completePayload, status: 'superseded', replacementAdrId: null } });
    expect(invalidSuperseded.statusCode).toBe(422);
    const superseded = await app.inject({ method: 'PATCH', url: `/adrs/${adr.id}`, payload: { ...completePayload, status: 'superseded', replacementAdrId: replacement.id } });
    expect(superseded.statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: `/diagrams/${firstDiagram.id}/adrs` })).json()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: adr.id, status: 'superseded' }),
      expect.objectContaining({ id: replacement.id, status: 'accepted' }),
    ]));
    expect((await app.inject({ method: 'GET', url: `/adrs/${adr.id}` })).json()).toMatchObject({ replacementAdrId: replacement.id });

    // 10: replacement deletion is blocked; deleting an ADR with both link types cleans up links.
    const blockedReplacement = await app.inject({ method: 'DELETE', url: `/adrs/${replacement.id}` });
    expect(blockedReplacement.statusCode).toBe(409);
    expect(blockedReplacement.json().blockers).toEqual([expect.objectContaining({ adrId: adr.id, title: completePayload.title })]);
    const linkedAdr = (await app.inject({ method: 'POST', url: `/diagrams/${firstDiagram.id}/adrs`, payload: completePayload })).json();
    await app.inject({ method: 'PUT', url: `/adrs/${linkedAdr.id}/components`, payload: { componentIds: [componentC] } });
    await app.inject({ method: 'PUT', url: `/adrs/${linkedAdr.id}/relationships`, payload: { relationshipIds: [relationshipTwo] } });
    expect((await app.inject({ method: 'DELETE', url: `/adrs/${linkedAdr.id}` })).statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: `/diagrams/${firstDiagram.id}/components/${componentC}/adrs` })).json()).toEqual([]);
    expect((await app.inject({ method: 'GET', url: `/diagrams/${firstDiagram.id}/relationships/${relationshipTwo}/adrs` })).json()).toEqual([]);
    await app.inject({ method: 'PATCH', url: `/adrs/${adr.id}`, payload: { ...completePayload, status: 'rejected', replacementAdrId: null } });
    expect((await app.inject({ method: 'DELETE', url: `/adrs/${replacement.id}` })).statusCode).toBe(204);
    expect((await app.inject({ method: 'DELETE', url: `/adrs/${adr.id}` })).statusCode).toBe(204);

    await app.close();
    await cleanup(database!.pool, firstDiagram.id);
    await cleanup(database!.pool, secondDiagram.id);
  });
});

async function cleanup(pool: { query: (text: string, values?: unknown[]) => Promise<unknown> }, diagramId: string): Promise<void> {
  await pool.query('DELETE FROM adr_component_links WHERE adr_id IN (SELECT id FROM adrs WHERE diagram_id = $1)', [diagramId]);
  await pool.query('DELETE FROM adr_relationship_links WHERE adr_id IN (SELECT id FROM adrs WHERE diagram_id = $1)', [diagramId]);
  await pool.query('DELETE FROM adrs WHERE diagram_id = $1', [diagramId]);
  await pool.query('DELETE FROM relationships WHERE diagram_id = $1', [diagramId]);
  await pool.query('DELETE FROM components WHERE diagram_id = $1', [diagramId]);
  await pool.query('DELETE FROM diagrams WHERE id = $1', [diagramId]);
}

async function cleanupPrefix(pool: { query: (text: string, values?: unknown[]) => Promise<unknown> }, prefix: string): Promise<void> {
  const result = await pool.query('SELECT id FROM diagrams WHERE name LIKE $1', [`${prefix}%`]) as { rows: Array<{ id: string }> };
  for (const row of result.rows) await cleanup(pool, row.id);
}
