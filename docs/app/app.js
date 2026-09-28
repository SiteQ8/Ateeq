/* Ateeq. Plain JavaScript, no build step, no network after the first visit. */
(function () {
  'use strict';

  var L = window.AteeqLogic;
  var KEY = 'ateeq.v1';
  var VERSION = '0.2.1';
  var app = document.getElementById('app');
  var tabs = document.getElementById('tabs');
  var RITE, BOOK, I18N;
  var RD = {}, DMAP = {};
  var TW_KINDS = ['umrah', 'qudum', 'ifadah', 'wada'];
  var SW_KINDS = ['umrah', 'hajj'];
  var NUSK = ['tamattu', 'qiran', 'ifrad'];
  var S = load();
  var wakeLock = null, flightTimer = null, lastPhase = null, twk = 'umrah', swk = 'umrah';

  /* ------------------------------------------------------------ state */
  function newTw() { return { laps: 0, startedAt: null, paused: false, doubt: false }; }
  function newSw() { return { legs: 0, startedAt: null, dhikr: 0, paused: false }; }
  /* In the Hajj months (Shawwal to Dhul-Hijjah) the app opens on the Hajj journey. */
  function autoMode() {
    try {
      var m = parseInt(new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { month: 'numeric' }).format(new Date()), 10);
      return m >= 10 && m <= 12 ? 'hajj' : 'umrah';
    } catch (e) { return 'umrah'; }
  }
  function defaults() {
    var nav = String(navigator.language || 'ar').toLowerCase();
    var tw = {}, sw = {};
    TW_KINDS.forEach(function (k) { tw[k] = newTw(); });
    SW_KINDS.forEach(function (k) { sw[k] = newSw(); });
    return {
      lang: nav.indexOf('ar') === 0 ? 'ar' : 'en', theme: 'auto', size: 'm',
      mode: autoMode(), nusk: 'tamattu', done: {},
      tw: tw, sw: sw, twk: 'umrah', swk: 'umrah',
      favs: [], mine: [], trusts: [],
      prep: { umrah: {}, hajj: {} }, custom: { umrah: [], hajj: [] },
      flight: { route: 'east', time: '', arrival: null, on: false }
    };
  }
  function load() {
    var d = defaults();
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || '{}');
      Object.keys(s).forEach(function (k) { d[k] = s[k]; });
      /* version 0.1 kept a single tawaf and a single sa'i */
      if (s.tawaf && !s.tw) d.tw.umrah = s.tawaf;
      if (s.sai && !s.sw) d.sw.umrah = s.sai;
    } catch (e) { /* first run or private mode */ }
    delete d.tawaf; delete d.sai;
    TW_KINDS.forEach(function (k) { if (!d.tw[k]) d.tw[k] = newTw(); });
    SW_KINDS.forEach(function (k) { if (!d.sw[k]) d.sw[k] = newSw(); });
    if (NUSK.indexOf(d.nusk) < 0) d.nusk = 'tamattu';
    if (d.mode !== 'hajj' && d.mode !== 'umrah') d.mode = 'umrah';
    return d;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage full or blocked */ } }
  function setMode(m) { if (S.mode !== m) { S.mode = m; save(); } }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  /* ------------------------------------------------------------ text */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function n(x) { return L.num(x, S.lang); }
  function t(key, vars) {
    var e = I18N[key];
    var s = e ? (e[S.lang] || e.ar) : key;
    if (vars) Object.keys(vars).forEach(function (k) {
      s = s.split('{' + k + '}').join(typeof vars[k] === 'number' ? n(vars[k]) : vars[k]);
    });
    return s;
  }
  function tx(o) { return o ? (o[S.lang] || o.ar) : ''; }
  function sep() { return S.lang === 'ar' ? '، ' : ', '; }
  function countDuas(c) {
    return S.lang === 'ar' ? L.arCount(c, { one: 'دعاء واحد', two: 'دعاءان', few: 'أدعية', many: 'دعاءً' }) : L.enCount(c, 'dua', 'duas');
  }
  function countTrusts(c) {
    return S.lang === 'ar' ? L.arCount(c, { one: 'أمانة واحدة', two: 'أمانتان', few: 'أمانات', many: 'أمانةً' }) : L.enCount(c, 'trust', 'trusts');
  }
  function countMin(c) {
    return S.lang === 'ar' ? L.arCount(c, { one: 'دقيقة واحدة', two: 'دقيقتين', few: 'دقائق', many: 'دقيقةً' }) : L.enCount(c, 'minute', 'minutes');
  }
  function clock(ms) {
    try {
      return new Date(ms).toLocaleTimeString(S.lang === 'ar' ? 'ar-SA-u-nu-arab' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }
  function hijri() {
    try {
      var loc = S.lang === 'ar' ? 'ar-SA-u-ca-islamic-umalqura-nu-arab' : 'en-GB-u-ca-islamic-umalqura';
      return new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
    } catch (e) { return ''; }
  }

  /* ------------------------------------------------------------ icons */
  var IC = {
    back: '<path d="M9 5l7 7-7 7"/>',
    star: '<path d="M12 3.6l2.6 5.2 5.8.9-4.2 4.1 1 5.7L12 16.8l-5.2 2.7 1-5.7-4.2-4.1 5.8-.9z"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M5.5 15.5V6.5a1 1 0 0 1 1-1h9"/>',
    share: '<path d="M12 15V4.5M8 8.5l4-4 4 4"/><path d="M5 12.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    journey: '<path d="M4 18c3-6 6 2 8-4s5-6 8-8"/><circle cx="4" cy="18" r="1.6"/><circle cx="20" cy="6" r="1.6"/>',
    duas: '<path d="M7.5 20c-2.2-2-3.2-5-2.2-8l3-6.2 2 1-1 5.2M16.5 20c2.2-2 3.2-5 2.2-8l-3-6.2-2 1 1 5.2"/>',
    prep: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4v2h6V4M8.5 11l1.5 1.5 3-3M8.5 16.5l1.5 1.5 3-3"/>',
    more: '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>',
    tawaf: '<rect x="9" y="9" width="6" height="6" transform="rotate(45 12 12)"/><path d="M19.6 9.4A8 8 0 1 0 20 13"/><path d="M20.6 6.2l-.9 3.4-3.3-.9"/>',
    sai: '<circle cx="12" cy="4.5" r="2"/><circle cx="12" cy="19.5" r="2"/><path d="M12 7v10"/><path d="M9.5 11.5h5" />',
    trusts: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    miqat: '<path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',
    hajj: '<path d="M3 19l6-9 3 4 3-6 6 11z"/>',
    plane: '<path d="M10.5 20l1.5-6-6.5 1.5L4 14l8-5V4.5a1.5 1.5 0 0 1 3 0V9l6 4v1.5L15 13l1.5 7z"/>',
    book: '<path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15H7.5A2.5 2.5 0 0 0 5 20.5z"/><path d="M5 20.5A2.5 2.5 0 0 1 7.5 18H19"/>'
  };
  function icon(name, cls) {
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + IC[name] + '</svg>';
  }

  /* ------------------------------------------------------------ pieces */
  function head(title, o) {
    o = o || {};
    return '<header class="hizam' + (o.big ? ' big' : '') + '"><div class="hz-in">' +
      (o.back ? '<a class="back" href="' + o.back + '" aria-label="' + esc(t('back')) + '">' + icon('back') + '</a>' : '') +
      '<div class="hz-t"><h1>' + esc(title) + '</h1>' + (o.sub ? '<p>' + esc(o.sub) + '</p>' : '') + '</div>' +
      '</div></header>';
  }
  function li(x) { return '<li>' + esc(tx(x)) + '</li>'; }
  function liS(s) { return '<li>' + esc(s) + '</li>'; }
  function empty(s) { return '<p class="empty">' + esc(s) + '</p>'; }
  function btnA(href, label, primary) { return '<a class="btn' + (primary ? ' primary' : ' ghost') + '" href="' + href + '">' + esc(label) + '</a>'; }
  function srcById(id) { return RITE.sources.filter(function (s) { return s.id === id; })[0]; }
  function srcList(ids) {
    return '<ul class="srclist">' + ids.map(function (id) {
      var s = srcById(id);
      return s ? '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(tx(s.title)) + '</a></li>' : '';
    }).join('') + '</ul>';
  }

  /* ------------------------------------------------------------ journeys */
  function jList(j) { return j === 'hajj' ? RITE.hajjStations : RITE.stations; }
  function jOf(id) { return String(id || '').indexOf('h-') === 0 ? 'hajj' : 'umrah'; }
  function stationById(id) {
    var list = jList(jOf(id));
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return { s: list[i], i: i, list: list };
    return null;
  }
  function currentIndex(j) {
    var st = jList(j);
    for (var i = 0; i < st.length; i++) if (!S.done[st[i].id]) return i;
    return st.length;
  }
  function doneCount(j) { return jList(j).filter(function (s) { return S.done[s.id]; }).length; }
  function pendingTrusts() { return S.trusts.filter(function (x) { return !x.done; }).length; }

  function acts(fid, fav) {
    return '<div class="dua-act">' +
      '<button class="icon-btn' + (fav ? ' on' : '') + '" data-act="fav" data-id="' + esc(fid) + '" aria-pressed="' + fav + '" aria-label="' + esc(fav ? t('fav_remove') : t('fav_add')) + '">' + icon('star', fav ? 'fill' : '') + '</button>' +
      '<button class="icon-btn" data-act="copy" data-id="' + esc(fid) + '" aria-label="' + esc(t('copy')) + '">' + icon('copy') + '</button>' +
      '<button class="icon-btn" data-act="share" data-id="' + esc(fid) + '" aria-label="' + esc(t('share')) + '">' + icon('share') + '</button></div>';
  }
  function riteDua(id) {
    var d = RD[id];
    if (!d) return '';
    var fid = 'r:' + id, fav = S.favs.indexOf(fid) >= 0;
    return '<article class="dua rite">' +
      '<div class="dua-h"><h3>' + esc(tx(d.title)) + '</h3>' + (d.ref ? '<span class="ref">' + esc(tx(d.ref)) + '</span>' : '') + '</div>' +
      '<p class="dua-ar" lang="ar" dir="rtl">' + esc(d.ar) + '</p>' +
      (S.lang === 'en' && d.tr ? '<p class="tr" lang="en" dir="ltr">' + esc(d.tr) + '</p>' : '') +
      (S.lang === 'en' ? '<p class="mean">' + esc(d.en) + '</p>' : '') +
      (d.note ? '<p class="note">' + esc(tx(d.note)) + '</p>' : '') +
      acts(fid, fav) + '</article>';
  }
  function bookDua(d) {
    var fav = S.favs.indexOf(d.id) >= 0;
    return '<article class="dua">' + (d.ref ? '<span class="ref">' + esc(tx(d.ref)) + '</span>' : '') +
      '<p class="dua-ar" lang="ar" dir="rtl">' + esc(d.ar) + '</p>' + acts(d.id, fav) + '</article>';
  }
  function mineCard(m) {
    return '<article class="dua mine"><p class="dua-ar" dir="auto">' + esc(m.t) + '</p><div class="dua-act">' +
      '<button class="icon-btn" data-act="copy" data-id="m:' + esc(m.id) + '" aria-label="' + esc(t('copy')) + '">' + icon('copy') + '</button>' +
      '<button class="icon-btn" data-act="share" data-id="m:' + esc(m.id) + '" aria-label="' + esc(t('share')) + '">' + icon('share') + '</button>' +
      '<button class="icon-btn" data-act="mine-del" data-id="' + esc(m.id) + '" aria-label="' + esc(t('delete')) + '">' + icon('trash') + '</button></div></article>';
  }
  function momentBar() {
    var pt = pendingTrusts(), mine = S.mine.length;
    if (!pt && !mine) return '';
    return '<div class="moment">' +
      (pt ? '<a class="chip gold" href="#/trusts">' + icon('trusts') + '<span>' + esc(t('open_trusts')) + '</span><b>' + esc(n(pt)) + '</b></a>' : '') +
      (mine ? '<a class="chip" href="#/duas?t=mine">' + icon('duas') + '<span>' + esc(t('open_mine')) + '</span><b>' + esc(n(mine)) + '</b></a>' : '') +
      '</div>';
  }
  function nuskSeg() {
    return '<div class="seg small">' + NUSK.map(function (k) {
      return '<button data-act="nusk" data-v="' + k + '" class="' + (k === S.nusk ? 'on' : '') + '" aria-pressed="' + (k === S.nusk) + '">' + esc(t('nusk_' + k)) + '</button>';
    }).join('') + '</div>';
  }

  /* ------------------------------------------------------------ home and journeys */
  function vHome() {
    var j = S.mode, st = jList(j), ci = currentIndex(j), total = st.length, dc = doneCount(j);
    var cur = st[Math.min(ci, total - 1)];
    var modes = '<div class="seg mode" role="tablist">' + ['hajj', 'umrah'].map(function (k) {
      return '<button role="tab" aria-selected="' + (k === j) + '" class="' + (k === j ? 'on' : '') + '" data-act="mode" data-v="' + k + '">' + esc(t('mode_' + k)) + '</button>';
    }).join('') + '</div>';
    var path = st.map(function (s, i) {
      var c = S.done[s.id] ? 'done' : (i === ci ? 'now' : '');
      return '<a class="node ' + c + '" href="#/s/' + s.id + '" aria-label="' + esc(tx(s.title)) + '"><i></i></a>';
    }).join('');
    var card = '<section class="card journey-card">' +
      '<div class="jc-top"><a class="jc-title" href="#/journey?j=' + j + '">' + esc(t('journey_' + j)) + '</a><span class="jc-count">' + esc(t('home_progress', { a: dc, b: total })) + '</span></div>' +
      '<div class="path">' + path + '</div>' +
      (ci >= total
        ? '<h2 class="jc-now">' + esc(t('home_done_' + j)) + '</h2>'
        : '<p class="jc-label">' + esc(t('home_now')) + '</p><h2 class="jc-now">' + esc(tx(cur.title)) + '</h2><p class="jc-place">' + esc(tx(cur.place)) + '</p>') +
      (j === 'hajj' ? '<p class="jc-nusk">' + esc(t('nusk_label')) + ': <b>' + esc(t('nusk_' + S.nusk)) + '</b><a href="#/journey?j=hajj">' + esc(t('nusk_change')) + '</a></p>' : '') +
      '<a class="btn primary" href="#/s/' + cur.id + '">' + esc(dc === 0 ? t('home_start_' + j) : t('home_continue')) + '</a></section>';
    var pt = pendingTrusts();
    var tools = [
      ['tawaf', '#/tawaf', t('tool_tawaf'), t('tool_tawaf_sub')],
      ['sai', '#/sai', t('tool_sai'), t('tool_sai_sub')],
      ['trusts', '#/trusts', t('tool_trusts'), pt ? t('trusts_left', { n: countTrusts(pt) }) : t('tool_trusts_sub')],
      ['miqat', '#/miqat', t('tool_miqat'), t('tool_miqat_sub')],
      ['prep', '#/prep?k=' + j, t('tool_prep'), t('tool_prep_sub')],
      ['hajj', '#/nusuk', t('tool_nusuk'), t('tool_nusuk_sub')]
    ].map(function (x) {
      return '<a class="tool" href="' + x[1] + '">' + icon(x[0]) + '<b>' + esc(x[2]) + '</b><span>' + esc(x[3]) + '</span></a>';
    }).join('');
    var h = hijri();
    return head(t('app_name'), { big: true, sub: t('tagline') }) +
      '<main class="wrap">' + (h ? '<p class="date">' + esc(h) + '</p>' : '') + modes + card +
      '<h2 class="sec-h">' + esc(t('tools_title')) + '</h2><div class="tools">' + tools + '</div></main>';
  }

  function vJourney(j) {
    var ci = currentIndex(j), other = j === 'hajj' ? 'umrah' : 'hajj';
    var items = jList(j).map(function (s, i) {
      var c = S.done[s.id] ? 'done' : (i === ci ? 'now' : '');
      return '<li class="stop ' + c + '"><a href="#/s/' + s.id + '"><span class="num">' + esc(n(i + 1)) + '</span>' +
        '<span class="stop-t"><b>' + esc(tx(s.title)) + '</b><small>' + esc(tx(s.place)) + '</small></span>' +
        (S.done[s.id] ? icon('check', 'ok') : '') + '</a></li>';
    }).join('');
    var pick = j === 'hajj' ? '<div class="card nusk-pick"><p class="lbl">' + esc(t('nusk_label')) + '</p>' + nuskSeg() +
      '<a class="more-link" href="#/nusuk">' + esc(t('nusk_what')) + '</a></div>' : '';
    return head(t('journey_' + j), { back: '#/' }) + '<main class="wrap">' + pick + '<ol class="stops">' + items + '</ol>' +
      '<a class="btn ghost wide" href="#/journey?j=' + other + '">' + esc(t('journey_' + other)) + '</a>' +
      (doneCount(j) ? '<button class="linkish" data-act="reset-journey" data-v="' + j + '">' + esc(t('reset_journey')) + '</button>' : '') + '</main>';
  }

  var TABS = ['do', 'say', 'watch', 'calm', 'women'];
  function toolBtn(x, primary) {
    var k = x.k, href, label, ic;
    if (x.kind === 'tawaf') { href = '#/tawaf?k=' + (k || 'umrah'); label = !k || k === 'umrah' ? t('open_tawaf') : t('open_counter', { x: t('tw_' + k) }); ic = 'tawaf'; }
    else if (x.kind === 'sai') { href = '#/sai?k=' + (k || 'umrah'); label = !k || k === 'umrah' ? t('open_sai') : t('open_counter', { x: t('sw_' + k) }); ic = 'sai'; }
    else if (x.kind === 'miqat') { href = '#/miqat'; label = t('open_miqat'); ic = 'miqat'; }
    else if (x.kind === 'umrah') { href = '#/journey?j=umrah'; label = t('open_umrah'); ic = 'journey'; }
    else if (x.kind === 'prep') { href = '#/prep?k=hajj'; label = t('open_prep_hajj'); ic = 'prep'; }
    else if (x.kind === 'trusts') { href = '#/trusts'; label = t('open_trusts'); ic = 'trusts'; }
    else return '';
    return '<a class="btn wide' + (primary ? ' primary' : '') + '" href="' + href + '">' + icon(ic) + esc(label) + '</a>';
  }
  function stationTools(s) {
    var list = (s.tools || (s.tool ? [{ kind: s.tool }] : [])).filter(function (x) { return !x.n || x.n.indexOf(S.nusk) >= 0; });
    return list.map(function (x, i) {
      return toolBtn(x, i === 0 && ['tawaf', 'sai', 'umrah'].indexOf(x.kind) >= 0);
    }).join('');
  }
  function nuskBox(lines) {
    return '<div class="nusk-box"><div class="nb-h"><span>' + esc(t('nusk_for', { n: t('nusk_' + S.nusk) })) + '</span>' +
      '<a href="#/journey?j=hajj">' + esc(t('nusk_change')) + '</a></div><ul class="lines dot">' + lines.map(li).join('') + '</ul></div>';
  }
  function vStation(id, tab) {
    var f = stationById(id);
    if (!f) return vHome();
    var s = f.s, i = f.i, list = f.list, j = jOf(id);
    var say = (s.nuskSay && s.nuskSay[S.nusk] ? [s.nuskSay[S.nusk]] : []).concat(s.say || []);
    var nuskLines = s.nusk && s.nusk[S.nusk] ? s.nusk[S.nusk] : null;
    var avail = TABS.filter(function (k) {
      if (k === 'say') return say.length;
      return (s[k] || []).length || (k === 'do' && nuskLines);
    });
    var cur = avail.indexOf(tab) >= 0 ? tab : avail[0];
    var seg = '<div class="seg" role="tablist">' + avail.map(function (k) {
      return '<a role="tab" aria-selected="' + (k === cur) + '" class="' + (k === cur ? 'on' : '') + '" href="#/s/' + s.id + '?t=' + k + '">' + esc(t('tab_' + k)) + '</a>';
    }).join('') + '</div>';
    var body;
    if (cur === 'say') body = say.map(riteDua).join('');
    else {
      var tag = cur === 'do' ? 'ol' : 'ul';
      body = (cur === 'do' && nuskLines ? nuskBox(nuskLines) : '') +
        '<' + tag + ' class="lines ' + cur + '">' + (s[cur] || []).map(li).join('') + '</' + tag + '>';
    }
    var done = !!S.done[s.id], prev = list[i - 1], next = list[i + 1];
    var nav = '<div class="st-nav">' +
      (prev ? '<a class="btn ghost sm" href="#/s/' + prev.id + '">' + esc(t('prev_station')) + '</a>' : '<span></span>') +
      '<button class="btn ' + (done ? 'ghost' : 'primary') + '" data-act="done" data-id="' + s.id + '">' + (done ? icon('check') + esc(t('marked_done')) : esc(t('mark_done'))) + '</button>' +
      (next ? '<a class="btn ghost sm" href="#/s/' + next.id + '">' + esc(t('next_station')) + '</a>' : '<span></span>') + '</div>';
    var srcs = '<details class="srcs"><summary>' + esc(t('station_sources')) + '</summary>' + srcList(s.src) + '</details>';
    return head(tx(s.title), { back: '#/journey?j=' + j, sub: t('station_of', { n: i + 1, total: list.length }) + sep() + tx(s.place) }) +
      '<main class="wrap">' + stationTools(s) + seg + (s.trusts ? momentBar() : '') + '<div class="panel">' + body + '</div>' + nav + srcs + '</main>';
  }

  /* ------------------------------------------------------------ tawaf */
  function tawafSvg(st) {
    var cx = 180, cy = 180, R = 140, span = 360 / 7, gap = 5;
    function P(r, deg) { var a = deg * Math.PI / 180; return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; }
    function f(p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }
    var segs = '';
    for (var i = 0; i < 7; i++) {
      var a1 = i * span + gap / 2, a2 = (i + 1) * span - gap / 2;
      var cls = i < st.done ? 'seg done' : (i === st.done && !st.finished ? 'seg now' : 'seg');
      segs += '<path class="' + cls + '" d="M' + f(P(R, a1)) + ' A' + R + ' ' + R + ' 0 0 0 ' + f(P(R, a2)) + '"/>';
    }
    var th = 12 * Math.PI / 180, ar = R + 20;
    var pos = [cx + ar * Math.cos(th), cy - ar * Math.sin(th)];
    var tan = [-Math.sin(th), -Math.cos(th)], nor = [Math.cos(th), -Math.sin(th)];
    var tip = [pos[0] + 9 * tan[0], pos[1] + 9 * tan[1]];
    var b1 = [pos[0] - 4 * tan[0] + 6 * nor[0], pos[1] - 4 * tan[1] + 6 * nor[1]];
    var b2 = [pos[0] - 4 * tan[0] - 6 * nor[0], pos[1] - 4 * tan[1] - 6 * nor[1]];
    var arrow = '<path class="dir" d="M' + f(tip) + ' L' + f(b1) + ' L' + f(b2) + 'Z"/>';
    return '<svg class="tawaf-svg" viewBox="0 0 360 360" role="img" aria-label="' + esc(t('lap_now', { n: st.current || 7 })) + '">' +
      '<circle class="mataf" cx="180" cy="180" r="' + (R + 16) + '"/>' +
      segs + arrow +
      '<line class="start" x1="249" y1="180" x2="336" y2="180"/>' +
      '<path class="hijr" d="M171.3 126.7 A31.5 31.5 0 0 0 126.7 171.3"/>' +
      '<rect class="maqam" x="225" y="121" width="13" height="13" rx="3" transform="rotate(45 231.5 127.5)"/>' +
      '<polygon class="kaaba" points="180,118 242,180 180,242 118,180"/>' +
      '<polygon class="hizam-line" points="180,131 229,180 180,229 131,180"/>' +
      '<circle class="stone" cx="242" cy="180" r="7"/>' +
      '<circle class="yamani" cx="180" cy="242" r="5.5"/>' +
      '<text class="count" x="180" y="192">' + esc(n(st.done)) + '</text>' +
      '<text class="of" x="180" y="214">' + esc(S.lang === 'ar' ? 'من ٧' : 'of 7') + '</text>' +
      '<text class="lbl" x="283" y="206">' + esc(t('label_blackstone')) + '</text>' +
      '<text class="lbl" x="180" y="268">' + esc(t('label_yamani')) + '</text>' +
      '<text class="lbl" x="104" y="104">' + esc(t('label_hijr')) + '</text>' +
      '<text class="lbl" x="252" y="104">' + esc(t('label_maqam')) + '</text>' +
      '</svg>';
  }
  function kindChips(kinds, cur, base, pre) {
    return '<div class="seg small kinds">' + kinds.map(function (k) {
      return '<a href="#/' + base + '?k=' + k + '" class="' + (k === cur ? 'on' : '') + '"' + (k === cur ? ' aria-current="true"' : '') + '>' + esc(t(pre + k)) + '</a>';
    }).join('') + '</div>';
  }
  function doubtBox(done) {
    var opts = [];
    for (var k = Math.max(0, done - 2); k <= done; k++) opts.push(k);
    return '<div class="card doubt"><p>' + esc(t('doubt_note')) + '</p><div class="seg small">' + opts.map(function (k) {
      return '<button data-act="t-set" data-v="' + k + '" class="' + (k === done ? 'on' : '') + '">' + esc(n(k)) + '</button>';
    }).join('') + '</div></div>';
  }
  function pauseBox(p) {
    return '<div class="pause-box"><p>' + esc(t('paused_note')) + '</p><button class="btn primary" data-act="' + p + '-resume">' + esc(t('resume')) + '</button></div>';
  }
  var TW_BACK = { umrah: '#/s/tawaf', qudum: '#/s/h-arrive', ifadah: '#/s/h-ifadah', wada: '#/s/h-wada' };
  function vTawaf(k) {
    k = TW_KINDS.indexOf(k) >= 0 ? k : (TW_KINDS.indexOf(S.twk) >= 0 ? S.twk : 'umrah');
    twk = k;
    if (S.twk !== k) { S.twk = k; save(); }
    var T0 = S.tw[k], st = L.tawaf(T0.laps), paused = T0.paused, first = k === 'umrah' || k === 'qudum';
    var tips = [];
    if (!st.finished) {
      if (first && st.current === 1) tips.push(t('tip_idtiba'));
      tips.push(t('tip_start'));
      tips.push(first ? (st.ramal ? t('tip_ramal') : t('tip_walk')) : t('tip_no_ramal'));
      if (first && st.last) tips.push(t('tip_last'));
    }
    var next;
    if (k === 'umrah') next = btnA('#/s/maqam', t('tawaf_next'), true);
    else if (k === 'wada') next = '<p class="note">' + esc(t('wada_done')) + '</p>' + btnA('#/s/h-done', tx(stationById('h-done').s.title), true);
    else next = '<p class="note">' + esc(t('after_tawaf')) + '</p>' + btnA('#/sai?k=hajj', t('sai_if_due'), true) + btnA('#/journey?j=hajj', t('back_hajj'));
    var top = st.finished
      ? '<div class="done-box">' + icon('check') + '<h2>' + esc(t('tawaf_done')) + '</h2>' + next + '</div>'
      : '<p class="lap-now">' + esc(t('lap_now', { n: st.current })) + '</p>';
    var corners = st.finished ? '' : '<div class="corner-dua"><p class="lbl">' + esc(t('tip_corners')) + '</p><p class="dua-ar sm" lang="ar" dir="rtl">' + esc(RD.corners.ar) + '</p>' +
      (S.lang === 'en' ? '<p class="mean">' + esc(RD.corners.en) + '</p>' : '') + '</div>';
    var row = '<div class="row3">' +
      '<button class="btn ghost sm" data-act="t-undo"' + (T0.laps ? '' : ' disabled') + '>' + esc(t('undo')) + '</button>' +
      '<button class="btn ghost sm" data-act="t-pause"' + (paused || st.finished ? ' disabled' : '') + '>' + esc(t('pause_prayer')) + '</button>' +
      '<button class="btn ghost sm" data-act="t-doubt"' + (st.finished || !st.done ? ' disabled' : '') + '>' + esc(t('doubt')) + '</button></div>';
    var dock = st.finished ? '' : '<div class="dock">' + (paused ? pauseBox('t') :
      '<button class="tap" data-act="t-lap"><span>' + esc(t('tap_lap')) + '</span><small>' + esc(t('tap_hint')) + '</small></button>') + '</div>';
    return head(t('tw_' + k), { back: TW_BACK[k], sub: T0.startedAt ? t('started_at', { t: clock(T0.startedAt) }) : t('kaaba_note') }) +
      '<main class="wrap counter">' + kindChips(TW_KINDS, k, 'tawaf', 'twk_') + tawafSvg(st) + top +
      (tips.length ? '<ul class="tips">' + tips.map(liS).join('') + '</ul>' : '') + corners +
      (T0.doubt && !st.finished ? doubtBox(st.done) : '') + momentBar() + row +
      (T0.laps ? '<button class="linkish" data-act="t-restart">' + esc(t('restart')) + '</button>' : '') +
      '</main>' + dock;
  }

  /* ------------------------------------------------------------ sa'i */
  function saiSvg(st) {
    var top = 70, bot = 330, x = 70, len = bot - top;
    var g1 = bot - 0.45 * len, g2 = bot - 0.25 * len;
    var you = st.at === 'safa' ? bot : top;
    var arrow = '';
    if (!st.finished) {
      var mid = (top + bot) / 2, up = st.next === 'marwa';
      arrow = up ? '<path class="dir" d="M70 ' + (mid - 16) + ' L60 ' + (mid + 2) + ' L80 ' + (mid + 2) + 'Z"/>'
                 : '<path class="dir" d="M70 ' + (mid + 16) + ' L60 ' + (mid - 2) + ' L80 ' + (mid - 2) + 'Z"/>';
    }
    return '<svg class="sai-svg" viewBox="0 0 140 400" role="img" aria-label="' + esc(t('safa') + sep() + t('marwa')) + '">' +
      '<path class="hill" d="M34 ' + top + ' Q70 ' + (top - 40) + ' 106 ' + top + 'Z"/>' +
      '<path class="hill" d="M34 ' + bot + ' Q70 ' + (bot + 40) + ' 106 ' + bot + 'Z"/>' +
      '<rect class="track" x="' + (x - 8) + '" y="' + top + '" width="16" height="' + len + '" rx="8"/>' +
      '<rect class="green" x="' + (x - 8) + '" y="' + g1.toFixed(1) + '" width="16" height="' + (g2 - g1).toFixed(1) + '"/>' +
      arrow +
      '<circle class="you" cx="70" cy="' + you + '" r="10"/>' +
      '<text class="lbl" x="70" y="' + (top - 46) + '">' + esc(t('marwa')) + '</text>' +
      '<text class="lbl" x="70" y="' + (bot + 60) + '">' + esc(t('safa')) + '</text>' +
      '</svg>';
  }
  function miniDua(id) {
    var d = RD[id];
    return '<div class="mini"><p class="mini-t">' + esc(tx(d.title)) + '</p><p class="dua-ar xs" lang="ar" dir="rtl">' + esc(d.ar) + '</p>' +
      (S.lang === 'en' ? '<p class="mean">' + esc(d.en) + '</p>' : '') + '</div>';
  }
  function vSai(k) {
    k = SW_KINDS.indexOf(k) >= 0 ? k : (SW_KINDS.indexOf(S.swk) >= 0 ? S.swk : 'umrah');
    swk = k;
    if (S.swk !== k) { S.swk = k; save(); }
    var W = S.sw[k], st = L.sai(W.legs), paused = W.paused, dh = W.dhikr || 0;
    var pills = '<ol class="legs">' + [1, 2, 3, 4, 5, 6, 7].map(function (x) {
      return '<li class="' + (x <= st.done ? 'done' : (x === st.current ? 'now' : '')) + '">' + esc(n(x)) + '</li>';
    }).join('') + '</ol>';
    var endCard = '<div class="card endcard"><h2>' + esc(st.at === 'safa' ? t('at_safa') : t('at_marwa')) + '</h2>' +
      (st.firstStart ? miniDua('nabda') + miniDua('safaverse') : '') +
      '<p class="mini-t">' + esc(tx(RD.safa.title)) + '</p>' +
      '<p class="dua-ar sm" lang="ar" dir="rtl">' + esc(RD.safa.ar) + '</p>' +
      (S.lang === 'en' ? '<p class="mean">' + esc(RD.safa.en) + '</p>' : '') +
      '<div class="rounds">' + [1, 2, 3].map(function (x) { return '<i class="' + (x <= dh ? 'on' : '') + '"></i>'; }).join('') +
      '<span>' + esc(dh >= 3 ? t('dhikr_done') : t('dhikr_round', { n: dh + 1 })) + '</span></div>' +
      (dh < 3 ? '<button class="btn sm" data-act="s-dhikr">' + esc(t('dhikr_next')) + '</button>' : '') + '</div>';
    var walk = st.finished ? '' : '<div class="walk"><p class="go">' + esc(st.next === 'marwa' ? t('going_marwa') : t('going_safa')) + '</p>' +
      '<p class="green-tip"><i></i>' + esc(t('green_zone')) + '</p></div>';
    var next = k === 'umrah' ? btnA('#/s/halq', t('sai_next'), true) : btnA('#/journey?j=hajj', t('back_hajj'), true);
    var done = st.finished ? '<div class="done-box">' + icon('check') + '<h2>' + esc(t('sai_done')) + '</h2>' + next + '</div>' : '';
    var row = '<div class="row3 two">' +
      '<button class="btn ghost sm" data-act="s-undo"' + (W.legs ? '' : ' disabled') + '>' + esc(t('undo')) + '</button>' +
      '<button class="btn ghost sm" data-act="s-pause"' + (paused || st.finished ? ' disabled' : '') + '>' + esc(t('pause_prayer')) + '</button></div>';
    var dock = st.finished ? '' : '<div class="dock">' + (paused ? pauseBox('s') :
      '<button class="tap" data-act="s-leg"><span>' + esc(st.next === 'marwa' ? t('reached_marwa') : t('reached_safa')) + '</span><small>' + esc(t('leg_now', { n: st.current })) + '</small></button>') + '</div>';
    return head(t('sw_' + k), { back: k === 'umrah' ? '#/s/sai' : '#/s/h-ifadah', sub: W.startedAt ? t('started_at', { t: clock(W.startedAt) }) : t('tool_sai_sub') }) +
      '<main class="wrap counter">' + kindChips(SW_KINDS, k, 'sai', 'swk_') +
      '<div class="sai-grid">' + saiSvg(st) + '<div class="sai-side">' + pills + done + endCard + walk + '</div></div>' +
      momentBar() + row + (W.legs ? '<button class="linkish" data-act="s-restart">' + esc(t('restart')) + '</button>' : '') + '</main>' + dock;
  }

  /* ------------------------------------------------------------ duas */
  function vDuas(tab, q) {
    var list = ['sections', 'rite', 'favs', 'mine'];
    tab = list.indexOf(tab) >= 0 ? tab : 'sections';
    var seg = '<div class="seg" role="tablist">' + list.map(function (k) {
      return '<a role="tab" aria-selected="' + (k === tab) + '" class="' + (k === tab ? 'on' : '') + '" href="#/duas?t=' + k + '">' + esc(t('duas_tab_' + k)) + '</a>';
    }).join('') + '</div>';
    var body = '';
    if (tab === 'sections') {
      body = '<input class="search" type="search" id="dsearch" placeholder="' + esc(t('search_ph')) + '" value="' + esc(q || '') + '" autocomplete="off">' +
        '<div id="dres"></div>' + (S.lang === 'en' ? '<p class="note">' + esc(t('arabic_note')) + '</p>' : '') +
        '<div class="grid-sec">' + BOOK.sections.map(function (s) {
          return '<a class="sec-card" href="#/duas/' + s.id + '"><b>' + esc(tx(s.title)) + '</b><span>' + esc(countDuas(s.duas.length)) + '</span></a>';
        }).join('') + '</div>';
    } else if (tab === 'rite') {
      body = RITE.duas.map(function (d) { return riteDua(d.id); }).join('');
    } else if (tab === 'favs') {
      body = S.favs.length ? S.favs.map(function (id) {
        if (id.indexOf('r:') === 0) return riteDua(id.slice(2));
        var d = DMAP[id];
        return d ? '<p class="found-in"><a href="#/duas/' + d.sec.id + '">' + esc(tx(d.sec.title)) + '</a></p>' + bookDua(d) : '';
      }).join('') : empty(t('empty_favs'));
    } else {
      body = '<form class="card form" data-form="mine"><textarea name="t" rows="3" maxlength="600" placeholder="' + esc(t('mine_ph')) + '" required></textarea>' +
        '<button class="btn primary" type="submit">' + icon('plus') + esc(t('mine_add')) + '</button></form>' +
        (S.mine.length ? S.mine.map(mineCard).join('') : empty(t('empty_mine')));
    }
    return head(t('duas_title')) + '<main class="wrap">' + seg + body + '</main>';
  }
  function vSection(id) {
    var s = BOOK.sections.filter(function (x) { return x.id === id; })[0];
    if (!s) return vDuas();
    return head(tx(s.title), { back: '#/duas', sub: countDuas(s.duas.length) }) + '<main class="wrap">' +
      (S.lang === 'en' ? '<p class="note">' + esc(t('arabic_note')) + '</p>' : '') + s.duas.map(bookDua).join('') + '</main>';
  }
  function runSearch(q) {
    var box = document.getElementById('dres'), grid = document.querySelector('.grid-sec');
    if (!box) return;
    if (L.normalize(q).length < 2) { box.innerHTML = ''; if (grid) grid.hidden = false; return; }
    var res = L.search(BOOK.sections, q);
    if (grid) grid.hidden = true;
    box.innerHTML = res.length ? res.slice(0, 60).map(function (r) {
      return '<p class="found-in"><a href="#/duas/' + r.section.id + '">' + esc(tx(r.section.title)) + '</a></p>' + bookDua(r.dua);
    }).join('') : empty(t('no_results'));
  }

  /* ------------------------------------------------------------ trusts */
  function vTrusts() {
    var form = '<form class="card form" data-form="trust">' +
      '<label>' + esc(t('trust_name')) + '<input name="name" required maxlength="60" autocomplete="off"></label>' +
      '<label>' + esc(t('trust_req')) + '<textarea name="req" rows="2" maxlength="300"></textarea></label>' +
      '<button class="btn primary" type="submit">' + icon('plus') + esc(t('trust_add')) + '</button></form>';
    var pending = pendingTrusts();
    var list = S.trusts.length ? '<ul class="trusts">' + S.trusts.map(function (x) {
      return '<li class="trust' + (x.done ? ' done' : '') + '">' +
        '<button class="tick" data-act="trust-toggle" data-id="' + esc(x.id) + '" aria-pressed="' + !!x.done + '" aria-label="' + esc(x.done ? t('trust_done') : t('trust_mark')) + '">' + icon('check') + '</button>' +
        '<div class="tr-t"><b>' + esc(x.name) + '</b>' + (x.req ? '<p>' + esc(x.req) + '</p>' : '') + (x.done ? '<small>' + esc(t('trust_done')) + '</small>' : '') + '</div>' +
        '<button class="icon-btn" data-act="trust-del" data-id="' + esc(x.id) + '" aria-label="' + esc(t('delete')) + '">' + icon('trash') + '</button></li>';
    }).join('') + '</ul>' : empty(t('trusts_empty'));
    return head(t('trusts_title'), { back: '#/' }) + '<main class="wrap"><p class="lead">' + esc(t('trusts_intro')) + '</p>' + form +
      (pending ? '<p class="count">' + esc(t('trusts_left', { n: countTrusts(pending) })) + '</p>' : '') + list +
      '<p class="note">' + esc(t('private_note')) + '</p></main>';
  }

  /* ------------------------------------------------------------ preparation */
  function chk(kind, id, text, link, del) {
    var on = !!(S.prep[kind] && S.prep[kind][id]);
    return '<div class="chk' + (on ? ' on' : '') + '"><label><input type="checkbox" data-act="prep" data-k="' + kind + '" data-id="' + esc(id) + '"' + (on ? ' checked' : '') + '>' +
      '<span class="box">' + icon('check') + '</span><span class="txt">' + esc(text) + '</span></label>' +
      (link ? '<a class="go" href="#/' + link + '" aria-label="' + esc(t('open')) + '">' + icon('back', 'fwd') + '</a>' : '') +
      (del ? '<button class="icon-btn" data-act="prep-del" data-k="' + kind + '" data-id="' + esc(id.slice(2)) + '" aria-label="' + esc(t('delete')) + '">' + icon('trash') + '</button>' : '') + '</div>';
  }
  function vPrep(kind) {
    kind = kind === 'hajj' ? 'hajj' : (kind === 'umrah' ? 'umrah' : S.mode);
    S.prep[kind] = S.prep[kind] || {};
    S.custom[kind] = S.custom[kind] || [];
    var groups = RITE.prep[kind], custom = S.custom[kind], all = [];
    groups.forEach(function (g) { g.items.forEach(function (it) { all.push(it.id); }); });
    custom.forEach(function (c) { all.push('c:' + c.id); });
    var done = all.filter(function (id) { return S.prep[kind][id]; }).length;
    var seg = '<div class="seg" role="tablist">' + ['hajj', 'umrah'].map(function (k) {
      return '<a role="tab" aria-selected="' + (k === kind) + '" class="' + (k === kind ? 'on' : '') + '" href="#/prep?k=' + k + '">' + esc(t('prep_' + k)) + '</a>';
    }).join('') + '</div>';
    var bar = '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + all.length + '" aria-valuenow="' + done + '"><div style="width:' + Math.round(100 * done / Math.max(1, all.length)) + '%"></div></div>' +
      '<p class="count">' + esc(t('prep_progress', { a: done, b: all.length })) + '</p>';
    var gh = groups.map(function (g) {
      return '<section class="card grp"><h2>' + esc(tx(g.title)) + '</h2>' + g.items.map(function (it) { return chk(kind, it.id, tx(it.t), it.link); }).join('') +
        (g.src ? srcList(g.src) : '') + '</section>';
    }).join('');
    var mine = '<section class="card grp"><h2>' + esc(t('prep_mine')) + '</h2>' + custom.map(function (c) { return chk(kind, 'c:' + c.id, c.t, null, true); }).join('') +
      '<form class="inline-add" data-form="prep" data-k="' + kind + '"><input name="t" maxlength="120" placeholder="' + esc(t('custom_ph')) + '" required>' +
      '<button class="btn primary sm" type="submit">' + esc(t('custom_add')) + '</button></form></section>';
    return head(t('prep_title')) + '<main class="wrap">' + seg + bar + gh + mine + '</main>';
  }

  /* ------------------------------------------------------------ miqat */
  function miqatSvg(list) {
    var c = 170, max = 450;
    function R(km) { return 34 + Math.sqrt(km / max) * 118; }
    var rings = [75, 183, 450].map(function (km) { return '<circle class="ring" cx="' + c + '" cy="' + c + '" r="' + R(km).toFixed(1) + '"/>'; }).join('');
    var pts = list.map(function (m) {
      var r = R(m.km), b = m.bearing * Math.PI / 180, x = c + r * Math.sin(b), y = c - r * Math.cos(b);
      return '<line class="spoke" x1="' + c + '" y1="' + c + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '"/>' +
        '<circle class="mq-dot" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="6"/>' +
        '<text class="mq-lbl" x="' + x.toFixed(1) + '" y="' + (y + 24).toFixed(1) + '">' + esc(tx(m.name)) + '</text>';
    }).join('');
    return '<svg class="miqat-svg" viewBox="0 0 340 340" role="img" aria-label="' + esc(t('miqat_list')) + '">' + rings + pts +
      '<rect class="mk" x="162" y="162" width="16" height="16" rx="2"/>' +
      '<text class="mk-lbl" x="170" y="200">' + esc(t('makkah')) + '</text>' +
      '<path class="north-ar" d="M24 12 l-6 12 h12z"/><text class="north" x="24" y="40">' + esc(t('north')) + '</text></svg>';
  }
  function flightRoute() {
    var rs = RITE.miqat.routes;
    return rs.filter(function (r) { return r.id === S.flight.route; })[0] || rs[0];
  }
  function intentWords() {
    var id = S.mode === 'hajj' ? { tamattu: 'niyyah', qiran: 'qiran', ifrad: 'hajj' }[S.nusk] : 'niyyah';
    var d = RD[id];
    return t('flight_now_intent', { w: S.lang === 'en' && d.tr ? d.tr : d.ar });
  }
  function flightStatusHtml() {
    var F = S.flight;
    if (!F.on || !F.arrival) return '';
    var rt = flightRoute(), ph = L.flight(F.arrival, Date.now(), rt);
    if (ph.phase === 'past') return '<p class="fs past">' + esc(t('flight_past')) + '</p>';
    if (ph.phase === 'intent') return '<p class="fs now">' + esc(intentWords()) + '</p>';
    if (ph.phase === 'prepare') return '<p class="fs now">' + esc(t('flight_now_prepare')) + '</p>' +
      (ph.toIntent != null ? '<p class="fs">' + esc(t('flight_to_intent', { m: countMin(ph.toIntent) })) + '</p>' : '<p class="fs">' + esc(t('flight_listen')) + '</p>');
    return '<p class="fs">' + esc(t('flight_to_prepare', { m: countMin(ph.toPrepare) })) + '</p>' +
      (ph.toIntent != null ? '<p class="fs">' + esc(t('flight_to_intent', { m: countMin(ph.toIntent) })) + '</p>' : '');
  }
  function flightWidget() {
    var F = S.flight, rt = flightRoute();
    var opts = RITE.miqat.routes.map(function (r) {
      return '<label class="radio' + (r.id === rt.id ? ' on' : '') + '"><input type="radio" name="route" value="' + r.id + '" data-act="route"' + (r.id === rt.id ? ' checked' : '') + '><span>' + esc(tx(r.name)) + '</span></label>';
    }).join('');
    return '<section class="card flight"><h3>' + icon('plane') + esc(t('flight_title')) + '</h3>' +
      '<p class="lbl">' + esc(t('flight_route')) + '</p><div class="radios">' + opts + '</div>' +
      '<label class="lbl" for="farr">' + esc(t('flight_arrival')) + '</label><input id="farr" class="time" type="time" value="' + esc(F.time || '') + '">' +
      (F.on ? '<button class="btn ghost" data-act="flight-stop">' + esc(t('flight_stop')) + '</button>'
            : '<button class="btn primary" data-act="flight-start">' + esc(t('flight_start')) + '</button>') +
      '<div class="flight-status" id="fstatus" aria-live="polite">' + flightStatusHtml() + '</div>' +
      '<p class="note">' + esc(rt.intent != null ? t('flight_note_east') : t('flight_listen')) + '</p>' +
      '<p class="note">' + esc(t('flight_note_web')) + '</p></section>';
  }
  function vMiqat() {
    var M = RITE.miqat;
    var cards = M.list.map(function (m) {
      return '<li class="mq"><b>' + esc(tx(m.name)) + '</b><span>' + esc(tx(m.today)) + '</span><small>' + esc(tx(m['for'])) + '</small><em>' + esc(t('miqat_km', { km: m.km })) + '</em></li>';
    }).join('');
    return head(t('miqat_title'), { back: '#/' }) + '<main class="wrap"><blockquote class="hadith">' + esc(tx(M.hadith)) + '</blockquote>' +
      miqatSvg(M.list) + '<p class="note center">' + esc(t('map_note')) + '</p>' +
      '<h2 class="sec-h">' + esc(t('miqat_list')) + '</h2><ul class="mqs">' + cards + '</ul>' +
      '<h2 class="sec-h">' + esc(t('miqat_rules')) + '</h2><ul class="lines dot">' + M.rules.map(li).join('') + '</ul>' +
      '<h2 class="sec-h">' + esc(t('miqat_plane')) + '</h2><ul class="lines dot">' + M.plane.map(li).join('') + '</ul>' +
      flightWidget() + '<details class="srcs"><summary>' + esc(t('sources')) + '</summary>' + srcList(M.src) + '</details></main>';
  }

  /* ------------------------------------------------------------ the three forms of Hajj */
  function vNusuk() {
    var H = RITE.hajj;
    var cards = H.nusuk.map(function (x) {
      var on = x.id === S.nusk;
      return '<section class="card nusk-card' + (on ? ' on' : '') + '"><div class="nc-h"><h2>' + esc(tx(x.name)) + '</h2>' +
        (on ? '<span class="pill">' + esc(t('nusk_yours')) + '</span>' : '<button class="btn sm" data-act="nusk" data-v="' + x.id + '">' + esc(t('nusk_choose')) + '</button>') +
        '</div><ul class="lines dot">' + x.lines.map(li).join('') + '</ul>' + riteDua(x.say) + '</section>';
    }).join('');
    return head(t('nusuk_title'), { back: '#/journey?j=hajj' }) + '<main class="wrap"><p class="lead">' + esc(t('nusuk_intro')) + '</p>' + cards +
      '<a class="btn primary wide" href="#/journey?j=hajj">' + icon('hajj') + esc(t('journey_hajj')) + '</a>' +
      '<details class="srcs"><summary>' + esc(t('sources')) + '</summary>' + srcList(H.src) + '</details></main>';
  }

  /* ------------------------------------------------------------ more */
  function segc(name, cur, opts) {
    return '<div class="seg small">' + opts.map(function (o) {
      return '<button data-act="set" data-k="' + name + '" data-v="' + o[0] + '" class="' + (cur === o[0] ? 'on' : '') + '" aria-pressed="' + (cur === o[0]) + '">' + esc(o[1]) + '</button>';
    }).join('') + '</div>';
  }
  function vMore() {
    var links = [['journey?j=hajj', t('journey_hajj'), 'hajj'], ['journey?j=umrah', t('journey_umrah'), 'tawaf'], ['nusuk', t('nusuk_title'), 'journey'],
      ['miqat', t('tool_miqat'), 'miqat'], ['trusts', t('tool_trusts'), 'trusts'], ['sources', t('sources'), 'book']];
    return head(t('more_title')) + '<main class="wrap">' +
      '<nav class="links">' + links.map(function (x) { return '<a href="#/' + x[0] + '">' + icon(x[2]) + '<span>' + esc(x[1]) + '</span>' + icon('back', 'fwd') + '</a>'; }).join('') + '</nav>' +
      '<h2 class="sec-h">' + esc(t('settings')) + '</h2><div class="card set">' +
      '<div class="set-row"><span>' + esc(t('lang')) + '</span>' + segc('lang', S.lang, [['ar', 'العربية'], ['en', 'English']]) + '</div>' +
      '<div class="set-row"><span>' + esc(t('theme')) + '</span>' + segc('theme', S.theme, [['auto', t('theme_auto')], ['light', t('theme_light')], ['dark', t('theme_dark')]]) + '</div>' +
      '<div class="set-row"><span>' + esc(t('size')) + '</span>' + segc('size', S.size, [['s', t('size_s')], ['m', t('size_m')], ['l', t('size_l')]]) + '</div></div>' +
      '<h2 class="sec-h">' + esc(t('install')) + '</h2><p class="note">' + esc(t('install_note')) + '</p>' +
      '<h2 class="sec-h">' + esc(t('data_title')) + '</h2><p class="note">' + esc(t('data_note')) + '</p>' +
      '<button class="btn ghost danger" data-act="erase">' + esc(t('erase_all')) + '</button>' +
      '<h2 class="sec-h">' + esc(t('about')) + '</h2><div class="card about"><p>' + esc(t('about_name')) + '</p><p>' + esc(t('about_content')) + '</p>' +
      '<p><a href="https://github.com/SiteQ8/Ateeq" target="_blank" rel="noopener">' + esc(t('about_open')) + '</a></p>' +
      '<p>' + esc(t('about_by')) + '</p><p><a href="mailto:site@hotmail.com">' + esc(t('contact')) + '</a></p>' +
      '<p class="ver">' + esc(t('version')) + ' <span dir="ltr">' + VERSION + '</span></p></div></main>';
  }
  function vSources() {
    return head(t('sources'), { back: '#/more' }) + '<main class="wrap"><p class="lead">' + esc(t('sources_intro')) + '</p>' +
      srcList(RITE.sources.map(function (s) { return s.id; })) + '</main>';
  }

  /* ------------------------------------------------------------ router */
  function parse() {
    var h = location.hash.replace(/^#\/?/, '');
    var qi = h.indexOf('?'), path = qi >= 0 ? h.slice(0, qi) : h, qs = qi >= 0 ? h.slice(qi + 1) : '';
    var q = {};
    qs.split('&').forEach(function (kv) {
      if (!kv) return;
      var p = kv.split('=');
      try { q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); } catch (e) { /* bad escape */ }
    });
    return { parts: path.split('/').filter(Boolean), q: q };
  }
  function renderTabs(active) {
    var items = [['journey', '#/', t('nav_journey')], ['duas', '#/duas', t('nav_duas')], ['prep', '#/prep', t('nav_prep')], ['more', '#/more', t('nav_more')]];
    tabs.innerHTML = items.map(function (x) {
      var on = x[0] === active;
      return '<a href="' + x[1] + '" class="' + (on ? 'on' : '') + '"' + (on ? ' aria-current="page"' : '') + '>' + icon(x[0]) + '<span>' + esc(x[2]) + '</span></a>';
    }).join('');
  }
  function render() {
    var r = parse(), p = r.parts, v = p[0] || '', html, tab = 'journey';
    if (v === '') html = vHome();
    else if (v === 'journey') {
      var j = r.q.j === 'hajj' || r.q.j === 'umrah' ? r.q.j : S.mode;
      setMode(j);
      html = vJourney(j);
    }
    else if (v === 's') { if (stationById(p[1])) setMode(jOf(p[1])); html = vStation(p[1], r.q.t); }
    else if (v === 'tawaf') html = vTawaf(r.q.k);
    else if (v === 'sai') html = vSai(r.q.k);
    else if (v === 'duas' && p[1]) { html = vSection(p[1]); tab = 'duas'; }
    else if (v === 'duas') { html = vDuas(r.q.t, r.q.q); tab = 'duas'; }
    else if (v === 'trusts') html = vTrusts();
    else if (v === 'prep') { html = vPrep(r.q.k); tab = 'prep'; }
    else if (v === 'miqat') html = vMiqat();
    else if (v === 'nusuk' || v === 'hajj') { html = vNusuk(); tab = 'more'; }
    else if (v === 'more') { html = vMore(); tab = 'more'; }
    else if (v === 'sources') { html = vSources(); tab = 'more'; }
    else html = vHome();
    app.innerHTML = html;
    document.body.setAttribute('data-view', v || 'home');
    renderTabs(tab);
    keepAwake(v === 'tawaf' || v === 'sai' || S.flight.on);
    var q = document.getElementById('dsearch');
    if (q && q.value) runSearch(q.value);
  }
  function rerender() { var y = window.scrollY; render(); window.scrollTo(0, y); }

  /* ------------------------------------------------------------ device helpers */
  /* browsers refuse to vibrate before the first tap, so wait for it */
  function buzz(p) {
    try {
      var ua = navigator.userActivation;
      if (navigator.vibrate && (!ua || ua.hasBeenActive)) navigator.vibrate(p);
    } catch (e) { /* not supported */ }
  }
  function keepAwake(on) {
    if (!('wakeLock' in navigator)) return;
    if (on && !wakeLock) {
      navigator.wakeLock.request('screen').then(function (l) {
        wakeLock = l;
        l.addEventListener('release', function () { wakeLock = null; });
      }).catch(function () { /* denied */ });
    } else if (!on && wakeLock) {
      wakeLock.release().catch(function () { /* already released */ });
      wakeLock = null;
    }
  }
  var toastTimer;
  function toast(s) {
    var el = document.getElementById('toast');
    el.textContent = s;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1800);
  }
  function showBanner(s) {
    var b = document.getElementById('banner');
    b.innerHTML = '<p>' + esc(s) + '</p><button type="button" data-close aria-label="' + esc(t('close')) + '">' + icon('check') + '</button>';
    b.hidden = false;
  }
  function textOf(id) {
    if (id.indexOf('r:') === 0) {
      var d = RD[id.slice(2)];
      if (!d) return '';
      var s = d.ar + (d.ref ? ' (' + tx(d.ref) + ')' : '');
      return S.lang === 'en' ? s + '\n\n' + d.en : s;
    }
    if (id.indexOf('m:') === 0) {
      var m = S.mine.filter(function (x) { return 'm:' + x.id === id; })[0];
      return m ? m.t : '';
    }
    var b = DMAP[id];
    return b ? b.ar + (b.ref ? ' (' + tx(b.ref) + ')' : '') : '';
  }
  function copyText(s) {
    function ok() { toast(t('copied')); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = s; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); ok(); } catch (e) { /* no clipboard */ }
      ta.remove();
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(s).then(ok, fallback);
    else fallback();
  }
  function shareText(s) {
    if (navigator.share) navigator.share({ text: s }).catch(function () { /* cancelled */ });
    else copyText(s);
  }

  /* ------------------------------------------------------------ flight alert */
  function startTicker() { stopTicker(); flightTimer = setInterval(tick, 20000); tick(); }
  function stopTicker() { if (flightTimer) clearInterval(flightTimer); flightTimer = null; }
  function tick() {
    if (!S.flight.on || !S.flight.arrival) return;
    var ph = L.flight(S.flight.arrival, Date.now(), flightRoute());
    var box = document.getElementById('fstatus');
    if (box) box.innerHTML = flightStatusHtml();
    if (ph.phase !== lastPhase) {
      if (ph.phase === 'prepare') { showBanner(t('flight_now_prepare')); buzz([200, 120, 200]); }
      if (ph.phase === 'intent') { showBanner(intentWords()); buzz([300, 150, 300, 150, 300]); }
      lastPhase = ph.phase;
    }
    if (ph.phase === 'past') { S.flight.on = false; save(); stopTicker(); keepAwake(false); }
  }
  function startFlight() {
    var inp = document.getElementById('farr');
    var v = inp ? inp.value : '';
    var arr = L.arrivalFrom(v, Date.now());
    if (!arr) { toast(t('flight_bad_time')); return; }
    S.flight.time = v; S.flight.arrival = arr; S.flight.on = true;
    save();
    lastPhase = L.flight(arr, Date.now(), flightRoute()).phase;
    startTicker();
    rerender();
  }

  /* ------------------------------------------------------------ events */
  function toggleFav(id) {
    var i = S.favs.indexOf(id);
    if (i >= 0) S.favs.splice(i, 1); else S.favs.push(id);
    save();
  }
  app.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'INPUT') return;
    var act = el.getAttribute('data-act'), id = el.getAttribute('data-id'), k = el.getAttribute('data-k'), v = el.getAttribute('data-v');
    var TW = S.tw[twk], SW = S.sw[swk];
    switch (act) {
      case 'mode': setMode(v); rerender(); break;
      case 'nusk': if (NUSK.indexOf(v) >= 0) { S.nusk = v; save(); rerender(); } break;
      case 'done':
        S.done[id] = !S.done[id]; save();
        if (S.done[id]) {
          var f = stationById(id), nx = f && f.list[f.i + 1];
          if (nx) { location.hash = '#/s/' + nx.id; return; }
        }
        rerender(); break;
      case 'reset-journey':
        if (confirm(t('confirm_reset'))) { jList(v).forEach(function (s) { delete S.done[s.id]; }); save(); rerender(); } break;
      case 't-lap':
        if (!TW.startedAt) TW.startedAt = Date.now();
        TW.laps = Math.min(7, TW.laps + 1); TW.doubt = false;
        if (TW.laps === 7 && twk === 'umrah') S.done.tawaf = true;
        if (TW.laps === 7 && twk === 'wada') S.done['h-wada'] = true;
        buzz(35); save(); rerender(); break;
      case 't-undo': TW.laps = Math.max(0, TW.laps - 1); save(); rerender(); break;
      case 't-pause': TW.paused = true; save(); rerender(); break;
      case 't-resume': TW.paused = false; save(); rerender(); break;
      case 't-doubt': TW.doubt = !TW.doubt; save(); rerender(); break;
      case 't-set': TW.laps = +v; TW.doubt = false; save(); rerender(); break;
      case 't-restart':
        if (confirm(t('confirm_restart'))) { S.tw[twk] = newTw(); save(); rerender(); } break;
      case 's-leg':
        if (!SW.startedAt) SW.startedAt = Date.now();
        SW.legs = Math.min(7, SW.legs + 1); SW.dhikr = 0;
        if (SW.legs === 7 && swk === 'umrah') S.done.sai = true;
        buzz(35); save(); rerender(); break;
      case 's-dhikr': SW.dhikr = Math.min(3, (SW.dhikr || 0) + 1); save(); rerender(); break;
      case 's-undo': SW.legs = Math.max(0, SW.legs - 1); SW.dhikr = 0; save(); rerender(); break;
      case 's-pause': SW.paused = true; save(); rerender(); break;
      case 's-resume': SW.paused = false; save(); rerender(); break;
      case 's-restart':
        if (confirm(t('confirm_restart'))) { S.sw[swk] = newSw(); save(); rerender(); } break;
      case 'fav': toggleFav(id); rerender(); break;
      case 'copy': copyText(textOf(id)); break;
      case 'share': shareText(textOf(id)); break;
      case 'mine-del':
        S.mine = S.mine.filter(function (m) { return m.id !== id; }); save(); rerender(); break;
      case 'trust-toggle':
        S.trusts.forEach(function (x) { if (x.id === id) { x.done = !x.done; x.at = x.done ? Date.now() : null; } });
        save(); rerender(); break;
      case 'trust-del':
        S.trusts = S.trusts.filter(function (x) { return x.id !== id; }); save(); rerender(); break;
      case 'prep-del':
        S.custom[k] = (S.custom[k] || []).filter(function (c) { return c.id !== id; });
        if (S.prep[k]) delete S.prep[k]['c:' + id];
        save(); rerender(); break;
      case 'set':
        S[k] = v; save(); applyPrefs(); rerender(); break;
      case 'erase':
        if (confirm(t('confirm_erase'))) {
          var keep = { lang: S.lang, theme: S.theme, size: S.size };
          S = defaults(); S.lang = keep.lang; S.theme = keep.theme; S.size = keep.size;
          save(); stopTicker(); rerender();
        } break;
      case 'flight-start': startFlight(); break;
      case 'flight-stop': S.flight.on = false; save(); stopTicker(); rerender(); break;
    }
  });
  app.addEventListener('change', function (e) {
    var el = e.target, act = el.getAttribute('data-act');
    if (act === 'prep') {
      var k = el.getAttribute('data-k'), id = el.getAttribute('data-id');
      S.prep[k] = S.prep[k] || {};
      if (el.checked) S.prep[k][id] = true; else delete S.prep[k][id];
      save(); rerender();
    } else if (act === 'route') {
      S.flight.route = el.value; save(); rerender();
    }
  });
  app.addEventListener('submit', function (e) {
    var f = e.target, kind = f.getAttribute('data-form');
    if (!kind) return;
    e.preventDefault();
    var fd = new FormData(f);
    if (kind === 'trust') {
      var name = String(fd.get('name') || '').trim();
      if (!name) return;
      S.trusts.push({ id: uid(), name: name, req: String(fd.get('req') || '').trim(), done: false });
    } else if (kind === 'mine') {
      var txt = String(fd.get('t') || '').trim();
      if (!txt) return;
      S.mine.push({ id: uid(), t: txt });
    } else if (kind === 'prep') {
      var k = f.getAttribute('data-k'), v = String(fd.get('t') || '').trim();
      if (!v) return;
      S.custom[k] = S.custom[k] || [];
      S.custom[k].push({ id: uid(), t: v });
    }
    save(); rerender();
  });
  app.addEventListener('input', function (e) { if (e.target.id === 'dsearch') runSearch(e.target.value); });
  document.getElementById('banner').addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) document.getElementById('banner').hidden = true;
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      var v = parse().parts[0];
      wakeLock = null;
      keepAwake(v === 'tawaf' || v === 'sai' || S.flight.on);
      if (S.flight.on) tick();
    }
  });

  function applyPrefs() {
    var d = document.documentElement;
    d.lang = S.lang;
    d.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
    if (S.theme === 'auto') d.removeAttribute('data-theme'); else d.setAttribute('data-theme', S.theme);
    d.style.setProperty('--dua-size', { s: '21px', m: '25px', l: '30px' }[S.size] || '25px');
    document.title = t('app_name');
  }

  /* ------------------------------------------------------------ start */
  Promise.all(['../data/rite.json', '../data/duas.json', '../data/i18n.json'].map(function (u) {
    return fetch(u).then(function (r) { if (!r.ok) throw new Error(u); return r.json(); });
  })).then(function (res) {
    RITE = res[0]; BOOK = res[1]; I18N = res[2];
    RITE.duas.forEach(function (d) { RD[d.id] = d; });
    BOOK.sections.forEach(function (s) { s.duas.forEach(function (d) { d.sec = s; DMAP[d.id] = d; }); });
    applyPrefs();
    render();
    if (S.flight.on) startTicker();
    window.addEventListener('hashchange', render);
  }).catch(function () {
    app.innerHTML = '<main class="wrap"><p class="lead">تعذّر تحميل المحتوى، فأعد فتح الصفحة.</p><p class="lead" dir="ltr">The content could not load. Please reopen the page.</p></main>';
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('../sw.js').catch(function () { /* offline cache unavailable */ }); });
  }
})();
