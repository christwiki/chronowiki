/**
 * Writes a book as an EPUB 3 file, with the older table of contents (NCX)
 * beside the new one so that old readers find their way too. The file embeds
 * no typeface and sets no size: an e-reader's own settings decide those.
 */
import { strToU8, zipSync, type Zippable } from 'fflate';
import { BOOK_SCHEME, bookRef, type Book, type BookDoc } from './types';
import { esc, parseXml } from './xml';

export const EPUB_CSS = `
body { margin: 0 4%; line-height: 1.45; widows: 2; orphans: 2; -webkit-hyphens: auto; hyphens: auto; }
h1 { font-size: 1.5em; line-height: 1.2; margin: 1em 0 0.4em; -webkit-hyphens: none; hyphens: none; page-break-after: avoid; }
h2 { font-size: 1.15em; line-height: 1.25; margin: 1.6em 0 0.4em; -webkit-hyphens: none; hyphens: none; page-break-after: avoid; }
h2.entry { border-top: 1px solid; padding-top: 0.8em; margin-top: 1.8em; }
h2.section { font-family: sans-serif; font-size: 0.95em; }
p { margin: 0 0 0.75em; }
a { color: inherit; text-decoration: underline; }
blockquote { margin: 1em 0 1em 1.2em; }
.kicker { font-family: sans-serif; font-size: 0.75em; letter-spacing: 0.06em; text-transform: uppercase; margin: 0; }
.kicker a { text-decoration: none; }
.date { font-family: sans-serif; font-size: 0.85em; }
.lead { font-size: 1.1em; }
.meta, .note, .small { font-size: 0.88em; }
.cite { font-size: 0.88em; }
.label { font-family: sans-serif; font-size: 0.75em; font-weight: bold; letter-spacing: 0.05em; text-transform: uppercase; margin: 1.4em 0 0.4em; page-break-after: avoid; }
.facts { margin: 0 0 0.4em; }
ul.links, ul.sources, ul.plain { list-style: none; margin: 0 0 1em; padding: 0; }
ul.links li, ul.sources li, ul.plain li { margin: 0 0 0.6em; }
.when { font-family: sans-serif; font-size: 0.8em; white-space: nowrap; }
.pager { font-family: sans-serif; font-size: 0.85em; border-top: 1px solid; padding-top: 0.7em; margin-top: 2em; }
.map { margin: 1em 0; text-align: center; page-break-inside: avoid; }
.map img { width: 100%; height: auto; }
.titlepage { text-align: center; margin-top: 18%; }
.titlepage h1 { font-size: 2.2em; margin: 0 0 0.3em; }
.titlepage .edition { font-family: sans-serif; font-size: 0.85em; margin-top: 3em; }
nav ol { list-style: none; margin: 0; padding: 0 0 0 1.2em; }
nav > ol { padding: 0; }
nav li { margin: 0.4em 0; }
`.trim();

const fileOf = (doc: BookDoc) => `${doc.id}.xhtml`;

/** Where every link in the book leads: `book:person/x` to `people-03.xhtml#person-x`. */
export function linkTable(book: Book): Map<string, string> {
  const table = new Map<string, string>();
  for (const doc of book.docs) {
    for (const target of doc.targets) {
      if (table.has(target.ref)) throw new Error(`The book defines ${target.ref} twice`);
      table.set(target.ref, target.anchor ? `${fileOf(doc)}#${target.anchor}` : fileOf(doc));
    }
  }
  for (const map of book.maps) table.set(bookRef('map', map.id), `maps/${map.id}.svg`);
  return table;
}

/** A document's XHTML with its links and its maps pointing at files. A link to something the book does not hold is an error. */
export function resolveLinks(html: string, table: Map<string, string>, where: string): string {
  return html.replace(new RegExp(`(href|src)="${BOOK_SCHEME}([^"]+)"`, 'g'), (_, attribute: string, ref: string) => {
    const target = table.get(`${BOOK_SCHEME}${ref}`);
    if (!target) throw new Error(`${where} ${attribute === 'src' ? 'shows' : 'links to'} ${ref}, which is not in the book`);
    return `${attribute}="${target}"`;
  });
}

