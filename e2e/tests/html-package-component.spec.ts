import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { componentPackageArchive } from './html-package-component-fixtures';
import { activateOfflineTextLink, disableOfflinePackageNetwork, extractHtmlPackageArchive, openOfflinePackagePage, relocateOfflinePackage } from './html-package-fixtures';
import { componentFixtureIds as ids } from '../../shared/tests/component-fixtures';
import { assembleHtmlPackageSnapshot, renderAggregateHtmlPackage } from '../../shared/src/index';
import { componentPackageInput } from '../../shared/tests/component-package-input';

test('three-level file package preserves local ADRs, source navigation, focus, recoloring and relocation', async ({ page, context, browser }, testInfo) => {
  const fixture = await componentPackageArchive();
  const { directory } = await extractHtmlPackageArchive(fixture.bytes, testInfo.outputPath('component-package'));
  await testInfo.attach('browser-version', { body: `${testInfo.project.name}: ${browser.version()}; OS ${process.platform}`, contentType: 'text/plain' });
  await disableOfflinePackageNetwork(context); await openOfflinePackagePage(page, directory);
  expect(await page.evaluate(async () => { try { await fetch('http://localhost:3000/health'); return 'online'; } catch { return 'offline'; } })).toBe('offline');
  await page.keyboard.press('Tab'); await expect(page.getByRole('link', { name: /Browse all ADRs/ })).toBeFocused();
  await activateOfflineTextLink(page, `#component-${ids.system}`);
  await activateOfflineTextLink(page, `diagrams/${ids.parent}/index.html`, `component-${ids.system}`);
  await activateOfflineTextLink(page, `#component-${ids.application}`);
  await activateOfflineTextLink(page, `../${ids.child}/index.html`, `component-${ids.application}`);
  await expect(page).toHaveURL(new RegExp(`diagrams/${ids.child}/index.html$`));
  await activateOfflineTextLink(page, `#component-${ids.internal}`);
  await expect(page.locator(`#component-${ids.internal}`)).toContainText('Handler <script> & "quoted"');
  await expect(page.locator('script')).toHaveCount(0);
  await activateOfflineTextLink(page, `../../adrs.html#adr-${ids.linkedAdr}`, `component-${ids.internal}`);
  expect(await page.locator('a').evaluateAll(links => links.every(link => link.tabIndex === 0))).toBe(true);
  await activateOfflineTextLink(page, `#adr-${ids.unlinkedAdr}`);
  await expect(page.locator(`#adr-${ids.unlinkedAdr}`)).toContainText('This ADR is not linked');
  await activateOfflineTextLink(page, `#adr-${ids.linkedAdr}`);
  await activateOfflineTextLink(page, `diagrams/${ids.child}/index.html#component-${ids.childPerson}`, `adr-${ids.linkedAdr}`);
  await expect(page).toHaveURL(new RegExp(`#component-${ids.childPerson}$`));
  await activateOfflineTextLink(page, `#component-${ids.siblingOccurrence}`);
  await activateOfflineTextLink(page, `../${ids.datastoreChild}/index.html`, `component-${ids.siblingOccurrence}`);
  await expect(page).toHaveURL(new RegExp(`diagrams/${ids.datastoreChild}/index.html$`));
  await activateOfflineTextLink(page, `../${ids.parent}/index.html#component-${ids.datastore}`);
  await expect(page).toHaveURL(new RegExp(`diagrams/${ids.parent}/index.html#component-${ids.datastore}$`));
  const stylePath = join(directory, 'styles.css');
  await writeFile(stylePath, (await readFile(stylePath, 'utf8'))
    .replace(/--component-outline:\s*#707780/, '--component-outline: #ff0000')
    + '\n.component-name { font-weight: 700; }\n.component-technology { font-family: monospace; }\n.component-description { fill: #333333; }\n');
  await page.reload(); await expect(page.locator('.component-shape').first()).toHaveCSS('stroke', 'rgb(255, 0, 0)');
  for (const diagramId of [ids.context, ids.parent, ids.child]) {
    await openOfflinePackagePage(page, directory, diagramId === ids.context ? undefined : diagramId);
    await expect(page.locator('.component-shape').first()).toHaveCSS('stroke', 'rgb(255, 0, 0)');
    await expect(page.locator('.component-name').first()).toHaveCSS('font-weight', '700');
    if (diagramId !== ids.context) {
      await expect(page.locator('.component-technology').first()).toHaveCSS('font-family', 'monospace');
      await expect(page.locator('.component-description').first()).toHaveCSS('fill', 'rgb(51, 51, 51)');
    }
  }
  await page.screenshot({ path: testInfo.outputPath('component-package.png'), fullPage: true });
  await page.goto('about:blank'); const moved = await relocateOfflinePackage(directory);
  await openOfflinePackagePage(page, moved, ids.child);
  await activateOfflineTextLink(page, `../${ids.parent}/index.html#component-${ids.application}`);
  await activateOfflineTextLink(page, `../../index.html#component-${ids.system}`);
  await expect(page).toHaveURL(/^file:\/\/.*index.html#component-/);
});
test('required missing member aborts package assembly', () => {
  const { source, capture, child } = componentPackageInput(); source.diagrams = source.diagrams.filter(m => m.diagram.id !== child.id);
  expect(() => assembleHtmlPackageSnapshot(capture, source)).toThrow(/missing/i);
});

test('export hierarchy fits nodes and supports narrow screens, standalone SVG and print', async ({ page, context }, testInfo) => {
  const fixture = await componentPackageArchive();
  const { directory } = await extractHtmlPackageArchive(fixture.bytes, testInfo.outputPath('presentation-package'));
  await disableOfflinePackageNetwork(context);
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const diagramId of [ids.context, ids.parent, ids.child]) {
    await openOfflinePackagePage(page, directory, diagramId === ids.context ? undefined : diagramId);
    await expect(page.locator('.component-name').first()).toHaveCSS('font-size', '21px');
    await expect(page.locator('.component-type-label').first()).toHaveCSS('font-size', '12px');
    if (diagramId !== ids.context) {
      await expect(page.locator('.component-description').first()).toHaveCSS('font-size', '17px');
      await expect(page.locator('.component-technology').first()).toHaveCSS('font-size', '14px');
    }
    const clipped = await page.locator('.diagram-component').evaluateAll(nodes => nodes.flatMap(node => {
      const shape = (node.querySelector('.component-shape') as SVGGraphicsElement).getBBox();
      return Array.from(node.querySelectorAll('text')).filter(text => {
        const bounds = text.getBBox();
        return bounds.x < shape.x || bounds.y < shape.y || bounds.x + bounds.width > shape.x + shape.width || bounds.y + bounds.height > shape.y + shape.height;
      }).map(text => text.textContent);
    }));
    expect(clipped).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`presentation-${diagramId}.png`), fullPage: true });
  }
  await activateOfflineTextLink(page, '../../adrs.html');
  await page.screenshot({ path: testInfo.outputPath('presentation-adrs.png'), fullPage: true });
  await openOfflinePackagePage(page, directory, ids.child);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('presentation-narrow.png'), fullPage: true });
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.artifact-detail').first()).toHaveCSS('display', 'block');
  await expect(page.locator('.diagram-svg')).toHaveCSS('min-width', '0px');
  await page.emulateMedia({ media: 'screen' });
  await page.goto(page.url().replace(/index\.html.*$/, 'diagram.svg'));
  await expect(page.locator('.component-name').first()).toHaveCSS('font-size', '21px');
  await expect(page.locator('.component-shape').first()).toHaveCSS('fill', 'rgb(255, 255, 255)');
});

