import { test, expect, type Page } from '@playwright/test';
import { buildApp } from '../../backend/src/api/app';
import { componentRecoveryFixture } from '../../backend/tests/component-recovery-fixture';
import { componentFixtureIds as ids } from '../../shared/tests/component-fixtures';
import { libraryAction, openLibraryDiagram } from './library-controls';

async function setup(page: Page) {
  const repository = componentRecoveryFixture(), app = buildApp(repository);
  await page.route(/\/api\/(?:diagrams|adrs)(?:\/|$|\?)/, async route => {
    const request = route.request();
    const response = await app.inject({ method: request.method() as import('light-my-request').InjectOptions['method'], url: new URL(request.url()).pathname.replace(/^\/api/, ''), ...(request.postData() ? { payload: JSON.parse(request.postData()!) } : {}) });
    await route.fulfill({ status: response.statusCode, contentType: 'application/json', body: response.body });
  });
  await page.goto('/');
  return { repository, app };
}

const diagram = (page: Page, id: string) => page.locator(`.saved-diagram-button[data-diagram-id="${id}"]`);
const toggle = (page: Page, id: string) => page.locator(`button[aria-controls="diagram-children-${id}"]`);
const actions = (page: Page, id: string) => page.locator(`.saved-diagram-row:has([data-diagram-id="${id}"]) .saved-diagram-actions`);

test('starts collapsed, expands independently of opening, and restores expansion after search', async ({ page }) => {
  const { app } = await setup(page);
  try {
    await expect(diagram(page, ids.context)).toBeVisible();
    await expect(diagram(page, ids.parent)).toBeHidden();
    await expect(page.locator('.saved-diagrams-filter-disclosure')).not.toHaveAttribute('open');
    await toggle(page, ids.context).click();
    await expect(diagram(page, ids.parent)).toBeVisible();
    await expect(diagram(page, ids.child)).toBeHidden();
    await expect(page.getByRole('button', { name: 'Create diagram', exact: true })).toBeVisible();
    await toggle(page, ids.context).click();
    await page.getByLabel('Filter diagrams by name').fill('Payment API');
    await expect(diagram(page, ids.child)).toBeVisible();
    await expect(diagram(page, ids.datastoreChild)).toBeVisible();
    await page.getByLabel('Filter diagrams by name').fill('');
    await expect(diagram(page, ids.parent)).toBeHidden();
    await toggle(page, ids.context).click();
    await toggle(page, ids.parent).click();
    await expect(diagram(page, ids.child)).toBeVisible();
  } finally { await app.close(); }
});

test('reveals ancestors when opening children from the canvas and respects later manual collapse', async ({ page }) => {
  const { app } = await setup(page);
  try {
    await openLibraryDiagram(page, ids.context);
    await page.locator(`.react-flow__node[data-id="${ids.system}"] .component-node`).dblclick();
    await expect(diagram(page, ids.parent)).toHaveAttribute('aria-current', 'true');
    await expect(toggle(page, ids.context)).toHaveAttribute('aria-expanded', 'true');
    await toggle(page, ids.context).click();
    await page.locator(`.react-flow__node[data-id="${ids.application}"] .component-node`).dblclick();
    await expect(diagram(page, ids.child)).toBeVisible();
    await expect(diagram(page, ids.child)).toHaveAttribute('aria-current', 'true');
    await toggle(page, ids.parent).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(diagram(page, ids.child)).toBeHidden();
  } finally { await app.close(); }
});

test('retains missing-parent context and lets users reveal children and refresh the library', async ({ page }) => {
  const { app } = await setup(page);
  try {
    const summaries = (await app.inject('/diagrams')).json() as Array<{ id: string }>;
    await page.route('**/api/diagrams', route => route.fulfill({ json: summaries.filter(item => item.id !== ids.context) }));
    await page.reload();
    await expect(page.getByText('Parent unavailable. Refresh the library to check availability.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh library' })).toBeVisible();
    await openLibraryDiagram(page, ids.child);
    await expect(diagram(page, ids.child)).toHaveAttribute('aria-current', 'true');
    await page.unroute('**/api/diagrams');
    await page.getByRole('button', { name: 'Refresh library' }).click();
    await expect(diagram(page, ids.context)).toBeVisible();
  } finally { await app.close(); }
});

