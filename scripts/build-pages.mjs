// UNUSUALL Ambassadeurs — génère les pages à partir d'un cadre commun
// (barre du haut, dock, fenêtre, pied de page, barre mobile), comme unusuall.online.
// Lancer : node scripts/build-pages.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://ambassadeurs.unusuall.online';
const V = '2';

const ICON = {
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/></svg>',
  products: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><path d="M17.25 13.5v7.5M13.5 17.25H21"/></svg>',
  gains: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V4"/><path d="M4 16h16"/><path d="M8 16V8"/><path d="M12 16V11"/><path d="M16 16V6"/></svg>',
  perks: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.5 6 .9-4.35 4.25 1 6L12 16.8l-5.4 2.85 1-6L3.3 9.4l6-.9z"/></svg>',
  apply: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 14l2 2 4-4"/></svg>'
};

const NAV = [
  { href: 'index.html', label: 'Programme', icon: 'home', cls: 'home' },
  { href: 'produits.html', label: 'Produits', icon: 'products', cls: 'olivia' },
  { href: 'gains.html', label: 'Gains', icon: 'gains', cls: 'omi' },
  { href: 'avantages.html', label: 'Avantages', icon: 'perks', cls: 'perks' },
  { href: 'postuler.html', label: 'Postuler', icon: 'apply', cls: 'contact' }
];

const THEME_BTN = `<button id="theme-toggle" class="sys-bar__btn" aria-label="Changer de thème clair/sombre">
          <svg class="theme-icon theme-icon--sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2"/></svg>
          <svg class="theme-icon theme-icon--moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="none" stroke="currentColor" stroke-width="2"/></svg>
        </button>`;

const SOCIAL = `
            <a href="mailto:services@unusuall.online" class="app-footer__social"><svg class="app-footer__social-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg><span>services@unusuall.online</span></a>
            <a href="https://www.linkedin.com/company/unusuall.online/" target="_blank" rel="noopener noreferrer" class="app-footer__social"><svg class="app-footer__social-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg><span>UNUSUALL</span></a>
            <a href="https://www.facebook.com/profile.php?id=61594556875752" target="_blank" rel="noopener noreferrer" class="app-footer__social"><svg class="app-footer__social-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M22 12.06C22 6.51 17.52 2 12 2S2 6.51 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.23.2 2.23.2v2.45h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.91h-2.33v7.03C18.34 21.21 22 17.06 22 12.06z"/></svg><span>unusuall</span></a>
            <a href="https://www.instagram.com/unusuall.online" target="_blank" rel="noopener noreferrer" class="app-footer__social"><svg class="app-footer__social-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".9" fill="currentColor" stroke="none"/></svg><span>@unusuall.online</span></a>`;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

