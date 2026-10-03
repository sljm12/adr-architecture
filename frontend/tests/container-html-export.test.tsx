import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureHtmlExportInput, runHtmlPackageExport } from '../src/components/ExportButton';
import { resolveContainerExportInput } from '../src/api/export-client';
import { diagramClient } from '../src/api/diagram-client';
import { populatedChildFixture, containerFixtureIds as ids } from '../../shared/tests/container-fixtures';
import type { DiagramDocument, ContainerContext } from '../../shared/src/index';
import { useAdrStore } from '../src/state/adr-store';

afterEach(() => vi.restoreAllMocks());
describe('immutable child export capture', () => {
  it('captures an unsaved decision and a new local occurrence before asynchronous source lookup', async () => {
    const child = populatedChildFixture() as unknown as DiagramDocument;
    child.components.push({ ...child.components[1], id: crypto.randomUUID(), sourceComponentId: ids.person, name: 'Cached person', position: { x: 900, y: 100 } });
    useAdrStore.getState().startNew(child.id); useAdrStore.getState().update(d => ({ ...d, title: 'Captured decision', context: 'Why', decision: 'Choose', consequences: 'Effects', componentIds: [child.components[2].id] }));
    const input = captureHtmlExportInput(child, useAdrStore.getState().draft);
    useAdrStore.getState().update(d => ({ ...d, title: 'Later decision' }));
    vi.spyOn(diagramClient, 'containerContext').mockResolvedValue({ scope: child.scope!, sources: [{ id: ids.sourceSystem, name: 'Fresh Ledger', description: null, type: 'software-system' }, { id: ids.person, name: 'Current customer', description: 'Buyer', type: 'person' }], capturedAt: new Date().toISOString() });
    const output = await resolveContainerExportInput(input);
    expect(output.draft?.title).toBe('Captured decision'); expect(output.diagram.components[2]).toMatchObject({ id: child.components[2].id, sourceComponentId: ids.person, name: 'Current customer' }); expect(useAdrStore.getState().draft?.title).toBe('Later decision');
  });
  it('resolves current source metadata while retaining captured draft name, scope, subtype and geometry', async () => {
    const child = populatedChildFixture() as unknown as DiagramDocument; child.components[0].containerType = 'datastore'; child.name = 'Draft runtime';
    const input = captureHtmlExportInput(child, null); child.name = 'Later edit';
    const context: ContainerContext = { scope: { ...child.scope!, softwareSystemName: 'Fresh owner' }, sources: [{ id: ids.sourceSystem, name: 'Fresh source', description: 'Current details', type: 'person' }], capturedAt: new Date().toISOString() };
    vi.spyOn(diagramClient, 'containerContext').mockResolvedValue(context);
    const output = await resolveContainerExportInput(input);
    expect(output.diagram).toMatchObject({ name: 'Draft runtime', scope: context.scope });
    expect(output.diagram.components[0]).toEqual(input.diagram.components[0]); expect(output.diagram.components[1]).toMatchObject({ id: ids.externalOccurrence, name: 'Fresh source', sourceComponentId: ids.sourceSystem, position: input.diagram.components[1].position });
    expect(input.diagram.scope!.softwareSystemName).toBe('Payments');
  });
  it('fails a source lookup, scope mismatch or missing source without download or editor mutation', async () => {
    const child = populatedChildFixture() as unknown as DiagramDocument;
    const input = captureHtmlExportInput(child, null), download = vi.fn(async captured => { await resolveContainerExportInput(captured); });
    const lookup = vi.spyOn(diagramClient, 'containerContext').mockRejectedValue(new Error('Source fetch failed'));
    expect((await runHtmlPackageExport(input, download)).success).toBe(false);
    lookup.mockResolvedValue({ scope: { ...child.scope!, softwareSystemId: crypto.randomUUID() }, sources: [], capturedAt: new Date().toISOString() });
    await expect(resolveContainerExportInput(input)).rejects.toThrow(/scope|match/i);
    lookup.mockResolvedValue({ scope: child.scope!, sources: [], capturedAt: new Date().toISOString() });
    await expect(resolveContainerExportInput(input)).rejects.toThrow(/source/i);
    expect(input.diagram).toEqual(child);
  });
});
