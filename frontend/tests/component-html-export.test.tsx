import { afterEach, describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import { captureHtmlPackage } from '../src/components/DiagramExportCoordinator';
import { exportClient } from '../src/api/export-client';
import { useDiagramStore } from '../src/state/diagram-store';
import { useAdrStore } from '../src/state/adr-store';
import { componentPackageInput } from '../../shared/tests/component-package-input';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('Component browser export capture', () => {
  it('freezes Component and ADR drafts and preserves failed-save state and history', async () => {
    const { source, child } = componentPackageInput('component');
    useDiagramStore.getState().open(child); useDiagramStore.getState().renameComponent(child.components[0].id, 'Captured handler');
    useDiagramStore.setState({ status: 'failed', error: 'Save failed' });
    useAdrStore.getState().startNew(child.id); useAdrStore.getState().update(d => ({ ...d, title: 'Captured ADR', context: 'Why', decision: 'Choose', consequences: 'Effects', componentIds: [child.components[0].id] }));
    const state = useDiagramStore.getState(), adrState = useAdrStore.getState(), capture = captureHtmlPackage(state.document!, adrState.draft);
    const click = vi.fn(); vi.stubGlobal('document', { createElement: () => ({ click }) });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:component'); vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(source))));
    vi.spyOn(JSZip.prototype, 'generateAsync').mockImplementation(async function(this: JSZip) {
      expect(await this.file('index.html')!.async('string')).toContain('Captured handler');
      expect(await this.file('adrs.html')!.async('string')).toContain('Captured ADR');
      return new Blob(['archive']);
    } as never);
    await exportClient.downloadHtmlPackage(capture); expect(click).toHaveBeenCalledOnce();
    expect(useDiagramStore.getState()).toBe(state); expect(useAdrStore.getState()).toBe(adrState);
    useDiagramStore.getState().undo(); expect(useDiagramStore.getState().document!.components[0].name).toBe(child.components[0].name);
  });
});
