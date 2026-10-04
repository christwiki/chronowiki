/** The folders that hold the book's typefaces. */
export function fontPaths(): string[];
/** The cover as a Typst document of its own, cut out of the book's source. */
export function coverSource(typst: string): string | undefined;
/** An EPUB with a cover picture added. */
export function addCover(epub: Uint8Array, png: Uint8Array): Uint8Array;
/** An EPUB as it is published: with its cover, and with its maps as PNG pictures in place of the SVG drawings. `maps` is keyed by the drawing's path. */
export function finishEpub(epub: Uint8Array, options?: { cover?: Uint8Array; maps?: Map<string, Uint8Array> }): Uint8Array;
/** Typesets every book in a built site and gives each EPUB its cover. */
export function typesetBooks(out: string, logger: { info(message: string): void; warn(message: string): void }): Promise<void>;
