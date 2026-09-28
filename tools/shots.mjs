// Renders real app screens from a local server, for review, the README and the landing page.
// Usage: BASE=http://localhost:8899 node tools/shots.mjs <outDir> <scale> [scene ...]
import { createRequire } from 'module';
import fs from 'fs';
import { state, scenes } from './scenes.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_MODULE || 'playwright-core');
const base = process.env.BASE || 'http://localhost:8899';
const out = process.argv[2] || '/tmp/shots';
const scale = +(process.argv[3] || 1);
const only = process.argv.slice(4);
const exe = process.env.CHROME || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const errors = [];
for (const lang of (process.env.LANGS || 'ar,en').split(',')) {
  for (const [name, hash, extra] of scenes) {
    if (only.length && !only.includes(name)) continue;
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: scale,
      locale: lang === 'ar' ? 'ar-KW' : 'en-GB', serviceWorkers: 'block'
    });
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') errors.push(`${lang}/${name}: ${m.text()}`); });
    page.on('pageerror', e => errors.push(`${lang}/${name}: ${e.message}`));
    await page.addInitScript(s => { localStorage.setItem('ateeq.v1', s); }, JSON.stringify(state(lang, extra)));
    await page.goto(`${base}/app/${hash}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/${lang}-${name}.png`, fullPage: !!process.env.FULL });
    await ctx.close();
  }
}
await browser.close();
if (errors.length) { console.log('ERRORS\n' + errors.join('\n')); process.exitCode = 1; }
else console.log('no console errors');
