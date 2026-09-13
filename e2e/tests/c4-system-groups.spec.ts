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

  await page.locator('.command-bar').getByRole('button', { name: 'Add component' }).click();
  const inspector = page.getByLabel('Diagram inspector');
  await inspector.getByLabel('Component name').fill('Operator');
  await inspector.getByRole('radio', { name: /Person/ }).check();
  await inspector.getByRole('button', { name: 'Add component' }).click();

  await page.locator('.command-bar').getByRole('button', { name: 'Add component' }).click();
  await inspector.getByLabel('Component name').fill('Billing');
  await inspector.getByRole('radio', { name: /Software System/ }).check();
  await inspector.getByRole('button', { name: 'Add component' }).click();
  await expect(page.locator('.component-node')).toHaveCount(2);
  await expect(page.locator('.component-node-person')).toContainText('Person');
  await expect(page.locator('.component-node-software-system')).toContainText('Software System');

  await page.locator('.command-bar').getByRole('button', { name: 'Add component' }).click();
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
    await page.locator('.command-bar').getByRole('button', { name: 'Add component' }).click();
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

  await page.getByLabel(/System group Finance, 3 Software System members/).locator('.group-boundary-label').click();
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

async function createTypedComponent(page: Page, name: string, type: 'Person' | 'Software System') {
  const inspector = page.getByLabel('Diagram inspector');
  await page.locator('.command-bar').getByRole('button', { name: 'Add component' }).click();
  await inspector.getByLabel('Component name').fill(name);
  await inspector.getByRole('radio', { name: new RegExp(type) }).check();
  await inspector.getByRole('button', { name: 'Add component' }).click();
}

async function createMockDiagram(page: Page) {
  await mockDiagramApi(page);
  await page.goto('/');
  await page.getByLabel('Diagram name').fill('System context');
  await page.getByRole('button', { name: 'Create diagram' }).click();
}

test('identifies each selected component and clears feedback after deselection, cancellation, and grouping', async ({ page }) => {
  await createMockDiagram(page);
  await createTypedComponent(page, 'Billing', 'Software System');
  await createTypedComponent(page, 'Ledger', 'Software System');

  const billing = page.getByLabel('Component Billing, Software System');
  const ledger = page.getByLabel('Component Ledger, Software System');
  await billing.click();
  await ledger.click({ modifiers: ['Shift'] });
  await expect(page.locator('.selection-feedback')).toContainText('Billing (Software System)');
  await expect(page.locator('.selection-feedback')).toContainText('Ledger (Software System)');
  await expect(billing).toHaveClass(/is-selected/);
  await expect(ledger).toHaveClass(/is-selected/);
  await expect(billing.locator('.component-selection-state')).toHaveText('Selected');
  await expect(ledger.locator('.component-selection-state')).toHaveText('Selected');

  await ledger.click({ modifiers: ['Shift'] });
  await expect(page.locator('.selection-feedback')).toContainText('Billing (Software System)');
  await expect(page.locator('.selection-feedback')).not.toContainText('Ledger (Software System)');
  await expect(ledger).not.toHaveClass(/is-selected/);
  await expect(ledger.locator('.component-selection-state')).toHaveCount(0);

  await ledger.click({ modifiers: ['Shift'] });
  await page.getByRole('button', { name: 'Group selected systems', exact: true }).click();
  await page.getByLabel('Group name').fill('Finance');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.selection-feedback')).toHaveCount(0);
  await expect(billing.locator('.component-selection-state')).toHaveCount(0);
  await expect(ledger.locator('.component-selection-state')).toHaveCount(0);

  await billing.click();
  await ledger.click({ modifiers: ['Shift'] });
  await page.getByRole('button', { name: 'Group selected systems', exact: true }).click();
  await page.getByLabel('Group name').fill('Finance');
  await page.getByLabel('Diagram inspector').getByRole('button', { name: 'Group selected systems', exact: true }).click();
  await expect(page.locator('[aria-label^="System group"]')).toHaveCount(1);
  await expect(page.locator('.selection-feedback')).toHaveCount(0);
});

