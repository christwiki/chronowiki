import { expect, test } from '@playwright/test';
import { de } from '../../src/i18n/messages/de';
import { en } from '../../src/i18n/messages/en';

/** A translated event, and one that exists only in English. */
const TRANSLATED = '/de/events/first-deportation-to-babylon/';
const UNTRANSLATED = '/de/events/edict-of-cyrus/';

test.describe('languages', () => {
  test('English stays at the root and German lives under /de/', async ({ page }) => {
    await page.goto('/events/first-deportation-to-babylon/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('The First Deportation to Babylon');

    await page.goto(TRANSLATED);
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Die erste Wegführung nach Babylon');
  });

  test('the language switch leads to the same page in the other language', async ({ page }) => {
    await page.goto('/events/first-deportation-to-babylon/');
    const languages = page.getByRole('navigation', { name: 'Language' });
    await expect(languages.getByRole('link', { name: 'EN' })).toHaveAttribute('aria-current', 'true');
    await languages.getByRole('link', { name: 'DE' }).click();
    await expect(page).toHaveURL(/\/de\/events\/first-deportation-to-babylon\/$/);

    await page.getByRole('navigation', { name: 'Sprache' }).getByRole('link', { name: 'EN' }).click();
    await expect(page).toHaveURL(/\/events\/first-deportation-to-babylon\/$/);
    await expect(page).not.toHaveURL(/\/de\//);
  });

  test('each page names its other languages for search engines', async ({ page }) => {
    await page.goto(TRANSLATED);
    const alternate = (lang: string) => page.locator(`link[rel="alternate"][hreflang="${lang}"]`);
    await expect(alternate('en')).toHaveAttribute('href', /\/events\/first-deportation-to-babylon\/$/);
    await expect(alternate('de')).toHaveAttribute('href', /\/de\/events\/first-deportation-to-babylon\/$/);
    await expect(alternate('x-default')).toHaveAttribute('href', /[^e]\/events\/first-deportation-to-babylon\/$/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/de\/events\/first-deportation-to-babylon\/$/);
  });

  test('links inside a German page stay in German', async ({ page }) => {
    await page.goto(TRANSLATED);
    const internal = await page
      .locator('main a[href^="/"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')!));
    expect(internal.length).toBeGreaterThan(10);
    expect(internal.filter((href) => !href.startsWith('/de/'))).toEqual([]);
  });
});

test.describe('a translated entry', () => {
  test('writes its date, citations and quotation marks the German way', async ({ page }) => {
    await page.goto(TRANSLATED);
    await expect(page.locator('.entry__facts')).toContainText('16. März 597 v. Chr.');
    await expect(page.locator('.entry__facts')).toContainText('Gesichertes Datum');

    const bible = page.locator('.prose a.cite--bible').first();
    await expect(bible).toHaveText(/^\(2 Könige 24,[\d–.]+\)$/);
    await expect(bible).toHaveAttribute('href', /^https:\/\/www\.bibleserver\.com\/EU\/2\.K%C3%B6nige24/);

    await expect(page.locator('.prose a.cite--source').first()).toContainText('Babylonische Chronik 5 Rs. 11–13');
    await expect(page.locator('.prose').first()).toContainText('„die Stadt Juda“');
    await expect(page.locator('#sources')).toContainText('Einheitsübersetzung 2016');
    await expect(page.locator('[data-translation]')).toHaveCount(0);
  });

  test('carries the translated names of its person, place and source', async ({ page }) => {
    await page.goto(TRANSLATED);
    await expect(page.locator('.entry__aside')).toContainText('Jojachin');
    await page.goto('/de/people/jehoiachin/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Jojachin');
    await expect(page.locator('.entry-header__facts')).toContainText('König von Juda, 597 v. Chr.');
    await page.goto('/de/sources/babylonian-chronicle-abc-5/');
    await expect(page.locator('.fact-list')).toContainText('Akkadisch');
  });
});

