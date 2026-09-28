import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DOCS = path.join(ROOT, 'docs');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const json = p => JSON.parse(read(p));
const L = require(path.join(DOCS, 'app/logic.js'));
const LOOK = require(path.join(DOCS, 'app/palettes.js'));
const RITE = json('docs/data/rite.json');
const BOOK = json('docs/data/duas.json');
const I18N = json('docs/data/i18n.json');

const TEXT_EXT = new Set(['.html', '.css', '.js', '.mjs', '.json', '.md', '.txt', '.yml', '.webmanifest', '.svg', '.swift', '.yaml', '.py', '.sh', '.strings', '.kt', '.kts', '.xml', '.properties', '.xcprivacy']);
const SKIP = [path.join(ROOT, 'ios', 'Web'), path.join(ROOT, 'android', 'app', 'build'), path.join(ROOT, 'android', '.gradle'), path.join(ROOT, 'android', 'build')];
const p_skip = (dir, name) => SKIP.includes(path.join(dir, name));
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules' || p_skip(dir, e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (TEXT_EXT.has(path.extname(e.name)) && !e.name.startsWith('OFL')) out.push(p);
  }
  return out;
}
const FILES = walk(ROOT);
const ARABIC = /[\u0600-\u06FF]/;

// Every {ar, en} pair in the rite data, with where it came from.
function pairs(node, where = 'rite', out = []) {
  if (Array.isArray(node)) node.forEach((x, i) => pairs(x, `${where}[${i}]`, out));
  else if (node && typeof node === 'object') {
    if (typeof node.ar === 'string' && typeof node.en === 'string' && Object.keys(node).every(k => k === 'ar' || k === 'en')) out.push({ where, ...node });
    else for (const [k, v] of Object.entries(node)) pairs(v, `${where}.${k}`, out);
  }
  return out;
}
const RITE_PAIRS = pairs(RITE);
const PROSE_KEYS = /\.(do|watch|calm|women|lines|rules|plane|hadith|note|t|tamattu|qiran|ifrad)(\[\d+\])?$/;

test('no unicode dashes anywhere in the repository text', () => {
  const dash = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/;
  for (const f of FILES) assert.ok(!dash.test(fs.readFileSync(f, 'utf8')), `dash found in ${path.relative(ROOT, f)}`);
});

test('no tool attribution, no bank name, and no mention of the duas booklet', () => {
  const banned = [['Cla', 'ude'], ['Anthr', 'opic'], ['N', 'BK']].map(p => p.join(''));
  const title = [['فإنك', ' بأعيننا'], ['بأعي', 'ينا']].map(p => L.normalize(p.join('')));
  for (const f of FILES) {
    const s = fs.readFileSync(f, 'utf8');
    for (const b of banned) assert.ok(!s.includes(b), `"${b}" found in ${path.relative(ROOT, f)}`);
    const n = L.normalize(s);
    for (const b of title) assert.ok(!n.includes(b), `booklet title found in ${path.relative(ROOT, f)}`);
  }
});

test('supplications that conflict with the sources are left out', () => {
  const all = JSON.stringify(BOOK);
  for (const phrase of ['بحق من حقه', 'بحق محمد', 'بحق العرش', 'بحق النبي', 'يا موجود', 'رب المستحيلات', 'تكون فيه سمعي', 'وبحمدك يا محمد', 'أجر هذا الكتيب']) {
    assert.ok(!L.normalize(all).includes(L.normalize(phrase)), `excluded phrase present: ${phrase}`);
  }
});

test('every rite text has both Arabic and English', () => {
  assert.ok(RITE_PAIRS.length > 150);
  for (const p of RITE_PAIRS) {
    assert.ok(p.ar.trim() && ARABIC.test(p.ar), `missing Arabic at ${p.where}`);
    assert.ok(p.en.trim(), `missing English at ${p.where}`);
  }
  for (const [k, v] of Object.entries(I18N)) {
    assert.ok(v.ar && v.en, `i18n ${k} is missing a language`);
    assert.ok(!ARABIC.test(v.en), `i18n ${k} has Arabic in the English text`);
  }
});

