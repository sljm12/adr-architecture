import { expect, type Page } from '@playwright/test';

export async function revealDiagram(page: Page, id: string) {
  const row = page.locator(`.saved-diagram-button[data-diagram-id="${id}"]`);
  await expect(row).toBeAttached();
  const hiddenBranches = await row.evaluate(element => {
    const ids: string[] = [];
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (parent.matches('ul[hidden]')) ids.unshift(parent.id);
    }
    return ids;
  });
  for (const branch of hiddenBranches) await page.locator(`button[aria-controls="${branch}"]`).click();
  return row;
}

export async function openLibraryDiagram(page: Page, id: string) {
  await (await revealDiagram(page, id)).click();
}

export async function libraryAction(page: Page, id: string, action: string, trashed = false) {
  if (!trashed) await revealDiagram(page, id);
  const row = trashed ? page.locator(`.saved-diagram-trash-row[data-diagram-id="${id}"]`) : page.locator(`.saved-diagram-row:has(.saved-diagram-button[data-diagram-id="${id}"])`);
  await row.getByRole('button', { name: /^Actions for/ }).click();
  await page.getByRole('menuitem', { name: action, exact: true }).click();
}

export function currentDiagramActions(page: Page) {
  return page.locator('.saved-diagram-row').filter({ has: page.locator('.saved-diagram-button[aria-current="true"]') }).getByRole('button', { name: /^Actions for / });
}

export async function exportFromMenu(page: Page, name: string) {
  await currentDiagramActions(page).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}
