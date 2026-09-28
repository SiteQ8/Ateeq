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

  /* Phrases of dhikr that never break across lines, so a line can never end on «لا إله»
     with «إلا الله» on the next. Their spaces become no-break spaces; the letters are
     matched with or without their vowel marks and hamza forms. */
  var KEEP = (function () {
    var marks = '[\u064B-\u065F\u0670\u06D6-\u06ED]*';
    var letter = { 'ا': '[اأإآٱ]', 'ه': '[هة]', 'ي': '[يى]' };
    function pat(words) {
      return words.split(' ').map(function (w) {
        return w.split('').map(function (c) { return (letter[c] || c) + marks; }).join('');
      }).join('\\s+');
    }
    var phrases = ['لا اله الا الله', 'لا اله الا انت', 'لا اله الا هو', 'الله اكبر', 'لا شريك له', 'لا شريك لك', 'سبحان الله', 'الحمد لله', 'بسم الله'];
    return new RegExp('(' + phrases.map(pat).join('|') + ')', 'g');
  })();
  function keepPhrases(s) {
    return String(s).replace(KEEP, function (m) { return m.replace(/\s+/g, '\u00A0'); });
  }

  /* ------------------------------------------------------------ dates
     Umm al-Qura dates from the calendar's numbers alone, with the app's own month and day
     names: some phone browsers carry the numbers but not the names in every language.
     Days are handled at noon UTC, so no time zone can move a date by one. */
  var DAY = 86400000;
  var HIJRI_MONTHS = {
    ar: ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'],
    en: ['Muharram', 'Safar', 'Rabiʿ al-Awwal', 'Rabiʿ al-Akhir', 'Jumada al-Ula', 'Jumada al-Akhirah', 'Rajab', 'Shaʿban', 'Ramadan', 'Shawwal', 'Dhul-Qiʿdah', 'Dhul-Hijjah']
  };
  var GREG_MONTHS = {
    ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  };
  var WEEKDAYS = {
    ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
    en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  };
  var UQ;
  function uq() {
    if (UQ === undefined) {
      try { UQ = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' }); }
      catch (e) { UQ = null; }
    }
    return UQ;
  }
  /* A calendar day as a Date at noon UTC. */
  function day(y, m, d) { return new Date(Date.UTC(y, m - 1, d, 12)); }
  function today(now) { var n = now || new Date(); return day(n.getFullYear(), n.getMonth() + 1, n.getDate()); }
  function toHijri(date) {
    var f = uq();
    if (!f) return null;
    var n = {};
    f.formatToParts(date).forEach(function (p) { n[p.type] = parseInt(p.value, 10); });
    return n.year > 0 && n.month >= 1 && n.month <= 12 && n.day >= 1 ? { y: n.year, m: n.month, d: n.day } : null;
  }
  /* The Gregorian day of a Hijri one: start from the mean length of the months, then walk
     day by day to it. A day the month does not have (the 30th of a 29 day month) gives null. */
  function fromHijri(y, m, d) {
    if (!uq() || !(y > 0 && m >= 1 && m <= 12 && d >= 1 && d <= 30)) return null;
    var t = day(622, 7, 19).getTime() + Math.round((y - 1) * 354.36708 + (m - 1) * 29.530589 + (d - 1)) * DAY;
    for (var i = 0; i < 14; i++) {
      var h = toHijri(new Date(t));
      if (!h) return null;
      if (h.y === y && h.m === m && h.d === d) return new Date(t);
      var diff = (y - h.y) * 354.367 + (m - h.m) * 29.53 + (d - h.d);
      var step = Math.round(diff) || (diff > 0 ? 1 : -1);
      t += step * DAY;
    }
    return null;
  }
  function daysBetween(a, b) { return Math.round((b.getTime() - a.getTime()) / DAY); }
  function fmtHijri(h, lang) {
    if (!h) return '';
    return lang === 'ar' ? num(h.d, 'ar') + ' ' + HIJRI_MONTHS.ar[h.m - 1] + ' ' + num(h.y, 'ar') + ' هـ'
      : h.d + ' ' + HIJRI_MONTHS.en[h.m - 1] + ' ' + h.y + ' AH';
  }
  function fmtGreg(date, lang) {
    var d = date.getUTCDate(), m = date.getUTCMonth(), y = date.getUTCFullYear();
    return lang === 'ar' ? num(d, 'ar') + ' ' + GREG_MONTHS.ar[m] + ' ' + num(y, 'ar') + ' م' : d + ' ' + GREG_MONTHS.en[m] + ' ' + y;
  }
  function weekday(date, lang) { return WEEKDAYS[lang === 'ar' ? 'ar' : 'en'][date.getUTCDay()]; }
  /* The days of Hajj of a Hijri year, 8 to 13 Dhul-Hijjah, as Gregorian days. */
  function hajjDays(y) {
    return [8, 9, 10, 11, 12, 13].map(function (d) { return { d: d, date: fromHijri(y, 12, d) }; });
  }
  /* The coming Day of Arafah, or today's; after the 13th the next year's. */
  function nextArafah(now) {
    var t = today(now), h = toHijri(t);
    if (!h) return null;
    var y = h.m === 12 && h.d > 13 ? h.y + 1 : h.y;
    var date = fromHijri(y, 12, 9);
    return date ? { y: y, date: date, days: daysBetween(t, date), hajjNow: h.m === 12 && h.d >= 8 && h.d <= 13 } : null;
  }

  return {
    toHijri: toHijri, fromHijri: fromHijri, fmtHijri: fmtHijri, fmtGreg: fmtGreg, weekday: weekday, day: day, today: today,
    daysBetween: daysBetween, hajjDays: hajjDays, nextArafah: nextArafah, HIJRI_MONTHS: HIJRI_MONTHS, GREG_MONTHS: GREG_MONTHS,
    keepPhrases: keepPhrases, KEEP: KEEP,
    num: num, arCount: arCount, enCount: enCount, normalize: normalize, search: search,
    tawaf: tawaf, sai: sai, arrivalFrom: arrivalFrom, flight: flight,
    TAWAF_LAPS: TAWAF_LAPS, SAI_LAPS: SAI_LAPS
  };
});
