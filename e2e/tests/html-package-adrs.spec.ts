import { test, expect, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { disableOfflinePackageNetwork, downloadAndExtractOfflinePackage, extractOfflinePackage, offlineIds, openOfflinePackagePage, preparePersistedHtmlPackageFixture } from './html-package-fixtures';

async function activateTextLink(page: Page, href: string, articleId?: string) {
  for (let index = 0; index < 150; index++) {
    await page.keyboard.press('Tab');
    const reached = await page.evaluate(({ href, articleId }) => {
      const active = document.activeElement;
      return active?.getAttribute('href') === href && !active.closest('svg') &&
        (!articleId || active.closest('article')?.id === articleId);
    }, { href, articleId });
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

test('package-wide catalog exposes scoped decisions and exact parent/child backlinks with native offline keyboard navigation', async ({ page, request, context }) => {
  const fixture = await preparePersistedHtmlPackageFixture(request, '/api');
  const child = fixture.children.find(diagram => diagram.components.length)!;
  const emptyChild = fixture.children.find(diagram => !diagram.components.length)!;
  const count = fixture.expected.adrIds.length;
  const directory = await mkdtemp(join(tmpdir(), 'adr-scoped-catalog-'));
  try {
    await page.goto('/');
    await page.locator(`.saved-diagram-button[data-diagram-id="${fixture.parent.id}"]`).click();
    await downloadAndExtractOfflinePackage(page, directory);
    await disableOfflinePackageNetwork(context);
    await openOfflinePackagePage(page, directory);
    await expect(page.getByRole('link', { name: `Browse all ADRs (${count})`, exact: true })).toBeVisible();
    await activateTextLink(page, 'adrs.html');
    await expect(page.locator('.adr-catalog-entry')).toHaveCount(count);
    await expect(page.locator('.adr-detail')).toHaveCount(count);
    for (const diagram of [fixture.parent, child]) for (const adr of fixture.adrsByDiagram[diagram.id]) {
      const entry = page.locator('.adr-catalog-entry').filter({ has: page.locator(`a[href="#adr-${adr.id}"]`) });
      const detail = page.locator(`#adr-${adr.id}`);
      for (const scoped of [entry, detail]) {
        await expect(scoped).toContainText(diagram.name);
        await expect(scoped).toContainText(diagram.id);
        await expect(scoped).toContainText(diagram.kind === 'container' ? 'Container diagram' : 'System context');
        await expect(scoped).toContainText(adr.status);
      }
      for (const text of [adr.context, adr.decision, adr.consequences, adr.createdAt, adr.updatedAt]) await expect(detail).toContainText(text);
      await expect(detail).toContainText(adr.alternativesOrConstraints ?? 'Not specified.');
    }
    for (const diagram of [fixture.parent, child]) {
      const unlinked = fixture.adrsByDiagram[diagram.id].find(adr => !adr.componentIds.length && !adr.relationshipIds.length)!;
      await page.goto(pathToFileURL(join(directory, 'adrs.html')).href);
      await activateTextLink(page, `#adr-${unlinked.id}`);
      await expect(page.locator(`#adr-${unlinked.id}`)).toContainText('This ADR is not linked to a diagram artifact.');
      const superseded = fixture.adrsByDiagram[diagram.id].find(adr => adr.replacementAdrId)!;
      await activateTextLink(page, `#adr-${superseded.id}`);
      await activateTextLink(page, `#adr-${superseded.replacementAdrId}`, `adr-${superseded.id}`);
      await expect(page.locator(`#adr-${superseded.replacementAdrId}`)).toContainText(diagram.id);
      const componentAdr = fixture.adrsByDiagram[diagram.id].find(adr => adr.status === 'accepted')!;
      const component = diagram.components.find(item => item.id === componentAdr.componentIds[0])!;
      expect(component.name).toBe('Payments');
      const path = diagram.id === fixture.parent.id ? 'index.html' : `diagrams/${diagram.id}/index.html`;
      await activateTextLink(page, `${path}#component-${component.id}`, `adr-${componentAdr.id}`);
      const linkedIds = await page.locator(`#component-${component.id} .linked-adrs a`).evaluateAll(links => links.map(link => link.getAttribute('href')!.split('#adr-')[1]));
      expect(linkedIds.sort()).toEqual([...fixture.expected.directAdrIds[component.id]].sort());
      await activateTextLink(page, diagram.id === fixture.parent.id ? 'adrs.html' : '../../adrs.html');
      await activateTextLink(page, `#adr-${superseded.id}`);
      const relationshipId = superseded.relationshipIds[0];
      await activateTextLink(page, `${path}#relationship-${relationshipId}`, `adr-${superseded.id}`);
      const relationshipAdrs = await page.locator(`#relationship-${relationshipId} .linked-adrs a`).evaluateAll(links => links.map(link => link.getAttribute('href')!.split('#adr-')[1]));
      expect(relationshipAdrs.sort()).toEqual([...fixture.expected.directAdrIds[relationshipId]].sort());
    }
    await openOfflinePackagePage(page, directory, emptyChild.id);
    await expect(page.getByText('No ADRs belong to this diagram.', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: `Browse all ADRs (${count})`, exact: true })).toBeVisible();
    await activateTextLink(page, '../../adrs.html');
    await expect(page.locator('.adr-index-link')).toHaveCount(count);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('offline ADR catalog reaches unlinked decisions and links back to exact diagram artifacts', async ({ page }) => {
  const directory = await mkdtemp(join(tmpdir(), 'adr-diagram-adrs-'));
  try {
    await extractOfflinePackage(directory);
    await page.goto(pathToFileURL(join(directory, 'adrs.html')).href);

    await page.locator(`a[href="#adr-${offlineIds.unlinkedAdr}"]`).click();
    const unlinked = page.locator(`#adr-${offlineIds.unlinkedAdr}`);
    await expect(unlinked).toContainText('Review token rotation');
    await expect(unlinked).toContainText('This ADR is not linked to a diagram artifact.');
    await expect(page.locator('.adr-detail')).toHaveCount(4);

    await page.goto(pathToFileURL(join(directory, 'adrs.html')).href);
    await page.locator(`#adr-${offlineIds.draftAdr} a[href="index.html#component-${offlineIds.component}"]`).click();
    await expect(page).toHaveURL(new RegExp(`index\\.html#component-${offlineIds.component}$`));
    await expect(page.locator(`#component-${offlineIds.component}`)).toContainText('Draft payment policy');

    await page.goto(pathToFileURL(join(directory, 'adrs.html')).href);
    await page.locator(`#adr-${offlineIds.acceptedAdr} a[href="index.html#relationship-${offlineIds.relationship}"]`).click();
    await expect(page).toHaveURL(new RegExp(`index\\.html#relationship-${offlineIds.relationship}$`));
    await expect(page.locator(`#relationship-${offlineIds.relationship}`)).toContainText('Ledger ordering');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
