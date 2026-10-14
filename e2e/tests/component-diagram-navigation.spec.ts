import { test, expect } from '@playwright/test';
import { buildApp } from '../../backend/src/api/app';
import { DiagramRepository } from '../../backend/src/persistence/diagram-repository';
import { componentContextFixture, componentParentFixture, populatedComponentFixture, componentFixtureIds as ids } from '../../shared/tests/component-fixtures';
import type { DiagramDocument } from '../../shared/src/index';

test('saves twice, returns through ancestors, previews owner names and reopens the UUID-nested child', async ({ page }) => {
  const repository = new DiagramRepository(); for (const d of [componentContextFixture(), componentParentFixture(), populatedComponentFixture()]) repository.create(d as DiagramDocument);
  const app = buildApp(repository); let failSave = false;
  await page.route(/\/api\/(?:diagrams|adrs)(?:\/|$|\?)/, async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace(/^\/api/, '');
    if (failSave && request.method() === 'PUT') { failSave = false; await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Injected save failure' }) }); return; }
    const response = await app.inject({ method: request.method() as import('light-my-request').InjectOptions['method'], url: path, ...(request.postData() ? { payload: JSON.parse(request.postData()!) } : {}) });
    await route.fulfill({ status: response.statusCode, contentType: 'application/json', body: response.body });
  });
  try {
    await page.goto('/'); const row = (id: string) => page.locator(`.saved-diagram-button[data-diagram-id="${id}"]`);
    await row(ids.child).click(); await expect(page.locator('#component-diagram-heading')).toBeFocused();
    for (let i = 0; i < 2; i++) { await page.getByRole('button', { name: 'Save', exact: true }).click(); await expect(page.locator('.save-status')).toContainText('Saved'); }
    await page.getByRole('button', { name: 'Return to Payments, owner Payment API', exact: true }).click(); await expect(page.locator('#container-diagram-heading')).toBeFocused();
    await expect(page.getByLabel('Component name', { exact: true })).toHaveValue('Payment API');
    await page.getByLabel('Component name', { exact: true }).fill('Draft API'); await page.getByRole('button', { name: 'Save component', exact: true }).click();
    await page.getByLabel('Filter diagrams by name', { exact: true }).fill('Draft API'); await expect(row(ids.child)).toBeVisible();
    await expect(page.locator(`[data-parent-diagram-id="${ids.context}"] [data-container-diagram-id="${ids.parent}"] [data-diagram-id="${ids.child}"]`)).toBeVisible();
    await expect(page.locator('#saved-diagrams-filter-status')).toContainText('1 of 3');
    await page.getByRole('button', { name: /Return to Payments architecture/ }).click(); await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(page.locator('#container-diagram-heading')).toBeVisible();
    failSave = true; await page.getByRole('button', { name: /Return to Payments architecture/ }).click(); await page.getByRole('alertdialog').getByRole('button', { name: 'Save and load', exact: true }).click();
    await expect(page.locator('.save-status')).toContainText('failed'); await expect(page.locator('#container-diagram-heading')).toBeVisible();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Discard and load', exact: true }).click(); await expect(page.locator('#diagram-heading')).toBeFocused();
    await page.getByRole('button', { name: 'Clear filters', exact: true }).first().click(); await row(ids.child).click(); await expect(page.getByLabel('Diagram name', { exact: true })).toHaveValue('Payment API');
    await page.reload(); await row(ids.child).click(); await expect(page.locator('#component-diagram-heading')).toBeFocused();
    expect(repository.findChildren(ids.parent)).toHaveLength(1);
    await page.screenshot({ path: 'test-results/component-navigation.png' });
  } finally { await app.close(); }
});

for (const [level, currentId, destinationId] of [
  ['Component', ids.child, ids.parent], ['Container', ids.parent, ids.context], ['Context', ids.context, ids.child],
] as const) test(`guards ${level} ADR navigation through Cancel, failed Save, Save and Discard`, async ({ page }) => {
  const repository = new DiagramRepository(); for (const d of [componentContextFixture(), componentParentFixture(), populatedComponentFixture()]) repository.create(d as DiagramDocument);
  const app = buildApp(repository); let failAdrSave = false;
  await page.route(/\/api\/(?:diagrams|adrs)(?:\/|$|\?)/, async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace(/^\/api/, '');
    if (failAdrSave && request.method() === 'POST' && path.endsWith('/adrs')) { failAdrSave = false; await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Injected ADR save failure' }) }); return; }
    const response = await app.inject({ method: request.method() as import('light-my-request').InjectOptions['method'], url: path, ...(request.postData() ? { payload: JSON.parse(request.postData()!) } : {}) });
    await route.fulfill({ status: response.statusCode, contentType: 'application/json', body: response.body });
  });
  const row = (id: string) => page.locator(`.saved-diagram-button[data-diagram-id="${id}"]`);
  const currentHeading = () => page.locator(currentId === ids.child ? '#component-diagram-heading' : currentId === ids.parent ? '#container-diagram-heading' : '#diagram-heading');
  try {
    await page.goto('/'); await row(currentId).click(); await page.getByRole('button', { name: 'Decision', exact: true }).click();
    for (const field of ['Title', 'Context', 'Decision', 'Consequences']) await page.getByLabel(`${field} required`, { exact: true }).fill(`${level} ${field}`);
    await row(destinationId).click(); await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByLabel('Title required', { exact: true })).toHaveValue(`${level} Title`);
    failAdrSave = true; await row(destinationId).click(); await page.getByRole('alertdialog').getByRole('button', { name: 'Save and load', exact: true }).click();
    await expect(page.getByText('Injected ADR save failure', { exact: true })).toBeVisible(); await expect(currentHeading()).toBeVisible();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Save and load', exact: true }).click(); await expect(row(destinationId)).toHaveAttribute('aria-current', 'true');
    await row(currentId).click(); await page.getByRole('button', { name: 'Decision', exact: true }).click(); await expect(page.getByLabel('Title required', { exact: true })).toHaveValue(`${level} Title`);
    await page.getByLabel('Title required', { exact: true }).fill('Discard this revision'); await row(destinationId).click(); await page.getByRole('alertdialog').getByRole('button', { name: 'Discard and load', exact: true }).click();
    await expect(row(destinationId)).toHaveAttribute('aria-current', 'true');
    const records = (await app.inject(`/diagrams/${currentId}/adrs`)).json(); expect(records).toHaveLength(1); expect(records[0].title).toBe(`${level} Title`);
  } finally { await app.close(); }
});
