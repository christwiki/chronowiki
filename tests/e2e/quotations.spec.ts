import { expect, test } from '@playwright/test';

test.describe('quotations', () => {
  test('the page draws a line for every quotation and lists them all', async ({ page }) => {
    await page.goto('/quotations/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Quotations');
    await expect(page.locator('.quotation-diagram__lines a')).toHaveCount(6);
    await expect(page.locator('.quotation-list__item')).toHaveCount(6);
    // The books stand in the order of the Bible, and a source after them.
    await expect(page.locator('.quotation-diagram__books--earlier li')).toHaveText(['Isaiah', 'Jeremiah']);
    await expect(page.locator('.quotation-diagram__books--later li')).toHaveText(['Matthew', 'John', 'Origen, Against Celsus']);
    // One line for each kind in use, each with its own stroke.
    await expect(page.locator('.quotation-diagram__legend dt')).toHaveText(['Stated', 'Applied', 'Later reading']);
    await expect(page.locator('.quotation-diagram__lines .quotation-line--applied')).toHaveCount(1);
    await expect(page.locator('.quotation-diagram__lines .quotation-line--later')).toHaveCount(1);
  });

  test('every line ends at its two books', async ({ page }) => {
    await page.goto('/quotations/');
    const box = (selector: string) =>
      page.locator(selector).evaluate((element) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x, y, width, height };
      });
    const line = await box('.quotation-diagram__lines a[data-quotation="jer-31-15-in-matt-2-17"] .quotation-line');
    const from = await box('.quotation-diagram__books--earlier [data-diagram-row="Jer"]');
    const to = await box('.quotation-diagram__books--later [data-diagram-row="Matt"]');
    // The line runs from Jeremiah, below, up to Matthew, and touches both rows.
    expect(line.y + line.height).toBeGreaterThan(from.y);
    expect(line.y + line.height).toBeLessThan(from.y + from.height);
    expect(line.y).toBeGreaterThan(to.y);
    expect(line.y).toBeLessThan(to.y + to.height);
    expect(Math.abs(line.x - (from.x + from.width))).toBeLessThan(1);
    expect(Math.abs(line.x + line.width - to.x)).toBeLessThan(1);
  });

  test('a book or a kind of line shows only its quotations', async ({ page }) => {
    await page.goto('/quotations/');
    const items = page.locator('.quotation-list__item:visible');
    const dimmed = page.locator('.quotation-diagram__lines a.is-dim');

    await page.getByRole('button', { name: 'Jeremiah' }).click();
    await expect(items).toHaveCount(1);
    await expect(items).toContainText('A voice was heard in Ramah');
    await expect(dimmed).toHaveCount(5);
    await expect(page.locator('[data-diagram-count]')).toHaveText('1 of 6 quotations');
    await expect(page.getByRole('button', { name: 'Jeremiah' })).toHaveAttribute('aria-pressed', 'true');
    // The groups of the list that are left empty go too.
    await expect(page.getByRole('heading', { level: 2, name: /^John/ })).toBeHidden();

    await page.getByRole('button', { name: 'Show all' }).click();
    await expect(items).toHaveCount(6);
    await expect(dimmed).toHaveCount(0);

    await page.getByRole('button', { name: 'Applied' }).click();
    await expect(items).toHaveCount(1);
    await expect(items).toContainText('The voice of one crying in the wilderness');
    // Two choices narrow together.
    await page.getByRole('button', { name: 'John', exact: true }).click();
    await expect(items).toHaveCount(0);
    await expect(page.locator('[data-diagram-count]')).toHaveText('0 of 6 quotations');
    await page.getByRole('button', { name: 'Applied' }).click();
    await expect(items).toHaveCount(1);
    await expect(items).toContainText('Lord, who has believed our report?');
  });

  test('a line leads to its quotation', async ({ page, isMobile }) => {
    test.skip(isMobile, 'A line is the same link on every viewport.');
    await page.goto('/quotations/');
    await expect(page.locator('.quotation-diagram__lines a[data-quotation="isa-53-4-in-matt-8-17"]')).toHaveAttribute(
      'href',
      '/quotations/isa-53-4-in-matt-8-17/',
    );
  });

  test('an entry sets the two passages side by side', async ({ page }) => {
    await page.goto('/quotations/jer-31-15-in-matt-2-17/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('A voice was heard in Ramah');
    const passages = page.locator('.quotation__passage');
    await expect(passages).toHaveCount(2);
    await expect(passages.nth(0)).toContainText('Jeremiah 31:15');
    await expect(passages.nth(0)).toContainText('Rachel weeping for her children.');
    await expect(passages.nth(1)).toContainText('Matthew 2:17–18');
    await expect(passages.nth(1).getByRole('link', { name: 'Matthew 2:17–18' })).toHaveAttribute('href', /biblegateway.*Matthew/);
    await expect(page.locator('.quotation__kind-note')).toContainText('Stated. The later text itself says');
    await expect(page.locator('.quotation__kind-note')).toContainText('World English Bible');
    // The passages head the sources, before what the note cites.
    await expect(page.locator('#sources .cite--bible').first()).toHaveText('Jeremiah 31:15');
    // The earlier passage belongs to an event of the timeline.
    await expect(page.locator('.event-list')).toContainText('The Call of Jeremiah');
  });

  test('a passage may be one of a source', async ({ page }) => {
    await page.goto('/quotations/isa-53-7-in-origen-against-celsus/');
    const later = page.locator('.quotation__passage').nth(1);
    await expect(later.getByRole('link', { name: 'Origen, Against Celsus 1.54' })).toHaveAttribute(
      'href',
      'https://www.newadvent.org/fathers/04161.htm',
    );
    await expect(page.locator('#sources')).toContainText('Against Celsus');
    await expect(page.locator('.quotation__kind-note')).toContainText('Later reading.');
    // The earlier passage is named without its words, and the page says that this is meant only where the other has words.
    await expect(page.locator('.quotation__omitted')).toHaveCount(0);
  });

  test('an event lists the quotations of its passages', async ({ page }) => {
    await page.goto('/events/prophecies-of-return/');
    const section = page.locator('section[aria-labelledby="quotations-title"]');
    await expect(section.getByRole('heading', { level: 3 })).toHaveText('Words from here, quoted later');
    await expect(section.locator('.quotation-list__item')).toHaveCount(5);
    await section.getByRole('link', { name: 'Behold, my servant whom I have chosen' }).click();
    await expect(page).toHaveURL(/\/quotations\/isa-42-1-in-matt-12-17\/$/);
  });

  test('text links to a quotation', async ({ page }) => {
    await page.goto('/quotations/isa-53-4-in-matt-8-17/');
    await expect(page.locator('.prose a.wikilink--event')).toHaveAttribute('href', '/events/prophecies-of-return/');
  });

  test('search finds a quotation', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Search' }).click();
    const dialog = page.locator('dialog[data-search]');
    await dialog.getByRole('searchbox').fill('Ramah');
    const result = dialog.locator('[data-search-results] li', { hasText: 'A voice was heard in Ramah' }).first();
    await expect(result).toBeVisible();
    await expect(result.locator('.search__kind')).toHaveText('Quotation');
  });

  test('the page is in the sitemap and in the navigation', async ({ page, request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('/quotations/</loc>');
    expect(sitemap).toContain('/quotations/isa-40-3-in-matt-3-3/</loc>');
    await page.goto('/quotations/');
    await expect(page.locator('.site-nav a[aria-current="page"]')).toHaveText('Quotations');
  });

  test('in German the page speaks German and says what is not translated', async ({ page }) => {
    await page.goto('/de/quotations/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Zitate');
    await expect(page.locator('.quotation-diagram__books--earlier li')).toHaveText(['Jesaja', 'Jeremia']);
    await expect(page.locator('.quotation-list__passages').first()).toContainText('Jeremia 31,15 in Matthäus 2,17–18');
    await page.goto('/de/quotations/jer-31-15-in-matt-2-17/');
    await expect(page.locator('[data-translation="missing"]')).toBeVisible();
    await expect(page.locator('.quotation__kind-note')).toContainText('World English Bible');
  });
});

test.describe('quotations without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the drawing and the list are complete', async ({ page }) => {
    await page.goto('/quotations/');
    await expect(page.locator('.quotation-diagram__lines a')).toHaveCount(6);
    await expect(page.locator('.quotation-list__item')).toHaveCount(6);
    // What needs the script stays out of the way: the names are not buttons, and nothing invites a choice.
    await expect(page.locator('.quotation-diagram button:visible')).toHaveCount(0);
    await expect(page.locator('[data-diagram-status]')).toBeHidden();
  });
});