test('supports menu keys, details focus trapping, single open menus, and outside dismissal', async ({ page }) => {
  const { app } = await setup(page);
  try {
    const trigger = actions(page, ids.context);
    await trigger.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem', { name: 'Details…' })).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.getByRole('menuitem', { name: 'Move to trash…' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Details…' })).toBeFocused();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Diagram details' });
    await expect(dialog).toContainText(ids.context);
    await expect(dialog).toContainText('Created:');
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Tab'); await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
    await trigger.click(); await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
    await trigger.click(); await page.getByLabel('Filter diagrams by name').click();
    await expect(page.getByRole('menu')).toHaveCount(0);
    await toggle(page, ids.context).click();
    await trigger.click(); await actions(page, ids.parent).focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('menu')).toHaveCount(1);
    await page.keyboard.press('Tab'); await expect(actions(page, ids.parent)).toBeFocused();
    await libraryAction(page, ids.parent, 'Details…');
    await expect(dialog).toContainText(`Parent ID: ${ids.context}`);
  } finally { await app.close(); }
});

test('keeps export, trash cancellation, and recovery actions tied to their UUID', async ({ page }) => {
  const { repository, app } = await setup(page);
  try {
    await libraryAction(page, ids.child, 'Export archive…');
    await expect(page.getByRole('dialog', { name: 'Review archive export' })).toContainText(ids.child);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Dismiss archive message' }).click();
    await libraryAction(page, ids.child, 'Move to trash…');
    await page.keyboard.press('Escape');
    await expect(actions(page, ids.child)).toBeFocused();
    expect(repository.get(ids.child)?.status).toBe('active');
    await libraryAction(page, ids.child, 'Move to trash…');
    await page.getByRole('button', { name: 'Move to trash', exact: true }).click();
    await expect(diagram(page, ids.child)).toHaveCount(0);
    await expect(page.getByLabel('Filter diagrams by name')).toBeFocused();
    await page.getByRole('button', { name: 'Open recovery' }).click();
    await libraryAction(page, ids.child, 'Restore', true);
    await page.getByRole('button', { name: 'Restore diagrams', exact: true }).click();
    await expect(diagram(page, ids.child)).toHaveAttribute('aria-current', 'true');
  } finally { await app.close(); }
});

test('fits long names, three levels, and menus at desktop and mobile sizes', async ({ page }) => {
  const { app } = await setup(page);
  try {
    await openLibraryDiagram(page, ids.context);
    const longName = 'Payments architecture with a deliberately long readable name';
    await page.getByLabel('Diagram name', { exact: true }).fill(longName);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await openLibraryDiagram(page, ids.child);
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      const sidebar = page.getByRole('complementary', { name: 'Diagram overview' });
      await expect(sidebar).toBeVisible();
      expect(await sidebar.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      await expect(diagram(page, ids.context).locator('strong')).toHaveText(longName);
      const titleHeight = await diagram(page, ids.context).locator('strong').evaluate(element => element.getBoundingClientRect().height);
      expect(titleHeight).toBeLessThanOrEqual(37);
      await actions(page, ids.child).click();
      const menu = await page.getByRole('menu').boundingBox();
      expect(menu!.x).toBeGreaterThanOrEqual(0); expect(menu!.x + menu!.width).toBeLessThanOrEqual(viewport.width);
      expect(menu!.y + menu!.height).toBeLessThanOrEqual(viewport.height);
      await page.keyboard.press('Escape');
      await page.screenshot({ path: `test-results/diagram-library-${viewport.width}.png` });
    }
  } finally { await app.close(); }
});
