// Renders comp.html into frames, then assembles brag.mp4 with the narration mix.
//
//   node render.mjs            render every frame and assemble the video
//   node render.mjs stills 0.5,4.7,16.9   screenshot the given seconds into stills/ for review
//
// Needs: node, playwright (npm i playwright && npx playwright install chromium) and ffmpeg.
// Every frame is a pure function of time, so the output is identical on every run.
import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import http from 'http';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');          // the repository, so ../../docs/fonts resolves
const FPS = 30;
const mode = process.argv[2] || 'frames';

// A small static server over the repository, so fonts and images load the way a site would.
const types = { html: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', png: 'image/png',
  jpg: 'image/jpeg', svg: 'image/svg+xml', woff2: 'font/woff2', woff: 'font/woff', json: 'application/json' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(file).slice(1)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/brag-output/composition/comp.html`;

// CHROMIUM=/path/to/chrome points at a browser already on the machine instead of Playwright's own.
const browser = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => Promise.all([...document.images].map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; }))));
const total = await page.evaluate(() => window.TOTAL);
console.log('total seconds', total.toFixed(2));

if (mode === 'stills') {
  const times = (process.argv[3] || '0.5,2.9,4.7,8.95,12.4,16.9,20.9').split(',').map(Number);
  fs.mkdirSync(path.join(HERE, 'stills'), { recursive: true });
  for (const t of times) {
    await page.evaluate(t => window.render(t), t);
    await page.screenshot({ path: path.join(HERE, 'stills', `t${t.toFixed(1)}.png`) });
  }
  console.log('stills', times.length);
} else {
  const frames = path.join(HERE, 'frames');
  fs.rmSync(frames, { recursive: true, force: true }); fs.mkdirSync(frames);
  const n = Math.round(total * FPS);
  for (let i = 0; i < n; i++) {
    await page.evaluate(t => window.render(t), i / FPS);
    await page.screenshot({ path: path.join(frames, `f${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 94 });
    if (i % 100 === 0) console.log('frame', i, 'of', n);
  }
  console.log('frames', n);
  // the poster is the settled closing frame; it is also baked in as frame 0 so it is the idle thumbnail everywhere
  const poster = path.join(frames, `f${String(n - 10).padStart(5, '0')}.jpg`);
  fs.copyFileSync(poster, path.join(HERE, '..', 'brag.jpg'));
  fs.copyFileSync(poster, path.join(frames, 'f00000.jpg'));
  const mix = spawnSync('bash', [path.join(HERE, 'mix.sh'), total.toFixed(2)], { stdio: 'inherit' });
  if (mix.status !== 0) process.exit(mix.status);
  const ff = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(frames, 'f%05d.jpg'),
    '-i', path.join(HERE, 'mix.m4a'), '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.1', '-movflags', '+faststart', '-c:a', 'copy', '-shortest',
    path.join(HERE, '..', 'brag.mp4')], { stdio: 'inherit' });
  if (ff.status !== 0) process.exit(ff.status);
  console.log('wrote brag-output/brag.mp4 and brag.jpg');
}
await browser.close();
server.close();
