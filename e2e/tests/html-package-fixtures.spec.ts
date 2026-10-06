import { expect, test } from '@playwright/test';
import JSZip from 'jszip';
import { disableOfflinePackageNetwork, extractHtmlPackageArchive, openOfflinePackagePage, relocateOfflinePackage } from './html-package-fixtures';

// Infrastructure smoke test; extension renderers and browser acceptance follow in later phases.
test('offline helpers support native root/nested file navigation with network disabled after relocation', async ({ page, context }, testInfo) => {
  const childId = '90000000-0000-4000-8000-000000000008';
  const zip = new JSZip();
  zip.file('index.html', `<html><body><h1 id="owner">Parent</h1><a href="diagrams/${childId}/index.html">Child</a></body></html>`);
  zip.file(`diagrams/${childId}/index.html`, '<html><body><h1>Child</h1><a href="../../index.html#owner">Parent</a></body></html>');
  const { directory } = await extractHtmlPackageArchive(await zip.generateAsync({ type: 'nodebuffer' }), testInfo.outputPath('package'));
  await disableOfflinePackageNetwork(context);
  await openOfflinePackagePage(page, directory);
  await expect(page).toHaveURL(/^file:\/\//);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Child', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Child', exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/diagrams/${childId}/index.html$`));
  expect(await page.evaluate(async () => {
    try { await fetch('http://localhost:3000/health'); return 'online'; }
    catch { return 'offline'; }
  })).toBe('offline');
  await page.getByRole('link', { name: 'Parent', exact: true }).click();
  await expect(page).toHaveURL(/index.html#owner$/);

  // Release the source file before moving the directory (also works on Windows).
  await page.goto('about:blank');
  const moved = await relocateOfflinePackage(directory);
  await openOfflinePackagePage(page, moved, childId);
  await page.getByRole('link', { name: 'Parent', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Parent', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/^file:\/\/.*-relocated\/index.html#owner$/);
});
