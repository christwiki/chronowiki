/**
 * Writes a book as Typst source, from which the PDF is typeset. The pages are
 * the size of a 10-inch e-paper screen (reMarkable, Kindle Scribe, Boox,
 * Supernote), so the PDF is read at full size with nothing to zoom.
 *
 * Every word of the book reaches Typst as a string, never as markup, so no
 * character in an entry can be mistaken for a command.
 */
import { coverBody } from './cover';
import { BOOK_SCHEME, type Book, type BookDoc } from './types';
import { parseXml, textOf, type XElement, type XNode } from './xml';

/** A Typst string literal. */
const str = (text: string): string => `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '').replace(/\t/g, ' ')}"`;

/** `book:person/jehoiachin` as the name of a Typst label: `person:jehoiachin`. */
const labelOf = (ref: string): string => ref.slice(BOOK_SCHEME.length).replace('/', ':');

const classes = (element: XElement): string[] => (element.attrs.class ?? '').split(/\s+/).filter(Boolean);
const isElement = (node: XNode): node is XElement => typeof node !== 'string';

const INLINE = new Set(['a', 'em', 'i', 'strong', 'b', 'span', 'br', 'sup', 'sub', 'code', 'cite', 'abbr', 'small']);

interface Context {
  doc: BookDoc;
  /** The language of the book. Text marked as being in another is hyphenated as that language. */
  language: string;
  /** The labels that exist in the book. A link to anything else is written as plain words. */
  known: Set<string>;
  /** The label for the element with a given `id` in this document. */
  anchors: Map<string, string>;
}

/** A run of text and inline elements, as a Typst expression. */
function inline(nodes: XNode[], ctx: Context): string {
  const parts: string[] = [];
  for (const node of nodes) {
    if (!isElement(node)) {
      const text = node.replace(/\s+/g, ' ');
      if (text) parts.push(str(text));
      continue;
    }
    const body = () => inline(node.children, ctx);
    switch (node.tag) {
      case 'a': {
        const href = node.attrs.href ?? '';
        if (href.startsWith(BOOK_SCHEME)) {
          const label = labelOf(href);
          parts.push(ctx.known.has(label) ? `go(${str(label)}, ${body()})` : body());
        } else if (/^https?:\/\//.test(href)) {
          parts.push(`ext(${str(href)}, ${body()})`);
        } else {
          parts.push(body());
        }
        break;
      }
      case 'em':
      case 'i':
      case 'cite':
        parts.push(`emph(${body()})`);
        break;
      case 'strong':
      case 'b':
        parts.push(`strong(${body()})`);
        break;
      case 'br':
        parts.push('linebreak()');
        break;
      case 'sup':
        parts.push(`super(${body()})`);
        break;
      case 'sub':
        parts.push(`sub(${body()})`);
        break;
      case 'code':
        parts.push(`raw(${str(textOf(node.children))})`);
        break;
      case 'span':
        if (classes(node).includes('when')) parts.push(`when(${body()})`);
        else if (classes(node).includes('cite')) parts.push(`cited(${body()})`);
        else parts.push(body());
        break;
      default:
        parts.push(body());
    }
  }
  return `seq((${parts.map((part) => `${part},`).join(' ')}))`;
}

/** The first entry a list item links to, whose page number is set beside it. */
function firstTarget(nodes: XNode[], ctx: Context): string | undefined {
  for (const node of nodes) {
    if (!isElement(node)) continue;
    if (node.tag === 'a' && (node.attrs.href ?? '').startsWith(BOOK_SCHEME)) {
      const label = labelOf(node.attrs.href);
      if (ctx.known.has(label)) return label;
    }
    const inside = firstTarget(node.children, ctx);
    if (inside) return inside;
  }
  return undefined;
}

const PARAGRAPHS: Record<string, string> = {
  lead: 'lead',
  kicker: 'kicker',
  date: 'dateline',
  meta: 'small',
  note: 'small',
  label: 'sublabel',
  facts: 'facts',
  pager: 'pager',
  edition: 'small',
};

