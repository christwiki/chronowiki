/**
 * The part of making the book that happens after the site is built: the
 * book's Typst source is typeset into the PDF, and its cover is drawn and
 * put into the EPUB. This runs in Node beside the integration, so the
 * typesetter and the image library are found wherever the theme is installed.
 */
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

const require = createRequire(import.meta.url);

/** The folders that hold the book's typefaces. Without them the typesetter falls back on a face of its own. */
export function fontPaths() {
  return ['@expo-google-fonts/newsreader', '@expo-google-fonts/inter'].flatMap((name) => {
    try {
      return [dirname(require.resolve(name))];
    } catch {
      return [];
    }
  });
}

/** The cover as a document of its own, cut out of the book's source, where it is the first page. */
export function coverSource(typst) {
  const cover = /\/\/ cover:start\n([\s\S]*?)\/\/ cover:end/.exec(typst);
  return cover ? `#set page(width: 150mm, height: 200mm, margin: 15mm, fill: rgb("#faf7f2"))\n${cover[1]}` : undefined;
}

/** An EPUB with a cover picture added: the picture itself, and its two mentions in the package file. */
export function addCover(epub, png) {
  const files = unzipSync(epub);
  const opf = strFromU8(files['OEBPS/package.opf'])
    .replace('</metadata>', '<meta name="cover" content="cover"/>\n</metadata>')
    .replace('<manifest>\n', '<manifest>\n<item id="cover" href="cover.png" media-type="image/png" properties="cover-image"/>\n');
  const zip = {};
  // The archive keeps its order: the file that names the format stays first and stays uncompressed.
  for (const [name, data] of Object.entries(files)) {
    zip[name] = [name === 'OEBPS/package.opf' ? strToU8(opf) : data, { level: name === 'mimetype' ? 0 : 9 }];
  }
  zip['OEBPS/cover.png'] = [png, { level: 0 }];
  return zipSync(zip);
}

function typeset(compiler, args) {
  const compiled = compiler.compile(args);
  const diagnostics = compiled.takeDiagnostics();
  const problems = diagnostics ? compiler.fetchDiagnostics(diagnostics) : [];
  if (!compiled.result) {
    const lines = problems.slice(0, 5).map((problem) => `${problem.message} (line ${(problem.range?.start?.line ?? 0) + 1})`);
    throw new Error(`chronowiki: the book could not be typeset:\n  ${lines.join('\n  ')}`);
  }
  return compiled.result;
}

/**
 * Typesets every book in a built site. The build leaves each book as Typst
 * source beside its EPUB; the source becomes the PDF and is removed.
 */
export async function typesetBooks(out, logger) {
  const sources = readdirSync(out, { recursive: true })
    .map(String)
    .filter((name) => /(^|[\\/])book[\\/][^\\/]+\.typ$/.test(name))
    .map((name) => join(out, name));
  if (sources.length === 0) return;

  const { NodeCompiler } = await import('@myriaddreamin/typst-ts-node-compiler');
  const fontArgs = [{ fontPaths: fontPaths() }];

  for (const source of sources) {
    const started = Date.now();
    const text = readFileSync(source, 'utf8');
    const compiler = NodeCompiler.create({ workspace: dirname(source), fontArgs });
    // Tags describe a PDF's structure for assistive software, and double its size. The EPUB is the accessible edition.
    writeFileSync(source.replace(/\.typ$/, '.pdf'), compiler.pdf(typeset(compiler, { mainFilePath: source }), { pdfTags: false }));
    rmSync(source);
    logger.info(`book typeset: ${source.slice(out.length).replace(/\.typ$/, '.pdf')} in ${((Date.now() - started) / 1000).toFixed(1)}s`);

    const epub = source.replace(/\.typ$/, '.epub');
    const cover = coverSource(text);
    if (!cover || !existsSync(epub)) continue;
    try {
      const { default: sharp } = await import('sharp');
      const svg = compiler.svg(typeset(compiler, { mainFileContent: cover }));
      const png = await sharp(Buffer.from(svg)).resize(1200, 1600).png({ compressionLevel: 9, palette: true }).toBuffer();
      writeFileSync(epub, addCover(new Uint8Array(readFileSync(epub)), new Uint8Array(png)));
    } catch (error) {
      logger.warn(`the EPUB has no cover picture: ${error.message}`);
    }
  }
}
