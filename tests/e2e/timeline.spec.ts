import { expect, test } from '@playwright/test';

test.describe('timeline', () => {
  test('shows the eras and their events', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Judah between the empires');
    await expect(page.locator('#era-exile-and-return')).toBeVisible();
    await expect(page.locator('#e-fall-of-jerusalem')).toContainText('The Fall of Jerusalem');
    await expect(page.locator('#e-fall-of-jerusalem')).toContainText('587/586 BC');
    expect(await page.locator('.event-card').count()).toBeGreaterThan(2);
  });

  test('a card links to its event page', async ({ page }) => {
    await page.goto('/#era-exile-and-return');
    await page.locator('#e-edict-of-cyrus a').first().click();
    await expect(page).toHaveURL(/\/events\/edict-of-cyrus\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Edict of Cyrus');
  });

  test('the era rail jumps to an era and marks it', async ({ page }) => {
    await page.goto('/');
    const link = page.locator('.era-rail a[data-era="exile-and-return"]');
    await link.click();
    await expect(page.locator('#era-exile-and-return')).toBeInViewport();
    await expect(link).toHaveAttribute('aria-current', 'true');
  });

  test('filters from the URL are applied on load', async ({ page }) => {
    await page.goto('/?era=exile-and-return');
    await expect(page.locator('#era-exile-and-return')).toBeVisible();
    await expect(page.locator('.era:not([hidden])')).toHaveCount(1);
    await expect(page.locator('[data-filter-status]')).toContainText(/\d+ of \d+ events/);
  });

  test('the word filter narrows the cards and updates the URL', async ({ page }) => {
    await page.goto('/?era=exile-and-return');
    await page.getByPlaceholder('Filter by word, person or place').fill('Cyrus');
    await expect(page.locator('#e-edict-of-cyrus')).toBeVisible();
    await expect(page.locator('#e-fall-of-jerusalem')).toBeHidden();
    await expect(page).toHaveURL(/q=Cyrus/);

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.locator('#e-fall-of-jerusalem')).toBeVisible();
    await expect(page).not.toHaveURL(/q=/);
    await expect(page.locator('[data-filter-status]')).toHaveText(/^\d+ events$/);
  });

  test('a filter menu selects by thread', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-filter-group="thread"] summary').click();
    await page.getByLabel('Temple and Worship').check();
    await expect(page).toHaveURL(/thread=temple-and-worship/);
    await expect(page.locator('#e-fall-of-jerusalem')).toBeVisible();
    await expect(page.locator('[data-filter-status]')).toContainText(/\d+ of \d+ events/);
  });
});
