/* Scroll-triggered lead-magnet slide-in.
   Shows a topic-matched kit offer once a visitor scrolls ~55% down a page.
   Self-suppresses on pages that already have an inline #get-the-kit form,
   on Contact and the State of Team Building report, and for 30 days after
   a visitor dismisses or clicks it. */
(function () {
  var KEY = 'bt_lm_dismissed';
  try {
    var d = localStorage.getItem(KEY);
    if (d && (Date.now() - parseInt(d, 10) < 30 * 864e5)) return; // dismissed < 30 days ago
  } catch (e) {}

  if (document.getElementById('get-the-kit')) return;         // inline form already on page
  var path = location.pathname;
  if (/\/(contact|thank-you|privacy|terms|state-of-team-building)\/?$/.test(path)) return;

  var KITS = {
    exec:    { k: 'Free self-assessment', t: 'Leadership Team Health Check', p: 'Where does your leadership team really stand? A 5-minute read.', href: '/executive-team-building/#get-the-kit' },
    prog:    { k: 'Free download', t: 'The 30-Day Make-It-Stick Plan', p: 'Turn one team event into lasting change.', href: '/programs/#get-the-kit' },
    retreat: { k: 'Free download', t: 'The Complete Corporate Retreat Kit', p: 'Everything you need to run a leadership offsite.', href: '/resources/corporate-retreat-ideas/#get-the-kit' },
    event:   { k: 'Free download', t: 'The Event Planning Kit', p: 'Get your team event approved and off the ground.', href: '/corporate-team-building-events/#get-the-kit' }
  };
  var kit = /execut|team-lfs|leadership|coaching/.test(path) ? KITS.exec
          : /program|measur|make-it-stick|tuckman/.test(path) ? KITS.prog
          : /retreat|offsite/.test(path) ? KITS.retreat
          : KITS.event;

  var shown = false;
  function persist() { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {} }

  function build() {
    if (shown) return; shown = true;
    var el = document.createElement('div');
    el.className = 'lm-slide';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Free resource');
    el.innerHTML =
      '<button class="lm-slide-x" aria-label="Dismiss">\u00d7</button>' +
      '<div class="k"></div><div class="t"></div><p></p>' +
      '<a class="btn" href="' + kit.href + '">Get it free \u2192</a>';
    el.querySelector('.k').textContent = kit.k;
    el.querySelector('.t').textContent = kit.t;
    el.querySelector('p').textContent = kit.p;
    document.body.appendChild(el);
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('in'); }); });
    if (typeof gtag === 'function') gtag('event', 'lead_magnet_promo_view', { promo: kit.t, page_path: path });

    function close(p) {
      el.classList.remove('in');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 350);
      if (p) persist();
      document.removeEventListener('keydown', onKey);
    }
    function onKey(ev) { if (ev.key === 'Escape') close(true); }
    el.querySelector('.lm-slide-x').addEventListener('click', function () { close(true); });
    el.querySelector('.btn').addEventListener('click', function () {
      if (typeof gtag === 'function') gtag('event', 'select_promotion', { promo: kit.t, page_path: path });
      persist();
    });
    document.addEventListener('keydown', onKey);
  }

  function onScroll() {
    var st = window.pageYOffset || document.documentElement.scrollTop;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    if (h > 0 && (st / h) > 0.55) { build(); window.removeEventListener('scroll', onScroll); }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  // Short pages that never reach 55% scroll: show after a delay.
  setTimeout(function () {
    if (!shown && document.documentElement.scrollHeight <= window.innerHeight * 1.3) build();
  }, 30000);
})();
