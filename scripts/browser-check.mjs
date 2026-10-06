import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const out = resolve(import.meta.dirname, '../.work/screenshots');
await mkdir(out, { recursive: true });
const url = process.env.TEST_URL || 'http://localhost:4173/';
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
const errors = [];
const videoRequests = new Set();
page.on('request', request => { if (request.url().includes('.mp4')) videoRequests.add(request.url()); });
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(url)) errors.push(`${response.status()} ${response.url()}`); });
async function checkSimplifiedLayout(target) {
  assert.equal(await target.locator('.site-header, .nav, .teaser, .hero-compare, [data-hero]').count(), 0);
  assert.equal(await target.locator('.publication-links a:visible').allTextContents().then(labels => labels.map(label => label.trim())).then(labels => labels.join(', ')), 'Paper, Code');
  assert.equal((await target.locator('.venue').innerText()).trim(), 'ACM MULTIMEDIA 2026');
  const venueSize = await target.locator('.venue').evaluate(element => parseFloat(getComputedStyle(element).fontSize));
  assert(venueSize >= 16, `Conference name too small: ${venueSize}px`);
  assert.equal(await target.locator('#supplementary-video, #video, #overview-heading, #results, .result-compare, .clip-scene-caption, .clip-card figcaption, #clip-note, #scene-videos a[download]').count(), 0);
  assert(await target.locator('.idea-statement').evaluate(element => parseFloat(getComputedStyle(element).fontSize) >= 21));
  assert.equal(await target.locator('#overview .step-number').count(), 3);
  assert(await target.evaluate(() => document.querySelector('.hero').compareDocumentPosition(document.querySelector('#scene-videos')) & Node.DOCUMENT_POSITION_FOLLOWING));
  assert(await target.evaluate(() => document.querySelector('#scene-videos').compareDocumentPosition(document.querySelector('#overview')) & Node.DOCUMENT_POSITION_FOLLOWING));
  assert.deepEqual(await target.locator('body *').evaluateAll(elements => elements
    .filter(element => element.getClientRects().length && [...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim()))
    .filter(element => getComputedStyle(element).color !== 'rgb(0, 0, 0)')
    .map(element => ({ tag: element.tagName, text: element.textContent.slice(0, 70), color: getComputedStyle(element).color }))), [], 'All webpage text must be black');
}
try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !document.querySelector('#clip-play').disabled);
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('h1').innerText(), 'Filling the Unseen');
  await checkSimplifiedLayout(page);
  assert.equal(await page.locator('.venue').evaluate(element => getComputedStyle(element).fontSize), '20px');
  await page.screenshot({ path: resolve(out, 'desktop-top.png') });
  assert.equal(videoRequests.size, 2, 'Do not eagerly download all presentation videos');
  const manifest = await (await page.request.get(new URL('assets/video/presentation/manifest.json', url).href)).json();
  const waitForClips = async () => {
    await page.waitForFunction(() => !document.querySelector('#scene-videos').hasAttribute('aria-busy') && !document.querySelector('#clip-play').disabled);
  };
  for (const scene of manifest.scenes) {
    await page.locator(`[data-clip-scene="${scene.id}"]`).click();
    await waitForClips();
    assert.equal(await page.locator('#clip-output-control').isVisible(), Boolean(scene.clips.ours_difixed));
    for (const method of ['genfusion', 'guidedvd', 'fsgs', 'difix']) {
      await page.selectOption('#clip-baseline', method);
      await waitForClips();
      assert.equal(await page.locator('#clip-baseline-video').getAttribute('src'), scene.clips[method].src);
      assert.equal(await page.locator('#clip-ours-video').getAttribute('src'), scene.clips.ours.src);
      await page.locator('#clip-play').click();
      await page.waitForFunction(() => [...document.querySelectorAll('.clip-video')].every(video => video.currentTime > .15 && !video.paused));
      await page.locator('#clip-play').click();
      assert(await page.locator('.clip-video').evaluateAll(videos => videos.every(video => video.paused)));
      await page.locator('#clip-progress').fill('700');
      await page.waitForFunction(() => [...document.querySelectorAll('.clip-video')].every(video => !video.seeking && video.readyState >= 2));
      const timing = await page.locator('.clip-video').evaluateAll(videos => videos.map(video => ({ time: video.currentTime, duration: video.duration, width: video.videoWidth })));
      for (const info of timing) {
        assert.equal(info.width, 960);
        assert(Math.abs(info.time - Math.max(...timing.map(item => item.duration)) * .7) < .1);
      }
      assert(Math.abs(timing[0].time - timing[1].time) < .1, 'Both clips must seek together');
    }
    if (scene.clips.ours_difixed) {
      await page.selectOption('#clip-output', 'ours_difixed');
      await waitForClips();
      assert(await page.locator('#clip-processing-note').isVisible());
      assert.equal(await page.locator('#clip-ours-video').getAttribute('src'), scene.clips.ours_difixed.src);
      await page.locator('#clip-play').click();
      await page.waitForFunction(() => document.querySelector('#clip-ours-video').currentTime > .15);
      await page.locator('#clip-play').click();
      await page.selectOption('#clip-output', 'ours');
      await waitForClips();
      assert(!(await page.locator('#clip-processing-note').isVisible()));
    }
  }
  assert.equal(videoRequests.size, 22, 'Every presentation clip must be accessible through the gallery');
  await page.locator('#clip-progress').fill('995');
  await page.locator('#clip-play').click();
  await page.waitForFunction(() => [...document.querySelectorAll('.clip-video')].every(video => video.paused));
  assert.equal(await page.locator('#clip-play').innerText(), 'Play comparison');
  await page.locator('#clip-restart').click();
  await page.waitForFunction(() => document.querySelector('#clip-baseline-video').currentTime > .15 && document.querySelector('#clip-baseline-video').currentTime < 2);
  // Changing a scene while playing pauses both tracks and resets the timeline.
  await page.locator('[data-clip-scene="bonsai"]').click();
  await waitForClips();
  assert(await page.locator('.clip-video').evaluateAll(videos => videos.every(video => video.paused && video.currentTime < .1)));
  await page.selectOption('#clip-baseline', 'genfusion');
  await waitForClips();
  await page.locator('[data-resource="paper"]').hover();
  await checkSimplifiedLayout(page);
  await page.locator('#tab-mipnerf').click();
  assert(await page.locator('#metrics-mipnerf').isVisible());
  assert(!(await page.locator('#metrics-scannet').isVisible()));
  await page.keyboard.press('ArrowLeft');
  assert(await page.locator('#metrics-scannet').isVisible());
  await page.locator('[data-lightbox]').first().click();
  assert(await page.locator('#figure-dialog').isVisible());
  assert.equal(await page.locator('#dialog-caption').textContent(), await page.locator('#method-overview-caption').textContent());
  await page.keyboard.press('Escape');
  assert(!(await page.locator('#figure-dialog').isVisible()));
  await page.locator('#copy-citation').click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert(copied.includes('Zhou, Yunlai and Lu, Yiren and Liang, Tuo'));
  assert(copied.includes('10.1145/3767308.3835425'));
  // Load all ordinary lazy images before collecting a full-page screenshot.
  await page.evaluate(async () => {
    await Promise.all([...document.querySelectorAll('img[src]')].map(img => { img.loading = 'eager'; return img.decode().catch(() => {}); }));
  });
  assert.deepEqual(await page.locator('img[src]').evaluateAll(images => images.filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src)), []);
} catch (error) {
  await page.screenshot({ path: resolve(out, 'failure.png'), fullPage: true });
  await browser.close();
  throw error;
}
try {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: resolve(out, 'desktop-full.png'), fullPage: true });
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  await writeFile(resolve(out, 'accessibility.json'), JSON.stringify(accessibility.violations, null, 2));
  assert.deepEqual(accessibility.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), []);
  for (const width of [320, 375, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Horizontal overflow at ${width}px`);
    await checkSimplifiedLayout(page);
    await page.screenshot({ path: resolve(out, `viewport-${width}.png`), fullPage: true });
  }
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const mobile = await mobileContext.newPage();
  await mobile.goto(url, { waitUntil: 'networkidle' });
  await mobile.waitForFunction(() => !document.querySelector('#clip-play').disabled);
  await checkSimplifiedLayout(mobile);
  await mobile.locator('[data-clip-scene="garden"]').tap();
  await mobile.waitForFunction(() => !document.querySelector('#clip-play').disabled);
  await mobile.locator('#clip-play').tap();
  await mobile.waitForFunction(() => [...document.querySelectorAll('.clip-video')].every(video => video.currentTime > .15));
  await mobile.locator('#clip-play').tap();
  await mobile.locator('#scene-videos').screenshot({ path: resolve(out, 'mobile-gallery.png') });
  const bounds = await mobile.locator('#clip-progress').boundingBox();
  await mobile.touchscreen.tap(bounds.x + bounds.width * .5, bounds.y + bounds.height * .5);
  await mobile.waitForFunction(() => [...document.querySelectorAll('.clip-video')].every(video => !video.seeking));
  assert(await mobile.locator('.clip-video').evaluateAll(videos => videos.every(video => video.currentTime > 1.7 && video.currentTime < 2.3)));
  await mobile.screenshot({ path: resolve(out, 'mobile-video-controls.png') });
  await mobileContext.close();
  assert.deepEqual(errors, []);
  console.log('Passed: section order, enlarged idea, 22 presentation clips, shared playback/seeking, scene switching, mobile touch, black text, original method captions, dialogs, clipboard, and accessibility.');
} finally { await browser.close(); }