test('Arabic prose puts a full stop only at the end of a sentence', () => {
  const midStop = /\.\s*\S/;
  for (const p of RITE_PAIRS) {
    assert.ok(!midStop.test(p.ar.replace(/\.$/, '')), `mid-sentence full stop at ${p.where}: ${p.ar}`);
    assert.ok(!/[0-9]/.test(p.ar), `ASCII digits in Arabic at ${p.where}`);
    if (PROSE_KEYS.test(p.where)) assert.ok(p.ar.endsWith('.'), `Arabic sentence without a closing full stop at ${p.where}`);
  }
  for (const [k, v] of Object.entries(I18N)) {
    assert.ok(!midStop.test(v.ar.replace(/\.$/, '')), `mid-sentence full stop in i18n ${k}`);
    assert.ok(!/[0-9]/.test(v.ar), `ASCII digits in Arabic i18n ${k}`);
  }
});

test('the duas library: thirty topics, clean text, no duplicates', () => {
  assert.equal(BOOK.sections.length, 30);
  const seen = new Map();
  let total = 0;
  for (const s of BOOK.sections) {
    assert.ok(s.title.ar && s.title.en, `section ${s.id} title`);
    assert.ok(s.duas.length >= 3, `section ${s.id} has too few duas`);
    for (const d of s.duas) {
      total++;
      assert.ok(!/[.A-Za-z0-9]/.test(d.ar), `dua ${d.id} has a full stop, Latin letters or ASCII digits`);
      assert.ok(!/\s[،,]|،\S/.test(d.ar), `dua ${d.id} has broken comma spacing`);
      assert.ok(!/^[\s،,]|[\s،,]$/.test(d.ar), `dua ${d.id} starts or ends with a comma or a space`);
      const key = L.normalize(d.ar);
      assert.ok(!seen.has(key), `duplicate dua ${d.id} and ${seen.get(key)}`);
      seen.set(key, d.id);
      if (d.ref) assert.ok(d.ref.ar && d.ref.en, `dua ${d.id} ref`);
    }
  }
  assert.ok(total > 450, `only ${total} duas`);
});

