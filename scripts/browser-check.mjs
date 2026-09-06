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
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(url)) errors.push(`${response.status()} ${response.url()}`); });
try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('h1').innerText(), 'Filling the Unseen');
  await page.screenshot({ path: resolve(out, 'desktop-top.png') });
  for (const scene of ['garden', 'indoor', 'bonsai']) {
    await page.locator(`[data-hero="${scene}"]`).click();
    await page.waitForFunction(s => document.querySelector('#hero-after').src.endsWith(`teaser-${s}-ours.jpg`), scene);
  }
  const slider = page.locator('.hero-compare input');
  await slider.focus();
  await page.keyboard.press('Home');
  assert.equal(await slider.inputValue(), '0');
  await page.keyboard.press('End');
  assert.equal(await slider.inputValue(), '100');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await slider.inputValue(), '99');
  await slider.fill('48');
  for (const scene of ['garden', 'workshop', 'meeting', 'bonsai']) {
    await page.locator(`[data-scene="${scene}"]`).click();
    await page.waitForFunction(() => !document.querySelector('.result-compare').hasAttribute('aria-busy'));
    const methods = await page.locator('#baseline option').evaluateAll(options => options.map(option => option.value));
    assert.equal(methods.includes('gt'), ['workshop', 'meeting'].includes(scene));
    for (const method of methods) {
      await page.selectOption('#baseline', method);
      await page.waitForFunction(() => !document.querySelector('.result-compare').hasAttribute('aria-busy'));
      assert((await page.locator('#result-before').getAttribute('src')).includes(`-${method}-`));
    }
    const viewCount = await page.locator('#view-buttons button').count();
    for (let i = 0; i < viewCount; i++) {
      await page.locator('#view-buttons button').nth(i).click();
      await page.waitForFunction(() => !document.querySelector('.result-compare').hasAttribute('aria-busy'));
      assert((await page.locator('#result-caption').innerText()).endsWith(`View ${i + 1}`));
    }
  }
  await page.selectOption('#baseline', 'genfusion');
  await page.locator('#view-buttons button').first().click();
  await page.locator('#tab-mipnerf').click();
  assert(await page.locator('#metrics-mipnerf').isVisible());
  assert(!(await page.locator('#metrics-scannet').isVisible()));
  await page.keyboard.press('ArrowLeft');
  assert(await page.locator('#metrics-scannet').isVisible());
  await page.locator('[data-lightbox]').first().click();
  assert(await page.locator('#figure-dialog').isVisible());
  await page.keyboard.press('Escape');
  assert(!(await page.locator('#figure-dialog').isVisible()));
  await page.locator('#copy-citation').click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert(copied.includes('Zhou, Yunlai and Lu, Yiren and Liang, Tuo'));
  assert(copied.includes('10.1145/3767308.3835425'));
  await page.locator('#supplementary-video').scrollIntoViewIfNeeded();
  await page.evaluate(async () => { const video = document.querySelector('video'); await video.play(); });
  await page.waitForFunction(() => document.querySelector('video').currentTime > 0.3);
  await page.evaluate(() => { const video = document.querySelector('video'); video.pause(); video.currentTime = 50; });
  await page.waitForFunction(() => { const video = document.querySelector('video'); return !video.seeking && video.readyState >= 2; });
  const videoInfo = await page.locator('video').evaluate(v => ({ duration: v.duration, width: v.videoWidth, time: v.currentTime }));
  assert(videoInfo.duration > 70 && videoInfo.duration < 72 && videoInfo.width === 1920);
  await page.evaluate(() => { document.querySelector('video').currentTime = 0; });
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
  for (const width of [375, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Horizontal overflow at ${width}px`);
    await page.screenshot({ path: resolve(out, `viewport-${width}.png`), fullPage: true });
  }
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const mobile = await mobileContext.newPage();
  await mobile.goto(url, { waitUntil: 'networkidle' });
  await mobile.locator('[data-hero="garden"]').tap();
  await mobile.waitForFunction(() => document.querySelector('#hero-after').src.includes('garden'));
  await mobile.locator('[data-scene="meeting"]').tap();
  await mobile.waitForFunction(() => !document.querySelector('.result-compare').hasAttribute('aria-busy'));
  const bounds = await mobile.locator('.result-compare').boundingBox();
  await mobile.touchscreen.tap(bounds.x + bounds.width * .25, bounds.y + bounds.height * .5);
  const mobileValue = Number(await mobile.locator('.result-compare input').inputValue());
  assert(mobileValue > 15 && mobileValue < 35, `Touch slider did not move: ${mobileValue}`);
  await mobile.screenshot({ path: resolve(out, 'mobile-results.png') });
  await mobileContext.close();
  assert.deepEqual(errors, []);
  console.log('Passed: desktop/mobile layouts, every scene and method, views, sliders, touch, tabs, figure dialog, clipboard, video playback/seeking, and accessibility.');
} finally { await browser.close(); }
