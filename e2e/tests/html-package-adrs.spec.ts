import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { extractOfflinePackage, offlineIds } from './html-package-fixtures';

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
