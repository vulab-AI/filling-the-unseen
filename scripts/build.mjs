import { cp, mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
await mkdir(dist, { recursive: true });
// Only these public files are deployed. Manuscript sources and local tooling
// never enter the Pages artifact, even when they are present in the workspace.
for (const path of ['index.html', 'styles.css', 'app.js', 'site-config.js', 'assets']) {
  await cp(resolve(root, path), resolve(dist, path), { recursive: true });
}
await writeFile(resolve(dist, '.nojekyll'), '');
const html = await readFile(resolve(dist, 'index.html'), 'utf8');
const site = html.match(/rel="canonical" href="([^"]+)"/)[1];
await writeFile(resolve(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${site}sitemap.xml\n`);
await writeFile(resolve(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${site}</loc></url></urlset>\n`);
await stat(resolve(dist, 'assets/paper/filling-the-unseen.pdf'));
await stat(resolve(dist, 'assets/video/supplementary.mp4'));
console.log('Built static project page in dist/ (no runtime dependencies).');
