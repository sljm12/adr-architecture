import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/api/app';
import { DiagramRepository } from '../src/persistence/diagram-repository';

describe('Mermaid export API', () => {
  it('returns Mermaid source with the expected content type', async () => {
    const repository = new DiagramRepository();
    const app = buildApp(repository);
    await app.ready();
    const created = await app.inject({ method: 'POST', url: '/diagrams', payload: { name: 'System' } });
    const document = created.json();
    document.components = [
      { id: '3f2504e0-4f89-41d3-9a0c-0305e82c3302', diagramId: document.id, name: 'API', description: null, type: null, position: { x: 0, y: 0 }, createdAt: document.createdAt, updatedAt: document.updatedAt },
      { id: '3f2504e0-4f89-41d3-9a0c-0305e82c3303', diagramId: document.id, name: 'Database', description: null, type: null, position: { x: 1, y: 1 }, createdAt: document.createdAt, updatedAt: document.updatedAt },
    ];
    document.relationships = [{ id: '3f2504e0-4f89-41d3-9a0c-0305e82c3304', diagramId: document.id, sourceComponentId: document.components[0].id, targetComponentId: document.components[1].id, direction: 'directed', label: 'queries', createdAt: document.createdAt, updatedAt: document.updatedAt }];
    repository.replace(document);

    const response = await app.inject({ method: 'GET', url: `/diagrams/${document.id}/export/mermaid` });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/vnd.mermaid');
    expect(response.headers['content-disposition']).toContain('.mmd');
    expect(response.body).toContain('flowchart TD');
    await app.close();
  });

  it('does not export an empty or missing diagram', async () => {
    const app = buildApp();
    await app.ready();
    const created = await app.inject({ method: 'POST', url: '/diagrams', payload: { name: 'Empty' } });
    const empty = await app.inject({ method: 'GET', url: `/diagrams/${created.json().id}/export/mermaid` });
    const missing = await app.inject({ method: 'GET', url: '/diagrams/3f2504e0-4f89-41d3-9a0c-0305e82c3302/export/mermaid' });
    expect(empty.statusCode).toBe(422);
    expect(empty.json().fields.document).toMatch(/component/i);
    expect(missing.statusCode).toBe(404);
    await app.close();
  });
});
