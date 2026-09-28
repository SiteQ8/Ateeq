/* Ateeq pure logic. No DOM here, so the tests and the native apps can share it. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AteeqLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var AR = '٠١٢٣٤٥٦٧٨٩';

  function num(n, lang) {
    var s = String(n);
    return lang === 'ar' ? s.replace(/[0-9]/g, function (d) { return AR[+d]; }) : s;
  }

  /* Arabic counted nouns follow the number: 1 and 2 have their own forms,
     3 to 10 take the plural, 11 and above take the singular. */
  function arCount(n, forms) {
    if (n === 0) return forms.zero || (num(0, 'ar') + ' ' + forms.many);
    if (n === 1) return forms.one;
    if (n === 2) return forms.two;
    var mod = n % 100;
    if (mod >= 3 && mod <= 10) return num(n, 'ar') + ' ' + forms.few;
    return num(n, 'ar') + ' ' + forms.many;
  }

  function enCount(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  var MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
  function normalize(s) {
    return String(s || '')
      .replace(MARKS, '')
      .replace(/[إأآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function search(sections, query) {
    var q = normalize(query);
    if (q.length < 2) return [];
    var out = [];
    sections.forEach(function (sec) {
      sec.duas.forEach(function (d) {
        if (normalize(d.ar).indexOf(q) !== -1) out.push({ section: sec, dua: d });
      });
    });
    return out;
  }

  /* Tawaf: seven circuits, each from the Black Stone back to it. */
  var TAWAF_LAPS = 7;
  function tawaf(laps) {
    var done = Math.max(0, Math.min(TAWAF_LAPS, laps | 0));
    var current = done >= TAWAF_LAPS ? null : done + 1;
    return {
      done: done,
      current: current,
      finished: done >= TAWAF_LAPS,
      ramal: current !== null && current <= 3,
      last: current === TAWAF_LAPS
    };
  }

  /* Sa'i: seven laps, Safa to Marwah is one, back is another. Even count
     means you stand at Safa, odd means Marwah, and the seventh ends at Marwah. */
  var SAI_LAPS = 7;
  function sai(legs) {
    var done = Math.max(0, Math.min(SAI_LAPS, legs | 0));
    var at = done % 2 === 0 ? 'safa' : 'marwa';
    return {
      done: done,
      at: at,
      next: at === 'safa' ? 'marwa' : 'safa',
      current: done >= SAI_LAPS ? null : done + 1,
      finished: done >= SAI_LAPS,
      firstStart: done === 0
    };
  }

  /* Flight alert. The arrival time is entered as Jeddah local time
     (UTC+3), so the countdown is right whatever time zone the phone keeps. */
  var JEDDAH_OFFSET_MIN = 180;
  function arrivalFrom(hhmm, nowMs) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
    if (!m) return null;
    var h = +m[1], mi = +m[2];
    if (h > 23 || mi > 59) return null;
    var jed = new Date(nowMs + JEDDAH_OFFSET_MIN * 60000);
    var t = Date.UTC(jed.getUTCFullYear(), jed.getUTCMonth(), jed.getUTCDate(), h, mi) - JEDDAH_OFFSET_MIN * 60000;
    if (t < nowMs - 60 * 60000) t += 24 * 3600000;
    return t;
  }

  function flight(arrivalMs, nowMs, route) {
    var left = Math.round((arrivalMs - nowMs) / 60000);
    var intentAt = route && route.intent != null ? route.intent : null;
    var prepareAt = route ? route.prepare : 90;
    var phase;
    if (left <= 0) phase = 'past';
    else if (intentAt != null && left <= intentAt) phase = 'intent';
    else if (left <= prepareAt) phase = 'prepare';
    else phase = 'wait';
    return {
      left: left,
      phase: phase,
      toPrepare: Math.max(0, left - prepareAt),
      toIntent: intentAt == null ? null : Math.max(0, left - intentAt)
    };
  }

  return {
    num: num, arCount: arCount, enCount: enCount, normalize: normalize, search: search,
    tawaf: tawaf, sai: sai, arrivalFrom: arrivalFrom, flight: flight,
    TAWAF_LAPS: TAWAF_LAPS, SAI_LAPS: SAI_LAPS
  };
});
