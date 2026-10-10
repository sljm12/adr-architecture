import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecoveryImpactDialog } from '../src/components/RecoveryImpactDialog';
import { useDiagramStore } from '../src/state/diagram-store';
import { diagramClient } from '../src/api/diagram-client';
import { componentContextFixture, componentParentFixture, populatedComponentFixture, componentFixtureIds as ids } from '../../shared/tests/component-fixtures';
import type { DiagramDocument, DiagramSummary } from '../../shared/src/index';
const summary = (d: DiagramDocument): DiagramSummary => ({ ...d, kind: d.kind ?? 'general', scope: d.scope ?? null });
afterEach(() => vi.restoreAllMocks());
describe('Component recovery presentation and refresh', () => {
  it('names Component, owner and immediate parent in the exact staged set', () => {
    const affected = [componentContextFixture(), componentParentFixture(), populatedComponentFixture() as DiagramDocument].map(summary);
    const html = renderToStaticMarkup(<RecoveryImpactDialog kind="restore" impact={{ requestedDiagramId: ids.datastoreChild, restoreRootDiagramId: ids.context, trashBatchId: ids.rootBatch, affectedDiagramIds: affected.map(d => d.id), affectedDiagrams: affected, requestedDiagramIncluded: false }} onConfirm={() => {}} onCancel={() => {}} />);
    expect(html).toContain('Component diagram'); expect(html).toContain('owner Payment API'); expect(html).toContain(ids.child);
    expect(html).toContain('separate child restore'); expect(html).toContain('Cancel');
  });
  it('refreshes three-level lists without overwriting current work and preserves failed load for retry', async () => {
    const child = populatedComponentFixture() as DiagramDocument;
    useDiagramStore.getState().open(child); useDiagramStore.getState().renameComponent(ids.internal, 'Draft');
    const draft = useDiagramStore.getState().document;
    vi.spyOn(diagramClient, 'list').mockResolvedValue([componentContextFixture(), componentParentFixture(), child].map(summary));
    vi.spyOn(diagramClient, 'listTrash').mockResolvedValue([]);
    await useDiagramStore.getState().refreshRecoveryLists([ids.context, ids.parent, ids.child]);
    expect(useDiagramStore.getState().document).toBe(draft);
    vi.spyOn(diagramClient, 'get').mockRejectedValueOnce(new Error('Committed recovery; load unavailable'));
    expect(await useDiagramStore.getState().loadSavedDocument(ids.parent)).toBe(false);
    expect(useDiagramStore.getState().document).toBe(draft);
    expect(useDiagramStore.getState().loadError).toContain('load unavailable');
  });
});
