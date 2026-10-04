/**
 * The little XML the book needs: escaping, and a parser for the XHTML the
 * book's pages are written in. The parser is strict, so parsing a page is
 * also the check that it is well formed, which an EPUB reader insists on.
 */
export const esc = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface XElement {
  tag: string;
  attrs: Record<string, string>;
  children: XNode[];
}
export type XNode = string | XElement;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, name: string) => {
    if (name.startsWith('#x')) return String.fromCodePoint(parseInt(name.slice(2), 16));
    if (name.startsWith('#')) return String.fromCodePoint(Number(name.slice(1)));
    const known = ENTITIES[name];
    if (known === undefined) throw new Error(`"${whole}" is not an XML entity`);
    return known;
  });
}

const TOKEN = /<!--[\s\S]*?-->|<\/([A-Za-z][\w:-]*)\s*>|<([A-Za-z][\w:-]*)((?:\s+[\w:-]+\s*=\s*"[^"]*")*)\s*(\/?)>|([^<]+)|(<)/g;
const ATTRIBUTE = /([\w:-]+)\s*=\s*"([^"]*)"/g;

/** Parse a fragment of XHTML into a tree. Throws on anything that is not well formed. */
export function parseXml(source: string): XNode[] {
  const root: XElement = { tag: '#root', attrs: {}, children: [] };
  const open: XElement[] = [root];
  for (const match of source.matchAll(TOKEN)) {
    const [whole, closing, opening, attributes, selfClosing, text, stray] = match;
    const parent = open[open.length - 1];
    if (stray) throw new Error(`A "<" that opens no tag, near "${source.slice(match.index, match.index + 40)}"`);
    if (text !== undefined) {
      if (text.includes('&') && /&(?!#x[0-9a-fA-F]+;|#\d+;|[a-zA-Z]+;)/.test(text)) {
        throw new Error(`An "&" that is not written as &amp;, near "${text.slice(0, 40)}"`);
      }
      parent.children.push(decode(text));
    } else if (closing) {
      if (open.length === 1 || parent.tag !== closing) {
        throw new Error(`</${closing}> closes <${parent.tag === '#root' ? 'nothing' : parent.tag}>`);
      }
      open.pop();
    } else if (opening) {
      const element: XElement = { tag: opening, attrs: {}, children: [] };
      for (const [, name, value] of (attributes ?? '').matchAll(ATTRIBUTE)) element.attrs[name] = decode(value);
      parent.children.push(element);
      if (!selfClosing) open.push(element);
    } else if (!whole.startsWith('<!--')) {
      throw new Error(`Cannot read "${whole.slice(0, 40)}"`);
    }
  }
  if (open.length > 1) throw new Error(`<${open[open.length - 1].tag}> is never closed`);
  return root.children;
}

/** The text of a tree, without its tags. */
export function textOf(nodes: XNode[]): string {
  return nodes.map((node) => (typeof node === 'string' ? node : textOf(node.children))).join('');
}