function page({ file, title, desc, windowTitle, back, body, jsonld }) {
  const url = file === 'index.html' ? `${ORIGIN}/` : `${ORIGIN}/${file}`;
  const dock = NAV.map((n) => `      <a href="${n.href}" class="app-dock__item" data-page="${n.href}"><span class="app-dock__icon app-dock__icon--${n.cls}">${ICON[n.icon]}</span><span class="app-dock__label">${n.label}</span></a>`).join('\n');
  const mdock = NAV.map((n) => `    <a href="${n.href}" class="mobile-dock__item" data-page="${n.href}"><span class="mobile-dock__icon app-dock__icon--${n.cls}">${ICON[n.icon]}</span><span class="mobile-dock__label">${n.label}</span></a>`).join('\n');
  const ld = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': 'https://unusuall.online/#organization', name: 'UNUSUALL', url: 'https://unusuall.online/', logo: 'https://unusuall.online/assets/images/icon-512-mark.png', email: 'services@unusuall.online' },
      { '@type': 'WebPage', url, name: title, inLanguage: 'fr', isPartOf: { '@type': 'WebSite', name: 'Ambassadeurs UNUSUALL', url: `${ORIGIN}/` }, publisher: { '@id': 'https://unusuall.online/#organization' } },
      ...(jsonld || [])
    ]
  }, null, 2).replace(/\n/g, '\n  ');

  return `<!DOCTYPE html>
<html lang="fr" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${url}">
  <meta property="og:locale" content="fr_FR">
  <meta property="og:site_name" content="UNUSUALL">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:image" content="${ORIGIN}/assets/img/og.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="assets/img/icon-32-mark.png" type="image/png" sizes="32x32">
  <link rel="icon" href="assets/img/icon-192-mark.png" type="image/png" sizes="192x192">
  <link rel="apple-touch-icon" href="assets/img/icon-180-mark.png" sizes="180x180">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <script>try{if(localStorage.getItem('unusuall-theme')==='dark')document.documentElement.setAttribute('data-theme','dark')}catch(e){}</script>
  <link rel="stylesheet" href="assets/css/site.css?v=${V}">
  <link rel="stylesheet" href="assets/css/ambassadeurs.css?v=${V}">
  <script src="assets/js/app.js?v=${V}" defer></script>
  <script type="application/ld+json">
  ${ld}
  </script>
</head>
<body class="app-body">

  <a href="#main-content" class="skip-link">Aller au contenu</a>

  <header class="sys-bar" role="banner">
    <div class="sys-bar__left">
      <span class="sys-bar__dot" aria-hidden="true"></span>
      <span class="sys-bar__brand"><span class="logo-inline">Ambassadeurs</span></span>
      <span class="status-live">OUVERT</span>
    </div>
    <div class="sys-bar__right">
      <div class="sys-bar__actions">
        ${THEME_BTN}
      </div>
      <span id="sys-time">--:-- WAT</span>
    </div>
  </header>

  <div class="app-layout">
    <nav class="app-dock" aria-label="Navigation principale">
${dock}
    </nav>

    <main class="app-main" id="main-content">
      <div class="app-window">
        <div class="app-window__titlebar">
          ${back ? `<a href="${back.href}" class="app-window__back">← ${back.label}</a>` : ''}
          <span class="app-window__title">${windowTitle}</span>
        </div>

        <div class="app-window__body page-content pg-body">
${body}
        </div>
      </div>

      <footer class="app-footer">
        <div class="app-footer__grid">
          <div class="app-footer__brand">
            <a href="https://unusuall.online/" class="logo"><span class="logo__unusu">UNUSU</span><span class="logo__a">A</span><span class="logo__l1">L</span><span class="logo__l2">L</span></a>
            <p>Programme Ambassadeurs : faites connaître nos produits, soyez payé chaque mois.</p>
            <a href="https://unusuall.online/legal.html" class="app-footer__legal" target="_blank" rel="noopener">Mentions légales</a>
          </div>
          <div class="app-footer__col">
            <h4>Programme</h4>
            <a href="produits.html">Produits</a>
            <a href="gains.html">Gains</a>
            <a href="avantages.html">Avantages</a>
            <a href="postuler.html">Postuler</a>
          </div>
          <div class="app-footer__col">
            <h4>Contact</h4>${SOCIAL}
          </div>
        </div>
      </footer>
    </main>
  </div>

  <nav class="mobile-dock" aria-label="Navigation mobile">
${mdock}
  </nav>

</body>
</html>
`;
}

/* ───────── Contenus ───────── */

