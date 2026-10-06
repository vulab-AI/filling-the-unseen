import assert from 'node:assert/strict';
import { readFile, stat, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname, '..');
const html = await readFile(resolve(root, 'index.html'), 'utf8');
assert(!/<header\b|class="teaser\b|data-hero=|Beyond the observed scene|Drag to reveal|Explore results|RIO DE JANEIRO/.test(html), 'Removed navigation and teaser UI must not return');
assert(/<p class="venue">ACM MULTIMEDIA 2026<\/p>/.test(html), 'Conference label must not include the location');
const publicationLinks = html.match(/<div class="publication-links">([\s\S]*?)<\/div>/)[1];
assert(!/href="#(?:video|results)"/.test(publicationLinks), 'Hero must not show Video or Explore results buttons');
assert(!/THE IDEA|A more complete world|from an incomplete capture|SEE IT IN MOTION|SUPPLEMENTARY VIDEO|supplementary-video|assets\/video\/supplementary\.mp4/.test(html), 'Old idea heading and full-length video section must not return');
assert(html.indexOf('class="publication-links"') < html.indexOf('id="scene-videos"') && html.indexOf('id="scene-videos"') < html.indexOf('id="overview"'), 'Individual scene videos must sit between publication links and the idea');
assert.equal([...html.matchAll(/class="step-number"/g)].length, 3, 'Keep all three contributions');
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
const manifest = JSON.parse(await readFile(resolve(root, 'assets/video/presentation/manifest.json'), 'utf8'));
assert.equal(manifest.source, 'supp videos.pptx');
assert.equal(manifest.scenes.length, 4);
const clips = manifest.scenes.flatMap(scene => Object.values(scene.clips));
assert.equal(clips.length, 22, 'All 22 distinct presentation videos should be available');
assert.equal(new Set(clips.map(clip => clip.src)).size, 22);
for (const clip of clips) {
  const video = await readFile(resolve(root, clip.src));
  assert.equal(createHash('sha256').update(video).digest('hex'), clip.sha256, `Video does not match extraction manifest: ${clip.src}`);
  assert(video.subarray(4, 8).toString() === 'ftyp', `Not an MP4: ${clip.src}`);
  assert(video.indexOf(Buffer.from('moov')) < video.indexOf(Buffer.from('mdat')), `No fast-start: ${clip.src}`);
  assert.equal(clip.codec, 'h264');
  assert.equal(clip.width, 960);
  assert.equal(clip.height, 540);
  assert((await stat(resolve(root, clip.poster))).isFile());
  assert.equal(Boolean(clip.post_processing), clip.method === 'ours_difixed');
}
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await inspect(path);
    else {
      assert(!/\.(zip|pptx|tex|aux|log|bib|bbl)$/.test(entry.name), `Private source in public assets: ${path}`);
      assert((await stat(path)).size < 95 * 1024 * 1024, `Asset exceeds GitHub file limit: ${path}`);
    }
  }
}
await inspect(resolve(root, 'assets'));
console.log('Passed: section order, idea/contributions, links, assets, PDF, and all 22 streamable presentation clips with verified hashes.');
