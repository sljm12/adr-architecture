import { expect, test, type Page } from '@playwright/test';

const documentFixture = {
  id: '00000000-0000-4000-8000-000000000801',
  name: 'Responsive workspace',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  trashedAt: null,
  components: [{
    id: '00000000-0000-4000-8000-000000000802',
    diagramId: '00000000-0000-4000-8000-000000000801',
    name: 'API',
    description: null,
    type: null,
    position: { x: 0, y: 0 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }],
  relationships: [],
  groups: [],
};

async function mockApi(page: Page) {
  await page.route('**/api/diagrams**', route => {
    const path = new URL(route.request().url()).pathname;
    const body = path === '/api/diagrams'
      ? [{ ...documentFixture, components: undefined, relationships: undefined, groups: undefined }]
      : path.endsWith('/component-adr-counts') ? [] : documentFixture;
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
}

test('fits the workspace at desktop, tablet, and mobile widths', async ({ page }) => {
  await mockApi(page);

  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Saved diagrams' })).toBeVisible();
    await page.getByRole('button', { name: /Responsive workspace, last saved/ }).click();
    await expect(page.getByRole('button', { name: 'Show Details panel' })).toBeVisible();

    const metrics = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth);
  }
});
