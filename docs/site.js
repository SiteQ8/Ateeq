/* Language toggle for the site, and the offline cache. */
(function () {
  var KEY = 'ateeq.site.lang', d = document.documentElement;
  var TITLES = { ar: d.getAttribute('data-title-ar') || document.title, en: d.getAttribute('data-title-en') || 'Ateeq, Umrah step by step' };
  function set(l) {
    d.setAttribute('data-lang', l); d.lang = l; d.dir = l === 'ar' ? 'rtl' : 'ltr';
    document.title = TITLES[l];
    try { localStorage.setItem(KEY, l); } catch (e) { /* private mode */ }
  }
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* private mode */ }
  var q = new URLSearchParams(location.search).get('lang');
  set(q === 'ar' || q === 'en' ? q : saved || (String(navigator.language || 'ar').toLowerCase().indexOf('ar') === 0 ? 'ar' : 'en'));
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-lang-toggle]')) set(d.getAttribute('data-lang') === 'ar' ? 'en' : 'ar');
  });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(function () { /* offline cache unavailable */ });
  }
})();
