/* Ateeq palettes. Pure colour maths, no DOM, shared by the app and the tests.
   Every palette, and any colour a person picks, is resolved to tokens that keep
   text readable: the tests hold each pair to its WCAG contrast. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AteeqLook = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function rgb(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function hex(c) {
    return '#' + c.map(function (v) {
      var s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return s.length < 2 ? '0' + s : s;
    }).join('').toUpperCase();
  }
  function lum(h) {
    var c = rgb(h).map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) {
    var x = lum(a), y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  /* t = 0 keeps a, t = 1 gives b */
  function mix(a, b, t) {
    var p = rgb(a), q = rgb(b);
    return hex([0, 1, 2].map(function (i) { return p[i] + (q[i] - p[i]) * t; }));
  }
  /* Moves fg towards black or white, whichever reads better on bg, until it reaches min. */
  function ensure(fg, bg, min) {
    if (contrast(fg, bg) >= min) return fg;
    var target = lum(bg) > 0.18 ? '#000000' : '#FFFFFF';
    for (var t = 0.05; t <= 1.0001; t += 0.05) {
      var c = mix(fg, target, t);
      if (contrast(c, bg) >= min) return c;
    }
    return target;
  }
  function better(bg, a, b) { return contrast(a, bg) >= contrast(b, bg) ? a : b; }

  var BASE = {
    light: { marble: '#F4F2EC', card: '#FFFEFA', ink: '#1B1914', stone: '#655F53', hair: '#E1DCD0', green: '#1D8A58', danger: '#A33A2F' },
    dark: { marble: '#0C0B09', card: '#17150F', ink: '#EFE9DC', stone: '#ABA391', hair: '#2D2920', green: '#3DB57F', danger: '#E07A6C' }
  };

  function preset(light, dark) {
    return {
      light: Object.assign({}, BASE.light, light),
      dark: Object.assign({}, BASE.dark, dark)
    };
  }

  /* Hand tuned: a deep band for the header and buttons, and a metal for the accents. */
  var PALETTES = {
    kiswah: preset(
      { marble: '#F4F1EA', card: '#FFFDF7', ink: '#1B1812', stone: '#665F50', hair: '#E2DCCD', band: '#12100C', bandInk: '#F5EEDC',
        gold: '#836124', line: '#B8924B', gold2: '#DDBE78', soft: '#F2E7CC', btnBg: '#12100C', btnFg: '#DDBE78', onLine: '#14110B' },
      { band: '#050403', bandInk: '#F5EEDC', gold: '#DDBE78', line: '#C9A55C', gold2: '#DDBE78', soft: '#2A2417',
        btnBg: '#D2B06A', btnFg: '#14110B', onLine: '#14110B' }),
    emerald: preset(
      { marble: '#F0F4F0', card: '#FBFEFB', ink: '#15201A', stone: '#56655B', hair: '#D5E0D7', band: '#0B3A2C', bandInk: '#F2EEDD',
        gold: '#76591E', line: '#B8924B', gold2: '#E0C27E', soft: '#EEE5C9', btnBg: '#0B3A2C', btnFg: '#E0C27E', onLine: '#14110B' },
      { marble: '#08110D', card: '#0F1C16', ink: '#E8EFE9', stone: '#9FB1A5', hair: '#213229', band: '#05241B', bandInk: '#F2EEDD',
        gold: '#E0C27E', line: '#C9A55C', gold2: '#E0C27E', soft: '#1F2A1C', btnBg: '#D2B06A', btnFg: '#0C1712', onLine: '#0C1712' }),
    navy: preset(
      { marble: '#F0F2F7', card: '#FBFCFF', ink: '#141A26', stone: '#586071', hair: '#D6DBE6', band: '#0E1D3C', bandInk: '#F2EEDF',
        gold: '#795C22', line: '#B8924B', gold2: '#E2C47F', soft: '#EDE5CE', btnBg: '#0E1D3C', btnFg: '#E2C47F', onLine: '#14110B' },
      { marble: '#080C15', card: '#101726', ink: '#E9EDF5', stone: '#A3ABBC', hair: '#222C40', band: '#060E21', bandInk: '#F2EEDF',
        gold: '#E2C47F', line: '#C9A55C', gold2: '#E2C47F', soft: '#242218', btnBg: '#D2B06A', btnFg: '#0B1120', onLine: '#0B1120' }),
    burgundy: preset(
      { marble: '#F6F0EF', card: '#FFFBFA', ink: '#231416', stone: '#6C585B', hair: '#E6D7D7', band: '#4A1119', bandInk: '#F6ECDD',
        gold: '#7B5B1F', line: '#B8924B', gold2: '#E4C685', soft: '#F0E3CB', btnBg: '#4A1119', btnFg: '#E4C685', onLine: '#14110B' },
      { marble: '#120A0B', card: '#1E1113', ink: '#F2E8E8', stone: '#B8A3A5', hair: '#38252A', band: '#2D090E', bandInk: '#F6ECDD',
        gold: '#E4C685', line: '#C9A55C', gold2: '#E4C685', soft: '#2B2116', btnBg: '#D2B06A', btnFg: '#1A0C0E', onLine: '#1A0C0E' }),
    sand: preset(
      { marble: '#F6EFE3', card: '#FFFAF2', ink: '#281F15', stone: '#6F614A', hair: '#E6DAC4', band: '#46321F', bandInk: '#F8EEDC',
        gold: '#7A5626', line: '#B07F46', gold2: '#EDCD96', soft: '#F1E1C4', btnBg: '#46321F', btnFg: '#F0D5A3', onLine: '#1C140C' },
      { marble: '#120E09', card: '#1D1710', ink: '#F3EADB', stone: '#BCA98C', hair: '#382D20', band: '#2A1D11', bandInk: '#F8EEDC',
        gold: '#E9C890', line: '#C08A4E', gold2: '#EDCD96', soft: '#2E2517', btnBg: '#D5A869', btnFg: '#1C140C', onLine: '#1C140C' }),
    graphite: preset(
      { marble: '#F1F2F4', card: '#FDFDFE', ink: '#16181B', stone: '#5B6069', hair: '#D9DCE1', band: '#1B1E23', bandInk: '#F1F3F5',
        gold: '#4B525D', line: '#8E97A4', gold2: '#D5DBE3', soft: '#E5E8EC', btnBg: '#1B1E23', btnFg: '#E4E8ED', onLine: '#111316' },
      { marble: '#0B0C0E', card: '#16181B', ink: '#ECEEF1', stone: '#A6ACB5', hair: '#2A2D33', band: '#050607', bandInk: '#F1F3F5',
        gold: '#C9D0DA', line: '#8E97A4', gold2: '#D5DBE3', soft: '#22262C', btnBg: '#C9D0DA', btnFg: '#111316', onLine: '#111316' })
  };
  var ORDER = ['kiswah', 'emerald', 'navy', 'burgundy', 'sand', 'graphite'];
  var DEFAULT_COLORS = { band: '#0B3A2C', accent: '#C9A55C' };

  /* A mid-tone band cannot carry 7:1 text in any colour, so it is taken to a deeper shade of itself. */
  function deepen(band) {
    if (contrast('#F5EEDC', band) >= 7 || contrast('#14110B', band) >= 7) return band;
    for (var t = 0.05; t <= 1.0001; t += 0.05) {
      var c = mix(band, '#000000', t);
      if (contrast('#F5EEDC', c) >= 7) return c;
    }
    return '#000000';
  }

  /* A person's own two colours become a full, readable palette. */
  function derive(band, accent, dark) {
    var b = rgb(band) ? band : DEFAULT_COLORS.band;
    var a = rgb(accent) ? accent : DEFAULT_COLORS.accent;
    var N = dark ? BASE.dark : BASE.light;
    var bandC = deepen(dark ? mix(b, '#000000', 0.45) : b);
    var bandInk = ensure(better(bandC, '#F5EEDC', '#14110B'), bandC, 7);
    var gold2 = ensure(a, bandC, 4.5);
    var gold = ensure(ensure(a, N.card, 4.5), N.marble, 4.5);
    var onLine = better(a, '#14110B', '#FFFFFF');
    var line = ensure(a, onLine, 4.5);
    var soft = mix(a, N.card, dark ? 0.84 : 0.86);
    gold = ensure(gold, soft, 4.5);
    var t = Object.assign({}, N, { band: bandC, bandInk: bandInk, gold: gold, line: line, gold2: gold2, soft: soft, onLine: onLine });
    if (dark) { t.btnFg = '#14110B'; t.btnBg = ensure(a, t.btnFg, 4.5); }
    else { t.btnBg = bandC; t.btnFg = gold2; }
    return t;
  }

  /* Higher contrast: body text in full ink, stronger lines, accents pushed to 7:1. */
  function strengthen(t) {
    var s = Object.assign({}, t);
    s.stone = ensure(mix(t.stone, t.ink, 0.6), t.marble, 7);
    s.hair = mix(t.ink, t.marble, 0.55);
    s.gold = ensure(ensure(t.gold, t.card, 7), t.marble, 7);
    s.gold = ensure(s.gold, t.soft, 7);
    s.gold2 = ensure(t.gold2, t.band, 7);
    s.btnFg = ensure(t.btnFg, t.btnBg, 7);
    return s;
  }

  function resolve(o) {
    o = o || {};
    var dark = !!o.dark;
    var t = o.palette === 'custom'
      ? derive(o.colors && o.colors.band, o.colors && o.colors.accent, dark)
      : Object.assign({}, (PALETTES[o.palette] || PALETTES.kiswah)[dark ? 'dark' : 'light']);
    if (o.contrast) t = strengthen(t);
    t.scheme = dark ? 'dark' : 'light';
    return t;
  }

  /* token -> CSS custom property */
  var VARS = {
    marble: '--marble', card: '--card', ink: '--ink', stone: '--stone', hair: '--hair',
    band: '--kiswah', bandInk: '--band-ink', gold: '--gold', line: '--gold-line', gold2: '--gold-2',
    soft: '--gold-soft', btnBg: '--btn-bg', btnFg: '--btn-fg', onLine: '--on-line', green: '--green', danger: '--danger'
  };
  var TEXT = [1, 1.12, 1.25, 1.4];

  /* The pairs the interface actually draws, and the contrast each must reach. */
  var PAIRS = [
    ['ink', 'marble', 7], ['ink', 'card', 7], ['stone', 'marble', 4.5], ['stone', 'card', 4.5],
    ['gold', 'marble', 4.5], ['gold', 'card', 4.5], ['gold', 'soft', 4.5], ['ink', 'soft', 7],
    ['bandInk', 'band', 7], ['gold2', 'band', 4.5], ['btnFg', 'btnBg', 4.5], ['onLine', 'line', 4.5],
    ['danger', 'card', 4.5]
  ];

  function textScaleFor(step, nativeScale) {
    if (step == null && nativeScale) {
      var best = 0;
      TEXT.forEach(function (v, i) { if (Math.abs(v - nativeScale) < Math.abs(TEXT[best] - nativeScale)) best = i; });
      return TEXT[best];
    }
    return TEXT[Math.max(0, Math.min(TEXT.length - 1, +step || 0))];
  }

  return {
    PALETTES: PALETTES, ORDER: ORDER, VARS: VARS, TEXT: TEXT, PAIRS: PAIRS, DEFAULT_COLORS: DEFAULT_COLORS,
    rgb: rgb, hex: hex, lum: lum, contrast: contrast, mix: mix, ensure: ensure,
    derive: derive, strengthen: strengthen, resolve: resolve, textScaleFor: textScaleFor
  };
});