const CHECK = (items, cls = 'ep-checks') => `<ul class="${cls}">${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;

const FINAL = (title, text, alt = ['gains.html', 'Voir les gains']) => `
          <div class="ep-final" data-ep-reveal>
            <h2>${title}</h2>
            <p>${text}</p>
            <div class="pg-cta">
              <a class="btn btn--primary" href="postuler.html">Je postule →</a>
              <a href="${alt[0]}" class="btn btn--ghost">${alt[1]}</a>
            </div>
          </div>`;

const PAGES = [];

/* 1. Programme */
PAGES.push({
  file: 'index.html',
  title: 'Devenez Ambassadeur UNUSUALL · Programme Ambassadeurs',
  desc: "Choisissez les produits UNUSUALL que vous voulez représenter, faites-les connaître et touchez 30 % du premier mois puis 10 % chaque mois pendant un an. Candidature gratuite.",
  windowTitle: 'Programme Ambassadeurs',
  body: `
          <div class="ep-hero">
            <div class="pg-copy">
              <img class="amb-hero__mark" src="assets/img/mark-black.png" width="72" height="72" alt="">
              <div class="pg-pills">
                <span class="pg-pill pg-pill--live"><i></i>Candidatures ouvertes</span>
                <span class="pg-pill">UNUSUALL</span>
              </div>
              <p class="pg-eyebrow">Programme Ambassadeurs</p>
              <h1 class="pg-title">Devenez <span class="flame-text">Ambassadeur UNUSUALL</span></h1>
              <p class="ep-punch"><span>Choisissez vos produits.</span> <span>Faites-les connaître.</span> <span>Soyez payé chaque mois.</span></p>
              <p class="pg-lead">Vous représentez les produits UNUSUALL de votre choix, comme vous l'entendez. Pour chaque client qui s'abonne, vous touchez <strong>30 % du premier mois</strong>, puis <strong>10 % chaque mois pendant un an</strong>.</p>
              <div class="pg-cta">
                <a class="btn btn--primary" href="postuler.html">Je postule →</a>
                <a href="gains.html" class="btn btn--ghost">Voir ce que je peux gagner</a>
              </div>
              <ul class="ep-facts">
                <li>Aucun frais d'entrée</li>
                <li>Aucun diplôme exigé</li>
                <li>Vos horaires, votre zone</li>
              </ul>
            </div>
          </div>

          <ul class="ep-stats" data-ep-stagger>
            <li><b><span class="ep-count" data-to="30">30</span> <small>%</small></b><span>du premier mois payé, pour vous</span></li>
            <li><b><span class="ep-count" data-to="10">10</span> <small>%</small></b><span>de chaque mois, du 3e au 12e</span></li>
            <li><b><span class="ep-count" data-to="103870">103 870</span></b><span>FCFA par an pour un seul client Epicure Ultra</span></li>
            <li><b><span class="ep-count" data-to="0">0</span></b><span>franc à investir pour commencer</span></li>
          </ul>

          <div class="ep-section">
            <div class="ep-head" data-ep-reveal>
              <h2>Le principe, en 4 étapes</h2>
              <p>De votre candidature à votre premier paiement.</p>
            </div>
            <ol class="ep-steps" data-ep-stagger>
              <li><strong>Vous postulez</strong><span>Et vous choisissez les produits que vous voulez représenter. Réponse sous 72 heures.</span></li>
              <li><strong>Vous êtes formé</strong><span>Formation offerte, kit complet et votre code ambassadeur personnel.</span></li>
              <li><strong>Vous faites connaître</strong><span>En personne, sur WhatsApp, sur vos réseaux : comme vous le sentez, en respectant la charte.</span></li>
              <li><strong>Vous êtes payé</strong><span>Chaque mois, par Mobile Money, avec un relevé détaillé de vos clients et de vos gains.</span></li>
            </ol>
          </div>

          <div class="ep-section">
            <div class="ep-head" data-ep-reveal>
              <h2>Les produits que vous pouvez représenter</h2>
              <p>Vous choisissez. Pour l'instant, Epicure est ouvert aux ambassadeurs ; d'autres produits arrivent.</p>
            </div>
            <ul class="amb-products amb-products--compact" data-ep-stagger>
              <li class="amb-product is-open"><img src="assets/img/epicure.webp" width="56" height="56" alt=""><div><strong>Epicure</strong><span>Gestion de restaurant</span></div><em class="pg-pill pg-pill--live"><i></i>Ouvert</em></li>
              <li class="amb-product"><span class="amb-product__ico"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-4.5-7-11a4 4 0 0 1 7-2.5 4 4 0 0 1 7 2.5c0 6.5-7 11-7 11z"/></svg></span><div><strong>Suite SOFIA</strong><span>Santé</span></div><em class="pg-pill pg-pill--dev">Bientôt</em></li>
              <li class="amb-product"><span class="amb-product__ico"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg></span><div><strong>OMI</strong><span>Données mobiles</span></div><em class="pg-pill pg-pill--dev">Bientôt</em></li>
            </ul>
            <p class="amb-more"><a href="produits.html">Voir les produits en détail →</a></p>
          </div>
