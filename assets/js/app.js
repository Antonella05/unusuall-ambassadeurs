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
    var on = a.getAttribute('data-page') === here;
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

  /* Simulateur Epicure : 30 % du 1er mois + 10 % du 3e au 12e mois */
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
