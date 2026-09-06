import assert from 'node:assert/strict';
import { readFile, stat, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const html = await readFile(resolve(root, 'index.html'), 'utf8');
const siteUrl = html.match(/rel="canonical" href="([^"]+)"/)[1];
for (const [, url] of html.matchAll(/(?:property="og:image"|name="citation_pdf_url") content="([^"]+)"/g)) {
  assert(url.startsWith(siteUrl), `Metadata points outside this site: ${url}`);
  assert((await stat(resolve(root, url.slice(siteUrl.length)))).isFile(), `Missing metadata asset: ${url}`);
}
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(ids.length, new Set(ids).size, 'HTML IDs must be unique');
for (const [, url] of html.matchAll(/\b(?:src|href|poster|data-lightbox)="([^"]+)"/g)) {
  if (/^(https?:|mailto:)/.test(url) || url === '#') continue;
  if (url.startsWith('#')) assert(ids.includes(url.slice(1)), `Missing anchor: ${url}`);
  else assert((await stat(resolve(root, url))).isFile(), `Missing resource: ${url}`);
}
for (const [, url] of (await readFile(resolve(root, 'styles.css'), 'utf8')).matchAll(/url\('([^']+)'\)/g)) {
  assert((await stat(resolve(root, url))).isFile(), `Missing CSS resource: ${url}`);
}
for (const match of html.matchAll(/<img\s[^>]+>/g)) assert(/\balt="[^"]*"/.test(match[0]), `Missing alt text: ${match[0]}`);
assert(!/Anonymous Author|YOUR REPO|TODO|lorem ipsum|XXXXXXX/i.test(html), 'Public content contains draft placeholders');
const pdf = await readFile(resolve(root, 'assets/paper/filling-the-unseen.pdf'));
assert(pdf.subarray(0, 5).toString() === '%PDF-', 'Paper is not a PDF');
const video = await readFile(resolve(root, 'assets/video/supplementary.mp4'));
assert(video.subarray(4, 8).toString() === 'ftyp', 'Video is not an MP4');
assert(video.indexOf(Buffer.from('moov')) < video.indexOf(Buffer.from('mdat')), 'Video should support fast-start streaming');
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await inspect(path);
    else {
      assert(!/\.(zip|tex|aux|log|bib|bbl)$/.test(entry.name), `Private source in public assets: ${path}`);
      assert((await stat(path)).size < 95 * 1024 * 1024, `Asset exceeds GitHub file limit: ${path}`);
    }
  }
}
await inspect(resolve(root, 'assets'));
console.log('Passed: links, anchors, asset files, alt text, public content, PDF, and streamable video.');
