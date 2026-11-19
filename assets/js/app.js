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
