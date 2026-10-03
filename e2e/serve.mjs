/**
 * Serves the production build the way Vercel does: every response carries the
 * headers from vercel.json (CSP included) and unknown paths fall back to
 * index.html for client-side routing.
 *
 * Testing under the real headers is the point. A CSP that blocks the app's own
 * code only shows up when the app runs under it.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = path.join(ROOT, 'build');
const PORT = Number(process.env.PORT || 4174);

// HSTS and upgrade-insecure-requests assume HTTPS; this server is plain HTTP on
// localhost, where both would only get in the way.
const headers = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'))
  .headers.find((h) => h.source === '/(.*)').headers
  .filter((h) => h.key !== 'Strict-Transport-Security')
  .map((h) => [h.key, h.value.replace(/;\s*upgrade-insecure-requests/, '')]);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.txt': 'text/plain', '.map': 'application/json',
  '.woff2': 'font/woff2',
};

http.createServer((req, res) => {
  for (const [key, value] of headers) res.setHeader(key, value);
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(BUILD, urlPath);
  if (!file.startsWith(BUILD) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(BUILD, 'index.html');
  }
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`serving build on http://127.0.0.1:${PORT}`));
