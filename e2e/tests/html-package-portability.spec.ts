import { test, expect, type Page } from '@playwright/test';
import { mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { disableOfflinePackageNetwork, downloadAndExtractOfflinePackage, extractOfflinePackage, offlineIds, offlineAdrs, openOfflinePackagePage, preparePersistedHtmlPackageFixture, relocateOfflinePackage } from './html-package-fixtures';

async function activateTextLink(page: Page, href: string, containerId?: string) {
  for (let index = 0; index < 150; index++) {
    await page.keyboard.press('Tab');
    const reached = await page.evaluate(({ href, containerId }) => {
      const active = document.activeElement;
      return active?.getAttribute('href') === href && !active.closest('svg') &&
        (!containerId || active.closest('[id]')?.id === containerId);
    }, { href, containerId });
    if (!reached) continue;
    await expect(page.locator('a:focus')).toHaveCSS('outline-style', 'solid');
    const destination = new URL(href, page.url()).href;
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(destination);
    await page.waitForLoadState('domcontentloaded');
    return;
  }
  throw new Error(`Native keyboard traversal did not reach ${href}`);
}

test('aggregate SVG and scoped Markdown remain complete while shared recoloring and relocated keyboard journeys work offline', async ({ page, request, context }) => {
  const fixture = await preparePersistedHtmlPackageFixture(request, '/api');
  const child = fixture.children.find(diagram => diagram.components.length)!;
  const emptyChild = fixture.children.find(diagram => !diagram.components.length)!;
  const directory = await mkdtemp(join(tmpdir(), 'adr-aggregate-portable-'));
  let movedDirectory: string | undefined;
  try {
    await page.goto('/');
    await page.locator(`.saved-diagram-button[data-diagram-id="${fixture.parent.id}"]`).click();
    const { files } = await downloadAndExtractOfflinePackage(page, directory);
    expect(Object.keys(files).sort()).toEqual([...fixture.expected.filePaths].sort());
    await disableOfflinePackageNetwork(context);
    const requests: string[] = [];
    page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    for (const diagram of [fixture.parent, ...fixture.children]) {
      const prefix = diagram.id === fixture.parent.id ? '' : `diagrams/${diagram.id}/`;
      const svg = await readFile(join(directory, `${prefix}diagram.svg`), 'utf8');
      expect(svg).toContain('<style>');
      expect(svg).not.toMatch(/<(?:image|script|foreignObject)\b/);
      await page.goto(pathToFileURL(join(directory, `${prefix}diagram.svg`)).href);
      await expect(page.locator('svg')).toHaveAttribute('viewBox', /.+/);
      await expect(page.locator('.diagram-component')).toHaveCount(diagram.components.length);
      await expect(page.locator('.diagram-relationship')).toHaveCount(diagram.relationships.length);
      if (diagram.kind === 'container') await expect(page.locator('.system-boundary')).toContainText(diagram.scope!.softwareSystemName);
      if (diagram.id === child.id) for (const text of ['Application', 'Datastore', 'PostgreSQL', 'Stores payment records', 'stores records', 'SQL']) {
        await expect(page.locator('svg')).toContainText(text);
      }
      for (const adr of fixture.adrsByDiagram[diagram.id]) {
        const markdown = await readFile(join(directory, `adrs/${adr.id}.md`), 'utf8');
        expect(markdown).toContain(`- Diagram: [${diagram.name} (${diagram.id})](../${prefix}index.html)`);
        expect(markdown).toContain(`- Level: ${diagram.kind === 'container' ? 'Container diagram' : 'System context'}`);
        expect(markdown).toContain(`- Status: ${adr.status}`);
        for (const id of adr.componentIds) expect(markdown).toContain(`../${prefix}index.html#component-${id}`);
        for (const id of adr.relationshipIds) expect(markdown).toContain(`../${prefix}index.html#relationship-${id}`);
        if (adr.replacementAdrId) expect(markdown).toContain(`../adrs.html#adr-${adr.replacementAdrId}`);
        if (!adr.componentIds.length && !adr.relationshipIds.length) expect(markdown).toContain('This ADR is not linked to a diagram artifact.');
      }
    }
    const assertColors = async () => {
      for (const diagram of [fixture.parent, ...fixture.children]) {
        await openOfflinePackagePage(page, movedDirectory ?? directory, diagram.id === fixture.parent.id ? undefined : diagram.id);
        await page.reload();
        for (const shape of await page.locator('.component-shape').all()) {
          await expect(shape).toHaveCSS('stroke', 'rgb(18, 52, 86)');
          await expect(shape).toHaveCSS('fill', 'rgb(171, 205, 239)');
        }
        if (!diagram.components.length) await expect(page.locator('.system-boundary')).toBeVisible();
      }
    };
    const stylePath = join(directory, 'styles.css');
    await writeFile(stylePath, files['styles.css'].replace('--component-outline:#707780;', '--component-outline:#123456;').replace('--component-fill:#ffffff;', '--component-fill:#abcdef;'));
    await assertColors();
    movedDirectory = await relocateOfflinePackage(directory);
    await assertColors();
    await openOfflinePackagePage(page, movedDirectory);
    await activateTextLink(page, `#component-${child.scope!.softwareSystemId}`);
    await activateTextLink(page, `diagrams/${child.id}/index.html`);
    const relationshipAdr = fixture.adrsByDiagram[child.id].find(adr => adr.relationshipIds.length)!;
    const relationshipId = relationshipAdr.relationshipIds[0];
    await activateTextLink(page, `#relationship-${relationshipId}`);
    await expect(page.locator(`#relationship-${relationshipId}`)).toHaveCSS('border-top-color', 'rgb(0, 102, 204)');
    await activateTextLink(page, `../../adrs.html#adr-${relationshipAdr.id}`, `relationship-${relationshipId}`);
    await expect(page.locator(`#adr-${relationshipAdr.id}`)).toContainText(relationshipAdr.decision);
    await activateTextLink(page, `diagrams/${child.id}/index.html#relationship-${relationshipId}`, `adr-${relationshipAdr.id}`);
    await activateTextLink(page, `../../index.html#component-${child.scope!.softwareSystemId}`);
    await expect(page.locator(`#component-${child.scope!.softwareSystemId}`)).toBeVisible();
    await openOfflinePackagePage(page, movedDirectory, child.id);
    const occurrence = child.components.find(component => component.role === 'external' && component.sourceComponentId === emptyChild.scope!.softwareSystemId)!;
    await activateTextLink(page, `#component-${occurrence.id}`);
    await activateTextLink(page, `../${emptyChild.id}/index.html`);
    await expect(page.locator('.system-boundary')).toBeVisible();
    await activateTextLink(page, `../../index.html#component-${emptyChild.scope!.softwareSystemId}`);
    await activateTextLink(page, 'adrs.html');
    const unlinked = fixture.adrsByDiagram[child.id].find(adr => !adr.componentIds.length && !adr.relationshipIds.length)!;
    await activateTextLink(page, `#adr-${unlinked.id}`);
    await expect(page.locator(`#adr-${unlinked.id}`)).toContainText('This ADR is not linked to a diagram artifact.');
    expect(requests).toEqual([]);
  } finally {
    await rm(directory, { recursive: true, force: true });
    if (movedDirectory) await rm(movedDirectory, { recursive: true, force: true });
  }
});

test('exported SVG, ADR Markdown, CSS colors, relative relocation, and keyboard links remain portable', async ({ page, context }) => {
  const directory = await mkdtemp(join(tmpdir(), 'adr-diagram-portable-'));
  const movedDirectory = `${directory}-relocated`;
  try {
    const hostileAdr = {
      ...offlineAdrs[0],
      title: 'Payment [boundary] <script>',
      context: 'Keep line breaks.\n<script>alert("unsafe")</script> and [run](javascript:alert(1))',
    };
    const adrs = [hostileAdr, ...offlineAdrs.slice(1)];
    await extractOfflinePackage(directory, adrs);
    await rename(directory, movedDirectory);
    await disableOfflinePackageNetwork(context);

    const markdown = await readFile(join(movedDirectory, `adrs/${offlineIds.draftAdr}.md`), 'utf8');
    expect(markdown).toContain(`ADR ID: ${offlineIds.draftAdr}`);
    expect(markdown).toContain('Keep line breaks');
    expect(markdown).not.toContain('<script');
    expect(markdown).not.toContain('[run](javascript:');

    const svg = await readFile(join(movedDirectory, 'diagram.svg'), 'utf8');
    expect(svg).toContain('<svg');
    expect(svg).toContain('class="component-shape');
    await page.goto(pathToFileURL(join(movedDirectory, 'diagram.svg')).href);
    await expect(page.locator('svg')).toHaveAttribute('viewBox', /.+/);
    await expect(page.locator('.diagram-component')).toHaveCount(2);
    await expect(page.locator('.diagram-relationship')).toHaveCount(1);

    const stylePath = join(movedDirectory, 'styles.css');
    const styles = await readFile(stylePath, 'utf8');
    await writeFile(stylePath, styles.replace('--component-outline:#707780;', '--component-outline:#123456;').replace('--component-fill:#ffffff;', '--component-fill:#abcdef;'));
    await page.goto(pathToFileURL(join(movedDirectory, 'index.html')).href);
    const componentLink = page.locator('.diagram-component-link').first();
    const componentShape = componentLink.locator('.component-shape');
    await expect(componentShape).toHaveCSS('stroke', 'rgb(18, 52, 86)');
    await expect(componentShape).toHaveCSS('fill', 'rgb(171, 205, 239)');

    await activateTextLink(page, `#component-${offlineIds.component}`);
    await expect(page).toHaveURL(new RegExp(`#component-${offlineIds.component}$`));
    await expect(page.locator(`#component-${offlineIds.component}`)).toContainText('Payment [boundary] <script>');
    await expect(page.locator(`#component-${offlineIds.component} script`)).toHaveCount(0);
    await expect(page.locator(`a[href="adrs.html#adr-${offlineIds.unlinkedAdr}"]`)).toHaveCount(0);
    await expect(page.locator('.package-nav a[href="adrs.html"]')).toBeVisible();
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(movedDirectory, { recursive: true, force: true });
  }
});
