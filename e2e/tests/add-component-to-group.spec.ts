import { expect, test, type Page } from '@playwright/test';

const diagramId = '00000000-0000-4000-8000-000000000801';
const timestamp = '2026-01-01T00:00:00.000Z';
const component = (id: string, name: string, x: number, y: number) => ({ id, diagramId, name, description: null, type: 'software-system', position: { x, y }, createdAt: timestamp, updatedAt: timestamp });

const initialDocument = {
  id: diagramId,
  name: 'System context',
  status: 'active',
  createdAt: timestamp,
  updatedAt: timestamp,
  trashedAt: null,
  components: [
    component('00000000-0000-4000-8000-000000000802', 'Billing', 100, 100),
    component('00000000-0000-4000-8000-000000000803', 'Ledger', 340, 180),
    component('00000000-0000-4000-8000-000000000804', 'Notifications', 620, 260),
    component('00000000-0000-4000-8000-000000000805', 'Reporting', 860, 340),
    component('00000000-0000-4000-8000-000000000806', 'Support', 1080, 420),
  ],
  relationships: [],
  groups: [
    { id: '00000000-0000-4000-8000-000000000807', diagramId, name: 'Platform', memberComponentIds: ['00000000-0000-4000-8000-000000000802', '00000000-0000-4000-8000-000000000803'], position: { x: 68, y: 44 }, size: { width: 484, height: 240 }, createdAt: timestamp, updatedAt: timestamp },
    { id: '00000000-0000-4000-8000-000000000808', diagramId, name: 'Operations', memberComponentIds: ['00000000-0000-4000-8000-000000000805', '00000000-0000-4000-8000-000000000806'], position: { x: 828, y: 284 }, size: { width: 484, height: 240 }, createdAt: timestamp, updatedAt: timestamp },
  ],
};

async function mockCompleteDocumentApi(page: Page) {
  let latest = structuredClone(initialDocument);
  await page.route('**/api/diagrams', async route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ id: latest.id, name: latest.name, status: latest.status, createdAt: latest.createdAt, updatedAt: latest.updatedAt, trashedAt: latest.trashedAt }]) });
    }
    return route.fallback();
  });
  await page.route('**/api/diagrams/**', async route => {
    const method = route.request().method();
    const url = route.request().url();
    if (method === 'PUT') {
      latest = route.request().postDataJSON();
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(latest) });
    }
    if (method === 'GET' && url.includes('/component-adr-counts')) return route.fulfill({ contentType: 'application/json', body: '[]' });
    if (method === 'GET') return route.fulfill({ contentType: 'application/json', body: JSON.stringify(latest) });
    return route.fallback();
  });
  return { getLatest: () => latest };
}

test('selects an outside component, adds it to the target group, and saves the fitted membership', async ({ page }) => {
  const api = await mockCompleteDocumentApi(page);
  await page.goto('/');
  await page.getByRole('button', { name: /System context, last saved/ }).click();

  const inspector = page.getByLabel('Diagram inspector');
  const targetGroup = page.getByLabel(/System group Platform, 2 Software System members/);
  const candidate = page.getByLabel(/Component Notifications, Software System/);
  await targetGroup.locator('.group-boundary-label').click();
  await candidate.click({ modifiers: ['Shift'] });
  await expect(inspector.getByText('Candidate component')).toBeVisible();
  const addButton = inspector.getByRole('button', { name: 'Add Notifications to Platform' });
  await expect(addButton).toBeEnabled();
  await addButton.focus();
  await page.keyboard.press('Enter');

  await expect(page.getByLabel(/System group Platform, 3 Software System members/)).toBeVisible();
  await expect(inspector.getByText(/Notifications was added to Platform/)).toBeVisible();
  const boundary = page.getByLabel(/System group Platform, 3 Software System members/);
  const boundaryBox = await boundary.boundingBox();
  const candidateBox = await page.getByLabel(/Component Notifications, Software System/).boundingBox();
  expect(boundaryBox).not.toBeNull();
  expect(candidateBox).not.toBeNull();
  if (boundaryBox && candidateBox) {
    expect(candidateBox.x).toBeGreaterThanOrEqual(boundaryBox.x - 1);
    expect(candidateBox.y).toBeGreaterThanOrEqual(boundaryBox.y - 1);
    expect(candidateBox.x + candidateBox.width).toBeLessThanOrEqual(boundaryBox.x + boundaryBox.width + 1);
    expect(candidateBox.y + candidateBox.height).toBeLessThanOrEqual(boundaryBox.y + boundaryBox.height + 1);
  }

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.save-status')).toHaveText('Saved');
  expect(api.getLatest().groups[0].memberComponentIds).toEqual(['00000000-0000-4000-8000-000000000802', '00000000-0000-4000-8000-000000000803', '00000000-0000-4000-8000-000000000804']);
  await page.getByRole('button', { name: /System context, last saved/ }).click();
  await expect(page.getByLabel(/System group Platform, 3 Software System members/)).toBeVisible();
  await expect(page.getByLabel(/Component Notifications, Software System/)).toBeVisible();
});

test('explains duplicate and conflicting candidates without changing membership', async ({ page }) => {
  const api = await mockCompleteDocumentApi(page);
  await page.goto('/');
  await page.getByRole('button', { name: /System context, last saved/ }).click();

  const inspector = page.getByLabel('Diagram inspector');
  const platform = page.getByLabel(/System group Platform, 2 Software System members/);
  await platform.locator('.group-boundary-label').click();
  await page.getByLabel(/Component Billing, Software System/).click({ modifiers: ['Shift'] });
  await expect(inspector.getByRole('alert')).toHaveText(/Billing is already in Platform.*cannot be added again/i);
  await expect(inspector.getByRole('button', { name: 'Add Billing to Platform' })).toBeDisabled();
  await inspector.getByRole('button', { name: 'Cancel' }).click();
  await expect(inspector.getByText('Candidate component')).not.toBeVisible();

  await page.getByLabel(/System group Platform, 2 Software System members/).locator('.group-boundary-label').click();
  await page.getByLabel(/Component Reporting, Software System/).click({ modifiers: ['Shift'] });
  await expect(inspector.getByRole('alert')).toHaveText(/Reporting already belongs to Operations.*Platform.*only one group/i);
  await expect(inspector.getByRole('button', { name: 'Add Reporting to Platform' })).toBeDisabled();
  await inspector.getByRole('button', { name: 'Cancel' }).click();
  expect(api.getLatest().groups).toEqual(initialDocument.groups);
});