/** Block elements, each as one Typst expression. */
function blocks(nodes: XNode[], ctx: Context): string[] {
  const out: string[] = [];
  let loose: XNode[] = [];
  const flush = () => {
    if (loose.some((node) => isElement(node) || node.trim() !== '')) out.push(`para(${inline(loose, ctx)})`);
    loose = [];
  };

  for (const node of nodes) {
    if (!isElement(node) || INLINE.has(node.tag)) {
      loose.push(node);
      continue;
    }
    flush();
    const label = node.attrs.id ? ctx.anchors.get(node.attrs.id) : undefined;
    const attach = (expression: string) => (label ? `[#${expression} #label(${str(label)})]` : expression);
    switch (node.tag) {
      case 'h1':
        out.push(attach(`heading(level: ${ctx.doc.level}, ${inline(node.children, ctx)})`));
        break;
      case 'h2':
      case 'h3':
      case 'h4':
        if (classes(node).includes('entry')) {
          out.push(attach(`heading(level: ${Math.min(ctx.doc.level + 1, 4)}, outlined: false, bookmarked: false, ${inline(node.children, ctx)})`));
        } else {
          out.push(attach(`subhead(${inline(node.children, ctx)})`));
        }
        break;
      case 'p': {
        const style = classes(node).map((name) => PARAGRAPHS[name]).find(Boolean) ?? 'para';
        out.push(attach(`${style}(${inline(node.children, ctx)})`));
        break;
      }
      case 'ul':
      case 'ol': {
        const items = node.children.filter(isElement).filter((child) => child.tag === 'li');
        const kinds = classes(node);
        if (kinds.includes('links') || kinds.includes('sources') || kinds.includes('plain')) {
          for (const item of items) {
            const target = kinds.includes('links') ? firstTarget(item.children, ctx) : undefined;
            out.push(`linkitem(${inline(item.children, ctx)}, ${target ? str(target) : 'none'})`);
          }
        } else {
          const rows = items.map((item) => (item.children.some((child) => isElement(child) && !INLINE.has(child.tag)) ? join(blocks(item.children, ctx)) : inline(item.children, ctx)));
          out.push(`${node.tag === 'ol' ? 'enum' : 'list'}(${rows.map((row) => `${row},`).join(' ')})`);
        }
        break;
      }
      case 'blockquote':
        out.push(`quoted(${join(blocks(node.children, ctx))})`);
        break;
      case 'hr':
        out.push('rule()');
        break;
      case 'div':
      case 'section':
      case 'nav':
      case 'header': {
        const inner = blocks(node.children, ctx);
        if (node.attrs.lang && node.attrs.lang !== ctx.language) out.push(`inlang(${str(node.attrs.lang)}, ${join(inner)})`);
        else out.push(...inner);
        break;
      }
      default:
        out.push(...blocks(node.children, ctx));
    }
  }
  flush();
  return out;
}

const join = (expressions: string[]): string => `seq((${expressions.map((expression) => `${expression},`).join(' ')}))`;

