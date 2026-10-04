/**
 * The book's cover: the wiki's mark, its name, what it is and which edition.
 * The same drawing is the first page of the PDF and, as a picture, the cover
 * an e-reader shows in its library (`book-build.mjs` makes the picture).
 */
import type { BookMeta } from './types';

const str = (text: string): string => `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

const PAPER = '#faf7f2';
const INK = '#1e1b18';
const RUBRIC = '#9a2b2b';

/** The cover as the body of a Typst page. It sets no page size, so it fits the page it is put on. */
export function coverBody(meta: BookMeta): string {
  const address = meta.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `#set text(font: ("Newsreader", "Libertinus Serif"), fill: rgb("${INK}"), hyphenate: false)
#set par(justify: false, leading: 0.55em)
#box(width: 12mm, height: 40mm, {
  place(center + top, line(start: (0mm, 0mm), end: (0mm, 40mm), stroke: (paint: rgb("${INK}"), thickness: 1.5mm, cap: "round")))
  place(center + top, dy: 6mm, circle(radius: 5mm, fill: rgb("${RUBRIC}")))
  place(center + top, dy: 25mm, circle(radius: 3.5mm, fill: rgb("${PAPER}"), stroke: 1.5mm + rgb("${INK}")))
})
#v(1fr)
#text(size: 40pt, weight: "semibold", ${str(meta.title)})
#v(3mm)
#block(width: 88%, text(size: 16pt, ${str(meta.tagline)}))
#v(2fr)
#text(font: ("Inter", "Libertinus Serif"), size: 9.5pt, fill: rgb("#5c544b"), ${str(meta.edition)} + "  ·  " + ${str(address)})
`;
}
