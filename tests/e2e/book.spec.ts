import { expect, test } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { parseXml } from '../../src/book/xml';

/** The wiki as a book: the page that offers it, and the two files themselves. */
test.describe('the book', () => {
  test('has a page of its own, reached from the header', async ({ page, isMobile }) => {
    await page.goto('/');
    if (!isMobile) {
      await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Book' }).click();
      await expect(page).toHaveURL(/\/book\/$/);
    } else {
      await page.goto('/book/');
    }
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('The book');
    await expect(page.locator('[data-book-edition]')).toContainText(/Edition of \d+ \w+ \d{4} · 24 events, \d+ people, \d+ places, and \d+ sources/);
    await expect(page.locator('[data-book="epub"]')).toHaveAttribute('href', '/book/example-wiki.epub');
    await expect(page.locator('[data-book="pdf"]')).toHaveAttribute('href', '/book/example-wiki.pdf');
  });

  test('the EPUB opens, is well formed, and every link in it leads somewhere', async ({ request, isMobile }) => {
    test.skip(isMobile, 'The file is the same on every viewport.');
    const response = await request.get('/book/example-wiki.epub');
    expect(response.status()).toBe(200);
    const bytes = new Uint8Array(await response.body());
    // The first entry of the archive names the format and is not compressed.
    expect(strFromU8(bytes.slice(30, 58))).toBe('mimetypeapplication/epub+zip');

    const files = unzipSync(bytes);
    const names = Object.keys(files);
    expect(names).toContain('META-INF/container.xml');
    expect(names).toContain('OEBPS/package.opf');
    expect(names).toContain('OEBPS/nav.xhtml');
    expect(names).toContain('OEBPS/toc.ncx');
    expect(names).toContain('OEBPS/cover.png');

    const pages = names.filter((name) => name.endsWith('.xhtml'));
    expect(pages.length).toBeGreaterThan(40);

    const ids = new Map<string, Set<string>>();
    const texts = new Map<string, string>();
    for (const name of pages) {
      const text = strFromU8(files[name]);
      texts.set(name, text);
      expect(() => parseXml(text.replace(/^<\?xml[^>]*\?>\s*<!DOCTYPE html>/, '')), name).not.toThrow();
      ids.set(name.replace('OEBPS/', ''), new Set([...text.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1])));
    }

    const broken: string[] = [];
    let internal = 0;
    for (const [name, text] of texts) {
      for (const [, href] of text.matchAll(/href="([^"]+)"/g)) {
        if (/^https?:/.test(href) || href === 'book.css') continue;
        internal += 1;
        const [file, fragment] = href.split('#');
        if (!ids.has(file) || (fragment && !ids.get(file)!.has(fragment))) broken.push(`${name}: ${href}`);
      }
    }
    expect(broken).toEqual([]);
    expect(internal).toBeGreaterThan(1000);

    // Every page is in the manifest and in the reading order.
    const opf = strFromU8(files['OEBPS/package.opf']);
    expect(opf.match(/<itemref /g)!.length).toBe(pages.length - 1);
    expect(opf).toContain('<dc:title>Example Wiki</dc:title>');
    expect(opf).toContain('<dc:language>en</dc:language>');
  });

  test('an event in the EPUB links to its people, its sources and its neighbours', async ({ request, isMobile }) => {
    test.skip(isMobile, 'The file is the same on every viewport.');
    const files = unzipSync(new Uint8Array(await (await request.get('/book/example-wiki.epub')).body()));
    const event = strFromU8(files['OEBPS/event-first-deportation-to-babylon.xhtml']);
    expect(event).toContain('<h1>The First Deportation to Babylon</h1>');
    expect(event).toContain('16 March 597 BC · Firm date');
    // A person in the text, a citation, the era, and the events before and after.
    expect(event).toMatch(/<a class="wikilink wikilink--person" href="people-\d+\.xhtml#person-jehoiachin">/);
    expect(event).toMatch(/<a class="cite cite--source" href="sources-\d+\.xhtml#source-babylonian-chronicle-abc-5">\(/);
    expect(event).toContain('<span class="cite cite--bible">(');
    expect(event).toContain('href="era-exile-and-return.xhtml"');
    expect(event).toMatch(/class="pager">.*href="event-[a-z-]+\.xhtml"/s);

    // And the person leads back to the event.
    const file = /href="(people-\d+\.xhtml)#person-jehoiachin"/.exec(event)![1];
    const people = strFromU8(files[`OEBPS/${file}`]);
    expect(people).toMatch(/id="person-jehoiachin"[\s\S]*href="event-first-deportation-to-babylon\.xhtml"/);
  });

  test('the PDF is typeset, with its links and its outline', async ({ request, isMobile }) => {
    test.skip(isMobile, 'The file is the same on every viewport.');
    const response = await request.get('/book/example-wiki.pdf');
    expect(response.status()).toBe(200);
    const pdf = (await response.body()).toString('latin1');
    expect(pdf.startsWith('%PDF-')).toBe(true);
    expect(pdf.match(/\/Type\s*\/Page[^s]/g)!.length).toBeGreaterThan(100);
    expect(pdf.match(/\/Subtype\s*\/Link/g)!.length).toBeGreaterThan(2000);
    expect(pdf).toContain('/Outlines');
    // The source it was typeset from is not published.
    expect((await request.get('/book/example-wiki.typ')).status()).toBe(404);
  });

  test('is made in every language', async ({ page, request, isMobile }) => {
    await page.goto('/de/book/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Das Buch');
    await expect(page.locator('[data-book="epub"]')).toHaveAttribute('href', '/de/book/example-wiki-de.epub');
    test.skip(isMobile, 'The file is the same on every viewport.');
    const files = unzipSync(new Uint8Array(await (await request.get('/de/book/example-wiki-de.epub')).body()));
    const opf = strFromU8(files['OEBPS/package.opf']);
    expect(opf).toContain('<dc:language>de</dc:language>');
    const event = strFromU8(files['OEBPS/event-first-deportation-to-babylon.xhtml']);
    expect(event).toContain('<h1>Die erste Wegführung nach Babylon</h1>');
    // An entry that is not translated is marked as English, so that a reader hyphenates and reads it as English.
    expect(strFromU8(files['OEBPS/event-edict-of-cyrus.xhtml'])).toContain('<h1 lang="en" xml:lang="en">');
    expect((await request.get('/de/book/example-wiki-de.pdf')).status()).toBe(200);
  });
});
