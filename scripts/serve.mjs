import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, realpath } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..', process.argv.includes('--dist') ? 'dist' : '.');
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.mp4': 'video/mp4', '.vtt': 'text/vtt', '.pdf': 'application/pdf', '.ttf': 'font/ttf', '.txt': 'text/plain', '.xml': 'application/xml' };
const publicRoots = new Set(['index.html', 'styles.css', 'app.js', 'site-config.js', 'assets', 'robots.txt', 'sitemap.xml']);
createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
    // Serve only public resources, including during development.
    if (!publicRoots.has(path.split('/')[0]) || path.split('/').some(part => part.startsWith('.'))) {
      response.writeHead(404).end('Not found'); return;
    }
    const target = await realpath(resolve(root, path));
    if (!target.startsWith(root + sep)) { response.writeHead(404).end('Not found'); return; }
    const info = await stat(target);
    if (!info.isFile()) { response.writeHead(404).end('Not found'); return; }
    const headers = { 'Content-Type': types[extname(target)] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' };
    let start = 0, end = info.size - 1;
    if (request.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
      if (!match || (!match[1] && !match[2])) { response.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end(); return; }
      if (!match[1]) start = Math.max(0, info.size - Number(match[2]));
      else { start = Number(match[1]); if (match[2]) end = Math.min(Number(match[2]), end); }
      if (start > end || start >= info.size) { response.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end(); return; }
      headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
    }
    headers['Content-Length'] = end - start + 1;
    response.writeHead(request.headers.range ? 206 : 200, headers);
    if (request.method === 'HEAD') response.end();
    else createReadStream(target, { start, end }).pipe(response);
  } catch { response.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Project page: http://localhost:${port}`));
