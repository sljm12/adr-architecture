import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecoveryImpactDialog } from '../src/components/RecoveryImpactDialog';
import { diagramClient, DiagramApiError, formatDiagramApiError } from '../src/api/diagram-client';
import { useDiagramStore } from '../src/state/diagram-store';
import { populatedChildFixture, generalParentFixture, containerFixtureIds as ids } from '../../shared/tests/container-fixtures';
import type { DiagramDocument, RestoreImpact } from '../../shared/src/index';
import { AdrLinkPicker } from '../src/components/AdrLinkPicker';
import { useAdrStore } from '../src/state/adr-store';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const child = () => populatedChildFixture() as unknown as DiagramDocument;
const row = (d: DiagramDocument) => ({ id: d.id, name: d.name, status: d.status, createdAt: d.createdAt, updatedAt: d.updatedAt, kind: d.kind, scope: d.scope });
describe('confirmed recovery UI and reconciliation', () => {
  it('normalizes legacy removal responses and rejects broken local references before updating the editor', async () => {
    const parent = generalParentFixture() as unknown as DiagramDocument;
    delete parent.kind; parent.relationships = [];
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ document: parent }), { status: 200 })));
    const result = await diagramClient.removeRelationship(parent.id, ids.parentRelationship);
    expect(result.document.kind).toBe('general'); expect(result.document.components[0].role).toBe('element');
    parent.kind = 'container'; parent.scope = null;
    await expect(diagramClient.removeRelationship(parent.id, ids.parentRelationship)).rejects.toThrow();
  });
  it('ignores a pre-recovery library response after the authoritative lists have refreshed', async () => {
    const parent = generalParentFixture() as unknown as DiagramDocument;
    let release!: (rows: ReturnType<typeof row>[]) => void;
    const stale = new Promise<ReturnType<typeof row>[]>(resolve => { release = resolve; });
    vi.spyOn(diagramClient, 'list').mockReturnValueOnce(stale).mockResolvedValueOnce([]);
    vi.spyOn(diagramClient, 'listTrash').mockResolvedValue([{ ...row(parent), status: 'trashed' }]);
    const pending = useDiagramStore.getState().refreshSavedDocuments();
    await useDiagramStore.getState().refreshRecoveryLists([parent.id]);
    release([row(parent)]); await pending;
    expect(useDiagramStore.getState().savedDocuments).toEqual([]);
    expect(useDiagramStore.getState().trashedDocuments[0].id).toBe(parent.id);
  });
  it('labels local ADR targets by subtype and preserves the local link IDs through undo', () => {
    const d = child(); d.components[0].containerType = 'datastore';
    const html = renderToStaticMarkup(<AdrLinkPicker components={d.components} relationships={d.relationships} selectedIds={[ids.container, ids.externalOccurrence]} relationshipIds={[ids.childRelationship]} onChange={() => {}} />);
    expect(html).toContain('Datastore'); expect(html).toContain('Software System'); expect(html).not.toContain(`boundary-${d.id}`);
    useAdrStore.getState().startNew(d.id); useAdrStore.getState().setComponentIds([ids.container, ids.externalOccurrence]); useAdrStore.getState().setRelationshipIds([ids.childRelationship]); useAdrStore.getState().undo();
    expect(useAdrStore.getState().draft?.componentIds).toEqual([ids.container, ids.externalOccurrence]); useAdrStore.getState().redo(); expect(useAdrStore.getState().draft?.relationshipIds).toEqual([ids.childRelationship]);
  });
  it('explains recoverable occurrence removal and retains the rejected source draft/history', async () => {
    const parent = generalParentFixture() as unknown as DiagramDocument; useDiagramStore.getState().open(parent); useDiagramStore.getState().renameComponent(ids.sourceSystem, 'Rejected draft name');
    const error = new DiagramApiError('Source has dependencies', 409, { code: 'DIAGRAM_DEPENDENCY', diagramBlockers: [{ name: 'Payments', status: 'trashed', diagramId: ids.populatedChild, componentId: ids.externalOccurrence, sourceComponentId: ids.sourceSystem, nextAction: 'Restore the child, then explicitly remove this occurrence after repairing its ADR and relationship links.' }] });
    vi.spyOn(diagramClient, 'save').mockRejectedValue(error); await useDiagramStore.getState().save();
    expect(formatDiagramApiError(error)).toContain(ids.externalOccurrence); expect(useDiagramStore.getState()).toMatchObject({ status: 'failed', canUndo: true, error: expect.stringMatching(/Restore.*remove/) }); expect(useDiagramStore.getState().document?.components.find(c => c.id === ids.sourceSystem)?.name).toBe('Rejected draft name');
  });
  it('names the canonical parent batch and explains a child excluded from restoration', () => {
    const parent = generalParentFixture() as unknown as DiagramDocument;
    const impact: RestoreImpact = { requestedDiagramId: ids.emptyChild, restoreRootDiagramId: parent.id, trashBatchId: crypto.randomUUID(), affectedDiagramIds: [parent.id, ids.populatedChild], affectedDiagrams: [row(parent), row(child())], requestedDiagramIncluded: false };
    const html = renderToStaticMarkup(<RecoveryImpactDialog kind="restore" impact={impact} onConfirm={() => {}} onCancel={() => {}} />);
    expect(html).toContain(parent.name); expect(html).toContain('Payments'); expect(html).toMatch(/independently|separate/i); expect(html).toContain('Cancel'); expect(html).toContain('Restore');
  });
  it('refreshes every affected list entry without registering an excluded child or replacing current work', async () => {
    const current = child(), parent = generalParentFixture() as unknown as DiagramDocument;
    useDiagramStore.getState().open(current); useDiagramStore.getState().update(d => ({ ...d, name: 'Unsaved runtime' }));
    const draft = useDiagramStore.getState().document;
    vi.spyOn(diagramClient, 'list').mockResolvedValue([row(parent), row(current)]); vi.spyOn(diagramClient, 'listTrash').mockResolvedValue([{ ...row(current), id: ids.emptyChild, status: 'trashed' }]);
    useDiagramStore.setState({ deletedSavedDocumentIds: [parent.id, current.id, ids.emptyChild] });
    await useDiagramStore.getState().refreshRecoveryLists([parent.id, current.id]);
    expect(useDiagramStore.getState().document).toBe(draft); expect(useDiagramStore.getState().savedDocuments.map(d => d.id)).toEqual([parent.id, current.id]); expect(useDiagramStore.getState().trashedDocuments.map(d => d.id)).toEqual([ids.emptyChild]);
  });
});
