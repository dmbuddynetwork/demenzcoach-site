// Progressive enhancement for /de/app/: the page works fully without this script.
(function () {
  // 1. Carry a legitimate incoming utm_source into the outgoing App Store campaign token
  //    (e.g. web_de_landing_hero_tiktok). No user data, nothing stored, nothing sent elsewhere.
  try {
    var params = new URLSearchParams(window.location.search);
    var source = (params.get('utm_source') || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 10);
    if (source) {
      document.querySelectorAll('a[data-store-link]').forEach(function (link) {
        var url = new URL(link.href);
        var token = url.searchParams.get('ct') || '';
        if (!token) return;
        url.searchParams.set('ct', (token + '_' + source).slice(0, 30));
        link.href = url.toString();
      });
    }
  } catch (error) {
    // The static campaign tokens remain valid.
  }

  // 2. Sticky download bar (only with JS): hidden while a full-size download button or the footer is on screen.
  var sticky = document.getElementById('dl-sticky');
  var anchors = [document.getElementById('dl-hero-cta'), document.getElementById('dl-final-cta'), document.querySelector('.dl-footer')].filter(Boolean);
  if (!sticky || !anchors.length || !('IntersectionObserver' in window)) return;
  document.body.classList.add('dl-sticky-ready');
  var visible = new Set();
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) visible.add(entry.target);
      else visible.delete(entry.target);
    });
    var off = visible.size > 0;
    sticky.classList.toggle('dl-sticky-off', off);
    sticky.setAttribute('aria-hidden', off ? 'true' : 'false');
  }, { threshold: 0 });
  anchors.forEach(function (anchor) { observer.observe(anchor); });
})();
