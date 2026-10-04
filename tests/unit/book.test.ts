import { NodeCompiler } from '@myriaddreamin/typst-ts-node-compiler';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { addCover, coverSource, finishEpub, fontPaths } from '../../book-build.mjs';
import { epubFiles, linkTable, resolveLinks, writeEpub } from '../../src/book/epub';
import { bookRef, type Book, type BookDoc } from '../../src/book/types';
import { writeTypst } from '../../src/book/typst';
import { esc, parseXml, textOf } from '../../src/book/xml';
import { renderProse, type ProseContext } from '../../src/lib/prose';

const doc = (over: Partial<BookDoc> & Pick<BookDoc, 'id' | 'html'>): BookDoc => ({
  kind: 'page',
  title: over.id,
  level: 2,
  targets: [],
  ...over,
});

function book(docs: BookDoc[]): Book {
  return {
    meta: {
      title: 'Test Wiki',
      tagline: 'History on one timeline.',
      description: 'A wiki for tests.',
      language: 'en',
      dir: 'ltr',
      identifier: 'urn:uuid:00000000-0000-5000-a000-000000000000',
      modified: new Date('2026-10-04T08:00:00.123Z'),
      edition: 'Edition of 4 October 2026',
      url: 'https://example.org/',
      rights: 'CC BY-SA 4.0',
      slug: 'test-wiki',
      labels: { contents: 'Contents', parts: [{ ref: bookRef('part', 'people'), title: 'People' }] },
    },
    docs,
    maps: [],
  };
}

const MAP = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 52" width="90" height="52"><rect width="90" height="52" fill="#ebebeb"/><circle cx="45" cy="26" r="4"/></svg>';

/** The sample book with a map on its event. */
function mapped(): Book {
  const withMap = sample();
  withMap.maps.push({ id: 'm0123456789', svg: MAP });
  withMap.docs[2].html += `<p class="map"><img src="${bookRef('map', 'm0123456789')}" alt="Map showing Jerusalem"/></p>`;
  return withMap;
}

const sample = () =>
  book([
    doc({ id: 'title', kind: 'title', level: 1, title: 'Test Wiki', html: '<div class="titlepage"><h1>Test Wiki</h1></div>' }),
    doc({
      id: 'part-timeline',
      kind: 'part',
      level: 1,
      title: 'Timeline',
      targets: [{ ref: bookRef('part', 'timeline'), anchor: '' }],
      html: `<h1>Timeline</h1><ul class="links"><li><a href="${bookRef('event', 'fall')}">The Fall</a> <span class="when">587 BC</span></li></ul>`,
    }),
    doc({
      id: 'event-fall',
      kind: 'event',
      level: 3,
      title: 'The Fall',
      targets: [{ ref: bookRef('event', 'fall'), anchor: '' }],
      html: `<h1>The Fall</h1><p class="lead">A city falls.</p><div class="prose"><p>The king, <a href="${bookRef('person', 'zedekiah')}">Zedekiah</a>, said "no" &amp; fled <span class="cite cite--bible">(2 Kings 25:4)</span>. See <a href="https://example.org/a?b=1&amp;c=2">the tablet</a>.</p><blockquote><p>A \\ backslash and a # sign.</p></blockquote></div>`,
    }),
    doc({
      id: 'part-people',
      kind: 'part',
      level: 1,
      title: 'People',
      targets: [{ ref: bookRef('part', 'people'), anchor: '' }],
      html: `<h1>People</h1><ul class="links"><li><a href="${bookRef('chapter', 'people-01')}">Zedekiah</a></li></ul>`,
    }),
    doc({
      id: 'people-01',
      kind: 'index',
      level: 2,
      title: 'Zedekiah',
      targets: [
        { ref: bookRef('chapter', 'people-01'), anchor: '' },
        { ref: bookRef('person', 'zedekiah'), anchor: 'person-zedekiah' },
      ],
      html: `<h1>Zedekiah</h1><h2 class="entry" id="person-zedekiah">Zedekiah</h2><p class="label">In the timeline</p><ul class="links"><li><a href="${bookRef('event', 'fall')}">The Fall</a> <span class="when">587 BC</span></li></ul>`,
    }),
  ]);

