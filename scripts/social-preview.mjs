import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const data = async (file, mime) => `data:${mime};base64,${(await readFile(resolve(root, file))).toString('base64')}`;
const [before, after, font] = await Promise.all([
  data('assets/results/teaser-bonsai-original.jpg', 'image/jpeg'),
  data('assets/results/teaser-bonsai-ours.jpg', 'image/jpeg'),
  data('assets/fonts/manrope-bold.ttf', 'font/ttf'),
]);
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html lang="en"><style>
    @font-face{font-family:Manrope;src:url('${font}')}*{box-sizing:border-box}body{margin:0;padding:35px 48px;background:#f6f8f3;color:#202b27;font-family:Manrope,Arial,sans-serif}header{height:33px;display:flex;align-items:center;justify-content:flex-end;font-size:15px;color:#1d5745}h1{font-size:55px;letter-spacing:-2px;margin:17px 0 5px}h1 span{color:#1d5745}p{margin:0;font-size:22px;font-family:Arial,sans-serif;color:#4d6155}.images{display:flex;gap:16px;margin-top:25px}.image{position:relative;width:544px;height:306px;overflow:hidden;border-radius:9px}.image img{width:100%;height:100%;object-fit:contain}.label{position:absolute;top:12px;left:12px;color:white;background:#24352de8;padding:8px 12px;font-size:13px;border-radius:5px}.ours{background:#1d5745}footer{display:flex;justify-content:space-between;margin-top:20px;font-size:13px;color:#4d6155}
    </style><header>ACM MULTIMEDIA 2026 · RIO DE JANEIRO</header><h1>Filling the <span>Unseen</span></h1><p>Scene Extrapolation via 3D Gaussian Splatting</p><div class="images"><div class="image"><img src="${before}" alt="Original"><span class="label">Original 3DGS</span></div><div class="image"><img src="${after}" alt="Ours"><span class="label ours">Filling the Unseen</span></div></div><footer><span>Yunlai Zhou, Yiren Lu, Tuo Liang, Disheng Liu, Vipin Chaudhary, Yu Yin</span><span>Case Western Reserve University</span></footer></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(root, 'assets/social-preview.png') });
  console.log('Generated 1200 × 630 social preview from original paper renderings.');
} finally { await browser.close(); }