test.describe('an entry without a translation', () => {
  test('is shown in English and says so', async ({ page }) => {
    await page.goto(UNTRANSLATED);
    await expect(page.locator('[data-translation="missing"]')).toContainText('noch nicht übersetzt');
    const title = page.getByRole('heading', { level: 1 });
    await expect(title).toHaveText('The Edict of Cyrus and the First Return');
    await expect(title).toHaveAttribute('lang', 'en');
    await expect(page.locator('.prose').first()).toHaveAttribute('lang', 'en');
    // The words around it are German all the same.
    await expect(page.locator('#dating-title')).toHaveText('Wie dies datiert wird');
    await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toContainText('Zeitstrahl');
  });

  test('keeps English names inside its English text, with links into the German site', async ({ page }) => {
    await page.goto(UNTRANSLATED);
    const link = page.locator('.prose a.wikilink--person').first();
    await expect(link).toHaveAttribute('href', /^\/de\/people\//);
    await expect(page.locator('.prose a.cite--bible, .prose a.cite--source').first()).toBeVisible();
  });
});

test.describe('the German timeline', () => {
  test('speaks German around entries that are not translated yet', async ({ page }) => {
    await page.goto('/de/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Juda zwischen den Großreichen');
    await expect(page.locator('[data-translation="partial"]')).toContainText('Einträgen');
    await expect(page.locator('#era-title-exile-and-return')).toHaveText('Exil und Rückkehr');
    await expect(page.locator('#e-first-deportation-to-babylon')).toContainText('Die erste Wegführung nach Babylon');
    await expect(page.locator('#e-first-deportation-to-babylon')).toContainText('16. März 597 v. Chr.');
    // A card that is still English is marked as English, date and all.
    const english = page.locator('#e-edict-of-cyrus');
    await expect(english.locator('.event-card__title a')).toHaveAttribute('lang', 'en');
    await expect(english).toContainText('538 BC');
  });

  test('filters in German', async ({ page }) => {
    await page.goto('/de/');
    const status = page.locator('[data-filter-status]');
    await expect(status).toHaveText(/^\d+ Ereignisse$/);
    await page.getByPlaceholder('Nach Wort, Person oder Ort filtern').fill('Wegführung');
    await expect(status).toHaveText(/^1 von \d+ Ereignissen$/);
    await expect(page.locator('#e-first-deportation-to-babylon')).toBeVisible();
    await expect(page).toHaveURL(/\/de\/\?q=Wegf/);
  });

  test('the map names places in German', async ({ page, isMobile }) => {
    test.skip(isMobile, 'The side map belongs to wide screens.');
    await page.goto('/de/#era-exile-and-return');
    const map = page.locator('[data-map-panel] [data-map]');
    await expect(map).toHaveAttribute('data-map-ready', 'true');
    await expect(map.locator('svg.map__svg')).toHaveAttribute('aria-label', /^Karte\./);
    await expect(map.getByRole('button', { name: 'Vergrößern' })).toBeVisible();
  });
});

test.describe('search in German', () => {
  test('finds the German words of an entry and stays in German', async ({ page }) => {
    await page.goto('/de/');
    await page.getByRole('button', { name: 'Suche' }).click();
    const dialog = page.locator('dialog[data-search]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-search-status]')).toHaveText('Tippen Sie, um das ganze Wiki zu durchsuchen.');
    await dialog.getByRole('searchbox').fill('Wegführung');
    const first = dialog.locator('[data-search-results] a').first();
    await expect(first).toHaveAttribute('href', /^\/de\//);
    await expect(dialog.locator('.search__kind').first()).toHaveText(/Ereignis|Person|Ort|Quelle|Leitfaden|Epoche|Seite/);
  });

  test('says in German when nothing matches', async ({ page }) => {
    await page.goto('/de/about/');
    await page.getByRole('button', { name: 'Suche' }).click();
    const dialog = page.locator('dialog[data-search]');
    await dialog.getByRole('searchbox').fill('zxqvjkwpz');
    await expect(dialog.locator('[data-search-status]')).toContainText('Nichts gefunden für „zxqvjkwpz“');
  });
});

test('the page for a missing address answers in the language of the address', async ({ page }) => {
  await page.goto('/de/gibt-es-nicht/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Diese Seite gibt es nicht');
  await expect(page.getByRole('link', { name: 'Zum Zeitstrahl' })).toHaveAttribute('href', '/de/');
  await page.goto('/there-is-no-such-page/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This page does not exist');
});

/**
 * No English may be left in the German interface. Every English message that
 * differs from its German one is looked for in the visible text of each kind of
 * page, leaving out the entries that are shown in English and say so.
 */
test.describe('no English is left in the German interface', () => {
  const leaves = (node: unknown, prefix = ''): [string, string][] => {
    if (typeof node === 'string') return [[prefix, node]];
    if (typeof node !== 'object' || node === null) return [];
    return Object.entries(node).flatMap(([key, value]) => leaves(value, prefix ? `${prefix}.${key}` : key));
  };
  const german = new Map(leaves(de));
  const phrases = leaves(en)
    // The part of a message before its first placeholder is enough to recognise it.
    .map(([key, text]) => [key, text.split('{')[0].trim()] as const)
    .filter(([key, text]) => text.length >= 12 && !german.get(key)?.startsWith(text));

  const PAGES = [
    '/de/',
    '/de/map/',
    '/de/threads/',
    '/de/threads/covenant/',
    '/de/people/',
    '/de/people/jehoiachin/',
    '/de/places/',
    '/de/places/babylon/',
    '/de/sources/',
    '/de/sources/babylonian-chronicle-abc-5/',
    '/de/eras/exile-and-return/',
    '/de/about/',
    TRANSLATED,
    UNTRANSLATED,
    '/de/gibt-es-nicht/',
  ];

  for (const path of PAGES) {
    test(path, async ({ page }) => {
      await page.goto(path);
      const { text, attributes } = await page.evaluate(() => {
        const copy = document.documentElement.cloneNode(true) as HTMLElement;
        for (const node of copy.querySelectorAll('[lang="en"], script, style, [hidden]')) node.remove();
        const words: string[] = [];
        for (const node of copy.querySelectorAll('[aria-label], [title], [placeholder], [alt]')) {
          for (const name of ['aria-label', 'title', 'placeholder', 'alt']) {
            const value = node.getAttribute(name);
            if (value) words.push(value);
          }
        }
        for (const template of copy.querySelectorAll('template')) words.push(template.content.textContent ?? '');
        return { text: copy.textContent ?? '', attributes: words.join('\n') };
      });
      const everything = `${text}\n${attributes}`;
      expect(phrases.filter(([, phrase]) => everything.includes(phrase)).map(([key, phrase]) => `${key}: ${phrase}`)).toEqual([]);
    });
  }
});

test.describe('right-to-left', () => {
  // No right-to-left language is defined yet. Turning the direction round on an
  // English page shows that the layout follows the direction of the text.
  test('the layout mirrors and nothing overflows', async ({ page, isMobile }) => {
    await page.goto('/');
    await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    const card = await page.locator('.event-card').first().boundingBox();
    const mark = await page.locator('.event-card .event-card__mark').first().boundingBox();
    // The spine and its marks run down the right-hand side.
    expect(mark!.x).toBeGreaterThan(card!.x + card!.width / 2);

    if (!isMobile) {
      const rail = await page.locator('.era-rail').boundingBox();
      const timeline = await page.locator('[data-timeline]').boundingBox();
      expect(rail!.x).toBeGreaterThan(timeline!.x);
    }
  });

  test('an entry page mirrors too', async ({ page }) => {
    await page.goto('/events/first-deportation-to-babylon/');
    await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const quote = page.locator('.prose blockquote').first();
    if ((await quote.count()) > 0) {
      const border = await quote.evaluate((node) => getComputedStyle(node).borderRightWidth);
      expect(Number.parseFloat(border)).toBeGreaterThan(0);
    }
  });
});
