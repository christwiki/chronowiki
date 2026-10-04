# The book

A wiki is also made as a book: an EPUB for any e-reader and a PDF for large e-paper tablets. Both are built by `astro build` together with the site, from the same entries, in every language the site is built in. This guide says how the book is put together.

## What is in it

Maps are part of it: every event and every place has a map of where it happened, and every era and thread an overview of all its places. They are drawn when the book is made, from the same shapes as the site's map, in greys that read on a screen with no colour. An overview is framed on where most of the era happened; a place far outside that frame is named beside the map instead of shrinking it.

1. The cover, and a page on how to read the book.
2. **Timeline.** A page for each era, then each of its events on a page of its own: the summary, the narrative, how the date is known, the sources cited, where and who, what the event grows out of and leads to, and the events before and after it.
3. **Threads.** Each thread with its events in order.
4. **People, Places, Sources.** In alphabetical order, in documents of thirty to forty entries so that an e-reader opens them quickly. Each entry lists the events it belongs to.
5. The method page.

Drafts are left out, as on the site.

## How the links work

A device for reading books may have no browser, no back button and no pointer to hover with. So:

- A link to a person, place, source, thread, era or event leads to that entry inside the book.
- A citation of a source leads to the source's entry. The link to the passage itself, which the site opens directly, is in the list of sources at the foot of the event, for devices that can open it.
- A Bible reference is plain words: the reference is all a reader needs.
- Every person, place and source lists the events it appears in. That is the way back from any link.
- A link to something the book does not hold stops the build. The EPUB writer checks every one.

In the PDF, a link is marked by a dotted line rather than by colour; a list of links shows the page each leads to; and the foot of every page links to the contents and to every part, with room around each word for a finger.

## How it is made

| | |
|---|---|
| `src/book/model.ts` | Builds the book from the site's data: a run of documents in reading order, each a piece of XHTML in which a link to another entry is written `book:<kind>/<id>`. |
| `src/book/epub.ts` | Writes the documents as an EPUB 3 file, with the older table of contents beside the new one for old readers. |
| `src/book/typst.ts` | Writes the documents as Typst source. Every word reaches the typesetter as a string, never as markup. |
| `src/book/maps.ts` | Draws a map of some places as an SVG: framed as the site frames it, names set where they fit. Events at the same places share one map. |
| `src/book/cover.ts` | The cover's drawing: the first page of the PDF and the picture an e-reader shows in its library. |
| `src/book/xml.ts` | A strict parser for the documents. Parsing one is also the check that it is well formed. |
| `src/routes/book*.ts`, `book.astro` | The page that offers the book, and the two files. |
| `book-build.mjs` | After the site is built: typesets the Typst source into the PDF, removes the source, draws the cover and puts it into the EPUB, and turns the EPUB's maps into PNG pictures, which every e-reader can show. |

The entries' text is rendered by the same code as on the site (`src/lib/prose.ts`), told that it is writing for a book.

## Changing it

- **The wording** of the book's own pages is in the `book` messages of each language, and a wiki may override it like any other message.
- **The EPUB's styles** are `EPUB_CSS` in `src/book/epub.ts`. They are deliberately few: an e-reader's own settings for typeface, size and margins should win.
- **The PDF's layout** is the preamble in `src/book/typst.ts`: page size, margins, type, the header and the footer. The page is 157.8 by 210.4 mm, the screen of a 10.3-inch tablet.
- **A wiki without a book** sets `book: false` in `wiki.config.ts`.

## Checking it

`npm test` typesets a small book and checks its links; `npm run e2e` opens the example's EPUB and PDF, checks that every page is well formed and that every link leads somewhere. The continuous integration also runs the EPUB through [EPUBCheck](https://www.w3.org/publishing/epubcheck/), the validator of the EPUB standard.
