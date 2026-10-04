import { expect, test } from '@playwright/test';

test.describe('search', () => {
  test('finds entries and opens one', async ({ page, isMobile }) => {
    await page.goto('/about/');
    if (isMobile) await page.getByRole('button', { name: 'Search' }).click();
    else await page.keyboard.press('/');

    const dialog = page.locator('dialog[data-search]');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('searchbox').fill('Cyrus');
    const results = dialog.locator('[data-search-results] a');
    await expect(results.first()).toBeVisible();
    await expect(dialog).toContainText('Cyrus');
    await expect(dialog.locator('.search__kind').first()).toHaveText(/Event|Person|Source|Place|Thread|Era|Page/);

    await results.first().click();
    await expect(page).toHaveURL(/\/(events|people|sources|places|threads|eras)\//);
  });

  test('works from the timeline, where every card has search text of its own', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Search' }).click();
    const dialog = page.locator('dialog[data-search]');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('searchbox').fill('Maccabean');
    await expect(dialog.locator('[data-search-results] a').first()).toBeVisible();
  });

  test('says so when nothing matches', async ({ page }) => {
    await page.goto('/about/');
    await page.getByRole('button', { name: 'Search' }).click();
    const dialog = page.locator('dialog[data-search]');
    await dialog.getByRole('searchbox').fill('zxqvjkwpz');
    await expect(dialog.locator('[data-search-status]')).toContainText('Nothing found');
  });
});
