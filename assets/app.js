/* UNUSUALL — Programme Ambassadeurs Epicure
   Thème, simulateur de gains, apparitions, chiffres animés, formulaire. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var fmt = function (n) { return Math.round(n).toLocaleString('fr-FR').replace(/\s/g, ' '); };

  /* Thème clair / sombre */
  var themeBtn = $('.theme');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var dark = root.getAttribute('data-theme') !== 'dark';
      if (dark) root.setAttribute('data-theme', 'dark'); else root.removeAttribute('data-theme');
      try { localStorage.setItem('unusuall-theme', dark ? 'dark' : 'light'); } catch (e) {}
    });
  }

  /* Simulateur : 30 % du 1er mois + 10 % du 3e au 12e mois (10 mois) */
  var PLANS = { 's-standard': 27900, 's-premium': 45900, 's-ultra': 79900 };
  function simulate() {
    var sign = 0, month = 0;
    Object.keys(PLANS).forEach(function (id) {
      var input = document.getElementById(id);
      var n = Math.max(0, Math.min(200, parseInt(input.value, 10) || 0));
      sign += n * PLANS[id] * 0.30;
      month += n * PLANS[id] * 0.10;
    });
    $('#r-sign').textContent = fmt(sign);
    $('#r-month').textContent = fmt(month);
    $('#r-year').textContent = fmt(sign + month * 10);
  }
  $$('.stepper button').forEach(function (b) {
    b.addEventListener('click', function () {
      var input = document.getElementById(b.getAttribute('data-for'));
      input.value = Math.max(0, Math.min(200, (parseInt(input.value, 10) || 0) + parseInt(b.getAttribute('data-step'), 10)));
      simulate();
    });
  });
  $$('.stepper input').forEach(function (i) { i.addEventListener('input', simulate); });
  if ($('#r-sign')) simulate();

  /* Apparitions au défilement et chiffres qui défilent */
  function countUp(el) {
    var to = parseInt(el.getAttribute('data-count'), 10);
    if (!to || reduce) return;
    var t0 = null;
    function step(now) {
      if (t0 === null) t0 = now;
      var p = Math.min((now - t0) / 1100, 1);
      el.textContent = fmt(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    }
    el.textContent = '0';
    requestAnimationFrame(step);
  }

  if ('IntersectionObserver' in window && !reduce) {
    root.classList.add('js');
    var targets = $$('.head, .split > *, .stat, .pitch li, .table-wrap, .sim, .perks li, .level, .steps li, .rules, .faq, .apply');
    targets.forEach(function (el) {
      var siblings = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
      el.classList.add('reveal');
      el.style.transitionDelay = Math.min(siblings, 6) * 60 + 'ms';
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        $$('[data-count]', e.target).forEach(countUp);
        io.unobserve(e.target);
      });
    }, { threshold: 0.04, rootMargin: '0px 0px -24px 0px' });
    targets.forEach(function (el) { io.observe(el); });
  }

  /* Bouton flottant « Je postule » (mobile) : caché en haut de page et près du formulaire */
  var floatCta = $('.float-cta');
  var apply = $('#postuler');
  if (floatCta && apply) {
    var update = function () {
      var r = apply.getBoundingClientRect();
      var hide = window.scrollY < 420 || (r.top < window.innerHeight && r.bottom > 0);
      floatCta.classList.toggle('is-hidden', hide);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  /* Formulaire de candidature (envoi sans quitter la page) */
  var form = $('#form');
  if (form) {
    var errorBox = $('#form-error');
    var okBox = $('#form-ok');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.querySelector('[name="_gotcha"]').value) return;

      var invalid = $$('input[required], select[required], textarea[required]', form).filter(function (f) {
        var bad = f.type === 'checkbox' ? !f.checked : !f.value.trim() || (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value));
        f.setAttribute('aria-invalid', bad ? 'true' : 'false');
        return bad;
      });
      if (invalid.length) {
        errorBox.textContent = 'Merci de remplir tous les champs obligatoires avec une adresse e-mail valide.';
        errorBox.hidden = false;
        invalid[0].focus();
        return;
      }
      errorBox.hidden = true;

      var btn = form.querySelector('button[type="submit"]');
      var label = btn.innerHTML;
      btn.disabled = true;
      btn.textContent = 'Envoi en cours…';

      fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (res) {
          if (!res.ok) throw new Error('send');
          $$('.field, .agree, button[type="submit"]', form).forEach(function (el) { el.hidden = true; });
          okBox.hidden = false;
          okBox.focus && okBox.setAttribute('tabindex', '-1');
          okBox.focus && okBox.focus();
        })
        .catch(function () {
          errorBox.textContent = "L'envoi n'a pas abouti. Vérifiez votre connexion et réessayez, ou écrivez-nous à services@unusuall.online.";
          errorBox.hidden = false;
        })
        .finally(function () { btn.disabled = false; btn.innerHTML = label; });
    });
  }
})();
