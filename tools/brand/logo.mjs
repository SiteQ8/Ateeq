// Draws the Ateeq mark and renders every icon size from it.
// The mark: an eight-point star of two interlaced squares, the Kaaba seen from above one corner
// with its gold band and raised door, and seven diamonds around it for the seven circuits.
// Usage: PW_MODULE=/path/to/playwright node tools/brand/logo.mjs
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const C = 512;
const f = n => n.toFixed(1);

function gold(id) {
  return `<linearGradient id="${id}" x1="0.12" y1="0.04" x2="0.88" y2="0.96">
    <stop offset="0" stop-color="#FBF0C8"/><stop offset="0.28" stop-color="#E4C57C"/>
    <stop offset="0.52" stop-color="#B8893C"/><stop offset="0.74" stop-color="#EDD48E"/>
    <stop offset="1" stop-color="#A67B33"/></linearGradient>`;
}

function square(r, deg) {
  const pts = [0, 1, 2, 3].map(i => {
    const a = (deg + i * 90) * Math.PI / 180;
    return `${f(C + r * Math.cos(a))},${f(C + r * Math.sin(a))}`;
  });
  return pts.join(' ');
}

function star(R, g, w) {
  return `<g fill="none" stroke="url(#${g})" stroke-linejoin="miter">
    <polygon points="${square(R, 45)}" stroke-width="${w}"/>
    <polygon points="${square(R, 0)}" stroke-width="${w}"/>
    <polygon points="${square(R - w * 2.2, 45)}" stroke-width="${w * 0.3}" opacity="0.7"/>
    <polygon points="${square(R - w * 2.2, 0)}" stroke-width="${w * 0.3}" opacity="0.7"/>
  </g>`;
}

function kaaba(s, g, dy) {
  const k = Math.cos(Math.PI / 6);
  const cy = C + dy;
  const T = [C, cy - s], L = [C - s * k, cy - s / 2], R = [C + s * k, cy - s / 2], M = [C, cy];
  const Lb = [L[0], L[1] + s], Rb = [R[0], R[1] + s], Mb = [M[0], M[1] + s];
  const P = p => `${f(p[0])},${f(p[1])}`;
  const down = (p, t) => [p[0], p[1] + t * s];
  const along = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  const band = (a, b, t1, t2) => [down(a, t1), down(b, t1), down(b, t2), down(a, t2)].map(P).join(' ');
  const d1 = along(M, R, 0.2), d2 = along(M, R, 0.4);
  const door = [down(d1, 0.5), down(d2, 0.5), down(d2, 0.84), down(d1, 0.84)].map(P).join(' ');
  return `<g stroke-linejoin="round">
    <polygon points="${[T, R, M, L].map(P).join(' ')}" fill="url(#top)"/>
    <polygon points="${[L, M, Mb, Lb].map(P).join(' ')}" fill="url(#left)"/>
    <polygon points="${[M, R, Rb, Mb].map(P).join(' ')}" fill="url(#right)"/>
    <polygon points="${band(L, M, 0.2, 0.31)}" fill="url(#${g})"/>
    <polygon points="${band(M, R, 0.2, 0.31)}" fill="url(#${g})"/>
    <polygon points="${band(L, M, 0.34, 0.36)}" fill="url(#${g})" opacity="0.7"/>
    <polygon points="${band(M, R, 0.34, 0.36)}" fill="url(#${g})" opacity="0.7"/>
    <polygon points="${door}" fill="url(#${g})"/>
    <g fill="none" stroke="url(#${g})" stroke-width="${f(s * 0.02)}" opacity="0.95">
      <polygon points="${[T, R, Rb, Mb, Lb, L].map(P).join(' ')}"/>
      <polyline points="${[L, M, R].map(P).join(' ')}"/>
      <line x1="${f(M[0])}" y1="${f(M[1])}" x2="${f(Mb[0])}" y2="${f(Mb[1])}"/>
    </g>
  </g>`;
}

function ring(r, g, size) {
  let out = `<circle cx="${C}" cy="${C}" r="${r}" fill="none" stroke="url(#${g})" stroke-width="${f(size * 0.18)}" opacity="0.55"/>`;
  for (let i = 0; i < 7; i++) {
    const a = (-90 + i * 360 / 7) * Math.PI / 180;
    const x = C + r * Math.cos(a), y = C + r * Math.sin(a);
    out += `<rect x="${f(x - size / 2)}" y="${f(y - size / 2)}" width="${size}" height="${size}" transform="rotate(45 ${f(x)} ${f(y)})" fill="url(#${g})"/>`;
  }
  return out;
}