/** The settings and the small vocabulary the documents are written in. */
function preamble(book: Book): string {
  const { meta } = book;
  const nav = [`tap("contents", ${str(meta.labels.contents)})`, ...meta.labels.parts.map((part) => `tap(${str(labelOf(part.ref))}, ${str(part.title)})`)].join(', ');
  return `// ${meta.title}: ${meta.edition}. Written by chronowiki; do not edit.
#let ink = luma(0)
#let soft = luma(75)
#let line-colour = luma(150)
#let serif = ("Newsreader", "Libertinus Serif")
#let sans = ("Inter", "Libertinus Serif")

#let seq(parts) = parts.join()
#let pageno(key) = context {
  let found = query(label(key))
  if found.len() > 0 { str(counter(page).at(found.first().location()).first()) }
}
// A link inside the book. The dotted line marks it without colour, for a screen that has none.
#let go(key, body) = link(label(key), underline(offset: 0.2em, stroke: (thickness: 0.45pt, dash: "densely-dotted"), body))
#let ext(url, body) = link(url, underline(offset: 0.2em, stroke: 0.3pt + soft, body))
// A link at the foot of the page, with room around it for a finger.
#let tap(key, body) = link(label(key), box(inset: (x: 0.5em, y: 0.55em), body))
#let cited(body) = text(size: 0.9em, body)
#let when(body) = text(font: sans, size: 0.76em, fill: soft, body)
#let para(body) = par(body)
#let lead(body) = block(above: 0.8em, below: 1.2em, text(size: 1.1em, par(justify: false, body)))
#let kicker(body) = block(above: 0em, below: 0.7em, text(font: sans, size: 0.7em, tracking: 0.06em, upper(body)))
#let dateline(body) = block(above: 0.7em, below: 1em, text(font: sans, size: 0.8em, body))
#let small(body) = block(above: 0.7em, below: 0.7em, text(size: 0.86em, fill: soft, body))
#let sublabel(body) = block(above: 1.3em, below: 0.6em, sticky: true, text(font: sans, size: 0.68em, weight: "semibold", tracking: 0.06em, upper(body)))
#let subhead(body) = block(above: 1.6em, below: 0.7em, sticky: true, text(font: sans, size: 0.88em, weight: "semibold", body))
#let facts(body) = block(above: 0.55em, below: 0.55em, text(size: 0.94em, body))
#let quoted(body) = block(inset: (left: 1.1em), stroke: (left: 0.6pt + line-colour), above: 1em, below: 1em, body)
#let rule() = block(above: 1.2em, below: 1.2em, line(length: 100%, stroke: 0.4pt + line-colour))
#let inlang(code, body) = [#set text(lang: code); #body]
// A row of a list of links: the words on the left, the page they lead to on the right.
#let linkitem(body, key) = block(above: 0.95em, below: 0.95em, breakable: false, grid(
  columns: (1fr, auto), column-gutter: 0.9em,
  par(justify: false, body),
  if key != none { text(font: sans, size: 0.72em, fill: soft, pageno(key)) },
))
#let pager(body) = block(above: 1.8em, stroke: (top: 0.4pt + line-colour), inset: (top: 0.8em), text(font: sans, size: 0.8em, par(justify: false, body)))

#set document(title: ${str(meta.title)}, author: ${str(meta.title)}, description: ${str(meta.description)})
#set text(font: serif, size: 11pt, lang: ${str(meta.language)}, hyphenate: true, fill: ink)
#set par(justify: true, leading: 0.66em, spacing: 0.95em)
#set list(indent: 0.6em, body-indent: 0.6em)
#set enum(indent: 0.6em, body-indent: 0.6em)

// 157.8 by 210.4 mm is the screen of a 10.3-inch e-paper tablet (1404 by 1872 dots at 226 to the inch).
#set page(
  width: 157.8mm, height: 210.4mm,
  margin: (left: 14mm, right: 14mm, top: 16mm, bottom: 19mm),
  header: context {
    if counter(page).get().first() > 1 {
      let parts = query(heading.where(level: 1).before(here()))
      let chapters = query(heading.where(level: 2).before(here()))
      set text(font: sans, size: 7.2pt, fill: soft)
      grid(columns: (1fr, 1fr),
        if parts.len() > 0 { parts.last().body },
        align(right, if chapters.len() > 0 and parts.len() > 0 and chapters.last().location().page() >= parts.last().location().page() { chapters.last().body }),
      )
    }
  },
  footer: context {
    if counter(page).get().first() > 1 {
      set text(font: sans, size: 7.6pt, fill: soft)
      grid(columns: (1fr, auto), align: horizon,
        move(dx: -0.5em, (${nav},).join(h(0.2em))),
        counter(page).display(),
      )
    }
  },
)

#show heading: set text(font: serif, hyphenate: false)
#show heading: set par(justify: false)
#show heading.where(level: 1): it => { pagebreak(weak: true); v(22%); block(below: 1.2em, text(size: 2.1em, weight: "semibold", it.body)) }
#show heading.where(level: 2): it => { pagebreak(weak: true); block(above: 0.4em, below: 0.7em, text(size: 1.7em, weight: "semibold", it.body)) }
#show heading.where(level: 3): it => block(above: 1.9em, below: 0.6em, sticky: true, text(size: 1.32em, weight: "semibold", it.body))
#show heading.where(level: 4): it => block(above: 1.6em, below: 0.5em, sticky: true, text(size: 1.12em, weight: "semibold", it.body))
`;
}

function titlePage(book: Book): string {
  // The marks let the build cut the cover out and draw it as the EPUB's cover picture.
  return `#page(header: none, footer: none, margin: 15mm, fill: rgb("#faf7f2"))[
// cover:start
${coverBody(book.meta)}// cover:end
]
`;
}

/** The book as Typst source. */
export function writeTypst(book: Book): string {
  const known = new Set(book.docs.flatMap((doc) => doc.targets.map((target) => labelOf(target.ref))));
  const out: string[] = [preamble(book), titlePage(book)];

  // The contents: the parts and their chapters, each with its page.
  out.push(`#heading(level: 1, outlined: false, ${str(book.meta.labels.contents)}) #label("contents")`);
  out.push('#outline(title: none, depth: 2, indent: 1em)');

  for (const doc of book.docs) {
    if (doc.kind === 'title') continue;
    const anchors = new Map(doc.targets.filter((target) => target.anchor).map((target) => [target.anchor, labelOf(target.ref)]));
    const own = doc.targets.find((target) => target.anchor === '');
    const ctx: Context = { doc, language: book.meta.language, known, anchors };
    let nodes: XNode[];
    try {
      nodes = parseXml(doc.html);
    } catch (error) {
      throw new Error(`The book's document ${doc.id} is not well formed: ${(error as Error).message}`);
    }
    const body = blocks(nodes, ctx);
    // The document's own label goes on its title, which is its first heading.
    if (own) {
      const index = body.findIndex((block) => block.startsWith('heading('));
      if (index !== -1) body[index] = `[#${body[index]} #label(${str(labelOf(own.ref))})]`;
    }
    // An event opens a page of its own, as it opens a file of its own in the EPUB.
    if (doc.kind === 'event') out.push('#pagebreak(weak: true)');
    out.push(body.map((block) => (block.startsWith('[') ? block.slice(1, -1) : `#${block}`)).join('\n\n'));
  }
  return `${out.join('\n\n')}\n`;
}
