import { expect, test } from '@playwright/test';

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the timeline is complete', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#e-fall-of-jerusalem')).toContainText('The Fall of Jerusalem');
    await expect(page.locator('.era-rail a[data-era="exile-and-return"]')).toHaveAttribute('href', '#era-exile-and-return');
    // Controls that need the script stay out of the way.
    await expect(page.locator('[data-filter-bar]')).toBeHidden();
    await expect(page.locator('[data-map-toggle]')).toBeHidden();
  });

  test('an event page shows its citations and sources', async ({ page }) => {
    await page.goto('/events/fall-of-jerusalem/');
    await expect(page.locator('.prose a.cite--bible').first()).toHaveAttribute('href', /biblegateway/);
    await expect(page.locator('#sources')).toContainText('Scripture');
    await expect(page.locator('#dating')).toContainText('587 or 586 BC');
  });
});