const faces = `
  <linearGradient id="top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3B3326"/><stop offset="1" stop-color="#262017"/></linearGradient>
  <linearGradient id="left" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#16130D"/><stop offset="1" stop-color="#0C0A07"/></linearGradient>
  <linearGradient id="right" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#231E15"/><stop offset="1" stop-color="#15110C"/></linearGradient>`;

function mark({ bg, scale = 1 }) {
  const s = 1024;
  const body = `<g transform="translate(${C} ${C}) scale(${scale}) translate(${-C} ${-C})">
    ${star(432, 'g', 17)}
    ${ring(274, 'g', 24)}
    ${kaaba(190, 'g', 0)}
  </g>`;
  const back = bg ? `<rect width="${s}" height="${s}" fill="url(#bg)"/>
    <rect width="${s}" height="${s}" fill="url(#glow)"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" width="${s}" height="${s}">
  <defs>${gold('g')}${faces}
    <radialGradient id="bg" cx="0.5" cy="0.46" r="0.72"><stop offset="0" stop-color="#241E15"/><stop offset="0.62" stop-color="#110F0B"/><stop offset="1" stop-color="#070605"/></radialGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.42"><stop offset="0" stop-color="#E4C57C" stop-opacity="0.10"/><stop offset="1" stop-color="#E4C57C" stop-opacity="0"/></radialGradient>
  </defs>
  ${back}
  ${body}
</svg>
`;
}

// The in-app header draws the same mark in one colour so it follows the chosen palette.
function flat() {
  const body = mark({ bg: false }).replace(/url\(#g\)/g, 'currentColor')
    .replace(/url\(#top\)/g, 'none').replace(/url\(#left\)/g, 'none').replace(/url\(#right\)/g, 'none');
  return body.replace(/<defs>[\s\S]*?<\/defs>/, '');
}

const assets = path.join(ROOT, 'docs/assets');
fs.writeFileSync(path.join(assets, 'icon.svg'), mark({ bg: true }));
fs.writeFileSync(path.join(assets, 'logo.svg'), mark({ bg: false }));
fs.writeFileSync(path.join(assets, 'mark-flat.svg'), flat());

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_MODULE || 'playwright-core');
const exe = process.env.CHROME || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
async function png(svg, size, out, transparent) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('width="1024" height="1024"', `width="${size}" height="${size}"`)}</body></html>`);
  await page.screenshot({ path: out, omitBackground: !!transparent });
  await page.close();
}
const full = mark({ bg: true });
for (const n of [180, 192, 512, 1024]) await png(full, n, path.join(assets, `icon-${n}.png`));
await png(mark({ bg: true, scale: 0.8 }), 512, path.join(assets, 'icon-maskable-512.png'));
const ios = path.join(ROOT, 'ios/Ateeq/Assets.xcassets');
if (fs.existsSync(ios)) {
  await png(full, 1024, path.join(ios, 'AppIcon.appiconset/AppIcon-1024.png'));
  await png(mark({ bg: false }), 600, path.join(ios, 'LaunchMark.imageset/LaunchMark.png'), true);
}
const res = path.join(ROOT, 'android/app/src/main/res');
if (fs.existsSync(res)) {
  // Adaptive icon layers: the mark inside the 66dp safe zone of a 108dp canvas, over the black.
  await png(mark({ bg: false, scale: 0.7 }), 432, path.join(res, 'drawable-xxxhdpi/ic_launcher_foreground.png'), true);
  const back = mark({ bg: true }).replace(/<g transform=[\s\S]*?<\/g>\s*<\/svg>/, '</svg>');
  await png(back, 432, path.join(res, 'drawable-xxxhdpi/ic_launcher_background.png'));
  await png(mark({ bg: true, scale: 0.86 }), 192, path.join(res, 'mipmap-xxxhdpi/ic_launcher.png'));
  const round = mark({ bg: true, scale: 0.78 }).replace('<svg ', '<svg style="border-radius:50%" ');
  await png(round, 192, path.join(res, 'mipmap-xxxhdpi/ic_launcher_round.png'), true);
}
const play = path.join(ROOT, 'play/graphics');
if (fs.existsSync(play)) await png(full, 512, path.join(play, 'icon-512.png'));
await browser.close();
console.log('mark written and rendered');
