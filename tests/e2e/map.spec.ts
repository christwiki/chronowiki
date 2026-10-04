import { expect, test } from '@playwright/test';

test.describe('map', () => {
  test('the timeline map follows the cards', async ({ page, isMobile }) => {
    test.skip(isMobile, 'On phones the map is behind a button; see the next test.');
    await page.goto('/?era=exile-and-return');
    const map = page.locator('[data-map-panel] [data-map]');
    await expect(map).toHaveAttribute('data-map-ready', 'true');
    await expect(map.locator('.map__pin.is-active').first()).toBeVisible();
    await expect(page.locator('[data-map-caption]')).toContainText('Exile and Return');

    // The places of the cards on screen are emphasised and labelled.
    await page.locator('#e-fall-of-jerusalem').scrollIntoViewIfNeeded();
    await expect(map.locator('.map__label', { hasText: 'Jerusalem' })).toBeVisible();

    await page.locator('#e-fall-of-jerusalem').hover();
    await expect(map.locator('.map__pin.is-highlighted')).not.toHaveCount(0);
  });

  test('a pin lists the events at its place', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Covered on the map page for phones.');
    await page.goto('/?era=exile-and-return');
    const map = page.locator('[data-map-panel] [data-map]');
    await expect(map).toHaveAttribute('data-map-ready', 'true');
    await map.locator('.map__pin[data-place="babylon"]').click();
    const card = map.locator('.map__card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Babylon');
    await card.getByRole('link', { name: /Edict of Cyrus/ }).click();
    await expect(page.locator('#e-edict-of-cyrus')).toBeInViewport();
  });

  test('on a phone the map opens as a sheet', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Phone layout only.');
    await page.goto('/?era=exile-and-return');
    const panel = page.locator('[data-map-panel]');
    await expect(panel).toBeHidden();
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-map]')).toHaveAttribute('data-map-ready', 'true');
    await page.getByRole('button', { name: 'Close the map' }).click();
    await expect(panel).toBeHidden();
  });

  test('the map page steps through the eras', async ({ page }) => {
    await page.goto('/map/?era=exile-and-return');
    const map = page.locator('[data-full-map]');
    await expect(map).toHaveAttribute('data-map-ready', 'true');
    const select = page.locator('[data-era-select]');
    await expect(select).toHaveValue('exile-and-return');
    await expect(page.locator('[data-era-list]:visible')).toHaveCount(1);
    const inEra = await map.locator('.map__pin:visible').count();
    expect(inEra).toBeGreaterThan(0);

    await select.selectOption('');
    await expect(page).not.toHaveURL(/era=/);
    await expect.poll(() => map.locator('.map__pin:visible').count()).toBeGreaterThanOrEqual(inEra);
    expect(await page.locator('[data-era-list]:visible').count()).toBeGreaterThan(1);
  });

  test('an event page shows where it happened', async ({ page }) => {
    await page.goto('/events/first-deportation-to-babylon/');
    const map = page.locator('[data-mini-map]');
    await expect(map).toHaveAttribute('data-map-ready', 'true');
    await expect(map.locator('.map__label', { hasText: 'Babylon' })).toBeVisible();
  });
});
