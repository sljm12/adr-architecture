import JSZip from 'jszip';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ArchitectureDecisionRecord, DiagramDocument } from '../../shared/src/domain/types';
import { buildHtmlPackage } from '../../shared/src/export/html-package';

export const offlineIds = {
  diagram: '00000000-0000-4000-8000-000000000101',
  component: '00000000-0000-4000-8000-000000000102',
  database: '00000000-0000-4000-8000-000000000103',
  relationship: '00000000-0000-4000-8000-000000000104',
  draftAdr: '00000000-0000-4000-8000-000000000105',
  acceptedAdr: '00000000-0000-4000-8000-000000000106',
  supersededAdr: '00000000-0000-4000-8000-000000000107',
  unlinkedAdr: '00000000-0000-4000-8000-000000000108',
} as const;

export const offlineTimestamp = '2026-01-01T00:00:00.000Z';

export const offlineDiagram: DiagramDocument = {
  id: offlineIds.diagram,
  name: 'Offline Payments',
  status: 'active',
  createdAt: offlineTimestamp,
  updatedAt: offlineTimestamp,
  trashedAt: null,
  components: [
    { id: offlineIds.component, diagramId: offlineIds.diagram, name: 'Payment API', description: null, type: 'software-system', position: { x: 60, y: 60 }, size: { width: 220, height: 100 }, createdAt: offlineTimestamp, updatedAt: offlineTimestamp },
    { id: offlineIds.database, diagramId: offlineIds.diagram, name: 'Ledger', description: null, type: 'software-system', position: { x: 420, y: 60 }, size: { width: 180, height: 72 }, createdAt: offlineTimestamp, updatedAt: offlineTimestamp },
  ],
  relationships: [
    { id: offlineIds.relationship, diagramId: offlineIds.diagram, sourceComponentId: offlineIds.component, targetComponentId: offlineIds.database, direction: 'directed', label: 'writes', createdAt: offlineTimestamp, updatedAt: offlineTimestamp },
  ],
  groups: [],
};

export const offlineAdrs: ArchitectureDecisionRecord[] = [
  {
    id: offlineIds.draftAdr, diagramId: offlineIds.diagram, title: 'Draft payment policy', context: 'A draft context.', decision: 'Keep this as a draft.', consequences: 'It remains under review.', alternativesOrConstraints: 'No alternatives recorded.', status: 'draft', replacementAdrId: null, componentIds: [offlineIds.component], relationshipIds: [], createdAt: offlineTimestamp, updatedAt: offlineTimestamp,
  },
  {
    id: offlineIds.acceptedAdr, diagramId: offlineIds.diagram, title: 'Ledger ordering', context: 'Ledger writes need ordering.', decision: 'Write sequentially.', consequences: 'Lower throughput.', alternativesOrConstraints: null, status: 'accepted', replacementAdrId: null, componentIds: [], relationshipIds: [offlineIds.relationship], createdAt: offlineTimestamp, updatedAt: offlineTimestamp,
  },
  {
    id: offlineIds.supersededAdr, diagramId: offlineIds.diagram, title: 'Old retry policy', context: 'The old context.', decision: 'Use the old policy.', consequences: 'It has been replaced.', alternativesOrConstraints: null, status: 'superseded', replacementAdrId: offlineIds.acceptedAdr, componentIds: [offlineIds.database], relationshipIds: [], createdAt: offlineTimestamp, updatedAt: offlineTimestamp,
  },
  {
    id: offlineIds.unlinkedAdr, diagramId: offlineIds.diagram, title: 'Review token rotation', context: 'Token rotation is under review.', decision: 'Document a rotation schedule.', consequences: 'No architecture link is needed yet.', alternativesOrConstraints: 'Consider provider limits.', status: 'rejected', replacementAdrId: null, componentIds: [], relationshipIds: [], createdAt: offlineTimestamp, updatedAt: offlineTimestamp,
  },
];

export function renderOfflinePackage(adrs: ArchitectureDecisionRecord[] = offlineAdrs) {
  return buildHtmlPackage({ diagram: offlineDiagram, adrs, capturedAt: offlineTimestamp });
}

export function renderScaleOfflinePackage() {
  const uuid = (value: number) => `00000000-0000-4000-8000-${value.toString(16).padStart(12, '0')}`;
  const diagramId = uuid(1);
  const components = Array.from({ length: 100 }, (_, index) => ({
    id: uuid(1000 + index), diagramId, name: `Component ${index + 1}`, description: null, type: 'software-system' as const,
    position: { x: (index % 10) * 300, y: Math.floor(index / 10) * 180 }, size: { width: 180, height: 72 }, createdAt: offlineTimestamp, updatedAt: offlineTimestamp,
  }));
  const relationships = Array.from({ length: 200 }, (_, index) => {
    const sourceIndex = index % 100;
    const targetIndex = (sourceIndex + (index < 100 ? 1 : 2)) % 100;
    return { id: uuid(2000 + index), diagramId, sourceComponentId: components[sourceIndex].id, targetComponentId: components[targetIndex].id, direction: 'directed' as const, label: `Relationship ${index + 1}`, createdAt: offlineTimestamp, updatedAt: offlineTimestamp };
  });
  const adrs = Array.from({ length: 100 }, (_, index) => ({
    id: uuid(3000 + index), diagramId, title: `Scale ADR ${index + 1}`, context: `Context for scale ADR ${index + 1}.`, decision: `Decision ${index + 1}.`, consequences: `Consequences ${index + 1}.`, alternativesOrConstraints: null,
    status: 'accepted' as const, replacementAdrId: null, componentIds: [components[index].id], relationshipIds: [relationships[index * 2].id], createdAt: offlineTimestamp, updatedAt: offlineTimestamp,
  }));
  const diagram: DiagramDocument = { ...offlineDiagram, id: diagramId, name: 'Scale architecture', components, relationships, groups: [] };
  return buildHtmlPackage({ diagram, adrs, capturedAt: offlineTimestamp });
}

/** Creates and extracts a ZIP in the supplied directory, as a reader would after download. */
export async function extractOfflinePackage(directory: string, adrs: ArchitectureDecisionRecord[] = offlineAdrs) {
  const files = renderOfflinePackage(adrs);
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) zip.file(path, content);
  const archive = await zip.generateAsync({ type: 'nodebuffer' });
  const extracted = await JSZip.loadAsync(archive);

  for (const [path, entry] of Object.entries(extracted.files)) {
    if (entry.dir) continue;
    const target = join(directory, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, await entry.async('nodebuffer'));
  }
  return { files, directory };
}
