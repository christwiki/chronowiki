/**
 * A minimal static file server for the browser tests: serves dist/ the way a
 * plain web host would, with dist/404.html for unknown paths.
 *
 *   node tests/e2e/serve.mjs [port]
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve('dist');
const PORT = Number(process.argv[2] ?? 4322);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
};

function fileFor(pathname) {
  const path = join(ROOT, normalize(decodeURIComponent(pathname)));
  if (!path.startsWith(ROOT)) return undefined;
  if (existsSync(path) && statSync(path).isFile()) return path;
  const index = join(path, 'index.html');
  return existsSync(index) ? index : undefined;
}

createServer((request, response) => {
  const { pathname } = new URL(request.url ?? '/', 'http://localhost');
  const file = fileFor(pathname);
  const path = file ?? join(ROOT, '404.html');
  response.writeHead(file ? 200 : 404, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' });
  createReadStream(path).pipe(response);
}).listen(PORT, () => console.log(`Serving dist/ at http://localhost:${PORT}`));