test('station references resolve: duas, sources and tools', () => {
  const duaIds = new Set(RITE.duas.map(d => d.id));
  const srcIds = new Set(RITE.sources.map(s => s.id));
  const NUSK = ['tamattu', 'qiran', 'ifrad'];
  const KINDS = { tawaf: ['umrah', 'qudum', 'ifadah', 'wada'], sai: ['umrah', 'hajj'] };
  assert.equal(RITE.stations.length, 10);
  assert.equal(RITE.hajjStations.length, 11);
  const ids = new Set();
  for (const s of [...RITE.stations, ...RITE.hajjStations]) {
    assert.ok(!ids.has(s.id), `station id ${s.id} is used twice`);
    ids.add(s.id);
    for (const id of s.say) assert.ok(duaIds.has(id), `station ${s.id} says unknown dua ${id}`);
    assert.ok(s.src.length, `station ${s.id} has no source`);
    for (const id of s.src) assert.ok(srcIds.has(id), `station ${s.id} cites unknown source ${id}`);
    assert.ok(s.do.length, `station ${s.id} has nothing to do`);
    for (const [k, id] of Object.entries(s.nuskSay || {})) {
      assert.ok(NUSK.includes(k), `station ${s.id} names an unknown form ${k}`);
      assert.ok(duaIds.has(id), `station ${s.id} says unknown dua ${id}`);
    }
    for (const [k, lines] of Object.entries(s.nusk || {})) {
      assert.ok(NUSK.includes(k), `station ${s.id} names an unknown form ${k}`);
      assert.ok(lines.length, `station ${s.id} has an empty ${k} card`);
    }
    for (const x of s.tools || []) {
      assert.ok(['tawaf', 'sai', 'miqat', 'umrah', 'prep', 'trusts'].includes(x.kind), `station ${s.id} has an unknown tool ${x.kind}`);
      if (x.k) assert.ok(KINDS[x.kind].includes(x.k), `station ${s.id} opens an unknown ${x.kind} ${x.k}`);
      for (const k of x.n || []) assert.ok(NUSK.includes(k), `station ${s.id} tool names an unknown form ${k}`);
    }
  }
  for (const s of RITE.hajjStations) assert.ok(s.id.startsWith('h-'), `Hajj station ${s.id} must start with h-`);
  for (const s of RITE.stations) assert.ok(!s.id.startsWith('h-'), `Umrah station ${s.id} must not start with h-`);
  assert.deepEqual(RITE.hajj.nusuk.map(n => n.id).sort(), [...NUSK].sort());
  for (const n of RITE.hajj.nusuk) assert.ok(duaIds.has(n.say), `nusk ${n.id}`);
  for (const id of [...RITE.hajj.src, ...RITE.miqat.src]) assert.ok(srcIds.has(id), `unknown source ${id}`);
  for (const s of RITE.sources) assert.match(s.url, /^https:\/\//);
  assert.equal(RITE.miqat.list.length, 5);
});

test('every interface string the app asks for exists', () => {
  const app = read('docs/app/app.js');
  const keys = new Set([...app.matchAll(/\bt\('([a-z0-9_]+)'\s*[,)]/g)].map(m => m[1]));
  for (const k of ['do', 'say', 'watch', 'calm', 'women']) keys.add('tab_' + k);
  for (const k of ['sections', 'rite', 'favs', 'mine']) keys.add('duas_tab_' + k);
  for (const k of ['umrah', 'hajj']) for (const p of ['prep_', 'mode_', 'journey_', 'home_done_', 'home_start_', 'sw_']) keys.add(p + k);
  for (const k of ['umrah', 'qudum', 'ifadah', 'wada']) { keys.add('tw_' + k); keys.add('twk_' + k); }
  for (const k of ['umrah', 'hajj']) keys.add('swk_' + k);
  for (const k of ['tamattu', 'qiran', 'ifrad']) keys.add('nusk_' + k);
  for (const k of [...LOOK.ORDER, 'custom']) keys.add('palette_' + k);
  for (const k of ['0', '1', '2', '3', 'auto']) keys.add('text_' + k);
  for (const k of keys) assert.ok(I18N[k], `missing i18n key ${k}`);
});

test('the offline cache lists only files that exist', () => {
  const sw = read('docs/sw.js');
  const list = JSON.parse(sw.slice(sw.indexOf('['), sw.indexOf(']') + 1).replace(/'/g, '"'));
  for (const f of list) {
    if (f.endsWith('/')) continue;
    assert.ok(fs.existsSync(path.join(DOCS, f)), `sw.js caches a missing file: ${f}`);
  }
  const fontsCss = read('docs/fonts/fonts.css');
  for (const m of fontsCss.matchAll(/url\('([^']+)'\)/g)) {
    assert.ok(list.includes('fonts/' + m[1]), `font not cached offline: ${m[1]}`);
  }
});

test('tawaf counter logic', () => {
  assert.deepEqual(L.tawaf(0), { done: 0, current: 1, finished: false, ramal: true, last: false });
  assert.equal(L.tawaf(3).ramal, false);
  assert.equal(L.tawaf(2).ramal, true);
  assert.equal(L.tawaf(6).last, true);
  assert.equal(L.tawaf(7).finished, true);
  assert.equal(L.tawaf(9).done, 7);
  assert.equal(L.tawaf(-2).done, 0);
});

test('sa\'i counter logic: starts at Safa and ends at Marwah', () => {
  assert.equal(L.sai(0).at, 'safa');
  assert.equal(L.sai(0).firstStart, true);
  assert.equal(L.sai(1).at, 'marwa');
  assert.equal(L.sai(2).at, 'safa');
  assert.equal(L.sai(6).next, 'marwa');
  const end = L.sai(7);
  assert.equal(end.finished, true);
  assert.equal(end.at, 'marwa');
});

test('Arabic counting agrees with the number', () => {
  const f = { one: 'دعاء واحد', two: 'دعاءان', few: 'أدعية', many: 'دعاءً' };
  assert.equal(L.arCount(1, f), 'دعاء واحد');
  assert.equal(L.arCount(2, f), 'دعاءان');
  assert.equal(L.arCount(3, f), '٣ أدعية');
  assert.equal(L.arCount(10, f), '١٠ أدعية');
  assert.equal(L.arCount(11, f), '١١ دعاءً');
  assert.equal(L.arCount(26, f), '٢٦ دعاءً');
  assert.equal(L.arCount(103, f), '١٠٣ أدعية');
  assert.equal(L.num(1448, 'ar'), '١٤٤٨');
});

test('search ignores diacritics and letter forms', () => {
  const hits = L.search(BOOK.sections, 'اللهم اغفر لي ذنبي');
  assert.ok(hits.length >= 1);
  assert.ok(L.search(BOOK.sections, 'الجنة').length > 5);
  assert.equal(L.search(BOOK.sections, 'ا').length, 0);
});

test('flight alert uses Jeddah time whatever the phone clock', () => {
  // 13:00 UTC is 16:00 in Jeddah, 17:00 in Dubai: an arrival typed as 17:30 Jeddah time is 90 minutes away.
  const now = Date.UTC(2026, 9, 1, 13, 0);
  const arr = L.arrivalFrom('17:30', now);
  assert.equal((arr - now) / 60000, 90);
  const east = RITE.miqat.routes.find(r => r.id === 'east');
  assert.equal(L.flight(arr, now, east).phase, 'wait');
  assert.equal(L.flight(arr, arr - 60 * 60000, east).phase, 'prepare');
  assert.equal(L.flight(arr, arr - 40 * 60000, east).phase, 'intent');
  assert.equal(L.flight(arr, arr + 60000, east).phase, 'past');
  const north = RITE.miqat.routes.find(r => r.id === 'north');
  assert.equal(L.flight(arr, arr - 30 * 60000, north).phase, 'prepare');
  assert.equal(L.flight(arr, arr - 30 * 60000, north).toIntent, null);
  // an arrival earlier than now by more than an hour means tomorrow
  assert.equal((L.arrivalFrom('10:00', now) - now) / 3600000, 18);
  assert.equal(L.arrivalFrom('25:00', now), null);
  assert.equal(L.arrivalFrom('', now), null);
});

test('every palette keeps text readable in light, dark and high contrast', () => {
  const fails = [];
  const check = (name, t) => {
    for (const [a, b, min] of LOOK.PAIRS) {
      const c = LOOK.contrast(t[a], t[b]);
      if (!(c >= min)) fails.push(`${name}: ${a} on ${b} is ${c.toFixed(2)}, needs ${min}`);
    }
  };
  for (const p of LOOK.ORDER) for (const dark of [false, true]) for (const contrast of [false, true]) {
    check(`${p} ${dark ? 'dark' : 'light'}${contrast ? ' high contrast' : ''}`, LOOK.resolve({ palette: p, dark, contrast }));
  }
  assert.deepEqual(fails, []);
});

test('any colours a person picks still give readable text', () => {
  let seed = 20260928;
  const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  const col = () => '#' + [0, 0, 0].map(() => Math.floor(rnd() * 256).toString(16).padStart(2, '0')).join('');
  const samples = [['#FFFFFF', '#FFFFFF'], ['#000000', '#000000'], ['#808080', '#808080'], ['#FFFF00', '#0000FF'], ['#ff0000', '#00ff00']];
  for (let i = 0; i < 600; i++) samples.push([col(), col()]);
  const fails = [];
  for (const [band, accent] of samples) for (const dark of [false, true]) for (const contrast of [false, true]) {
    const t = LOOK.resolve({ palette: 'custom', colors: { band, accent }, dark, contrast });
    for (const [a, b, min] of LOOK.PAIRS) {
      const c = LOOK.contrast(t[a], t[b]);
      if (!(c >= min)) fails.push(`${band} ${accent} ${dark ? 'dark' : 'light'}: ${a} on ${b} ${c.toFixed(2)}`);
    }
  }
  assert.deepEqual(fails.slice(0, 5), []);
});

test('the text size setting reaches every font size outside the drawings', () => {
  const css = read('docs/app/app.css');
  const fixed = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (/svg|:root/.test(m[1])) continue;
    for (const f of m[2].matchAll(/font-size:\s*([^;]+)/g)) if (!/var\(--ts/.test(f[1]) && !/inherit/.test(f[1])) fixed.push(`${m[1].trim()} ${f[1]}`);
  }
  assert.deepEqual(fixed, []);
  assert.deepEqual(LOOK.TEXT, [...LOOK.TEXT].sort((a, b) => a - b));
  assert.equal(LOOK.textScaleFor(null, 1.3), 1.25);
  assert.equal(LOOK.textScaleFor(2), 1.25);
});

test('every station opens with a verse or hadith, each with its reference', () => {
  const faith = JSON.parse(read('docs/data/faith.json'));
  const rite = JSON.parse(read('docs/data/rite.json'));
  const ids = [...rite.stations, ...rite.hajjStations].map(s => s.id);
  assert.deepEqual(ids.filter(id => !faith.items[faith.stations[id]]), []);
  for (const [k, it] of Object.entries(faith.items)) {
    assert.ok(ARABIC.test(it.ar) && it.en && !ARABIC.test(it.en), k);
    if (it.kind === 'ayah') assert.ok(faith.surahs[String(it.sura)] && it.ayah > 0, k);
    else assert.ok(it.kind === 'hadith' && it.src && it.src.ar && it.src.en, k);
  }
  assert.ok(faith.items[faith.name]);
  for (const g of Object.values(faith.sources)) for (const s of g) assert.match(s.url, /^https:\/\//);
});
