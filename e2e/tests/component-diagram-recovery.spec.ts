import { libraryAction, openLibraryDiagram } from './library-controls';
import { test, expect } from '@playwright/test';
import { buildApp } from '../../backend/src/api/app';
import { componentRecoveryFixture } from '../../backend/tests/component-recovery-fixture';
import { componentFixtureIds as ids } from '../../shared/tests/component-fixtures';
import { DiagramService } from '../../backend/src/services/diagram-service';

for (const entry of ['library','inspector'] as const) test(`forwards current recovery tokens from the ${entry} controls after an archive epoch advance`, async ({ page }) => {
  const repository = componentRecoveryFixture(), app = buildApp(repository);
  await repository.withCollectionTransaction(d => d.advanceConfirmationEpochs([ids.child]));
  const confirmations: Array<Record<string, unknown>> = [];
  await page.route(/\/api\/(?:diagrams|adrs)(?:\/|$|\?)/, async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace(/^\/api/, '');
    const payload = request.postData() ? JSON.parse(request.postData()!) : undefined;
    if (request.method() === 'DELETE' || path.endsWith('/restore')) confirmations.push(payload);
    const response = await app.inject({ method: request.method() as import('light-my-request').InjectOptions['method'], url: path, ...(payload ? { payload } : {}) });
    await route.fulfill({ status: response.statusCode, contentType: 'application/json', body: response.body });
  });
  try {
    await page.goto('/');
    if (entry === 'library') await libraryAction(page, ids.child, 'Move to trash…');
    else {
      await openLibraryDiagram(page, ids.child);
      await page.getByRole('button', { name: 'Show Details panel', exact: true }).click();
      await page.getByText('Diagram management', { exact: true }).click();
      await page.getByRole('button', { name: 'Move diagram to trash', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Move to trash', exact: true }).click();
    await expect.poll(() => repository.get(ids.child)?.status).toBe('trashed');
    await page.getByRole('button', { name: 'Open recovery', exact: true }).click();
    await libraryAction(page, ids.child, 'Restore', true);
    await page.getByRole('button', { name: 'Restore diagrams', exact: true }).click();
    await expect.poll(() => repository.get(ids.child)?.status).toBe('active');
    expect(confirmations).toHaveLength(2);
    for (const confirmation of confirmations) expect(confirmation.impactToken).toMatch(/^[0-9a-f]{64}$/);
  } finally { await app.close(); }
});

for (const mode of ['trash', 'permanent'] as const) test(`keeps the local draft when ${mode} deletion rejects an open diagram's stale save`, async ({ page }) => {
  const repository = componentRecoveryFixture(), app = buildApp(repository), service = new DiagramService(repository);
  await page.route(/\/api\/(?:diagrams|adrs)(?:\/|$|\?)/, async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace(/^\/api/, '');
    const response = await app.inject({ method: request.method() as import('light-my-request').InjectOptions['method'], url: path, ...(request.postData() ? { payload: JSON.parse(request.postData()!) } : {}) });
    await route.fulfill({ status: response.statusCode, contentType: 'application/json', body: response.body });
  });
  try {
    await page.goto('/'); await openLibraryDiagram(page, ids.child);
    await page.getByRole('button', { name: 'Add component', exact: true }).first().click();
    await page.getByLabel('Component name', { exact: true }).fill('Retained unsaved handler');
    await page.getByLabel('Responsibilities', { exact: true }).fill('Retained local responsibilities');
    await page.getByLabel('Technology', { exact: true }).fill('TypeScript');
    await page.getByRole('button', { name: 'Add component', exact: true }).last().click();
    const preview = await service.previewDeletion({ selector: { id: ids.child }, mode });
    await service.executeDeletion(ids.child, { mode, confirmationToken: preview.confirmationToken });
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('.save-status')).toContainText('Save failed');
    await expect(page.locator('.react-flow__node').filter({ hasText: 'Retained unsaved handler' })).toBeVisible();
    expect(repository.get(ids.child)?.status).toBe(mode === 'trash' ? 'trashed' : undefined);
    if (mode === 'trash') {
      await service.restore(ids.child);
      await page.getByRole('button', { name: 'Save', exact: true }).click(); await expect(page.locator('.save-status')).toContainText('Saved');
      expect(repository.get(ids.child)!.components.some(c => c.name === 'Retained unsaved handler')).toBe(true);
    }
  } finally { await app.close(); }
});

test('confirms exact three-level batches, cancels with focus, guards drafts and retries a committed restore load', async ({ page }) => {
  const repository = componentRecoveryFixture(), app = buildApp(repository);
  let failLoad = false, restores = 0;
  await page.route(/\/api\/(?:diagrams|adrs)(?:\/|$|\?)/, async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace(/^\/api/, '');
    if (request.method() === 'POST' && path.endsWith('/restore')) restores++;
    if (failLoad && request.method() === 'GET' && path === `/diagrams/${ids.child}`) { failLoad = false; await route.fulfill({ status: 503, json: { message: 'Restored; load unavailable' } }); return; }
    const response = await app.inject({ method: request.method() as import('light-my-request').InjectOptions['method'], url: path, ...(request.postData() ? { payload: JSON.parse(request.postData()!) } : {}) });
    await route.fulfill({ status: response.statusCode, contentType: 'application/json', body: response.body });
  });
  const recovery = async (kind: 'trash' | 'restore', id: string) => page.evaluate(({ kind, id }) => window.dispatchEvent(new CustomEvent('adr:recover-diagram', { detail: { kind, id } })), { kind, id });
  try {
    await page.goto('/'); await openLibraryDiagram(page, ids.child);
    await page.getByRole('button', { name: 'Decision', exact: true }).click();
    await page.getByLabel('Title required').fill('Retained local decision');
    const trigger = page.getByRole('button', { name: 'Decision', exact: true }); await trigger.focus();
    await recovery('trash', ids.context);
    await expect(page.getByRole('alertdialog')).toContainText('Component diagram');
    await expect(page.getByRole('alertdialog')).toContainText(ids.child);
    await page.screenshot({ path: 'test-results/component-recovery-impact.png', fullPage: true });
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).press('Enter');
    await expect(trigger).toBeFocused(); expect(repository.get(ids.context)?.status).toBe('active');
    await recovery('trash', ids.context); await page.getByRole('button', { name: 'Move to trash', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Resolve unsaved changes');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByLabel('Title required')).toHaveValue('Retained local decision');
    await recovery('trash', ids.context); await page.getByRole('button', { name: 'Move to trash', exact: true }).click();
    await page.getByRole('button', { name: 'Discard and delete', exact: true }).click();
    await expect.poll(() => repository.get(ids.child)?.status).toBe('trashed');
    failLoad = true; await recovery('restore', ids.child);
    await page.getByRole('button', { name: 'Restore diagrams', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry loading diagram', exact: true })).toBeVisible();
    expect(repository.get(ids.child)?.status).toBe('active'); expect(restores).toBe(1);
    await page.getByRole('button', { name: 'Retry loading diagram', exact: true }).click();
    await expect(page.locator('#component-diagram-heading')).toBeFocused(); expect(restores).toBe(1);
    await page.screenshot({ path: 'test-results/component-recovery.png', fullPage: true });
  } finally { await app.close(); }
});