${FINAL('Prêt à représenter UNUSUALL ?', 'Deux minutes pour postuler, une réponse sous 72 heures.')}`
});

/* 2. Produits */
PAGES.push({
  file: 'produits.html',
  title: 'Produits à représenter · Ambassadeurs UNUSUALL',
  desc: 'Choisissez les produits UNUSUALL que vous voulez représenter. Epicure, le logiciel de gestion de restaurant, est ouvert aux ambassadeurs ; la Suite SOFIA et OMI arrivent bientôt.',
  windowTitle: 'Produits',
  back: { href: 'index.html', label: 'Programme' },
  body: `
          <div class="ep-head amb-top" data-ep-reveal>
            <p class="pg-eyebrow">Vous choisissez</p>
            <h1 class="pg-title">Les produits que vous représentez</h1>
            <p>À votre candidature, vous cochez les produits qui vous intéressent. Dès qu'un nouveau produit s'ouvre aux ambassadeurs, vous pourrez l'ajouter à votre profil.</p>
          </div>

          <article class="amb-feature" data-ep-reveal>
            <div class="amb-feature__art"><img src="assets/img/epicure.webp" width="280" height="280" alt="Logo Epicure"></div>
            <div class="amb-feature__copy">
              <div class="pg-pills"><span class="pg-pill pg-pill--live"><i></i>Ouvert aux ambassadeurs</span><span class="pg-pill">Suite OLIVIA</span></div>
              <h2>Epicure</h2>
              <p class="amb-feature__lead">Le logiciel qui aide les restaurants à ne plus perdre d'argent sans le savoir.</p>
              <p>Le restaurateur note ses achats, crée ses recettes, vend, et Epicure fait les calculs : le coût de chaque plat, le stock en temps réel et les pertes, produit par produit. Sur téléphone, tablette ou ordinateur, même sans internet.</p>
              ${CHECK(['<b>Pour qui :</b> restaurants, maquis, fast-foods, bars, hôtels-restaurants', '<b>Prix :</b> dès 27 900 FCFA par mois, sans engagement, en Mobile Money', '<b>Offre de lancement :</b> 1 mois payé, 1 mois offert', '<b>Vos gains :</b> jusqu\'à 103 870 FCFA par an et par restaurant'])}
              <div class="pg-cta">
                <a class="btn btn--primary" href="postuler.html">Représenter Epicure →</a>
                <a class="btn btn--ghost" href="https://unusuall.online/epicure.html" target="_blank" rel="noopener">Découvrir Epicure ↗</a>
              </div>
            </div>
          </article>

          <div class="ep-section">
            <div class="ep-head" data-ep-reveal>
              <h2>Bientôt ouverts aux ambassadeurs</h2>
              <p>Inscrivez-vous dès maintenant : vous serez prévenu en priorité à leur ouverture.</p>
            </div>
            <ul class="amb-products" data-ep-stagger>
              <li class="amb-product"><span class="amb-product__ico"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-4.5-7-11a4 4 0 0 1 7-2.5 4 4 0 0 1 7 2.5c0 6.5-7 11-7 11z"/></svg></span><div><strong>Suite SOFIA</strong><span>Digitaliser les établissements de santé : moins de paperasse, moins d'attente.</span></div><em class="pg-pill pg-pill--dev">Bientôt</em></li>
              <li class="amb-product"><span class="amb-product__ico"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg></span><div><strong>OMI</strong><span>Organiser ses données mobiles et les retrouver en moins de 3 secondes.</span></div><em class="pg-pill pg-pill--dev">Bientôt</em></li>
            </ul>
          </div>
