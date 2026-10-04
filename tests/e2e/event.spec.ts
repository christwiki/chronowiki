import { expect, test } from '@playwright/test';

const EVENT = '/events/first-deportation-to-babylon/';

test.describe('event page', () => {
  test('shows the date, its confidence and the narrative', async ({ page }) => {
    await page.goto(EVENT);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('The First Deportation to Babylon');
    await expect(page.locator('.entry__facts')).toContainText('16 March 597 BC');
    await expect(page.locator('.entry__facts')).toContainText('Firm date');
    await expect(page.locator('.prose').first()).toContainText('Jehoiachin surrendered');
  });

  test('cites Scripture and other sources with working links', async ({ page }) => {
    await page.goto(EVENT);
    const bible = page.locator('.prose a.cite--bible').first();
    await expect(bible).toHaveText(/^\(2 Kings 24:[\d–, ]+\)$/);
    await expect(bible).toHaveAttribute('href', /^https:\/\/www\.biblegateway\.com\/passage\/\?search=2%20Kings%2024%3A[\dA-F%-]+&version=NRSVUE$/);

    const source = page.locator('.prose a.cite--source').first();
    await expect(source).toContainText('Babylonian Chronicle 5');
    await expect(source).toHaveAttribute('href', /^https:\/\/www\.livius\.org\//);
    await expect(source).toHaveAttribute('data-source', 'babylonian-chronicle-abc-5');
  });

  test('lists its primary sources and explains the date', async ({ page }) => {
    await page.goto(EVENT);
    const sources = page.locator('#sources');
    await expect(sources).toContainText('Scripture');
    await expect(sources).toContainText('Babylonian Chronicle 5 (the Jerusalem Chronicle)');
    await expect(sources).toContainText('British Museum');
    await expect(page.locator('#dating')).toContainText('second of the month Addaru');
  });

  test('a citation opens a source card that closes with Escape', async ({ page }) => {
    await page.goto(EVENT);
    const citation = page.locator('.prose a.cite--source').first();
    await citation.focus();
    const card = page.locator('#source-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Babylonian Chronicle 5');
    await expect(card.getByRole('link', { name: /Read the passage/ })).toHaveAttribute('href', /livius\.org/);
    await page.keyboard.press('Escape');
    await expect(card).toBeHidden();
  });

  test('links people, places and context', async ({ page }) => {
    await page.goto(EVENT);
    await page.locator('.prose a.wikilink--person', { hasText: 'Jehoiachin' }).first().click();
    await expect(page).toHaveURL(/\/people\/jehoiachin\/$/);
    await expect(page.locator('.event-list')).toContainText('The First Deportation to Babylon');

    await page.goto(EVENT);
    await expect(page.locator('.entry__context')).toContainText('Leads to');
    await page.locator('.entry__context a', { hasText: 'The Fall of Jerusalem' }).first().click();
    await expect(page).toHaveURL(/\/events\/fall-of-jerusalem\/$/);
  });
});
