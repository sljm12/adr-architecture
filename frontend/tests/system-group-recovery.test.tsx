import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { DiagramDocument } from '../../shared/src/index';
import { DiagramApiError, diagramClient } from '../src/api/diagram-client';
import { formatComponentRemovalError } from '../src/components/RecoveryControls';
import { useDiagramStore } from '../src/state/diagram-store';

const diagramId = '00000000-0000-4000-8000-000000000601';
const firstId = '00000000-0000-4000-8000-000000000602';
const secondId = '00000000-0000-4000-8000-000000000603';
const relationshipId = '00000000-0000-4000-8000-000000000604';
const timestamp = '2026-01-01T00:00:00.000Z';
const document: DiagramDocument = {
  id: diagramId, name: 'System context', status: 'active', createdAt: timestamp, updatedAt: timestamp, trashedAt: null,
  components: [
    { id: firstId, diagramId, name: 'Checkout', description: null, type: 'software-system', position: { x: 100, y: 120 }, createdAt: timestamp, updatedAt: timestamp },
    { id: secondId, diagramId, name: 'Ledger', description: null, type: 'software-system', position: { x: 360, y: 180 }, createdAt: timestamp, updatedAt: timestamp },
  ],
  relationships: [{ id: relationshipId, diagramId, sourceComponentId: firstId, targetComponentId: secondId, direction: 'directed', label: 'posts', createdAt: timestamp, updatedAt: timestamp }],
  groups: [],
};
const otherDocument = { ...document, id: '00000000-0000-4000-8000-000000000605', name: 'Other diagram' };

afterEach(() => { vi.restoreAllMocks(); useDiagramStore.getState().open(structuredClone(document)); });

describe('system group save and recovery', () => {
  it('keeps deletion conflict feedback specific to group membership while retaining ordinary errors', () => {
    const conflict = new DiagramApiError('Component cannot be removed.', 409, { groupIds: ['group-123'] });
    expect(formatComponentRemovalError(conflict, 'Checkout')).toMatch(/Checkout.*group-123/);
    expect(formatComponentRemovalError(new Error('Relationship dependency'), 'Checkout')).toContain('Relationship dependency');
  });

  it('keeps failed grouped drafts and history available, then retries the unchanged payload', async () => {
    useDiagramStore.getState().open(structuredClone(document));
    expect(useDiagramStore.getState().createGroup(' Finance ', [firstId, secondId])).toBe(true);
    const grouped = structuredClone(useDiagramStore.getState().document!);
    let submitted: DiagramDocument | undefined;
    const save = vi.spyOn(diagramClient, 'save')
      .mockImplementationOnce(input => { submitted = structuredClone(input); return Promise.reject(new Error('Backend unavailable')); })
      .mockResolvedValueOnce({ ...grouped, updatedAt: '2026-01-01T00:01:00.000Z' });

    await useDiagramStore.getState().save();
    expect(useDiagramStore.getState()).toMatchObject({ status: 'failed', error: 'Backend unavailable', document: grouped, canUndo: true });
    await useDiagramStore.getState().retry();

    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toEqual(submitted);
    expect(useDiagramStore.getState().document).toMatchObject({ groups: [expect.objectContaining({ id: grouped.groups[0].id, name: 'Finance' })] });
    expect(useDiagramStore.getState().document?.components.map(component => component.id)).toEqual([firstId, secondId]);
    expect(useDiagramStore.getState().document?.relationships[0].id).toBe(relationshipId);
  });

  it('keeps newer group edits and a newly reopened diagram safe from stale save responses', async () => {
    useDiagramStore.getState().open(structuredClone(document));
    useDiagramStore.getState().createGroup('Finance', [firstId, secondId]);
    let resolveSave: ((value: DiagramDocument) => void) | undefined;
    vi.spyOn(diagramClient, 'save').mockImplementation(() => new Promise(resolve => { resolveSave = resolve; }));
    const pending = useDiagramStore.getState().save();
    useDiagramStore.getState().renameGroup(useDiagramStore.getState().document!.groups[0].id, 'Core Finance');
    resolveSave?.(structuredClone(document));
    await pending;
    expect(useDiagramStore.getState().document?.groups[0].name).toBe('Core Finance');
    expect(useDiagramStore.getState().status).toBe('unsaved');

    useDiagramStore.getState().open(structuredClone(document));
    let resolveSecond: ((value: DiagramDocument) => void) | undefined;
    vi.spyOn(diagramClient, 'save').mockImplementation(() => new Promise(resolve => { resolveSecond = resolve; }));
    const stale = useDiagramStore.getState().save();
    useDiagramStore.getState().open(structuredClone(otherDocument));
    resolveSecond?.(structuredClone(document));
    await stale;
    expect(useDiagramStore.getState()).toMatchObject({ document: expect.objectContaining({ id: otherDocument.id }), status: 'saved', canUndo: false, canRedo: false });
  });

  it('keeps ungrouping behind the existing confirmation dialog', () => {
    const source = readFileSync(new URL('../src/components/WorkspaceInspector.tsx', import.meta.url), 'utf8');
    expect(source).toContain('The group and its membership will be removed. Components, relationships, ADR links, and positions will be preserved.');
    expect(source).toContain('confirmGroupRemoval');
    expect(source).toContain('ConfirmDialog');
  });
});
