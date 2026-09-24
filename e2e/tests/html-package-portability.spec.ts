import { test, expect } from '@playwright/test';
import { mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { extractOfflinePackage, offlineIds, offlineAdrs } from './html-package-fixtures';

test('exported SVG, ADR Markdown, CSS colors, relative relocation, and keyboard links remain portable', async ({ page }) => {
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

    await componentLink.focus();
    await page.keyboard.press('Enter');
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