${FINAL('Epicure vous intéresse ?', 'Postulez aujourd\'hui et commencez dès votre validation.')}`
});

/* 3. Gains */
const PLANS = [['Standard', 27900], ['Premium', 45900], ['Ultra', 79900]];
const f = (n) => Math.round(n).toLocaleString('fr-FR').replace(/\s/g, ' ');
const stepper = (id, label, val) => `
              <div class="amb-sim__row">
                <label for="${id}">${label}</label>
                <div class="amb-stepper"><button type="button" data-step="-1" data-for="${id}" aria-label="Moins de restaurants ${label}">−</button><input id="${id}" type="number" min="0" max="200" value="${val}" inputmode="numeric"><button type="button" data-step="1" data-for="${id}" aria-label="Plus de restaurants ${label}">+</button></div>
              </div>`;
PAGES.push({
  file: 'gains.html',
  title: 'Vos gains · Ambassadeurs UNUSUALL',
  desc: "30 % du premier mois payé puis 10 % chaque mois du 3e au 12e mois. Jusqu'à 103 870 FCFA par an pour un seul restaurant Epicure. Simulez vos gains.",
  windowTitle: 'Gains',
  back: { href: 'index.html', label: 'Programme' },
  body: `
          <div class="ep-head amb-top" data-ep-reveal>
            <p class="pg-eyebrow">Vos gains</p>
            <h1 class="pg-title">Vous signez une fois, <span class="flame-text">vous êtes payé tous les mois.</span></h1>
            <p>Une prime à la signature, puis une commission chaque mois tant que le client paie son abonnement, jusqu'au 12e mois. Les mêmes règles s'appliqueront à chaque nouveau produit.</p>
          </div>

          <div class="amb-rule" data-ep-stagger>
            <div><b>30 %</b><span>du premier mois payé : votre prime de signature, versée dès l'encaissement.</span></div>
            <div><b>10 %</b><span>de chaque mois payé, du 3e au 12e mois : votre revenu mensuel.</span></div>
            <div><b>0</b><span>commission sur un mois offert au client, puisque rien n'est encaissé.</span></div>
          </div>

          <div class="ep-section">
            <div class="ep-head" data-ep-reveal>
              <h2>Epicure : ce que vous rapporte chaque restaurant</h2>
            </div>
            <div class="amb-table" data-ep-reveal>
              <table>
                <thead><tr><th scope="col">Formule</th><th scope="col">Prix / mois</th><th scope="col">Prime de signature</th><th scope="col">Chaque mois (3e au 12e)</th><th scope="col">Total sur un an</th></tr></thead>
                <tbody>
${PLANS.map(([n, p], i) => `                  <tr${i === 1 ? ' class="is-hot"' : ''}><th scope="row">${n}</th><td>${f(p)}</td><td>${f(p * 0.3)}</td><td>${f(p * 0.1)}</td><td><b>${f(p * 0.3 + p * 0.1 * 10)}</b></td></tr>`).join('\n')}
                </tbody>
              </table>
              <p>Montants en FCFA, pour un restaurant qui reste abonné toute l'année.</p>
            </div>
          </div>

          <div class="ep-section">
            <div class="amb-sim" data-ep-reveal>
              <div>
                <h2>Simulez vos gains</h2>
                <p class="amb-sim__hint">Combien de restaurants pensez-vous convaincre ?</p>${stepper('s-standard', 'Standard', 5)}${stepper('s-premium', 'Premium', 3)}${stepper('s-ultra', 'Ultra', 1)}
              </div>
              <div class="amb-sim__result" aria-live="polite">
                <div><small>Primes de signature</small><b id="r-sign">107 130</b><span>FCFA, dès le premier paiement</span></div>
                <div><small>Revenu mensuel</small><b id="r-month">35 710</b><span>FCFA par mois, pendant 10 mois</span></div>
                <div class="amb-sim__total"><small>Total sur un an</small><b id="r-year">464 230</b><span>FCFA</span></div>
              </div>
            </div>
          </div>
