// Scenes shared by the web screenshots (tools/shots.mjs) and the iPhone simulator run (tools/ios/scenes.mjs).
export const now = Date.now();
export const people = {
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
export function state(lang, extra) {
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
export const scenes = [
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
  ['dark-arafah', '#/s/h-arafah', { mode: 'hajj', theme: 'dark' }],
  ['tasbeeh', '#/tasbeeh', { tb: { phrase: 0, count: 21, target: 33, total: 254 } }], ['dates', '#/dates'],
  ['dates-h2g', '#/dates', { conv: { mode: 'h2g', g: '', hy: 1448, hm: 12, hd: 10 } }],
  ['hajj-qiran-dark', '#/', { mode: 'hajj', nusk: 'qiran', palette: 'emerald', theme: 'dark', text: 2 }],
  ['sources', '#/sources'], ['station-sai', '#/s/sai'], ['station-ifadah-dark', '#/s/h-ifadah', { mode: 'hajj', theme: 'dark' }],
  ['look', '#/look'], ['look-custom', '#/look', { palette: 'custom', colors: { band: '#5B2A86', accent: '#E9B949' } }],
  ['home-emerald', '#/', { mode: 'hajj', palette: 'emerald' }], ['home-navy-dark', '#/', { mode: 'hajj', palette: 'navy', theme: 'dark' }],
  ['home-burgundy', '#/', { palette: 'burgundy' }], ['home-sand', '#/', { palette: 'sand' }], ['home-graphite', '#/', { palette: 'graphite' }],
  ['arafah-a11y', '#/s/h-arafah', { mode: 'hajj', text: 3, bold: true, contrast: true, spacing: true }],
  ['tawaf-emerald-dark', '#/tawaf?k=umrah', { palette: 'emerald', theme: 'dark' }], ['dark-hajj-home', '#/', { mode: 'hajj', theme: 'dark' }]
];

