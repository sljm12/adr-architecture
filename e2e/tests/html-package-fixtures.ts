import JSZip from 'jszip';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import type { APIRequestContext, BrowserContext, Page } from '@playwright/test';
import type { ArchitectureDecisionRecord, DiagramDocument } from '../../shared/src/domain/types';
import { buildHtmlPackage } from '../../shared/src/export/html-package';
import { architectureDecisionRecordListSchema, containerAvailabilitySchema, diagramDocumentSchema } from '../../shared/src/validation/schemas';
import { htmlPackageFixture, htmlPackageFixtureExpectations, htmlPackageFixtureIds, type HtmlPackageFixture } from '../../shared/tests/html-export-fixtures';

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
  await extractHtmlPackageArchive(archive, directory);
  return { files, directory };
}

/** Seed through real write endpoints; fresh UUIDs isolate concurrent browser runs.
 * API contexts may point directly at the backend or use apiPrefix='/api' via Vite.
 * Call before export, never during the read-only/offline journey.
 */
export async function preparePersistedHtmlPackageFixture(api: APIRequestContext, apiPrefix = ''): Promise<HtmlPackageFixture> {
  const template = htmlPackageFixture();
  const ids = new Map<string, string>(Object.values(htmlPackageFixtureIds).map(id => [id, randomUUID()]));
  const remap = <T>(input: T): T => JSON.parse(JSON.stringify(input), (_key, value) => typeof value === 'string' ? ids.get(value) ?? value : value);
  const call = async (method: string, path: string, data?: unknown) => {
    const response = await api.fetch(`${apiPrefix}${path}`, { method, ...(data === undefined ? {} : { data }) });
    if (response.status() < 200 || response.status() >= 300) {
      throw new Error(`HTML fixture ${method} ${path} failed (${response.status()}): ${await response.text()}`);
    }
    return response.status() === 204 ? undefined : response.json();
  };
  const saveParent = async (original: DiagramDocument) => {
    const created = diagramDocumentSchema.parse(await call('POST', '/diagrams', { name: original.name }));
    ids.set(original.id, created.id);
    return diagramDocumentSchema.parse(await call('PUT', `/diagrams/${created.id}`, remap(original)));
  };
  const parent = await saveParent(template.parent);
  const unrelatedParent = await saveParent(template.unrelatedParent);
  const saveChild = async (original: DiagramDocument) => {
    const scope = remap(original.scope!);
    const created = diagramDocumentSchema.parse(await call('POST', `/diagrams/${scope.parentDiagramId}/components/${scope.softwareSystemId}/container-diagram`));
    ids.set(original.id, created.id);
    // Create active first, then use the recovery endpoint for the exclusion fixture.
    return diagramDocumentSchema.parse(await call('PUT', `/diagrams/${created.id}`, { ...remap(original), status: 'active', trashedAt: null }));
  };
  const children: DiagramDocument[] = [];
  for (const child of template.children) children.push(await saveChild(child));
  let trashedChild: DiagramDocument = await saveChild(template.trashedChild);
  const unrelatedChild = await saveChild(template.unrelatedChild);

  for (const original of Object.values(template.adrsByDiagram).flat()) {
    const adr = remap(original);
    const { title, context, decision, consequences, alternativesOrConstraints, status, replacementAdrId } = adr;
    const created = await call('POST', `/diagrams/${adr.diagramId}/adrs`, { title, context, decision, consequences, alternativesOrConstraints, status, replacementAdrId });
    ids.set(original.id, created.id);
    await call('PUT', `/adrs/${created.id}/components`, { componentIds: adr.componentIds });
    await call('PUT', `/adrs/${created.id}/relationships`, { relationshipIds: adr.relationshipIds });
  }
  await call('DELETE', `/diagrams/${trashedChild.id}`);
  const availability = [];
  for (const owner of parent.components.filter(component => component.type === 'software-system')) {
    availability.push(containerAvailabilitySchema.parse(await call('GET', `/diagrams/${parent.id}/components/${owner.id}/container-diagram`)));
  }
  const trashedSummary = availability.find(item => item.diagram?.id === trashedChild.id)!.diagram!;
  trashedChild = { ...trashedChild, status: 'trashed', updatedAt: trashedSummary.updatedAt, trashedAt: trashedSummary.updatedAt };
  const adrsByDiagram: Record<string, ArchitectureDecisionRecord[]> = {};
  for (const diagram of [parent, ...children]) {
    adrsByDiagram[diagram.id] = architectureDecisionRecordListSchema.parse(await call('GET', `/diagrams/${diagram.id}/adrs/full`));
  }
  const fixture = { parent, children, trashedChild, unrelatedParent, unrelatedChild, availability, adrsByDiagram };
  return { ...fixture, expected: htmlPackageFixtureExpectations(fixture) };
}

