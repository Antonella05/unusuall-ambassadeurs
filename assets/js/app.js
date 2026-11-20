/* UNUSUALL Ambassadeurs — thème, horloge, dock, apparitions, simulateur, formulaire */
(function () {
  'use strict';

  var html = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var fmt = function (n) { return Math.round(n).toLocaleString('fr-FR').replace(/\s/g, ' '); };

  /* Thème : même clé que unusuall.online */
  var toggle = $('#theme-toggle');
  if (toggle) toggle.addEventListener('click', function () {
    var next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    try { localStorage.setItem('unusuall-theme', next); } catch (e) {}
  });

  /* Horloge de la barre du haut */
  var clock = $('#sys-time');
  if (clock) {
    var tick = function () { var d = new Date(); clock.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ' WAT'; };
    tick(); setInterval(tick, 30000);
  }

  /* Page active dans le dock */
  var here = location.pathname.split('/').pop() || 'index.html';
  $$('[data-page]').forEach(function (a) {
    var on = (a.getAttribute('data-page') || '').split(/\s+/).indexOf(here) !== -1;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page');
  });

  /* Apparitions au défilement et chiffres qui défilent */
  function countUp(el) {
    var to = parseInt(el.getAttribute('data-to'), 10);
    if (!to) return;
    var t0 = null;
    el.textContent = '0';
    requestAnimationFrame(function step(now) {
      if (t0 === null) t0 = now;
      var p = Math.min((now - t0) / 1100, 1);
      el.textContent = fmt(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    });
  }
  var targets = $$('[data-ep-reveal], [data-ep-stagger]');
  $$('[data-ep-stagger]').forEach(function (list) {
    Array.prototype.forEach.call(list.children, function (c, i) { c.style.setProperty('--i', i); });
  });
  if (reduce || !('IntersectionObserver' in window)) {
    targets.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    html.classList.add('ep-fx');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        $$('.ep-count', e.target).forEach(countUp);
        io.unobserve(e.target);
      });
    }, { threshold: 0.04, rootMargin: '0px 0px -24px 0px' });
    targets.forEach(function (el) { io.observe(el); });
  }

  /* Simulateur Epicure : 1re année = 30 % du 1er mois + 10 % du 3e au 12e (2e mois offert) ;
     années suivantes = 30 % du mois anniversaire + 10 % des 11 autres mois */
  var PLANS = { 's-standard': 27900, 's-premium': 45900, 's-ultra': 79900 };
  function simulate() {
    var sign = 0, month = 0;
    Object.keys(PLANS).forEach(function (id) {
      var n = Math.max(0, Math.min(200, parseInt(document.getElementById(id).value, 10) || 0));
      sign += n * PLANS[id] * 0.3;
      month += n * PLANS[id] * 0.1;
    });
    $('#r-sign').textContent = fmt(sign);
    $('#r-month').textContent = fmt(month);
    $('#r-year').textContent = fmt(sign + month * 10);
    if ($('#r-next')) $('#r-next').textContent = fmt(sign + month * 11);
  }
  if ($('#r-sign')) {
    $$('.amb-stepper button').forEach(function (b) {
      b.addEventListener('click', function () {
        var input = document.getElementById(b.getAttribute('data-for'));
        input.value = Math.max(0, Math.min(200, (parseInt(input.value, 10) || 0) + parseInt(b.getAttribute('data-step'), 10)));
        simulate();
      });
    });
    $$('.amb-stepper input').forEach(function (i) { i.addEventListener('input', simulate); });
    simulate();
  }

  /* Formulaire de candidature */
  var form = $('#form');
  if (form) {
    var err = $('#form-error'), ok = $('#form-ok');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.querySelector('[name="_gotcha"]').value) return;
      var bad = $$('[required]', form).filter(function (f) {
        var invalid = f.type === 'checkbox' ? !f.checked : !f.value.trim() || (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value));
        f.setAttribute('aria-invalid', invalid ? 'true' : 'false');
        return invalid;
      });
      if (bad.length) {
        err.textContent = 'Merci de remplir tous les champs obligatoires avec une adresse e-mail valide.';
        err.hidden = false;
        bad[0].focus();
        return;
      }
      err.hidden = true;
      var btn = form.querySelector('button[type="submit"]'), label = btn.textContent;
      btn.disabled = true; btn.textContent = 'Envoi en cours…';
      fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (r) {
          if (!r.ok) throw new Error();
          $$('.form-group, .amb-agree, button[type="submit"]', form).forEach(function (el) { el.hidden = true; });
          ok.hidden = false; ok.setAttribute('tabindex', '-1'); ok.focus();
        })
        .catch(function () {
          err.textContent = "L'envoi n'a pas abouti. Vérifiez votre connexion et réessayez, ou écrivez-nous à services@unusuall.online.";
          err.hidden = false;
        })
        .finally(function () { btn.disabled = false; btn.textContent = label; });
    });
  }
})();