${FINAL('Ces chiffres vous parlent ?', 'Postulez en deux minutes, réponse sous 72 heures.', ['avantages.html', 'Voir les avantages'])}`
});

/* 4. Avantages */
const PERK = (ico, t, d, gold) => `<li class="ep-card${gold ? ' ep-card--accent' : ''}"><span class="pg-ico${gold ? ' pg-ico--gold' : ''}"><svg viewBox="0 0 24 24" aria-hidden="true">${ico}</svg></span><div><strong>${t}</strong><small>${d}</small></div></li>`;
PAGES.push({
  file: 'avantages.html',
  title: 'Vos avantages · Ambassadeurs UNUSUALL',
  desc: "Formation offerte, titre officiel, priorité d'embauche, kit complet, accès gratuit aux produits pour vos démonstrations, communauté et liberté totale.",
  windowTitle: 'Avantages',
  back: { href: 'index.html', label: 'Programme' },
  body: `
          <div class="ep-head amb-top" data-ep-reveal>
            <p class="pg-eyebrow">Bien plus qu'une commission</p>
            <h1 class="pg-title">Ce que vous gagnez <span class="flame-text">en devenant ambassadeur.</span></h1>
          </div>

          <ul class="ep-grid" data-ep-stagger>
            ${PERK('<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>', 'Une formation offerte', 'Vente, marketing digital et connaissance des produits, avec une attestation UNUSUALL.')}
            ${PERK('<circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 8 5-3 5 3-1.5-8"/>', 'Un titre officiel', '« Ambassadeur UNUSUALL », avec une attestation et un badge à afficher sur LinkedIn.')}
            ${PERK('<path d="M20 7H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1z"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>', "La priorité d'embauche", 'Quand UNUSUALL recrute des commerciaux salariés, les meilleurs ambassadeurs passent en premier.', true)}
            ${PERK('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>', 'Une lettre de recommandation', 'Signée par UNUSUALL, pour les ambassadeurs qui atteignent leurs objectifs.')}
            ${PERK('<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3"/>', 'Un kit complet', 'Affiches, flyers, visuels, vidéos de démonstration et argumentaire prêts à l\'emploi.')}
            ${PERK('<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>', 'Les produits gratuits pour vos démos', 'Un accès complet pour montrer les produits en conditions réelles.')}
            ${PERK('<path d="M3 11a8 8 0 0 1 15.5-2.8"/><path d="M21 13a8 8 0 0 1-15.5 2.8"/><path d="M18 3v5h-5M6 21v-5h5"/>', 'Mis en avant', 'Chaque mois, un « Ambassadeur du mois » présenté sur les réseaux d\'UNUSUALL.')}
            ${PERK('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>', 'Une communauté', 'Un groupe privé d\'ambassadeurs pour partager les astuces et joindre l\'équipe vite.')}
            ${PERK('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 'Une liberté totale', 'Vos horaires, votre zone, vos produits, votre façon de faire. Compatible avec des études ou un emploi.')}
          </ul>

          <div class="ep-section">
            <div class="ep-head" data-ep-reveal>
              <h2>Trois niveaux à débloquer</h2>
              <p>Plus vos clients restent abonnés, plus vous montez.</p>
            </div>
            <div class="amb-levels" data-ep-stagger>
              <div class="amb-level"><p class="amb-level__n">Niveau 1</p><h3>Ambassadeur</h3><p class="amb-level__when">Dès votre inscription</p>${CHECK(['Commissions de 30 % et 10 %', 'Formation et kit complet', 'Accès au groupe privé'])}</div>
              <div class="amb-level"><p class="amb-level__n">Niveau 2</p><h3>Ambassadeur Confirmé</h3><p class="amb-level__when">À 5 clients actifs</p>${CHECK(['Tout le niveau 1', 'Formation avancée', 'Mise en avant sur nos réseaux'])}</div>
              <div class="amb-level amb-level--top"><p class="amb-level__n">Niveau 3</p><h3>Ambassadeur Élite</h3><p class="amb-level__when">À 15 clients actifs</p>${CHECK(['Tout le niveau 2', "Priorité d'embauche", 'Lettre de recommandation', 'Votre avis compte dans nos décisions produits'])}</div>
            </div>
          </div>

          <div class="ep-section">
            <div class="amb-charter" data-ep-reveal>
              <div>
                <h2>La charte, en bref</h2>
                <p>Vous faites la publicité comme vous l'entendez, avec quelques règles simples pour protéger la marque et les clients.</p>
              </div>
              ${CHECK(['Utiliser votre code ambassadeur pour chaque client', 'Présenter les produits honnêtement, sans promettre ce qu\'ils ne font pas', 'Ne pas modifier les prix ni inventer de réductions', 'Pas de spam ni de faux comptes : une inscription fictive annule les commissions', 'Utiliser le logo et les visuels fournis'])}
            </div>
          </div>
${FINAL('Envie de rejoindre l\'équipe ?', 'Postulez et choisissez vos produits.')}`
});

/* 5. Postuler */
const FAQ = [
  ['Faut-il de l\'expérience ?', 'Non. Une bonne connaissance de votre entourage professionnel et l\'envie de convaincre suffisent. La formation vous donne le reste.'],
  ['Est-ce que je dois payer quelque chose ?', 'Non, rien. La candidature, la formation, le kit et l\'accès aux produits pour vos démonstrations sont gratuits.'],
  ['Puis-je représenter plusieurs produits ?', 'Oui. Vous choisissez à la candidature, et vous pourrez ajouter les nouveaux produits dès leur ouverture aux ambassadeurs. Pour l\'instant, Epicure est ouvert.'],
  ['Quand et comment suis-je payé ?', 'Chaque mois, par Mobile Money, après l\'encaissement des abonnements de vos clients, avec un relevé détaillé.'],
  ['Comment savez-vous quels clients viennent de moi ?', 'Grâce à votre code ambassadeur personnel, que le client indique à son inscription.'],
  ['Est-ce un emploi salarié ?', 'Non. Vous êtes ambassadeur indépendant, payé à la commission et libre de vos horaires. Les meilleurs sont prioritaires quand UNUSUALL recrute des commerciaux salariés.'],
  ['Je ne suis pas à Cotonou, puis-je postuler ?', 'Oui. Vous pouvez représenter nos produits partout : en personne dans votre ville, ou à distance avec vos réseaux.']
];
PAGES.push({
  file: 'postuler.html',
  title: 'Postuler · Ambassadeurs UNUSUALL',
  desc: 'Postulez pour devenir Ambassadeur UNUSUALL et choisissez les produits que vous voulez représenter. Gratuit, réponse sous 72 heures.',
  windowTitle: 'Postuler',
  back: { href: 'index.html', label: 'Programme' },
  jsonld: [{ '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }],
  body: `
          <div class="pg-split pg-split--tight amb-apply">
            <div class="pg-copy">
              <p class="pg-eyebrow">Candidature</p>
              <h1 class="pg-title">Prêt à représenter <span class="flame-text">UNUSUALL ?</span></h1>
              <p class="pg-lead">Deux minutes suffisent. Nous étudions chaque candidature et vous répondons sous 72 heures, par WhatsApp ou par e-mail.</p>
              ${CHECK(['Candidature gratuite', 'Réponse sous 72 heures', 'Formation dès votre validation'])}
            </div>

            <div class="pg-card">
              <div class="pg-card__head"><h2>Votre candidature</h2><p>Les champs marqués d'un * sont obligatoires.</p></div>
              <form class="pg-form" id="form" action="https://formspree.io/f/xzdqanqq" method="POST" novalidate>
                <input type="hidden" name="_subject" value="[Ambassadeur UNUSUALL] Nouvelle candidature">
                <input type="hidden" name="source" value="ambassadeurs">
                <div class="amb-hp" aria-hidden="true"><label for="f-gotcha">Ne pas remplir</label><input type="text" id="f-gotcha" name="_gotcha" tabindex="-1" autocomplete="off"></div>

                <div class="form-group"><label for="f-name">Nom et prénom *</label><input id="f-name" name="nom" type="text" class="form-control" autocomplete="name" required></div>
                <div class="form-group"><label for="f-phone">Numéro WhatsApp *</label><input id="f-phone" name="whatsapp" type="tel" class="form-control" autocomplete="tel" placeholder="+229 …" required></div>
                <div class="form-group"><label for="f-email">E-mail *</label><input id="f-email" name="email" type="email" class="form-control" autocomplete="email" required></div>
                <div class="form-group"><label for="f-city">Ville *</label><input id="f-city" name="ville" type="text" class="form-control" autocomplete="address-level2" required></div>

                <fieldset class="form-group span-2 amb-choose">
                  <legend>Les produits que vous voulez représenter *</legend>
                  <label class="amb-choice"><input type="checkbox" name="produits" value="Epicure" checked required><span><b>Epicure</b><small>Gestion de restaurant · ouvert</small></span></label>
                  <label class="amb-choice is-soon"><input type="checkbox" name="produits_futurs" value="Suite SOFIA"><span><b>Suite SOFIA</b><small>Santé · me prévenir à l'ouverture</small></span></label>
                  <label class="amb-choice is-soon"><input type="checkbox" name="produits_futurs" value="OMI"><span><b>OMI</b><small>Données mobiles · me prévenir à l'ouverture</small></span></label>
                </fieldset>

                <div class="form-group span-2"><label for="f-profile">Vous êtes plutôt… *</label>
                  <select id="f-profile" name="profil" class="form-control" required>
                    <option value="">Choisissez</option>
                    <option>Étudiant(e)</option>
                    <option>Commercial(e) ou vendeur(se)</option>
                    <option>Dans la restauration</option>
                    <option>Créateur(trice) de contenu</option>
                    <option>Autre</option>
                  </select>
                </div>
                <div class="form-group span-2"><label for="f-how">Comment comptez-vous faire connaître nos produits ? *</label><textarea id="f-how" name="methode" class="form-control" rows="4" required placeholder="Ex. : je connais beaucoup de restaurants à Calavi, je ferai des visites et je partagerai sur mes réseaux…"></textarea></div>
                <div class="form-group span-2"><label for="f-social">Vos réseaux sociaux (facultatif)</label><input id="f-social" name="reseaux" type="text" class="form-control" placeholder="Lien Facebook, Instagram, TikTok, LinkedIn…"></div>
                <label class="amb-agree span-2"><input type="checkbox" name="charte" value="acceptee" required> J'accepte la <a href="avantages.html">charte de l'ambassadeur</a> et le traitement de mes données pour étudier ma candidature. *</label>

                <p class="form-error" id="form-error" role="alert" hidden>Merci de remplir tous les champs obligatoires avec une adresse e-mail valide.</p>
                <button class="btn btn--primary" type="submit">Envoyer ma candidature →</button>
                <div class="form-success amb-ok" id="form-ok" role="status" hidden><strong>Candidature envoyée.</strong> Merci ! Nous vous répondons sous 72 heures, par WhatsApp ou par e-mail.</div>
              </form>
            </div>
          </div>

          <div class="ep-section">
            <div class="ep-head" data-ep-reveal>
              <h2>Vos questions</h2>
            </div>
            <div class="ep-faq">
${FAQ.map(([q, a]) => `              <details><summary>${q}</summary><p>${a}</p></details>`).join('\n')}
            </div>
          </div>`
});

for (const p of PAGES) {
  fs.writeFileSync(path.join(root, p.file), page(p));
  console.log('ok', p.file);
}
