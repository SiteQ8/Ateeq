// Composes the store screenshots: a real capture of the app inside a drawn phone, under a
// gold headline and a line of copy, on the black and gold of the brand.
//
//   PW_MODULE=... BASE=http://localhost:8899 node tools/store/compose.mjs <platform> <rawDir> <outDir>
//
// platform: appstore (iPhone captures, 1290x2796 and 1242x2688) or play (Android captures, 1080x1920).
// rawDir holds <lang>-<scene>.png from the simulator or emulator runs. The page is served from
// docs/ so the app's own fonts are used; the working files live in docs/_store and are removed.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_MODULE || 'playwright-core');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const base = process.env.BASE || 'http://localhost:8899';
const [platform, rawDir, outDir] = process.argv.slice(2);
if (!['appstore', 'play'].includes(platform) || !rawDir || !outDir) {
  console.error('usage: compose.mjs appstore|play <rawDir> <outDir>');
  process.exit(1);
}

const TALBIYAH = 'لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ';
const SCENES = [
  { id: 'hajj-home', hero: true,
    ar: [TALBIYAH, 'عتيق، رفيقك في الحج والعمرة خطوة بخطوة'],
    en: [TALBIYAH, 'Ateeq, your companion through Hajj and Umrah, step by step'] },
  { id: 'arafah',
    ar: ['في كل محطة', 'ما تفعله وما تقوله وما تنتبه له، كما شرحه الشيخ ابن باز رحمه الله'],
    en: ['At every station', 'What to do, what to say and what to watch for, as Shaykh Ibn Baz explained'] },
  { id: 'tawaf',
    ar: ['عدّاد الطواف', 'سبعة أشواط بلا عدّ في رأسك، وذكر كل ركن في موضعه'],
    en: ['The tawaf counter', 'Seven circuits without counting in your head, and the words for each corner'] },
  { id: 'sai',
    ar: ['عدّاد السعي', 'من الصفا إلى المروة، يعرف موضعك ويضع أمامك الذكر'],
    en: ["The sa'i counter", 'From Safa to Marwah, it knows where you are and what to say'] },
  { id: 'duas',
    ar: ['أدعية لكل حاجة', 'أدعية المناسك في مواضعها وأبواب الدعاء، مع البحث وحفظ ما تحب'],
    en: ['Duas for every need', 'The rite duas in their places and collections for every need, with search'] },
  { id: 'trusts',
    ar: ['أمانات الدعاء', 'اكتب من أوصاك بالدعاء، فتجده أمامك على الصفا والمروة وفي عرفة'],
    en: ['Dua trusts', 'Note who asked you to pray for them, and find them on Safa, Marwah and Arafah'] },
  { id: 'look',
    ar: ['ألوانك وخطك', 'ست لوحات فاخرة، والوضع الليلي، وأدوات سهولة الاستخدام'],
    en: ['Your colours, your text', 'Six refined palettes, dark mode and accessibility tools'] },
];

const SIZES = platform === 'appstore'
  ? [{ kind: 'APP_IPHONE_67', w: 1290, h: 2796 }, { kind: 'APP_IPHONE_65', w: 1242, h: 2688 }]
  : [{ kind: 'phone', w: 1080, h: 1920 }];
const LANGS = platform === 'appstore' ? [['ar', 'ar'], ['en', 'en']] : [['ar', 'ar'], ['en', 'en-US']];