/* ============================================
   UNUSUALL — brand-word.js (repris de unusuall.online, à garder identique)
   Applique l'effet dégradé animé (.brand-gradient) sur chaque mot
   « UNUSUALL » affiché dans le texte du site, sans exception :
   textes traduits, panneau musique, pied de page, contenus ajoutés
   plus tard par un script ou après un changement de page / de langue.
   Les éléments qui ont déjà leur propre effet de marque sont ignorés.
   ============================================ */

(function() {
  'use strict';

  var WORD = /unusuall/i;
  var WORD_ALL = /unusuall/gi;

  var SKIP_TAGS = {
    SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, TITLE: 1,
    OPTION: 1, SELECT: 1, INPUT: 1, IFRAME: 1, SVG: 1
  };

  // Déjà animés par leur propre style, ou à ne jamais toucher
  var SKIP_SELECTOR = '.brand-gradient, .accent-text, .flame-text, .logo, .logo-inline, .loader, [data-no-brand]';

  var pending = [];
  var scheduled = false;
  var observer = null;

  function isSkipped(textNode) {
    var parent = textNode.parentElement;
    if (!parent) return true;
    if (SKIP_TAGS[parent.tagName.toUpperCase()]) return true;
    return !!parent.closest(SKIP_SELECTOR);
  }

  function wrapTextNode(textNode) {
    var text = textNode.nodeValue;
    if (!WORD.test(text) || isSkipped(textNode)) return;

    var fragment = document.createDocumentFragment();
    var last = 0;
    var match;

    WORD_ALL.lastIndex = 0;
    while ((match = WORD_ALL.exec(text)) !== null) {
      if (match.index > last) {
        fragment.appendChild(document.createTextNode(text.slice(last, match.index)));
      }
      var span = document.createElement('span');
      span.className = 'brand-gradient';
      span.textContent = match[0];
      fragment.appendChild(span);
      last = match.index + match[0].length;
    }

    if (last < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(last)));
    }

    textNode.parentNode.replaceChild(fragment, textNode);
  }

  function process(root) {
    if (!root || !root.isConnected) return;

    if (root.nodeType === 3) {
      wrapTextNode(root);
      return;
    }

    if (root.nodeType !== 1) return;

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    var node;
    while ((node = walker.nextNode())) {
      if (WORD.test(node.nodeValue)) nodes.push(node);
    }
    nodes.forEach(wrapTextNode);
  }

  function observe() {
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function flush() {
    scheduled = false;
    var batch = pending;
    pending = [];

    // On se déconnecte pendant nos propres modifications pour ne pas boucler
    observer.disconnect();
    batch.forEach(process);
    observe();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    if (window.requestAnimationFrame) window.requestAnimationFrame(flush);
    else setTimeout(flush, 16);
  }

  function init() {
    if (!document.body) return;

    process(document.body);

    observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        if (m.type === 'characterData') {
          pending.push(m.target);
        } else {
          m.addedNodes.forEach(function(n) { pending.push(n); });
        }
      });
      schedule();
    });

    observe();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* ============================================
   UNUSUALL — Titre d'onglet animé (repris de unusuall.online, à garder identique)
   Effet « machine à écrire » avec curseur « _ » (comme le titre de l'accueil) :
   « We build UNUSUALL » s'écrit, marque une pause, s'efface, puis le nom de la
   page s'écrit à son tour. Le texte reste aligné à gauche : aucune secousse,
   contrairement à un défilement lettre par lettre.
   Le favicon reste le symbole de marque.
   ============================================ */

(function() {
  'use strict';

  var BRAND = 'We build UNUSUALL';
  var SHOW_PAGE_NAME = true;   // alterne avec le nom de la page (passer à false pour garder seulement BRAND)
  var CURSOR = '_';

  var TYPE_MS = 95;     // vitesse d'écriture, par lettre
  var ERASE_MS = 40;    // vitesse d'effacement, par lettre
  var BLINK_MS = 520;   // clignotement du curseur pendant la pause
  var HOLD_BLINKS = 5;  // durée de la pause (en clignotements)

  // Les robots des moteurs de recherche doivent lire le vrai titre de la page :
  // on ne touche jamais au titre pour eux.
  if (/bot|crawl|spider|slurp|bingpreview|lighthouse|headless|facebookexternalhit|linkedin|embedly|preview/i.test(navigator.userAgent || '')) return;

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var pageName = '';
  var phrases = [BRAND];
  var phraseIndex = 0;
  var length = 1;
  var state = 'typing';
  var holdLeft = 0;
  var cursorOn = true;
  var timer = null;
  var running = false;
  var lastWritten = '';

  function normalize(text) {
    return String(text).replace(/\s+/g, ' ').trim();
  }

  function write(text) {
    lastWritten = text;
    document.title = text;
  }

  // Nom court de la page : la première partie du titre (« Epicure · Logiciel… · UNUSUALL » → « Epicure »)
  function shortName(title) {
    var name = normalize(title).replace(/\s*[·|–]\s*unusuall\s*$/i, '').split(/\s+[·|–]\s+/)[0];
    return name || normalize(title);
  }

  function refreshPhrases() {
    phrases = [BRAND];
    if (SHOW_PAGE_NAME && pageName && normalize(pageName).toLowerCase() !== BRAND.toLowerCase()) {
      phrases.push(pageName);
    }
    if (phraseIndex >= phrases.length) phraseIndex = 0;
  }

  function schedule(delay) {
    timer = window.setTimeout(tick, delay);
  }

  function tick() {
    if (!running) return;

    var phrase = phrases[phraseIndex];
    write(phrase.slice(0, length) + (cursorOn ? CURSOR : ' '));

    if (state === 'typing') {
      cursorOn = true;
      if (length < phrase.length) {
        length++;
        schedule(TYPE_MS);
      } else {
        state = 'hold';
        holdLeft = HOLD_BLINKS;
        schedule(BLINK_MS);
      }
      return;
    }

    if (state === 'hold') {
      cursorOn = !cursorOn;
      holdLeft--;
      if (holdLeft <= 0) {
        state = 'erasing';
        cursorOn = true;
        schedule(ERASE_MS);
      } else {
        schedule(BLINK_MS);
      }
      return;
    }

    // Effacement : on garde toujours une lettre pour ne jamais afficher un titre vide
    cursorOn = true;
    if (length > 1) {
      length--;
      schedule(ERASE_MS);
    } else {
      phraseIndex = (phraseIndex + 1) % phrases.length;
      state = 'typing';
      length = 1;
      schedule(TYPE_MS * 2);
    }
  }

  function start() {
    if (running || reducedMotion) return;
    running = true;
    state = 'typing';
    length = 1;
    cursorOn = true;
    schedule(0);
  }

  function stop() {
    running = false;
    if (timer) {
      window.clearTimeout(timer);
      timer = null;
    }
  }

  // Titre propre (jamais à moitié écrit) quand l'animation est arrêtée
  function settle() {
    write(BRAND);
  }

  // Si la page change sans rechargement, son script met à jour le titre : on le détecte
  function watchTitle() {
    var titleEl = document.querySelector('title');
    if (!titleEl || !window.MutationObserver) return;

    new MutationObserver(function() {
      if (normalize(document.title) === normalize(lastWritten)) return;
      pageName = shortName(document.title);
      refreshPhrases();
      phraseIndex = 0;
      if (running) {
        stop();
        running = false;
        start();
      } else {
        settle();
      }
    }).observe(titleEl, { childList: true, characterData: true, subtree: true });
  }

  function boot() {
    pageName = shortName(document.title);
    refreshPhrases();
    watchTitle();

    if (reducedMotion || document.hidden) {
      settle();
      return;
    }
    start();
  }

  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      stop();
      settle();
    } else if (!reducedMotion) {
      start();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(boot, 40); });
  } else {
    setTimeout(boot, 40);
  }

  window.UnusuallTabMarquee = { start: start, stop: stop };
})();