describe('parseXml', () => {
  it('reads elements, attributes and text', () => {
    const [p] = parseXml('<p class="lead" xml:lang="de">Fish &amp; <em>chips</em><br/></p>');
    expect(p).toEqual({
      tag: 'p',
      attrs: { class: 'lead', 'xml:lang': 'de' },
      children: ['Fish & ', { tag: 'em', attrs: {}, children: ['chips'] }, { tag: 'br', attrs: {}, children: [] }],
    });
  });

  it('reads entities by name and by number', () => expect(textOf(parseXml('<p>&lt;&gt;&quot;&#8211;&#x2014;</p>'))).toBe('<>"–—'));

  it('refuses what an e-reader would refuse', () => {
    expect(() => parseXml('<p>one<br>two</p>')).toThrow(/closes <br>/);
    expect(() => parseXml('<p>never closed')).toThrow(/never closed/);
    expect(() => parseXml('<p>Fish & chips</p>')).toThrow(/&amp;/);
    expect(() => parseXml('<p>a &nbsp; b</p>')).toThrow(/not an XML entity/);
    expect(() => parseXml('<p>1 < 2</p>')).toThrow(/opens no tag/);
    expect(() => parseXml('</p>')).toThrow(/closes <nothing>/);
  });

  it('escapes what it must', () => expect(esc('a < b & "c"')).toBe('a &lt; b &amp; &quot;c&quot;'));
});

describe('the EPUB', () => {
  it('opens with its type, stored as it is', () => {
    const bytes = writeEpub(sample());
    // A zip entry: signature, then at offset 8 the method (0 = stored) and at 30 the name.
    expect(strFromU8(bytes.slice(30, 38))).toBe('mimetype');
    expect(bytes[8] | (bytes[9] << 8)).toBe(0);
    expect(strFromU8(bytes.slice(38, 58))).toBe('application/epub+zip');
  });

  it('holds a file for every document, both tables of contents and the stylesheet', () => {
    const names = Object.keys(unzipSync(writeEpub(sample())));
    expect(names).toEqual([
      'mimetype',
      'META-INF/container.xml',
      'OEBPS/title.xhtml',
      'OEBPS/part-timeline.xhtml',
      'OEBPS/event-fall.xhtml',
      'OEBPS/part-people.xhtml',
      'OEBPS/people-01.xhtml',
      'OEBPS/nav.xhtml',
      'OEBPS/toc.ncx',
      'OEBPS/book.css',
      'OEBPS/package.opf',
    ]);
  });

  it('points every link at a file, and at the entry inside it', () => {
    const files = epubFiles(sample());
    expect(files.get('OEBPS/event-fall.xhtml')).toContain('<a href="people-01.xhtml#person-zedekiah">Zedekiah</a>');
    expect(files.get('OEBPS/people-01.xhtml')).toContain('<a href="event-fall.xhtml">The Fall</a>');
    expect(files.get('OEBPS/event-fall.xhtml')).toContain('href="https://example.org/a?b=1&amp;c=2"');
  });

  it('writes pages that are well formed', () => {
    for (const [name, content] of epubFiles(sample())) {
      if (typeof content === 'string' && /\.(xhtml|opf|ncx)$/.test(name)) {
        expect(() => parseXml(content.replace(/^<\?xml[^>]*\?>\s*(<!DOCTYPE html>)?/, '')), name).not.toThrow();
      }
    }
  });

  it('nests the table of contents by level', () => {
    const nav = epubFiles(sample()).get('OEBPS/nav.xhtml') as string;
    expect(nav).toContain('<li><a href="part-timeline.xhtml">Timeline</a><ol><li><a href="event-fall.xhtml">The Fall</a></li></ol></li>');
    expect(nav).toContain('<li><a href="part-people.xhtml">People</a><ol><li><a href="people-01.xhtml">Zedekiah</a></li></ol></li>');
  });

  it('lists every document in the manifest and in reading order', () => {
    const opf = epubFiles(sample()).get('OEBPS/package.opf') as string;
    expect(opf.match(/<itemref /g)).toHaveLength(5);
    expect(opf).toContain('<item id="d2" href="event-fall.xhtml" media-type="application/xhtml+xml"/>');
    expect(opf).toContain('<meta property="dcterms:modified">2026-10-04T08:00:00Z</meta>');
    expect(opf).toContain('<dc:identifier id="id">urn:uuid:00000000-0000-5000-a000-000000000000</dc:identifier>');
    expect(opf).not.toContain('cover');
  });

  it('carries a cover when given one', () => {
    const files = epubFiles(sample(), { cover: { data: new Uint8Array([1, 2, 3]), type: 'image/png' } });
    expect(files.get('OEBPS/cover.png')).toEqual(new Uint8Array([1, 2, 3]));
    expect(files.get('OEBPS/package.opf')).toContain('<item id="cover" href="cover.png" media-type="image/png" properties="cover-image"/>');
  });

  it('takes a cover after it is written, keeping its first file first and uncompressed', () => {
    const covered = addCover(writeEpub(sample()), new Uint8Array([1, 2, 3]));
    expect(strFromU8(covered.slice(30, 58))).toBe('mimetypeapplication/epub+zip');
    expect(covered[8] | (covered[9] << 8)).toBe(0);
    const files = unzipSync(covered);
    expect(files['OEBPS/cover.png']).toEqual(new Uint8Array([1, 2, 3]));
    const opf = strFromU8(files['OEBPS/package.opf']);
    expect(opf).toContain('<item id="cover" href="cover.png" media-type="image/png" properties="cover-image"/>');
    expect(opf).toContain('<meta name="cover" content="cover"/>\n</metadata>');
    expect(Object.keys(files)).toHaveLength(Object.keys(unzipSync(writeEpub(sample()))).length + 1);
  });

  it('holds each map once, as a drawing, and shows it where it belongs', () => {
    const files = epubFiles(mapped());
    expect(files.get('OEBPS/maps/m0123456789.svg')).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(files.get('OEBPS/event-fall.xhtml')).toContain('<p class="map"><img src="maps/m0123456789.svg" alt="Map showing Jerusalem"/></p>');
    expect(files.get('OEBPS/package.opf')).toContain('<item id="m0123456789" href="maps/m0123456789.svg" media-type="image/svg+xml"/>');
  });

  it('refuses to show a map the book does not hold', () => {
    const lost = mapped();
    lost.maps = [];
    expect(() => epubFiles(lost)).toThrow(/event-fall shows map\/m0123456789, which is not in the book/);
  });

  it('is published with its maps as pictures any reader can show', () => {
    const png = new Uint8Array([137, 80, 78, 71]);
    const finished = unzipSync(finishEpub(writeEpub(mapped()), { maps: new Map([['OEBPS/maps/m0123456789.svg', png]]) }));
    expect(finished['OEBPS/maps/m0123456789.png']).toEqual(png);
    expect(finished['OEBPS/maps/m0123456789.svg']).toBeUndefined();
    expect(strFromU8(finished['OEBPS/event-fall.xhtml'])).toContain('<img src="maps/m0123456789.png" alt="Map showing Jerusalem"/>');
    const opf = strFromU8(finished['OEBPS/package.opf']);
    expect(opf).toContain('<item id="m0123456789" href="maps/m0123456789.png" media-type="image/png"/>');
    expect(opf).not.toContain('svg');
    // A map that could not be drawn as a picture stays as it was.
    const kept = unzipSync(finishEpub(writeEpub(mapped()), { maps: new Map() }));
    expect(kept['OEBPS/maps/m0123456789.svg']).toBeDefined();
    expect(strFromU8(kept['OEBPS/package.opf'])).toContain('image/svg+xml');
  });

  it('refuses a link to something the book does not hold', () => {
    const broken = sample();
    broken.docs[2].html += `<p><a href="${bookRef('place', 'atlantis')}">Atlantis</a></p>`;
    expect(() => epubFiles(broken)).toThrow(/event-fall links to place\/atlantis, which is not in the book/);
  });

  it('refuses two entries with one name, two documents with one name, and a page that is not well formed', () => {
    const twice = sample();
    twice.docs[1].targets.push({ ref: bookRef('event', 'fall'), anchor: 'again' });
    expect(() => linkTable(twice)).toThrow(/defines book:event\/fall twice/);

    const same = sample();
    same.docs.push({ ...same.docs[2], targets: [] });
    expect(() => epubFiles(same)).toThrow(/two documents called event-fall/);

    const open = sample();
    open.docs[0].html = '<p>never closed';
    expect(() => epubFiles(open)).toThrow(/title is not well formed/);
  });

  it('resolves links only in the book\'s own scheme', () => {
    const table = new Map([[bookRef('event', 'x'), 'event-x.xhtml']]);
    expect(resolveLinks(`<a href="${bookRef('event', 'x')}">x</a> <a href="https://e.org/book:event/x">y</a>`, table, 'doc')).toBe(
      '<a href="event-x.xhtml">x</a> <a href="https://e.org/book:event/x">y</a>',
    );
  });
});

