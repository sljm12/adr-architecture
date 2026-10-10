import { test, expect } from '@playwright/test';
import { buildApp } from '../../backend/src/api/app';
import { componentRecoveryFixture } from '../../backend/tests/component-recovery-fixture';
import { componentFixtureIds as ids } from '../../shared/tests/component-fixtures';

test('confirms exact three-level batches, cancels with focus, guards drafts and retries a committed restore load', async ({ page }) => {
  const repository = componentRecoveryFixture(), app = buildApp(repository);
  let failLoad = false, restores = 0;
  await page.route(/\/api\/(?:diagrams|adrs)(?:\/|$|\?)/, async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace(/^\/api/, '');
    if (request.method() === 'POST' && path.endsWith('/restore')) restores++;
    if (failLoad && request.method() === 'GET' && path === `/diagrams/${ids.child}`) { failLoad = false; await route.fulfill({ status: 503, json: { message: 'Restored; load unavailable' } }); return; }
    const response = await app.inject({ method: request.method() as any, url: path, ...(request.postData() ? { payload: JSON.parse(request.postData()!) } : {}) });
    await route.fulfill({ status: response.statusCode, contentType: 'application/json', body: response.body });
  });
  const recovery = async (kind: 'trash' | 'restore', id: string) => page.evaluate(({ kind, id }) => window.dispatchEvent(new CustomEvent('adr:recover-diagram', { detail: { kind, id } })), { kind, id });
  try {
    await page.goto('/'); await page.locator(`.saved-diagram-button[data-diagram-id="${ids.child}"]`).click();
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
