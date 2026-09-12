import { expect, test, type Page } from '@playwright/test';

const diagram = { id: '00000000-0000-0000-0000-000000000401', name: 'System context', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', trashedAt: null, components: [], relationships: [], groups: [] };

async function mockDiagramApi(page: Page) {
  let latest = structuredClone(diagram);
  await page.route('**/api/diagrams', async route => {
    if (route.request().method() === 'POST') return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(latest) });
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify([latest]) });
  });
  await page.route('**/api/diagrams/**', async route => {
    if (route.request().method() === 'PUT') {
      latest = route.request().postDataJSON();
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(latest) });
    }
    if (route.request().method() === 'GET') return route.fulfill({ contentType: 'application/json', body: JSON.stringify(latest) });
    return route.fallback();
  });
}

test('creates typed C4 components, supports cancellation, and reopens their types', async ({ page }) => {
  await mockDiagramApi(page);
  await page.goto('/');
  await page.getByLabel('Diagram name').fill('System context');
  await page.getByRole('button', { name: 'Create diagram' }).click();

  await page.getByRole('button', { name: 'Add component' }).click();
  const inspector = page.getByLabel('Diagram inspector');
  await inspector.getByLabel('Component name').fill('Operator');
  await inspector.getByRole('radio', { name: /Person/ }).check();
  await inspector.getByRole('button', { name: 'Add component' }).click();

  await page.getByRole('button', { name: 'Add component' }).click();
  await inspector.getByLabel('Component name').fill('Billing');
  await inspector.getByRole('radio', { name: /Software System/ }).check();
  await inspector.getByRole('button', { name: 'Add component' }).click();
  await expect(page.locator('.component-node')).toHaveCount(2);
  await expect(page.locator('.component-node-person')).toContainText('Person');
  await expect(page.locator('.component-node-software-system')).toContainText('Software System');

  await page.getByRole('button', { name: 'Add component' }).click();
  await inspector.getByLabel('Component name').fill('Cancelled');
  await inspector.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('.component-node')).toHaveCount(2);

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await page.getByRole('button', { name: /System context, last saved/ }).click();
  await expect(page.locator('.component-node')).toHaveCount(2);
  await expect(page.getByLabel('Component Operator, Person')).toBeVisible();
  await expect(page.getByLabel('Component Billing, Software System')).toBeVisible();
});

test('groups selected systems, reviews and renames the boundary, removes a member, and ungroups safely', async ({ page }) => {
  await mockDiagramApi(page);
  await page.goto('/');
  await page.getByLabel('Diagram name').fill('System context');
  await page.getByRole('button', { name: 'Create diagram' }).click();

  const inspector = page.getByLabel('Diagram inspector');
  for (const name of ['Billing', 'Ledger', 'Notifications']) {
    await page.getByRole('button', { name: 'Add component' }).click();
    await inspector.getByLabel('Component name').fill(name);
    await inspector.getByRole('radio', { name: /Software System/ }).check();
    await inspector.getByRole('button', { name: 'Add component' }).click();
  }

  await page.getByLabel('Component Billing, Software System').click();
  await page.getByLabel('Component Ledger, Software System').click({ modifiers: ['Shift'] });
  await page.getByLabel('Component Notifications, Software System').click({ modifiers: ['Shift'] });
  const groupCommand = page.getByRole('button', { name: 'Group selected systems', exact: true });
  await expect(groupCommand).toBeEnabled();
  await groupCommand.click();
  await inspector.getByLabel('Group name').fill(' Finance ');
  await inspector.getByRole('button', { name: 'Group selected systems', exact: true }).click();

  const groupBoundary = page.getByLabel('System group Finance, 3 Software System members');
  await expect(groupBoundary).toBeVisible();
  const groupBox = await groupBoundary.boundingBox();
  expect(groupBox).not.toBeNull();
  if (!groupBox) throw new Error('The Finance group boundary has no bounding box');
  for (const name of ['Billing', 'Ledger', 'Notifications']) {
    const memberBox = await page.getByLabel(`Component ${name}, Software System`).boundingBox();
    expect(memberBox).not.toBeNull();
    if (!memberBox) throw new Error(`${name} has no bounding box`);
    expect(memberBox.x).toBeGreaterThanOrEqual(groupBox.x - 1);
    expect(memberBox.y).toBeGreaterThanOrEqual(groupBox.y - 1);
    expect(memberBox.x + memberBox.width).toBeLessThanOrEqual(groupBox.x + groupBox.width + 1);
    expect(memberBox.y + memberBox.height).toBeLessThanOrEqual(groupBox.y + groupBox.height + 1);
  }

  await page.getByLabel(/System group Finance, 3 Software System members/).click();
  await inspector.getByLabel('Group name').fill(' Core Finance ');
  await inspector.getByRole('button', { name: 'Rename group' }).click();
  await expect(page.getByLabel(/System group Core Finance, 3 Software System members/)).toBeVisible();

  await inspector.getByRole('button', { name: 'Remove from group' }).first().click();
  await expect(page.getByLabel(/System group Core Finance, 2 Software System members/)).toBeVisible();
  await inspector.getByRole('button', { name: 'Ungroup', exact: true }).click();
  await page.locator('.confirm-dialog').getByRole('button', { name: 'Ungroup', exact: true }).click();

  await expect(page.locator('.system-group-node')).toHaveCount(0);
  await expect(page.locator('.component-node')).toHaveCount(3);
});