/** Extract a single archive as UTF-8 files without starting a package HTTP server. */
export async function extractHtmlPackageArchive(archive: Buffer, directory: string) {
  const zip = await JSZip.loadAsync(archive);
  const files: Record<string, string> = {};
  const root = resolve(directory);
  // Check original ZIP names too: JSZip normalizes dot segments when loading.
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const original = entry.unsafeOriginalName ?? path;
    const target = resolve(root, path);
    if (/[\\:]/.test(original) || original.startsWith('/') || original.split('/').some(segment => !segment || segment === '.' || segment === '..') || !target.startsWith(`${root}${sep}`)) {
      throw new Error(`Unsafe HTML package archive path: ${original}`);
    }
    files[path] = await entry.async('string');
  }
  for (const [path, content] of Object.entries(files)) {
    const target = join(root, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
  }
  return { files, directory: root };
}

/** Wait for the app's one ZIP download and extract that archive, not a rebuilt map. */
export async function downloadAndExtractOfflinePackage(page: Page, directory: string) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export HTML package', exact: true }).click(),
  ]);
  const failure = await download.failure();
  if (failure) throw new Error(`HTML package download failed: ${failure}`);
  const archivePath = await download.path();
  if (!archivePath) throw new Error('HTML package download has no local archive.');
  return { ...await extractHtmlPackageArchive(await readFile(archivePath), directory), filename: download.suggestedFilename() };
}

export async function enumerateOfflinePackage(directory: string) {
  const filePaths: string[] = [];
  const visit = async (relativeDirectory: string) => {
    for (const entry of await readdir(join(directory, relativeDirectory), { withFileTypes: true })) {
      const path = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) filePaths.push(path);
    }
  };
  await visit('');
  filePaths.sort();
  const anchorsByFile: Record<string, string[]> = {};
  const linksByFile: Record<string, string[]> = {};
  for (const path of filePaths.filter(path => /\.(html|svg)$/.test(path))) {
    const content = await readFile(join(directory, path), 'utf8');
    anchorsByFile[path] = [...content.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
    linksByFile[path] = [...content.matchAll(/\bhref=["']([^"']+)["']/g)].map(match => match[1]);
  }
  return { filePaths, anchorsByFile, linksByFile };
}

/** Disable network only after the app has produced the ZIP. */
export async function disableOfflinePackageNetwork(context: BrowserContext) {
  await context.setOffline(true);
  await context.route(/^https?:\/\//i, route => route.abort('internetdisconnected'));
}

export async function openOfflinePackagePage(page: Page, directory: string, childDiagramId?: string, fragment?: string) {
  if (childDiagramId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(childDiagramId)) {
    throw new Error('Nested offline page requires a diagram UUID.');
  }
  const path = childDiagramId ? join(directory, 'diagrams', childDiagramId, 'index.html') : join(directory, 'index.html');
  const url = pathToFileURL(resolve(path));
  if (fragment) url.hash = fragment;
  await page.goto(url.href);
}

/** Move the whole extracted directory to a new sibling location, retaining relative links. */
export async function relocateOfflinePackage(directory: string) {
  const source = resolve(directory);
  const destination = `${source}-relocated`;
  await rename(source, destination);
  return destination;
}
