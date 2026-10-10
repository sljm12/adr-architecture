import { test, expect, type Locator, type Page } from '@playwright/test';
import { buildApp } from '../../backend/src/api/app';
import { DiagramRepository } from '../../backend/src/persistence/diagram-repository';
import { componentContextFixture, componentParentFixture, componentFixtureIds as ids } from '../../shared/tests/component-fixtures';

/** Reach controls through native focus traversal; never script focus or click. */
async function tabTo(page: Page, target: Locator) {
  await expect(target).toBeVisible();
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let i = 0; i < 150; i++) {
      if (await target.evaluate(el => el === document.activeElement)) {
        await expect(target).toBeFocused();
        // Windows display scaling can round an authored 2px stroke to 1.6 CSS px.
        await expect.poll(() => target.evaluate(el => parseFloat(getComputedStyle(el).outlineWidth))).toBeGreaterThan(0);
        expect(await target.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
        if (await target.evaluate(el => el.tagName === 'BUTTON')) {
          const box = await target.boundingBox(); expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
        }
        return;
      }
      await page.keyboard.press(key);
    }
  }
  throw new Error(`Control cannot be reached with Tab: ${await target.getAttribute('aria-label') ?? await target.textContent()}`);
}
async function activate(page: Page, target: Locator) { await tabTo(page, target); await page.keyboard.press('Enter'); }
async function type(page: Page, target: Locator, value: string) { await tabTo(page, target); await page.keyboard.press('Control+A'); await page.keyboard.insertText(value); }
async function assertContrast(target: Locator) {
  const ratio = await target.evaluate(el => {
    const luminance = (color: string) => {
      const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(v => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    let background: Element | null = el;
    while (background && getComputedStyle(background).backgroundColor === 'rgba(0, 0, 0, 0)') background = background.parentElement;
    const fg = luminance(getComputedStyle(el).color), bg = luminance(background ? getComputedStyle(background).backgroundColor : 'rgb(255, 255, 255)');
    return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
  return ratio;
}

test('keyboard-only create/open/edit/save/return/ADR linking and exact recovery with visible focus', async ({ page }) => {
  test.setTimeout(90_000);
  const diagrams = new DiagramRepository(); diagrams.create(componentContextFixture()); diagrams.create(componentParentFixture());
  const app = buildApp(diagrams);
  await page.route(/\/api\/(?:diagrams|adrs)(?:\/|$|\?)/, async route => {
    const request = route.request(), url = new URL(request.url());
    const response = await app.inject({ method: request.method() as any, url: url.pathname.replace(/^\/api/, '') + url.search, ...(request.postData() ? { payload: JSON.parse(request.postData()!) } : {}) });
    await route.fulfill({ status: response.statusCode, contentType: 'application/json', body: response.body });
  });
  const button = (name: string | RegExp) => page.getByRole('button', { name, exact: true });
  try {
    await page.goto('/');
    await activate(page, page.locator(`.saved-diagram-button[data-diagram-id="${ids.parent}"]`));
    await activate(page, page.locator(`.react-flow__node[data-id="${ids.application}"] .component-node`));
    await activate(page, button('Create component diagram'));
    await expect(page.locator('#component-diagram-heading')).toBeFocused();
    await expect.poll(() => page.locator('#component-diagram-heading').evaluate(el => parseFloat(getComputedStyle(el).outlineWidth))).toBeGreaterThan(0);
    const child = diagrams.listAll().find(d => d.kind === 'component')!;
    await expect(page.getByLabel('Diagram name', { exact: true })).toHaveAttribute('readonly', '');
    await expect(page.locator('#component-diagram-name-help')).toContainText('Software System: Payments. Parent Container: Payments.');
    await activate(page, button('Add component').first());
    await type(page, page.getByLabel('Component name', { exact: true }), 'Keyboard handler');
    await type(page, page.getByLabel('Technology', { exact: true }), 'TypeScript');
    await activate(page, button('Add component').last());
    await expect(page.getByLabel('Responsibilities', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('Component name', { exact: true })).toHaveValue('Keyboard handler');
    await type(page, page.getByLabel('Responsibilities', { exact: true }), 'Validates requests');
    await activate(page, button('Add component').last());
    await activate(page, button('Save')); await expect(page.locator('.save-status')).toHaveText('Saved');
    const internal = diagrams.get(child.id)!.components[0];
    await activate(page, button('Include external participant').first());
    const participant = page.getByLabel('External participant', { exact: true });
    await tabTo(page, participant); await page.keyboard.press('Home');
    for (let i = 0; i < 5 && await participant.inputValue() !== ids.datastore; i++) await page.keyboard.press('ArrowDown');
    await expect(participant).toHaveValue(ids.datastore); await activate(page, button('Include participant'));
    await activate(page, button('Save')); await expect(page.locator('.save-status')).toHaveText('Saved');
    const supporting = diagrams.get(child.id)!.components.find(c => c.role === 'external')!;
    await expect(page.locator(`.react-flow__node[data-id="${supporting.id}"]`)).toContainText('Datastore · Supporting');
    const node = page.locator(`.react-flow__node[data-id="${internal.id}"] .component-node`);
    await expect(node).toContainText('Component'); await activate(page, node);
    await type(page, page.getByLabel('Responsibilities', { exact: true }), 'Handles keyboard requests');
    const contrast = { responsibilities: await assertContrast(page.getByLabel('Responsibilities', { exact: true })), scope: await assertContrast(page.locator('#component-diagram-name-help')), save: await assertContrast(button('Save')) };
    await activate(page, button('Save component'));
    const returnButton = button(/^Return to Payments, owner Payment API/);
    await activate(page, returnButton); await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.keyboard.press('Escape'); await expect(returnButton).toBeFocused();
    await activate(page, button('Save')); await expect(page.locator('.save-status')).toHaveText('Saved');
    await activate(page, button('Decision'));
    for (const [label, value] of [['Title required', 'Keyboard decision'], ['Context required', 'Keyboard workflow'], ['Decision required', 'Keep stable references'], ['Consequences required', 'Accessible review']]) await type(page, page.getByLabel(label, { exact: true }), value);
    const link = page.getByRole('checkbox', { name: 'Keyboard handler', exact: true });
    await tabTo(page, link); await page.keyboard.press('Space'); await expect(link).toBeChecked();
    const supportingLink = page.getByRole('checkbox', { name: 'Payment API', exact: true });
    await tabTo(page, supportingLink); await page.keyboard.press('Space'); await expect(supportingLink).toBeChecked();
    await activate(page, button('Save decision')); await expect(button('Delete decision')).toBeVisible();
    await activate(page, returnButton); await expect(page.locator('#container-diagram-heading')).toBeFocused();
    await expect(page.getByLabel('Component name', { exact: true })).toHaveValue('Payment API');
    await activate(page, button('Open component diagram')); await expect(page.locator('#component-diagram-heading')).toBeFocused();
    const remove = page.locator(`.saved-diagram-row:has([data-diagram-id="${child.id}"]) .saved-diagram-delete`);
    await activate(page, remove); await expect(page.getByRole('alertdialog')).toContainText('Component diagram, owner Payment API');
    await page.keyboard.press('Escape'); await expect(remove).toBeFocused(); expect(diagrams.get(child.id)?.status).toBe('active');
    await activate(page, remove);
    const confirm = button('Move to trash');
    const rect = await confirm.boundingBox(); expect(rect!.height).toBeGreaterThanOrEqual(44); expect(rect!.width).toBeGreaterThanOrEqual(44);
    const recoveryContrast = await assertContrast(confirm);
    await activate(page, confirm); await expect.poll(() => diagrams.get(child.id)?.status).toBe('trashed');
    await activate(page, button('Open recovery'));
    await activate(page, page.locator(`.saved-diagram-trash-row[data-diagram-id="${child.id}"]`).getByRole('button', { name: 'Restore', exact: true }));
    await activate(page, button('Restore diagrams')); await expect(page.locator('#component-diagram-heading')).toBeFocused();
    expect(diagrams.get(child.id)!.components[0].id).toBe(internal.id);
    await page.screenshot({ path: 'test-results/phase8-keyboard-component.png', fullPage: true });
    console.info('Spec 010 keyboard audit:', JSON.stringify({ nativeTraversal: true, minimumActionTarget: 44, contrast: { ...contrast, recovery: recoveryContrast }, canceledNavigationAndRecoveryFocusReturn: true }));
  } finally { await app.close(); }
});