function page(book: Book, title: string, body: string, bodyClass: string): string {
  const { language, dir } = book.meta;
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${language}" xml:lang="${language}" dir="${dir}">
<head>
<meta charset="utf-8"/>
<title>${esc(title)}</title>
<link rel="stylesheet" type="text/css" href="book.css"/>
</head>
<body class="${bodyClass}">
${body}
</body>
</html>
`;
}

interface NavItem {
  doc: BookDoc;
  children: NavItem[];
}

/** The documents as a tree, by their levels. */
function navTree(docs: BookDoc[]): NavItem[] {
  const roots: NavItem[] = [];
  const open: NavItem[] = [];
  for (const doc of docs) {
    const item: NavItem = { doc, children: [] };
    while (open.length > 0 && open[open.length - 1].doc.level >= doc.level) open.pop();
    (open.length > 0 ? open[open.length - 1].children : roots).push(item);
    open.push(item);
  }
  return roots;
}

function navList(items: NavItem[]): string {
  if (items.length === 0) return '';
  const rows = items.map((item) => `<li><a href="${fileOf(item.doc)}">${esc(item.doc.title)}</a>${navList(item.children)}</li>`);
  return `<ol>${rows.join('')}</ol>`;
}

function ncxPoints(items: NavItem[], counter: { n: number }): string {
  return items
    .map((item) => {
      counter.n += 1;
      return `<navPoint id="n${counter.n}" playOrder="${counter.n}"><navLabel><text>${esc(item.doc.title)}</text></navLabel><content src="${fileOf(item.doc)}"/>${ncxPoints(item.children, counter)}</navPoint>`;
    })
    .join('');
}

export interface EpubOptions {
  /** A picture for the reader's library, as PNG or JPEG. */
  cover?: { data: Uint8Array; type: 'image/png' | 'image/jpeg' };
}

/** The files of the EPUB, by their path inside it. */
export function epubFiles(book: Book, options: EpubOptions = {}): Map<string, string | Uint8Array> {
  const { meta, docs } = book;
  const table = linkTable(book);
  const files = new Map<string, string | Uint8Array>();
  const ids = new Set<string>();

  for (const doc of docs) {
    if (ids.has(doc.id)) throw new Error(`The book has two documents called ${doc.id}`);
    ids.add(doc.id);
    const html = resolveLinks(doc.html, table, doc.id);
    try {
      parseXml(html);
    } catch (error) {
      throw new Error(`The book's document ${doc.id} is not well formed: ${(error as Error).message}`);
    }
    files.set(`OEBPS/${fileOf(doc)}`, page(book, doc.title, html, `doc doc--${doc.kind}`));
  }

  const tree = navTree(docs);
  files.set(
    'OEBPS/nav.xhtml',
    page(book, meta.labels.contents, `<nav epub:type="toc" id="toc"><h1>${esc(meta.labels.contents)}</h1>${navList(tree)}</nav>`, 'doc doc--nav'),
  );
  files.set(
    'OEBPS/toc.ncx',
    `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="${meta.language}">
<head><meta name="dtb:uid" content="${esc(meta.identifier)}"/><meta name="dtb:depth" content="3"/><meta name="dtb:totalPageCount" content="0"/><meta name="dtb:maxPageNumber" content="0"/></head>
<docTitle><text>${esc(meta.title)}</text></docTitle>
<navMap>${ncxPoints(tree, { n: 0 })}</navMap>
</ncx>
`,
  );
  files.set('OEBPS/book.css', EPUB_CSS);
  for (const map of book.maps) files.set(`OEBPS/maps/${map.id}.svg`, `<?xml version="1.0" encoding="utf-8"?>\n${map.svg}\n`);

  const coverFile = options.cover ? `cover.${options.cover.type === 'image/png' ? 'png' : 'jpg'}` : undefined;
  if (options.cover && coverFile) files.set(`OEBPS/${coverFile}`, options.cover.data);

  const manifest = [
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
    '<item id="css" href="book.css" media-type="text/css"/>',
    ...(options.cover && coverFile ? [`<item id="cover" href="${coverFile}" media-type="${options.cover.type}" properties="cover-image"/>`] : []),
    ...docs.map((doc, index) => `<item id="d${index}" href="${fileOf(doc)}" media-type="application/xhtml+xml"/>`),
    ...book.maps.map((map) => `<item id="${map.id}" href="maps/${map.id}.svg" media-type="image/svg+xml"/>`),
  ];
  // The time without its fraction, as the EPUB standard writes it.
  const modified = meta.modified.toISOString().replace(/\.\d+Z$/, 'Z');
  files.set(
    'OEBPS/package.opf',
    `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id" xml:lang="${meta.language}" dir="${meta.dir}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="id">${esc(meta.identifier)}</dc:identifier>
<dc:title>${esc(meta.title)}</dc:title>
<dc:language>${meta.language}</dc:language>
<dc:creator>${esc(meta.title)}</dc:creator>
<dc:publisher>${esc(meta.title)}</dc:publisher>
<dc:description>${esc(meta.description)}</dc:description>
<dc:date>${modified.slice(0, 10)}</dc:date>
<dc:source>${esc(meta.url)}</dc:source>
${meta.rights ? `<dc:rights>${esc(meta.rights)}</dc:rights>\n` : ''}<meta property="dcterms:modified">${modified}</meta>
${options.cover ? '<meta name="cover" content="cover"/>\n' : ''}</metadata>
<manifest>
${manifest.join('\n')}
</manifest>
<spine toc="ncx">
${docs.map((_, index) => `<itemref idref="d${index}"/>`).join('\n')}
</spine>
</package>
`,
  );
  return files;
}

/** The book as one EPUB file. */
export function writeEpub(book: Book, options: EpubOptions = {}): Uint8Array {
  const mtime = book.meta.modified;
  // The first file names the format and is stored as it is; a reader looks for it at a fixed place.
  const zip: Zippable = { mimetype: [strToU8('application/epub+zip'), { level: 0, mtime }] };
  zip['META-INF/container.xml'] = [
    strToU8(
      '<?xml version="1.0" encoding="utf-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>\n',
    ),
    { mtime },
  ];
  for (const [path, content] of epubFiles(book, options)) {
    zip[path] = [typeof content === 'string' ? strToU8(content) : content, { mtime, level: typeof content === 'string' ? 9 : 0 }];
  }
  return zipSync(zip);
}
