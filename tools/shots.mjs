// Renders real app screens from a local server, for review, the README and the landing page.
// Usage: BASE=http://localhost:8899 node tools/shots.mjs <outDir> <scale> [scene ...]
import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_MODULE || 'playwright-core');
const base = process.env.BASE || 'http://localhost:8899';
const out = process.argv[2] || '/tmp/shots';
const scale = +(process.argv[3] || 1);
const only = process.argv.slice(4);
const exe = process.env.CHROME || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
fs.mkdirSync(out, { recursive: true });

const now = Date.now();
const people = {
  ar: [
    { id: 'a1', name: 'أمي', req: 'الصحة والعافية وطول العمر في طاعة الله', done: true },
    { id: 'a2', name: 'أبو فهد', req: 'تيسير أمره في عمله', done: false },
    { id: 'a3', name: 'أختي نورة', req: 'الذرية الصالحة', done: false }
  ],
  en: [
    { id: 'a1', name: 'My mother', req: 'Health and a long life in obedience to Allah', done: true },
    { id: 'a2', name: 'Abu Fahad', req: 'Ease in his work', done: false },
    { id: 'a3', name: 'My sister Noura', req: 'Righteous children', done: false }
  ]
};
const tw = (u, q = 0, i = 0, w = 0) => ({
  umrah: { laps: u, startedAt: u ? now - 22 * 60000 : null, paused: false, doubt: false },
  qudum: { laps: q, startedAt: q ? now - 15 * 60000 : null, paused: false, doubt: false },
  ifadah: { laps: i, startedAt: i ? now - 26 * 60000 : null, paused: false, doubt: false },
  wada: { laps: w, startedAt: w ? now - 30 * 60000 : null, paused: false, doubt: false }
});
const sw = (u, h = 0) => ({
  umrah: { legs: u, startedAt: u ? now - 9 * 60000 : null, dhikr: 1, paused: false },
  hajj: { legs: h, startedAt: h ? now - 40 * 60000 : null, dhikr: 0, paused: false }
});
const UMRAH_DONE = { safar: true, before: true, ihram: true, road: true, enter: true };
const HAJJ_DONE = { 'h-safar': true, 'h-ihram': true, 'h-arrive': true, 'h-tarwiyah': true };
function state(lang, extra) {
  return Object.assign({
    lang, theme: 'light', size: 'm', mode: 'umrah', nusk: 'tamattu',
    done: Object.assign({}, UMRAH_DONE, HAJJ_DONE),
    tw: tw(3), sw: sw(2), twk: 'umrah', swk: 'umrah',
    favs: ['rizq-01', 'r:talbiyah'], mine: [], trusts: people[lang],
    prep: { umrah: { h1: true, h2: true, h3: true, k1: true, b1: true, b3: true }, hajj: { h1: true, k1: true, k5: true } },
    custom: { umrah: [], hajj: [] },
    flight: { route: 'east', time: '', arrival: null, on: false }
  }, extra || {});
}
const scenes = [
  ['home', '#/'], ['station', '#/s/tawaf'], ['say', '#/s/sai?t=say'], ['tawaf', '#/tawaf?k=umrah'], ['sai', '#/sai?k=umrah'],
  ['duas', '#/duas'], ['section', '#/duas/rizq'], ['trusts', '#/trusts'], ['prep', '#/prep?k=umrah'], ['miqat', '#/miqat'],
  ['journey', '#/journey?j=umrah'], ['more', '#/more'], ['dark-tawaf', '#/tawaf?k=umrah', { theme: 'dark' }],
  ['dark-home', '#/', { theme: 'dark' }],
  ['hajj-home', '#/', { mode: 'hajj' }], ['hajj-journey', '#/journey?j=hajj', { mode: 'hajj' }],
  ['arafah', '#/s/h-arafah', { mode: 'hajj' }], ['arafah-say', '#/s/h-arafah?t=say', { mode: 'hajj' }],
  ['ihram-qiran', '#/s/h-ihram', { mode: 'hajj', nusk: 'qiran' }], ['arrive-ifrad', '#/s/h-arrive', { mode: 'hajj', nusk: 'ifrad' }],
  ['nahr', '#/s/h-nahr', { mode: 'hajj' }], ['tashreeq', '#/s/h-tashreeq', { mode: 'hajj' }], ['nusuk', '#/nusuk', { mode: 'hajj' }],
  ['ifadah', '#/tawaf?k=ifadah', { mode: 'hajj', tw: tw(7, 0, 4) }], ['wada-done', '#/tawaf?k=wada', { mode: 'hajj', tw: tw(7, 0, 7, 7) }],
  ['hajj-sai-done', '#/sai?k=hajj', { mode: 'hajj', sw: sw(7, 7) }], ['prep-hajj', '#/prep?k=hajj', { mode: 'hajj' }],
  ['hajj-new', '#/', { mode: 'hajj', done: {} }],
  ['miqat-qiran', '#/miqat', { mode: 'hajj', nusk: 'qiran', flight: { route: 'east', time: '', arrival: now + 30 * 60000, on: true } }],
  ['dark-arafah', '#/s/h-arafah', { mode: 'hajj', theme: 'dark' }], ['dark-hajj-home', '#/', { mode: 'hajj', theme: 'dark' }]
];

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