// A faint lattice of eight-point stars, the brand's geometry, behind everything.
const star = (() => {
  const c = 60, R = 26, sq = a => [0, 1, 2, 3].map(i => {
    const t = (a + i * 90) * Math.PI / 180;
    return `${(c + R * Math.cos(t)).toFixed(1)},${(c + R * Math.sin(t)).toFixed(1)}`;
  }).join(' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><g fill="none" stroke="#DDBE78" stroke-width="1.2"><polygon points="${sq(45)}"/><polygon points="${sq(0)}"/></g></svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
})();

function page({ w, h, lang, scene, img, imgW, imgH }) {
  const u = w / 1290;
  const ar = lang === 'ar';
  const [head, sub] = scene[lang === 'ar' ? 'ar' : 'en'];
  const heroHead = scene.hero;
  const headSize = (heroHead ? 118 : (ar ? 124 : 104)) * u;
  const subSize = (ar ? 46 : 44) * u;
  const top = (platform === 'appstore' ? 150 : 110) * u;
  const textH = (heroHead ? 560 : 520) * u;
  const bottomGap = 90 * u;
  const aspect = imgW / imgH;
  const bezel = 0.024;
  let devW = Math.min(w * 0.8, (h - top - textH - bottomGap) * aspect / (1 + 2 * bezel * aspect));
  const screenW = devW, screenH = devW / aspect;
  const b = devW * bezel;
  const radius = devW * 0.125;
  const island = platform === 'appstore'
    ? `<i class="island" style="width:${screenW * 0.29}px;height:${screenW * 0.085}px;top:${screenW * 0.026}px"></i>`
    : `<i class="hole" style="width:${screenW * 0.03}px;height:${screenW * 0.03}px;top:${screenW * 0.022}px"></i>`;
  return `<!doctype html><html lang="${lang}" dir="${ar ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<link rel="stylesheet" href="../fonts/fonts.css">
<style>
*{box-sizing:border-box;margin:0}
html,body{width:${w}px;height:${h}px;overflow:hidden}
body{position:relative;background:radial-gradient(ellipse at 50% 14%,#2E261A 0%,#16130D 42%,#080706 100%);font-family:'Noto Kufi Arabic',sans-serif}
.lattice{position:absolute;inset:0;background:url(${star}) center top/${120 * u}px ${120 * u}px repeat;opacity:.07;
  -webkit-mask-image:linear-gradient(#000 0%,rgba(0,0,0,.6) 35%,transparent 70%);mask-image:linear-gradient(#000 0%,rgba(0,0,0,.6) 35%,transparent 70%)}
.glow{position:absolute;left:50%;top:${top + textH * 0.9}px;width:${w * 1.1}px;height:${w * 1.1}px;transform:translate(-50%,0);background:radial-gradient(circle,rgba(221,190,120,.16) 0%,rgba(221,190,120,0) 60%)}
.text{position:absolute;left:0;right:0;top:${top}px;height:${textH}px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 ${80 * u}px}
.head{font-family:'Scheherazade New',serif;font-weight:700;font-size:${headSize}px;line-height:1.3;
  background:linear-gradient(100deg,#B8893C 0%,#EDD48E 22%,#FBF0C8 40%,#E4C57C 60%,#B8893C 80%,#EDD48E 100%);
  -webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 ${4 * u}px ${10 * u}px rgba(0,0,0,.5));
  padding:.08em .1em .45em;margin-bottom:-.37em}
.rule{width:${140 * u}px;height:${3 * u}px;margin:${26 * u}px 0 ${28 * u}px;background:linear-gradient(90deg,transparent,#DDBE78,transparent)}
.sub{font-size:${subSize}px;line-height:1.65;color:#EFE3C6;opacity:.92;max-width:${1060 * u}px;font-weight:500}
.dev{position:absolute;left:50%;top:${top + textH + 10 * u}px;transform:translateX(-50%);width:${devW + 2 * b}px;height:${screenH + 2 * b}px;border-radius:${radius + b}px;padding:${b}px;
  background:linear-gradient(145deg,#4A4640 0%,#15130F 30%,#0B0A08 70%,#3A362F 100%);
  box-shadow:0 0 0 ${2.5 * u}px rgba(221,190,120,.55),0 ${60 * u}px ${140 * u}px rgba(0,0,0,.7),0 0 ${120 * u}px rgba(221,190,120,.10)}
.screen{position:relative;width:${screenW}px;height:${screenH}px;border-radius:${radius}px;overflow:hidden;background:#000}
.screen img{display:block;width:100%;height:100%;object-fit:cover}
.island,.hole{position:absolute;left:50%;transform:translateX(-50%);background:#000;border-radius:999px}
</style></head><body>
<div class="lattice"></div><div class="glow"></div>
<div class="text"><div class="head" lang="${heroHead ? 'ar' : lang}" dir="${heroHead || ar ? 'rtl' : 'ltr'}">${head}</div><div class="rule"></div><div class="sub">${sub}</div></div>
<div class="dev"><div class="screen"><img src="${img}" alt="">${island}</div></div>
</body></html>`;
}

const work = path.join(ROOT, 'docs/_store');
fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(work, { recursive: true });
const exe = process.env.CHROME || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const { execFileSync } = await import('child_process');
let count = 0;
try {
  for (const size of SIZES) {
    for (const [lang, folder] of LANGS) {
      const dir = platform === 'appstore' ? path.join(outDir, lang, size.kind) : path.join(outDir, folder);
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      for (const [i, scene] of SCENES.entries()) {
        const raw = path.join(rawDir, `${lang}-${scene.id}.png`);
        if (!fs.existsSync(raw)) throw new Error('missing capture ' + raw);
        const copy = `${lang}-${scene.id}.png`;
        fs.copyFileSync(raw, path.join(work, copy));
        const dims = execFileSync('python3', ['-c', `from PIL import Image; im = Image.open(${JSON.stringify(raw)}); print(im.width, im.height)`]).toString().trim().split(' ').map(Number);
        const html = page({ w: size.w, h: size.h, lang, scene, img: copy, imgW: dims[0], imgH: dims[1] });
        fs.writeFileSync(path.join(work, 'shot.html'), html);
        const p = await browser.newPage({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1 });
        await p.goto(`${base}/_store/shot.html`, { waitUntil: 'networkidle' });
        await p.evaluate(() => document.fonts.ready);
        const out = path.join(dir, `${i + 1}-${scene.id}.png`);
        await p.screenshot({ path: out });
        await p.close();
        count++;
      }
    }
  }
} finally {
  await browser.close();
  fs.rmSync(work, { recursive: true, force: true });
}
console.log(`${count} store screenshots composed for ${platform}`);
