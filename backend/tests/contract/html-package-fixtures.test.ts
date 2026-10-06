import { afterEach, describe, expect, it } from 'vitest';
import { request } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { buildApp } from '../../src/api/app';
import { DiagramRepository } from '../../src/persistence/diagram-repository';
import { AdrRepository } from '../../src/persistence/adr-repository';
import { preparePersistedHtmlPackageFixture, extractHtmlPackageArchive, enumerateOfflinePackage, relocateOfflinePackage } from '../../../e2e/tests/html-package-fixtures';
import offlineConfig from '../../../playwright.offline.config';
import appConfig from '../../../playwright.config';

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });

describe('HTML package browser infrastructure', () => {
  it('prepares matching persisted ownership, availability and complete local ADRs using the API', async () => {
    const diagrams = new DiagramRepository();
    const adrs = new AdrRepository();
    const app = buildApp(diagrams, adrs);
    const baseURL = await app.listen({ host: '127.0.0.1', port: 0 });
    const api = await request.newContext({ baseURL });
    try {
      const fixture = await preparePersistedHtmlPackageFixture(api);
      expect(fixture.expected.diagramIds).toHaveLength(3);
      expect(fixture.expected.adrIds).toHaveLength(8);
      expect(fixture.children.find(child => !child.components.length)).toBeDefined();
      expect(fixture.availability.map(item => item.availability)).toEqual(['active', 'active', 'none', 'trashed']);
      expect(diagrams.findChildren(fixture.parent.id).map(child => child.id).sort()).toEqual([...fixture.children.map(child => child.id), fixture.trashedChild.id].sort());
      expect(diagrams.get(fixture.trashedChild.id)?.status).toBe('trashed');
      for (const diagramId of fixture.expected.diagramIds) expect(adrs.listFull(diagramId)).toEqual(fixture.adrsByDiagram[diagramId]);
      expect(fixture.expected.siblingLinks).toHaveLength(1);
      const second = await preparePersistedHtmlPackageFixture(api);
      expect(second.expected.diagramIds.some(id => fixture.expected.diagramIds.includes(id))).toBe(false);
    } finally { await api.dispose(); await app.close(); }
  });

  it('extracts and inventories root/nested anchors and relocates the whole package', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'html-package-fixture-'));
    directories.push(directory, `${directory}-relocated`);
    const zip = new JSZip();
    zip.file('index.html', '<a id="root" href="diagrams/child/index.html#child">Child</a>');
    zip.file('diagrams/child/index.html', '<a id="child" href="../../index.html#root">Parent</a>');
    zip.file('styles.css', ':root{}');
    await extractHtmlPackageArchive(await zip.generateAsync({ type: 'nodebuffer' }), directory);
    const inventory = await enumerateOfflinePackage(directory);
    expect(inventory.filePaths).toEqual(['diagrams/child/index.html', 'index.html', 'styles.css']);
    expect(inventory.anchorsByFile['diagrams/child/index.html']).toEqual(['child']);
    expect(inventory.linksByFile['index.html']).toEqual(['diagrams/child/index.html#child']);
    const moved = await relocateOfflinePackage(directory);
    expect(await enumerateOfflinePackage(moved)).toEqual(inventory);
    expect(await readFile(join(moved, 'styles.css'), 'utf8')).toBe(':root{}');
  });

  it('selects only HTML package suites with isolated branded and engine projects', () => {
    expect(offlineConfig.testMatch).toBe('**/html-package-*.spec.ts');
    expect(offlineConfig.webServer).toEqual(appConfig.webServer);
    expect(offlineConfig.use?.trace).toBe('retain-on-failure');
    expect(offlineConfig.use?.launchOptions).toBeUndefined();
    expect(offlineConfig.projects?.map(project => [project.name, project.use?.browserName, project.use?.channel])).toEqual([
      ['offline-chrome', 'chromium', 'chrome'], ['offline-edge', 'chromium', 'msedge'],
      ['offline-firefox', 'firefox', undefined], ['offline-webkit', 'webkit', undefined],
    ]);
    expect(appConfig.projects).toBeUndefined();
  });
});
