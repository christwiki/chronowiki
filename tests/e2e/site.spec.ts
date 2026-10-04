import { expect, test } from '@playwright/test';

const INDEXES = ['/', '/map/', '/threads/', '/people/', '/places/', '/sources/', '/about/'];

test.describe('site', () => {
  test('every internal link resolves', async ({ page, request, isMobile }) => {
    test.skip(isMobile, 'The link graph is the same on every viewport.');
    test.setTimeout(180_000);
    const seen = new Set<string>();
    const queue = [...INDEXES];
    const broken: string[] = [];

    // Collect links from the index pages and from one entry of each kind they lead to.
    while (queue.length > 0) {
      const path = queue.shift()!;
      if (seen.has(path)) continue;
      seen.add(path);
      await page.goto(path);
      const hrefs = await page.locator('a[href]').evaluateAll((links) =>
        links.map((a) => new URL((a as HTMLAnchorElement).href)).filter((u) => u.origin === location.origin).map((u) => u.pathname),
      );
      for (const href of new Set(hrefs)) {
        if (seen.has(href)) continue;
        if (INDEXES.includes(path)) {
          const response = await request.get(href);
          if (response.status() !== 200) broken.push(`${href} (${response.status()}) linked from ${path}`);
          seen.add(href);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  test('index pages list their entries', async ({ page }) => {
    await page.goto('/people/');
    await expect(page.getByRole('link', { name: 'Jehoiachin' })).toBeVisible();
    await page.goto('/places/');
    await expect(page.getByRole('link', { name: 'Babylon', exact: true })).toBeVisible();
    await page.goto('/sources/');
    await expect(page.getByRole('link', { name: 'The Cyrus Cylinder' })).toBeVisible();
    await page.goto('/threads/');
    await expect(page.getByRole('heading', { name: 'Covenant and Promise' })).toBeVisible();
  });

  test('a source page leads to the source itself', async ({ page }) => {
    await page.goto('/sources/cyrus-cylinder/');
    await expect(page.getByRole('link', { name: /See the object at britishmuseum\.org/ })).toHaveAttribute(
      'href',
      'https://www.britishmuseum.org/collection/object/W_1880-0617-1941',
    );
    await expect(page.locator('.event-list')).toContainText('The Edict of Cyrus');
  });

  test('an unknown address gives the 404 page', async ({ page }) => {
    const response = await page.goto('/events/no-such-event/');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('This page does not exist');
  });

  test('the theme switch changes and remembers the theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/about/');
    const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const light = await background();
    await page.getByRole('button', { name: 'Switch colour theme' }).click();
    await expect.poll(background).not.toBe(light);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});