test('rejects mixed Person and Software System selections with an explanation and no mutation', async ({ page }) => {
  await createMockDiagram(page);
  await createTypedComponent(page, 'Operator', 'Person');
  await createTypedComponent(page, 'Billing', 'Software System');

  await page.getByLabel('Component Operator, Person').click();
  await page.getByLabel('Component Billing, Software System').click({ modifiers: ['Shift'] });
  await expect(page.locator('.selection-feedback-error')).toContainText('Operator (Person)');
  await expect(page.locator('.selection-feedback-error')).toContainText('Software System');
  await expect(page.locator('.selection-feedback-error')).toContainText('Person cannot be grouped with a Software System');
  await expect(page.getByRole('button', { name: /Person cannot be grouped with a Software System/ })).toBeDisabled();
  await expect(page.locator('.system-group-node')).toHaveCount(0);
  await expect(page.locator('.component-node')).toHaveCount(2);

  await page.locator('.react-flow__pane').click({ position: { x: 20, y: 20 } });
  await expect(page.locator('.selection-feedback')).toHaveCount(0);
});

test('refits the boundary when members cross every edge and persists the fitted layout', async ({ page }) => {
  await createMockDiagram(page);
  await createTypedComponent(page, 'Billing', 'Software System');
  await createTypedComponent(page, 'Ledger', 'Software System');

  const billing = page.getByLabel('Component Billing, Software System');
  const ledger = page.getByLabel('Component Ledger, Software System');
  await billing.click();
  await ledger.click({ modifiers: ['Shift'] });
  await page.getByRole('button', { name: 'Group selected systems', exact: true }).click();
  await page.getByLabel('Group name').fill('Finance');
  await page.getByLabel('Diagram inspector').getByRole('button', { name: 'Group selected systems', exact: true }).click();

  const boundary = page.getByLabel('System group Finance, 2 Software System members');
  const assertEnclosesMembers = async () => {
    const groupBox = await boundary.boundingBox();
    expect(groupBox).not.toBeNull();
    if (!groupBox) throw new Error('The Finance group boundary has no bounding box');
    for (const member of [billing, ledger]) {
      const memberBox = await member.boundingBox();
      expect(memberBox).not.toBeNull();
      if (!memberBox) throw new Error('A group member has no bounding box');
      expect(memberBox.x).toBeGreaterThanOrEqual(groupBox.x - 1);
      expect(memberBox.y).toBeGreaterThanOrEqual(groupBox.y - 1);
      expect(memberBox.x + memberBox.width).toBeLessThanOrEqual(groupBox.x + groupBox.width + 1);
      expect(memberBox.y + memberBox.height).toBeLessThanOrEqual(groupBox.y + groupBox.height + 1);
    }
  };
  const dragMember = async (member: typeof billing, dx: number, dy: number) => {
    const box = await member.boundingBox();
    expect(box).not.toBeNull();
    if (!box) throw new Error('The member has no bounding box');
    const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + dx, start.y + dy, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(100);
  };

  const initialBox = await boundary.boundingBox();
  expect(initialBox).not.toBeNull();
  if (!initialBox) throw new Error('The initial Finance boundary has no bounding box');
  await assertEnclosesMembers();
  await dragMember(billing, 420, 0);
  await assertEnclosesMembers();
  await dragMember(billing, -720, 0);
  await assertEnclosesMembers();
  await dragMember(billing, 0, 420);
  await assertEnclosesMembers();
  await dragMember(billing, 0, -720);
  await assertEnclosesMembers();
  const expandedBox = await boundary.boundingBox();
  expect(expandedBox).not.toBeNull();
  if (!expandedBox) throw new Error('The expanded Finance boundary has no bounding box');
  expect(expandedBox.width).toBeGreaterThanOrEqual(initialBox.width);
  const currentLedgerBox = await ledger.boundingBox();
  const currentBillingBox = await billing.boundingBox();
  expect(currentLedgerBox).not.toBeNull();
  expect(currentBillingBox).not.toBeNull();
  if (!currentLedgerBox || !currentBillingBox) throw new Error('A member has no bounding box before shrink-to-fit');
  await dragMember(ledger, currentBillingBox.x - currentLedgerBox.x, currentBillingBox.y - currentLedgerBox.y);
  await assertEnclosesMembers();
  const shrunkBox = await boundary.boundingBox();
  expect(shrunkBox).not.toBeNull();
  if (!shrunkBox) throw new Error('The shrunk Finance boundary has no bounding box');
  expect(shrunkBox.width).toBeLessThan(expandedBox.width);
  expect(shrunkBox.height).toBeLessThan(expandedBox.height);

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.save-status')).toHaveText('Saved');
  await page.getByRole('button', { name: /System context, last saved/ }).click();
  await expect(boundary).toBeVisible();
  await assertEnclosesMembers();
});

