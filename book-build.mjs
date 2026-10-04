/**
 * The part of making the book that happens after the site is built: the
 * book's Typst source is typeset into the PDF, and its cover is drawn and
 * put into the EPUB. This runs in Node beside the integration, so the
 * typesetter and the image library are found wherever the theme is installed.
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
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

/**
 * An EPUB as it is published: with its cover picture, and with its maps as
 * PNG pictures in place of the SVG drawings it was written with. Every
 * e-reader shows a PNG; not every one shows an SVG.
 *
 * `maps` holds the pictures by the path of the drawing each replaces.
 */
export function finishEpub(epub, { cover, maps = new Map() } = {}) {
  const files = unzipSync(epub);
  const drawn = (path) => maps.has(path);
  let opf = strFromU8(files['OEBPS/package.opf']).replace(
    /href="(maps\/[^"]+)\.svg" media-type="image\/svg\+xml"/g,
    (whole, stem) => (drawn(`OEBPS/${stem}.svg`) ? `href="${stem}.png" media-type="image/png"` : whole),
  );
  if (cover) {
    opf = opf
      .replace('</metadata>', '<meta name="cover" content="cover"/>\n</metadata>')
      .replace('<manifest>\n', '<manifest>\n<item id="cover" href="cover.png" media-type="image/png" properties="cover-image"/>\n');
  }

  const zip = {};
  // The archive keeps its order: the file that names the format stays first and stays uncompressed.
  for (const [name, data] of Object.entries(files)) {
    if (drawn(name)) {
      zip[name.replace(/\.svg$/, '.png')] = [maps.get(name), { level: 0 }];
    } else if (name === 'OEBPS/package.opf') {
      zip[name] = [strToU8(opf), { level: 9 }];
    } else if (maps.size > 0 && name.endsWith('.xhtml')) {
      const page = strFromU8(data).replace(/src="(maps\/[^"]+)\.svg"/g, (whole, stem) => (drawn(`OEBPS/${stem}.svg`) ? `src="${stem}.png"` : whole));
      zip[name] = [strToU8(page), { level: 9 }];
    } else {
      zip[name] = [data, { level: name === 'mimetype' ? 0 : 9 }];
    }
  }
  if (cover) zip['OEBPS/cover.png'] = [cover, { level: 0 }];
  return zipSync(zip);
}

/** An EPUB with a cover picture added: the picture itself, and its two mentions in the package file. */
export const addCover = (epub, png) => finishEpub(epub, { cover: png });

/**
 * Lets the image library find the book's typeface for the names on the maps,
 * beside the typefaces of the machine. Where that fails the names are set in
 * the machine's own sans-serif.
 */
function offerFonts() {
  if (process.env.FONTCONFIG_FILE || process.env.FONTCONFIG_PATH) return;
  try {
    const dir = mkdtempSync(join(tmpdir(), 'chronowiki-fonts-'));
    const dirs = fontPaths().map((path) => `<dir>${path}</dir>`).join('');
    writeFileSync(
      join(dir, 'fonts.conf'),
      `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig><include ignore_missing="yes">/etc/fonts/fonts.conf</include>${dirs}<cachedir>${join(dir, 'cache')}</cachedir></fontconfig>\n`,
    );
    process.env.FONTCONFIG_FILE = join(dir, 'fonts.conf');
  } catch {
    // The machine's own typefaces will do.
  }
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
    if (!existsSync(epub)) continue;
    try {
      offerFonts();
      const { default: sharp } = await import('sharp');
      const picture = (svg, width) => sharp(Buffer.from(svg), { density: 96 }).resize(width).png({ compressionLevel: 9, palette: true, colours: 16 }).toBuffer();

      const coverTypst = coverSource(text);
      const cover = coverTypst ? await sharp(Buffer.from(compiler.svg(typeset(compiler, { mainFileContent: coverTypst })))).resize(1200, 1600).png({ compressionLevel: 9, palette: true }).toBuffer() : undefined;

      const bytes = new Uint8Array(readFileSync(epub));
      const maps = new Map();
      for (const [name, data] of Object.entries(unzipSync(bytes, { filter: (file) => /^OEBPS\/maps\/.+\.svg$/.test(file.name) }))) {
        maps.set(name, new Uint8Array(await picture(strFromU8(data), 1200)));
      }
      writeFileSync(epub, finishEpub(bytes, { cover: cover && new Uint8Array(cover), maps }));
      if (maps.size > 0) logger.info(`book: ${maps.size} maps drawn for the EPUB`);
    } catch (error) {
      logger.warn(`the EPUB keeps its maps as SVG and has no cover picture: ${error.message}`);
    }
  }
}
