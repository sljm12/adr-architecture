import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureHtmlExportInput, captureHtmlPackage, runHtmlPackageExport } from '../src/components/ExportButton';
import { exportClient, resolveContainerExportInput } from '../src/api/export-client';
import { diagramClient } from '../src/api/diagram-client';
import { populatedChildFixture, containerFixtureIds as ids } from '../../shared/tests/container-fixtures';
import type { DiagramDocument, ContainerContext } from '../../shared/src/index';
import { useAdrStore } from '../src/state/adr-store';
import { aggregateInput } from '../../shared/tests/html-package-input';
import JSZip from 'jszip';
import { useDiagramStore } from '../src/state/diagram-store';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('one-source atomic browser archive', () => {
  it('freezes edits before a delayed read, uses one source request and waits for the archive before downloading', async () => {
    const { fixture, source } = aggregateInput();
    const parent = structuredClone(fixture.parent);
    parent.components[0].name = 'Captured owner';
    const capture = captureHtmlPackage(parent, null);
    const click = vi.fn(), revoke = vi.fn();
    vi.stubGlobal('document', { createElement: () => ({ click }) });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:package');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revoke);
    let resolveSource!: (response: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>(resolve => { resolveSource = resolve; }));
    vi.stubGlobal('fetch', fetchMock);
    const archive = vi.spyOn(JSZip.prototype, 'generateAsync').mockImplementation(async function (this: JSZip) {
      const html = await this.file(`diagrams/${fixture.children.find(d => d.components.length)!.id}/index.html`)!.async('string');
      expect(html).toContain('Captured owner'); expect(html).not.toContain('Later owner');
      expect(click).not.toHaveBeenCalled();
      return new Blob(['archive']);
    } as never);
    const stages: string[] = [];
    const operation = exportClient.downloadHtmlPackage(capture, stage => stages.push(stage));
    await expect(exportClient.downloadHtmlPackage(capture)).rejects.toThrow(/already in progress/);
    parent.components[0].name = 'Later owner';
    resolveSource(new Response(JSON.stringify(source), { status: 200 }));
    await operation;
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(`/api/diagrams/${parent.id}/export/html-source`);
    expect(archive).toHaveBeenCalledOnce(); expect(click).toHaveBeenCalledOnce();
    expect(stages).toEqual(['gathering', 'validating', 'rendering', 'archiving']);
  });
  it('does not alter store documents, drafts, undo/redo, navigation, revision or failed-save state', async () => {
    const { fixture, source } = aggregateInput();
    useDiagramStore.getState().open(fixture.parent);
    useDiagramStore.getState().renameComponent(fixture.parent.components[0].id, 'Retained edit');
    useDiagramStore.setState({ status: 'failed', error: 'Save failed' });
    useAdrStore.getState().startNew(fixture.parent.id);
    useAdrStore.getState().update(d => ({ ...d, title: 'Retained ADR', context: 'Reason', decision: 'Choose', consequences: 'Effects' }));
    useAdrStore.setState({ status: 'failed', error: 'Save failed' });
    const diagramState = useDiagramStore.getState(), adrState = useAdrStore.getState();
    const capture = captureHtmlPackage(diagramState.document!, adrState.draft);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(source))));
    vi.stubGlobal('document', { createElement: () => ({ click: vi.fn() }) });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:package'); vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(JSZip.prototype, 'generateAsync').mockResolvedValue(new Blob(['archive']));
    await exportClient.downloadHtmlPackage(capture);
    expect(useDiagramStore.getState()).toBe(diagramState);
    expect(useAdrStore.getState()).toBe(adrState);
    useDiagramStore.getState().undo();
    expect(useDiagramStore.getState().document!.components[0].name).toBe(fixture.parent.components[0].name);
  });
  it.each(['source', 'archive'])('fails %s without triggering a download', async failure => {
    const { source, fixture } = aggregateInput();
    const click = vi.fn();
    vi.stubGlobal('document', { createElement: () => ({ click }) });
    vi.stubGlobal('fetch', vi.fn(async () => failure === 'source'
      ? new Response(JSON.stringify({ message: 'Missing child', diagramId: fixture.children[0].id, artifactKind: 'diagram', field: 'scope', remedy: 'Repair and retry.' }), { status: 409 })
      : new Response(JSON.stringify(source))));
    vi.spyOn(JSZip.prototype, 'generateAsync').mockRejectedValue(new Error('Archive failed'));
    await expect(exportClient.downloadHtmlPackage(captureHtmlPackage(fixture.parent, null))).rejects.toThrow(failure === 'source' ? /Missing child.*scope.*Repair/ : /Archive failed/);
    expect(click).not.toHaveBeenCalled();
  });
});
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
  it('resolves the current owner title while retaining captured draft content, subtype and geometry', async () => {
    const child = populatedChildFixture() as unknown as DiagramDocument; child.components[0].containerType = 'datastore'; child.name = 'Draft runtime';
    const input = captureHtmlExportInput(child, null); child.name = 'Later edit';
    const context: ContainerContext = { scope: { ...child.scope!, softwareSystemName: 'Fresh owner' }, sources: [{ id: ids.sourceSystem, name: 'Fresh source', description: 'Current details', type: 'person' }], capturedAt: new Date().toISOString() };
    vi.spyOn(diagramClient, 'containerContext').mockResolvedValue(context);
    const output = await resolveContainerExportInput(input);
    expect(output.diagram).toMatchObject({ name: 'Fresh owner', scope: context.scope });
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