describe('the PDF', () => {
  const source = writeTypst(sample());

  it('hands every word to the typesetter as a string', () => {
    expect(source).toContain('", said \\"no\\" & fled "');
    expect(source).toContain('"A \\\\ backslash and a # sign."');
  });

  it('links to entries by label and sets a label on every entry', () => {
    expect(source).toContain('go("person:zedekiah", seq(("Zedekiah",)))');
    expect(source).toContain('#label("person:zedekiah")');
    expect(source).toContain('#label("event:fall")');
    expect(source).toContain('ext("https://example.org/a?b=1&c=2", seq(("the tablet",)))');
  });

  it('sets the page beside a link in a list', () => {
    expect(source).toContain('linkitem(seq((go("event:fall", seq(("The Fall",))), " ", when(seq(("587 BC",))),)), "event:fall")');
  });

  it('writes a link to something outside the book as plain words', () => {
    const outside = sample();
    outside.docs[2].html = `<h1>The Fall</h1><p><a href="${bookRef('place', 'atlantis')}">Atlantis</a></p>`;
    const typst = writeTypst(outside);
    expect(typst).toContain('para(seq((seq(("Atlantis",)),)))');
    expect(typst).not.toContain('place:atlantis');
  });

  it('holds each map once and sets it where it belongs, with its description', () => {
    const typst = writeTypst(mapped());
    expect(typst.match(/#let map-m0123456789 = bytes\(/g)).toHaveLength(1);
    expect(typst).toContain('#mapfigure(map-m0123456789, "Map showing Jerusalem")');
    const compiler = NodeCompiler.create({ fontArgs: [{ fontPaths: fontPaths() }] });
    const compiled = compiler.compile({ mainFileContent: typst });
    const diagnostics = compiled.takeDiagnostics();
    expect(diagnostics ? compiler.fetchDiagnostics(diagnostics).map((problem: { message: string }) => problem.message) : []).toEqual([]);
    expect(compiled.result).toBeTruthy();
  });

  it('leaves out a map the book does not hold', () => {
    const lost = mapped();
    lost.maps = [];
    expect(writeTypst(lost)).not.toContain('mapfigure(map-');
  });

  it('links to the parts from the foot of every page', () => {
    expect(source).toContain('tap("contents", "Contents"), tap("part:people", "People")');
  });

  it('is typeset without complaint, with its links and its outline', () => {
    const compiler = NodeCompiler.create({ fontArgs: [{ fontPaths: fontPaths() }] });
    const compiled = compiler.compile({ mainFileContent: source });
    const diagnostics = compiled.takeDiagnostics();
    const problems = diagnostics ? compiler.fetchDiagnostics(diagnostics) : [];
    expect(problems.map((problem: { message: string }) => problem.message)).toEqual([]);
    const pdf = compiler.pdf(compiled.result!, { pdfTags: false }).toString('latin1');
    expect(pdf.startsWith('%PDF-')).toBe(true);
    expect(pdf.match(/\/Subtype\s*\/Link/g)!.length).toBeGreaterThanOrEqual(8);
    expect(pdf).toContain('/Outlines');
    expect(pdf).toContain('Newsreader');
  });

  it('carries its cover as its first page, which can be cut out and drawn alone', () => {
    const cover = coverSource(source)!;
    expect(cover).toContain('"Test Wiki"');
    expect(cover).toContain('"Edition of 4 October 2026"');
    expect(cover).not.toContain('#outline');
    const compiler = NodeCompiler.create({ fontArgs: [{ fontPaths: fontPaths() }] });
    expect(compiler.svg({ mainFileContent: cover }).startsWith('<svg')).toBe(true);
  });
});

describe('citations in a book', () => {
  const ctx: ProseContext = {
    medium: 'book',
    resolve: (type, id) => (type === 'person' && id === 'jeremiah' ? { href: bookRef('person', 'jeremiah'), label: 'Jeremiah' } : undefined),
    citations: { chron: { source: 'abc-5', at: 'rev. 11–13', url: 'https://example.org/abc5#rev11' }, lost: { source: 'draft' } },
    source: (id) =>
      id === 'abc-5'
        ? { id, cite: 'Babylonian Chronicle 5', title: 'Jerusalem Chronicle', url: 'https://example.org/abc5', href: bookRef('source', 'abc-5') }
        : id === 'draft'
          ? { id, cite: 'A Draft', title: 'A Draft', url: 'https://example.org/draft', href: '' }
          : undefined,
  };

  it('lead to the source\'s own entry, not out of the book', () => {
    expect(renderProse('Taken [[cite:chron]].', ctx).html).toBe(
      '<p>Taken <a class="cite cite--source" href="book:source/abc-5">(Babylonian Chronicle 5 rev. 11–13)</a>.</p>',
    );
  });

  it('are plain words where the source has no entry', () => {
    expect(renderProse('Taken [[cite:lost]].', ctx).html).toBe('<p>Taken <span class="cite cite--source">(A Draft)</span>.</p>');
  });

  it('write a Bible reference without a link', () => {
    expect(renderProse('Burned [[bible:2 Kings 25:8-10; Jer 52:12]].', ctx).html).toBe(
      '<p>Burned <span class="cite cite--bible">(2 Kings 25:8–10; Jeremiah 52:12)</span>.</p>',
    );
  });

  it('still report what was cited', () => {
    const result = renderProse('A [[cite:chron]] b [[bible:Gen 1:1]] c [[person:jeremiah]].', ctx);
    expect(result.cites.map((cite) => cite.key)).toEqual(['chron']);
    expect(result.bible.map((ref) => ref.osis)).toEqual(['Gen.1.1']);
    expect(result.html).toContain('<a class="wikilink wikilink--person" href="book:person/jeremiah">Jeremiah</a>');
  });
});
