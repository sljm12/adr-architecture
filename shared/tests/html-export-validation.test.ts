import { describe, expect, it } from 'vitest';
import { HtmlExportError, validateHtmlExportSnapshot } from '../src/export/html-snapshot';
import { exportAdrFixture, exportAdrsFixture, exportDiagramFixture, exportIds, exportTimestamp } from './html-export-fixtures';

describe('interactive HTML export snapshot validation', () => {
  it.each(['unsaved', 'failed-save'] as const)('overlays an existing %s ADR draft by stable identity without changing timestamps', origin => {
    const saved = exportAdrFixture();
    const snapshot = validateHtmlExportSnapshot({
      diagram: exportDiagramFixture(), adrs: [saved], capturedAt: exportTimestamp,
      draft: { ...saved, title: `Current ${origin} title` },
    });
    expect(snapshot.adrs).toHaveLength(1);
    expect(snapshot.adrs[0]).toMatchObject({ id: saved.id, title: `Current ${origin} title`, createdAt: saved.createdAt, updatedAt: saved.updatedAt });
  });

  it('assigns a package-local UUID to a valid new draft without mutating the draft', () => {
    const draft = { ...exportAdrFixture({ id: undefined as never }), title: 'New draft', componentIds: [], relationshipIds: [] };
    delete (draft as Partial<typeof draft>).id;
    const before = structuredClone(draft);
    const snapshot = validateHtmlExportSnapshot({ diagram: exportDiagramFixture(), adrs: exportAdrsFixture(), draft, capturedAt: exportTimestamp });
    const exported = snapshot.adrs.find(adr => adr.title === 'New draft');
    expect(exported?.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(exported?.id).not.toBe(exportIds.adr);
    expect(exported).toMatchObject({ createdAt: exportTimestamp, updatedAt: exportTimestamp });
    expect(draft).toEqual(before);
  });

  it('reports required draft fields instead of silently omitting an invalid draft', () => {
    expect(() => validateHtmlExportSnapshot({
      diagram: exportDiagramFixture(), adrs: exportAdrsFixture(), capturedAt: exportTimestamp,
      draft: { ...exportAdrFixture(), id: undefined, title: ' ' },
    })).toThrow(expect.objectContaining({ artifactKind: 'ADR', field: 'title' }));
  });

  it.each([
    ['duplicate ADR identities', () => ({ adrs: [exportAdrFixture(), exportAdrFixture()] })],
    ['cross-diagram ADR ownership', () => ({ adrs: [exportAdrFixture({ diagramId: exportIds.otherDiagram })] })],
    ['missing component link targets', () => ({ adrs: [exportAdrFixture({ componentIds: [exportIds.missingArtifact] })] })],
    ['missing replacement targets', () => ({ adrs: [exportAdrFixture({ status: 'superseded', replacementAdrId: exportIds.missingArtifact })] })],
    ['missing relationship endpoints', () => ({ diagram: { ...exportDiagramFixture(), relationships: [{ ...exportDiagramFixture().relationships[0], targetComponentId: exportIds.missingArtifact }] } })],
    ['unsupported component types', () => ({ diagram: { ...exportDiagramFixture(), components: exportDiagramFixture().components.map(component => component.id === exportIds.systemA ? { ...component, type: 'database' } : component) } })],
    ['invalid resized dimensions', () => ({ diagram: { ...exportDiagramFixture(), components: exportDiagramFixture().components.map(component => component.id === exportIds.systemA ? { ...component, size: { width: 0, height: 80 } } : component) } })],
  ])('rejects %s atomically with an artifact-specific error', (_name, makeOverrides) => {
    const overrides = makeOverrides();
    expect(() => validateHtmlExportSnapshot({ diagram: exportDiagramFixture(), adrs: exportAdrsFixture(), capturedAt: exportTimestamp, ...overrides } as never)).toThrow(HtmlExportError);
  });
});