test('long Unicode fields remain inside exported text envelopes', async ({ page, context }, testInfo) => {
  const input = componentPackageInput();
  input.child.components[0].name = 'Architecture service 数据库 WWW '.repeat(6);
  input.child.components[0].description = 'Responsibilities: validates requests\n数据库 & <records> '.repeat(12);
  input.child.components[0].technology = 'TypeScript, PostgreSQL, HTTP APIs';
  input.child.relationships[0].label = 'Writes validated payment records 数据库 '.repeat(6);
  const files = renderAggregateHtmlPackage(assembleHtmlPackageSnapshot(input.capture, input.source));
  const fixture = await componentPackageArchive();
  const { directory } = await extractHtmlPackageArchive(fixture.bytes, testInfo.outputPath('long-label-package'));
  for (const [path, content] of Object.entries(files)) await writeFile(join(directory, path), content);
  await disableOfflinePackageNetwork(context);
  await openOfflinePackagePage(page, directory, ids.child);
  const clipped = await page.locator('.diagram-component').evaluateAll(nodes => nodes.flatMap(node => {
    const shape = (node.querySelector('.component-shape') as SVGGraphicsElement).getBBox();
    return Array.from(node.querySelectorAll('text')).filter(text => {
      const bounds = text.getBBox();
      return bounds.x < shape.x || bounds.y < shape.y || bounds.x + bounds.width > shape.x + shape.width || bounds.y + bounds.height > shape.y + shape.height;
    }).map(text => text.textContent);
  }));
  expect(clipped).toEqual([]);
  await expect(page.locator('.component-name').first()).toContainText('数据库');
  await expect(page.locator('script')).toHaveCount(0);
});