/* ============================================
   UNUSUALL — Lecteur Audiomack (barre du haut) (repris de unusuall.online, à garder identique)
   Le lecteur tiers ne se charge qu'au clic du visiteur.
   Le panneau vit hors de .app-main : la musique continue
   quand on change de page sans rechargement complet.
   ============================================ */

(function() {
  'use strict';

  // Playlist Audiomack « TikTok Viral Afrobeats Hits » (70 titres, par Tukie).
  // Pour changer de playlist, modifier l'adresse d'intégration :
  //   https://audiomack.com/embed/playlist/<utilisateur>/<identifiant>
  // Autres idées : michael/229 (sons du Bénin), michael/225 (Côte d'Ivoire), michael/228 (Togo),
  // michael/237 (Cameroun), michael/221 (Sénégal).
  var PLAYLIST_NAME = 'Afrobeats';
  var EMBED_URL = 'https://audiomack.com/embed/playlist/tukiemusik/dbee';

  var button;
  var panel;
  var loaded = false;

  function lang() {
    return document.documentElement.getAttribute('lang') === 'en' ? 'en' : 'fr';
  }

  function t(fr, en) {
    return lang() === 'en' ? en : fr;
  }

  function bilingual(tag, className, fr, en) {
    var el = document.createElement(tag);
    el.className = className;
    el.setAttribute('data-fr', fr);
    el.setAttribute('data-en', en);
    el.textContent = t(fr, en);
    return el;
  }

  function buildButton() {
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'sys-bar__btn music-btn';
    el.setAttribute('aria-expanded', 'false');
    el.setAttribute('aria-controls', 'music-panel');
    el.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>';
    return el;
  }

  function buildPanel() {
    var el = document.createElement('div');
    el.id = 'music-panel';
    el.className = 'music-panel';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-hidden', 'true');

    var head = document.createElement('div');
    head.className = 'music-panel__head';
    head.appendChild(bilingual('p', 'music-panel__label', 'Musique', 'Music'));

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'music-panel__close';
    close.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
    close.addEventListener('click', closePanel);
    head.appendChild(close);
    el.appendChild(head);

    el.appendChild(bilingual('p', 'music-panel__text',
      'UNUSUALL vous propose les sons afrobeats les plus écoutés pendant que vous découvrez notre site. Cliquez pour charger la musique, et coupez-la quand vous voulez.',
      'UNUSUALL brings you the most-played afrobeats sounds while you explore our site. Click to load the music, and stop it whenever you like.'));

    var player = document.createElement('div');
    player.className = 'music-panel__player';
    el.appendChild(player);

    var load = bilingual('button', 'btn btn--primary music-panel__load', 'Charger la musique', 'Load the music');
    load.type = 'button';
    load.addEventListener('click', loadPlayer);
    el.appendChild(load);

    el.appendChild(bilingual('p', 'music-panel__note',
      'Le lecteur Audiomack ne se charge qu’après votre clic, et peut alors déposer des cookies et afficher des publicités.',
      'The Audiomack player only loads after you click, and may then set cookies and show ads.'));

    return el;
  }

  function loadPlayer() {
    if (loaded) return;
    loaded = true;

    var frame = document.createElement('iframe');
    frame.src = EMBED_URL;
    frame.title = 'Audiomack – ' + PLAYLIST_NAME;
    frame.height = '352';
    frame.setAttribute('frameborder', '0');
    frame.setAttribute('scrolling', 'no');
    frame.setAttribute('allow', 'autoplay; encrypted-media');
    frame.setAttribute('loading', 'lazy');

    panel.querySelector('.music-panel__player').appendChild(frame);
    panel.querySelector('.music-panel__load').hidden = true;
    panel.classList.add('is-loaded');
    button.classList.add('is-loaded');
  }

  function openPanel() {
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    button.setAttribute('aria-expanded', 'true');
    var first = panel.querySelector('.music-panel__load:not([hidden])') || panel.querySelector('.music-panel__close');
    if (first) first.focus({ preventScroll: true });
  }

  function closePanel() {
    if (!panel.classList.contains('is-open')) return;
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    button.setAttribute('aria-expanded', 'false');
    button.focus({ preventScroll: true });
  }

  function togglePanel() {
    if (panel.classList.contains('is-open')) closePanel();
    else openPanel();
  }

  function refreshLabels() {
    var label = t('Musique', 'Music');
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    panel.setAttribute('aria-label', label);
    panel.querySelector('.music-panel__close').setAttribute('aria-label', t('Fermer', 'Close'));
  }

  function init() {
    var actions = document.querySelector('.sys-bar__actions');
    if (!actions || document.getElementById('music-panel')) return;

    button = buildButton();
    panel = buildPanel();

    var themeToggle = document.getElementById('theme-toggle');
    actions.insertBefore(button, themeToggle || null);
    document.body.appendChild(panel);

    button.addEventListener('click', function(e) {
      e.stopPropagation();
      togglePanel();
    });

    document.addEventListener('click', function(e) {
      if (!panel.classList.contains('is-open')) return;
      if (panel.contains(e.target) || button.contains(e.target)) return;
      closePanel();
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closePanel();
    });

    refreshLabels();
    new MutationObserver(refreshLabels).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* ============================================
   UNUSUALL — Notification « Site officiel » (plateforme ambassadeurs)
   Pendant de la notification « Programme Ambassadeurs » de unusuall.online
   (même composant, mêmes règles) : présente le site principal et ses
   logiciels, et y renvoie (nouvel onglet).
   - Apparaît après DELAY_MS sur le site, ou dès 35 % de défilement,
     jamais pendant l'intro.
   - Revient toutes les INTERVAL_MIN minutes : après une apparition ou une
     fermeture (« Plus tard », ✕, Échap), même si le visiteur reste sur le site
     ou recharge la page.
   - Clic sur « Visiter unusuall.online » : plus rien pendant CLICKED_DAYS jours.
   - Absente des pages de compte (connexion, espace, admin) et de la page 404.
   - Vit hors de .app-main : elle reste en place quand on change de page.
   ============================================ */

(function() {
  'use strict';

  var URL = 'https://unusuall.online/';
  var DELAY_MS = 7000;
  var INTERVAL_MIN = 15;
  var CLICKED_DAYS = 60;
  var INTERVAL_MS = INTERVAL_MIN * 60000;
  var KEY = 'unusuall-site-promo';          // localStorage : date jusqu'à laquelle on n'affiche plus
  var SKIP_PAGES = /(connexion|espace|admin|404)(\.html)?$/i;

  // Les logiciels UNUSUALL qui défilent dans la carte
  var FEED = [
    { fr: 'Epicure · Restaurants', en: 'Epicure · Restaurants', amount: 'Disponible' },
    { fr: 'Suite SOFIA · Santé', en: 'Suite SOFIA · Healthcare', amount: 'Bientôt' },
    { fr: 'OMI · Données mobiles', en: 'OMI · Mobile data', amount: 'Bêta' },
    { fr: 'Studio · Sur mesure', en: 'Studio · Custom', amount: 'Ouvert' }
  ];

  var card, feedIndex = 0, feedTimer = null, showTimer = null, shown = false;

  function store(get, value) {
    try {
      if (get) return localStorage.getItem(KEY);
      localStorage.setItem(KEY, value);
    } catch (e) { return null; }
  }
  // Temps restant (ms) avant de pouvoir réafficher la carte ; 0 si elle peut s'afficher
  function remaining() {
    var until = Number(store(true));
    return until && until > Date.now() ? until - Date.now() : 0;
  }
  function snooze(ms) {
    // Ne raccourcit jamais une pause plus longue (60 jours après un clic)
    if (remaining() > ms) return;
    store(false, String(Date.now() + ms));
  }
  // Prochaine apparition, si elle tombe dans l'intervalle (pas après un clic)
  function scheduleNext(ms) {
    clearTimeout(showTimer);
    if (ms <= INTERVAL_MS) showTimer = setTimeout(show, ms + 500);
  }

  function lang() { return document.documentElement.getAttribute('lang') === 'en' ? 'en' : 'fr'; }

  // Élément bilingue : i18n.js le retraduit tout seul au changement de langue
  function el(tag, cls, fr, en) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (fr != null) {
      node.setAttribute('data-fr', fr);
      node.setAttribute('data-en', en);
      node.textContent = lang() === 'en' ? en : fr;
    }
    return node;
  }

  function build() {
    card = document.createElement('aside');
    card.className = 'amb-promo';
    card.setAttribute('aria-label', 'Le site officiel UNUSUALL');
    card.setAttribute('data-no-brand', '');

    var head = document.createElement('div');
    head.className = 'amb-promo__head';
    var tag = el('p', 'amb-promo__tag', 'UNUSUALL · Le site officiel', 'UNUSUALL · Official website');
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'amb-promo__close';
    close.setAttribute('aria-label', lang() === 'en' ? 'Close' : 'Fermer');
    close.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
    head.appendChild(tag);
    head.appendChild(close);

    var title = el('p', 'amb-promo__title', 'Découvrez ce que vous allez représenter.', 'Discover what you will represent.');
    var text = el('p', 'amb-promo__text',
      'Epicure, les suites et le Studio : fonctionnalités, tarifs et démonstrations sur unusuall.online. Le meilleur moyen de bien les présenter.',
      'Epicure, the suites and the Studio: features, pricing and demos on unusuall.online. The best way to present them well.');

    var feed = document.createElement('div');
    feed.className = 'amb-promo__feed';
    feed.setAttribute('aria-hidden', 'true');
    feed.innerHTML = '<span class="amb-promo__dot"></span><span class="amb-promo__label"></span><b class="amb-promo__amount"></b>';

    var actions = document.createElement('div');
    actions.className = 'amb-promo__actions';
    var cta = el('a', 'btn amb-promo__cta', 'Visiter unusuall.online ↗', 'Visit unusuall.online ↗');
    cta.href = URL;
    cta.target = '_blank';
    cta.rel = 'noopener';
    var later = el('button', 'amb-promo__later', 'Plus tard', 'Later');
    later.type = 'button';
    actions.appendChild(cta);
    actions.appendChild(later);

    card.appendChild(head);
    card.appendChild(title);
    card.appendChild(text);
    card.appendChild(feed);
    card.appendChild(actions);
    document.body.appendChild(card);

    close.addEventListener('click', function() { hide(INTERVAL_MS); });
    later.addEventListener('click', function() { hide(INTERVAL_MS); });
    cta.addEventListener('click', function() { hide(CLICKED_DAYS * 86400000); });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && shown) hide(INTERVAL_MS);
    });
  }

  function renderFeed() {
    var item = FEED[feedIndex % FEED.length];
    var feed = card.querySelector('.amb-promo__feed');
    feed.classList.remove('is-tick');
    void feed.offsetWidth;
    card.querySelector('.amb-promo__label').textContent = lang() === 'en' ? item.en : item.fr;
    card.querySelector('.amb-promo__amount').textContent = item.amount;
    feed.classList.add('is-tick');
    feedIndex++;
  }

  // Sur mobile, la carte se place juste au-dessus de la barre de navigation du bas
  function placeAboveDock() {
    var dock = document.querySelector('.mobile-dock');
    var h = dock && getComputedStyle(dock).display !== 'none' ? dock.offsetHeight : 0;
    card.style.setProperty('--amb-promo-bottom', (h + 12) + 'px');
  }

  function show() {
    if (shown) return;
    var wait = remaining();
    if (wait) { scheduleNext(wait); return; }
    if (document.getElementById('page-loader')) { showTimer = setTimeout(show, 800); return; }
    shown = true;
    // Un rechargement dans les 15 minutes ne la refait pas apparaître
    snooze(INTERVAL_MS);
    if (!card) build();
    placeAboveDock();
    renderFeed();
    requestAnimationFrame(function() { card.classList.add('is-open'); });
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      feedTimer = setInterval(renderFeed, 2600);
    }
  }

  function hide(ms) {
    if (!shown) return;
    shown = false;
    snooze(ms);
    clearInterval(feedTimer);
    card.classList.remove('is-open');
    scheduleNext(ms);
  }

  function onScroll() {
    var main = document.querySelector('.app-main');
    var scroller = main && main.scrollHeight > main.clientHeight + 4 ? main : document.documentElement;
    var max = scroller.scrollHeight - scroller.clientHeight;
    if (max > 0 && scroller.scrollTop / max > 0.35) {
      window.removeEventListener('scroll', onScroll, true);
      show();
    }
  }

  function init() {
    if (SKIP_PAGES.test(location.pathname)) return;
    var wait = remaining();
    if (wait) { scheduleNext(wait); return; }
    // Les robots et les aperçus de liens n'ont pas besoin de la notification
    if (/bot|crawl|spider|slurp|lighthouse|headless|preview/i.test(navigator.userAgent || '')) return;
    showTimer = setTimeout(show, DELAY_MS);
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', function() { if (card) placeAboveDock(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* ============================================
   UNUSUALL — Annonces (barre du haut)
   Bouton mégaphone à côté du bouton musique, avec une pastille tant
   qu'il reste une annonce non lue. Au clic, un panneau liste les annonces.
   - Pour ajouter une annonce : ajouter un objet EN TÊTE de ANNOUNCEMENTS,
     avec un « id » nouveau (la pastille réapparaît pour tout le monde).
   - « external: true » : le lien s'ouvre dans un nouvel onglet.
   - Copie du composant de unusuall.online (assets/js/announcements.js),
     avec les annonces de la plateforme : garder le reste du code identique.
   ============================================ */

(function() {
  'use strict';

  var ANNOUNCEMENTS = [
    {
      id: 'site-officiel-2026-11',
      tag: { fr: 'À découvrir', en: 'Discover' },
      title: { fr: 'Le site officiel UNUSUALL', en: 'The official UNUSUALL website' },
      text: {
        fr: 'Fonctionnalités, tarifs et démonstrations d’Epicure et de nos suites : tout pour bien présenter ce que vous représentez.',
        en: 'Features, pricing and demos of Epicure and our suites: everything to present what you represent.'
      },
      link: { href: 'https://unusuall.online/', fr: 'Visiter unusuall.online', en: 'Visit unusuall.online', external: true }
    }
  ];

  var SEEN_KEY = 'unusuall-amb-annonces-lues';
  var button, panel;

  function lang() { return document.documentElement.getAttribute('lang') === 'en' ? 'en' : 'fr'; }
  function t(o) { return o[lang()] || o.fr; }

  function seen() {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch (e) { return []; }
  }
  function unreadCount() {
    var s = seen();
    return ANNOUNCEMENTS.filter(function(a) { return s.indexOf(a.id) === -1; }).length;
  }
  function markAllSeen() {
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(ANNOUNCEMENTS.map(function(a) { return a.id; }))); } catch (e) {}
  }

  // Élément bilingue : i18n.js le retraduit tout seul au changement de langue
  function bi(tag, cls, o) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    el.setAttribute('data-fr', o.fr);
    el.setAttribute('data-en', o.en || o.fr);
    el.textContent = t(o);
    return el;
  }

  function buildButton() {
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'sys-bar__btn news-btn';
    el.setAttribute('aria-expanded', 'false');
    el.setAttribute('aria-controls', 'news-panel');
    el.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>' +
      '<span class="news-btn__dot" aria-hidden="true"></span>';
    return el;
  }

  function buildPanel() {
    var el = document.createElement('div');
    el.id = 'news-panel';
    el.className = 'news-panel';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-hidden', 'true');

    var head = document.createElement('div');
    head.className = 'news-panel__head';
    head.appendChild(bi('p', 'news-panel__label', { fr: 'Annonces', en: 'News' }));
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'news-panel__close';
    close.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
    close.addEventListener('click', closePanel);
    head.appendChild(close);
    el.appendChild(head);

    var list = document.createElement('ul');
    list.className = 'news-panel__list';
    var s = seen();
    ANNOUNCEMENTS.forEach(function(a) {
      var li = document.createElement('li');
      li.className = 'news-item' + (s.indexOf(a.id) === -1 ? ' is-new' : '');
      var top = document.createElement('div');
      top.className = 'news-item__top';
      top.appendChild(bi('span', 'news-item__tag', a.tag));
      li.appendChild(top);
      li.appendChild(bi('p', 'news-item__title', a.title));
      li.appendChild(bi('p', 'news-item__text', a.text));
      if (a.link) {
        var link = bi('a', 'news-item__link', { fr: a.link.fr + (a.link.external ? ' ↗' : ' →'), en: (a.link.en || a.link.fr) + (a.link.external ? ' ↗' : ' →') });
        link.href = a.link.href;
        if (a.link.external) { link.target = '_blank'; link.rel = 'noopener'; }
        link.addEventListener('click', function() { if (!a.link.external) closePanel(); });
        li.appendChild(link);
      }
      list.appendChild(li);
    });
    el.appendChild(list);
    return el;
  }

  function refreshBadge() {
    var n = unreadCount();
    button.classList.toggle('has-unread', n > 0);
    var label = lang() === 'en' ? 'News' : 'Annonces';
    if (n > 0) label += ' (' + n + (lang() === 'en' ? ' new)' : (n > 1 ? ' nouvelles)' : ' nouvelle)'));
    button.setAttribute('aria-label', label);
    button.setAttribute('title', lang() === 'en' ? 'News' : 'Annonces');
    panel.setAttribute('aria-label', lang() === 'en' ? 'News' : 'Annonces');
    panel.querySelector('.news-panel__close').setAttribute('aria-label', lang() === 'en' ? 'Close' : 'Fermer');
  }

  function openPanel() {
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    button.setAttribute('aria-expanded', 'true');
    // Ouvrir le panneau vaut lecture : la pastille disparaît, les annonces
    // restent marquées « nouvelles » jusqu'à la fermeture.
    markAllSeen();
    refreshBadge();
    var first = panel.querySelector('.news-item__link') || panel.querySelector('.news-panel__close');
    if (first) first.focus({ preventScroll: true });
  }

  function closePanel() {
    if (!panel.classList.contains('is-open')) return;
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    button.setAttribute('aria-expanded', 'false');
    panel.querySelectorAll('.news-item.is-new').forEach(function(li) { li.classList.remove('is-new'); });
  }

  function init() {
    var actions = document.querySelector('.sys-bar__actions');
    if (!actions || document.getElementById('news-panel') || !ANNOUNCEMENTS.length) return;

    button = buildButton();
    panel = buildPanel();
    // Avant le bouton musique (ou le bouton thème s'il n'y a pas de musique)
    actions.insertBefore(button, actions.querySelector('.music-btn') || document.getElementById('theme-toggle') || null);
    document.body.appendChild(panel);

    button.addEventListener('click', function(e) {
      e.stopPropagation();
      if (panel.classList.contains('is-open')) closePanel();
      else {
        // Un seul panneau ouvert à la fois : on ferme celui de la musique
        var music = document.getElementById('music-panel');
        if (music && music.classList.contains('is-open')) document.body.click();
        openPanel();
      }
    });
    document.addEventListener('click', function(e) {
      if (!panel.classList.contains('is-open')) return;
      if (panel.contains(e.target) || button.contains(e.target)) return;
      closePanel();
    });
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closePanel(); });

    refreshBadge();
    new MutationObserver(refreshBadge).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
