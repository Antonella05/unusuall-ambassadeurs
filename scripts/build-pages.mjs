// UNUSUALL Ambassadeurs — génère les pages à partir d'un cadre commun
// (barre du haut, dock, fenêtre, pied de page, barre mobile), comme unusuall.online.
// Lancer : node scripts/build-pages.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://ambassadeurs.unusuall.online';
const V = '23';

const ICON = {
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/></svg>',
  products: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><path d="M17.25 13.5v7.5M13.5 17.25H21"/></svg>',
  gains: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V4"/><path d="M4 16h16"/><path d="M8 16V8"/><path d="M12 16V11"/><path d="M16 16V6"/></svg>',
  user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'
};

const NAV = [
  { href: 'index.html', label: 'Programme', icon: 'home', cls: 'home', group: ['index.html', 'postuler.html'] },
  { href: 'produits.html', label: 'Produits', icon: 'products', cls: 'olivia', group: ['produits.html'] },
  { href: 'gains.html', label: 'Gains', icon: 'gains', cls: 'omi', group: ['gains.html', 'avantages.html'] },
  { href: 'annuaire.html', label: 'Annuaire', icon: 'search', cls: 'annuaire', group: ['annuaire.html'] },
  { href: 'espace.html', label: 'Mon espace', icon: 'user', cls: 'sofia', group: ['espace.html', 'connexion.html'] }
];

const THEME_BTN = `<button id="theme-toggle" class="sys-bar__btn" aria-label="Changer de thème clair/sombre">
          <svg class="theme-icon theme-icon--sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2"/></svg>
          <svg class="theme-icon theme-icon--moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="none" stroke="currentColor" stroke-width="2"/></svg>
        </button>`;

const SOCIAL = `
            <a href="mailto:services@unusuall.online" class="app-footer__social"><svg class="app-footer__social-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg><span>services@unusuall.online</span></a>
            <a href="https://www.linkedin.com/company/unusuall.online/" target="_blank" rel="noopener noreferrer" class="app-footer__social"><svg class="app-footer__social-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg><span>UNUSUALL</span></a>
            <a href="https://www.facebook.com/profile.php?id=61594556875752" target="_blank" rel="noopener noreferrer" class="app-footer__social"><svg class="app-footer__social-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M22 12.06C22 6.51 17.52 2 12 2S2 6.51 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.23.2 2.23.2v2.45h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.91h-2.33v7.03C18.34 21.21 22 17.06 22 12.06z"/></svg><span>unusuall</span></a>`;
/* 4e colonne du pied de page, comme sur unusuall.online */
const SOCIAL2 = `
            <a href="https://www.instagram.com/unusuall.online" target="_blank" rel="noopener noreferrer" aria-label="Instagram (@unusuall.online)" class="app-footer__social"><svg class="app-footer__social-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".9" fill="currentColor" stroke="none"/></svg><span>@unusuall.online</span></a>
            <a href="https://www.threads.com/@unusuall.online" target="_blank" rel="noopener noreferrer" aria-label="Threads (@unusuall.online)" class="app-footer__social"><svg class="app-footer__social-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.019c.028-3.576.877-6.43 2.523-8.482C5.845 1.205 8.598.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.57c-1.104-3.945-3.858-5.964-8.184-6.001-2.9.023-5.093.968-6.516 2.809-1.33 1.72-2.017 4.19-2.042 7.34.025 3.15.712 5.62 2.042 7.34 1.423 1.84 3.617 2.786 6.516 2.809 2.612-.02 4.339-.63 5.615-1.976 1.463-1.542 1.436-3.44 1.203-4.634-.14-.72-.402-1.352-.775-1.88-.115 1.372-.548 2.457-1.294 3.239-.988 1.033-2.4 1.575-4.203 1.609-1.36.026-2.612-.298-3.523-.958-1.06-.77-1.65-1.926-1.665-3.29-.014-1.302.532-2.5 1.535-3.377.958-.836 2.29-1.322 3.849-1.402.976-.05 1.89.005 2.727.164-.11-.664-.343-1.192-.688-1.564-.499-.54-1.24-.813-2.208-.813h-.02c-1.026.008-1.874.313-2.516.907l-1.652-1.492c1.06-1.02 2.492-1.554 4.152-1.567 1.523.012 2.734.483 3.6 1.402.847.9 1.28 2.146 1.288 3.703v.315c1.108.594 1.888 1.35 2.32 2.25.586 1.226.65 3.166-.86 4.75-1.55 1.628-3.744 2.436-6.53 2.46h-.016z"/></svg><span>@unusuall.online</span></a>
            <a href="https://www.youtube.com/@unusuall.online" target="_blank" rel="noopener noreferrer" aria-label="YouTube (@unusuall.online)" class="app-footer__social"><svg class="app-footer__social-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg><span>@unusuall.online</span></a>`;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

function page({ file, title, desc, windowTitle, back, body, jsonld, account, script, noindex }) {
  const url = file === 'index.html' ? `${ORIGIN}/` : `${ORIGIN}/${file}`;
  const dock = NAV.map((n) => `      <a href="${n.href}" class="app-dock__item" data-page="${(n.group || [n.href]).join(' ')}"><span class="app-dock__icon app-dock__icon--${n.cls}">${ICON[n.icon]}</span><span class="app-dock__label">${n.label}</span></a>`).join('\n');
  const mdock = NAV.map((n) => `    <a href="${n.href}" class="mobile-dock__item" data-page="${(n.group || [n.href]).join(' ')}"><span class="mobile-dock__icon app-dock__icon--${n.cls}">${ICON[n.icon]}</span><span class="mobile-dock__label">${n.label}</span></a>`).join('\n');
  const ld = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': 'https://unusuall.online/#organization', name: 'UNUSUALL', url: 'https://unusuall.online/', logo: 'https://unusuall.online/assets/images/icon-512-mark.png', email: 'services@unusuall.online', sameAs: ['https://www.linkedin.com/company/unusuall.online/', 'https://www.facebook.com/profile.php?id=61594556875752', 'https://www.instagram.com/unusuall.online', 'https://www.threads.com/@unusuall.online', 'https://www.youtube.com/@unusuall.online'] },
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
  <meta name="description" content="${esc(desc)}">${noindex ? `
  <meta name="robots" content="noindex">` : ''}
  <link rel="canonical" href="${url}">
  <meta property="og:locale" content="fr_FR">
  <meta property="og:site_name" content="UNUSUALL">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:image" content="${ORIGIN}/assets/img/og-reseau-or.jpg">
  <meta property="og:image:alt" content="Votre réseau vaut de l'or. Devenez ambassadeur UNUSUALL.">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${ORIGIN}/assets/img/og-reseau-or.jpg">
  <link rel="icon" href="assets/img/icon-32-mark.png" type="image/png" sizes="32x32">
  <link rel="icon" href="assets/img/icon-192-mark.png" type="image/png" sizes="192x192">
  <link rel="apple-touch-icon" href="assets/img/icon-180-mark.png" sizes="180x180">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <script>try{if(localStorage.getItem('unusuall-theme')==='dark')document.documentElement.setAttribute('data-theme','dark')}catch(e){}</script>
  <link rel="stylesheet" href="assets/css/app.css?v=${V}">
  <script src="assets/js/app.js?v=${V}" defer></script>${account ? `
  <link rel="preconnect" href="https://www.gstatic.com" crossorigin>
  <script type="module" src="assets/js/account.js?v=${V}"></script>` : ''}${script ? `
  <script type="module" src="assets/js/${script}?v=${V}"></script>` : ''}
  <script type="application/ld+json">
  ${ld}
  </script>
</head>
<body class="app-body"${account ? ` data-account="${account}"` : ''}>

  <a href="#main-content" class="skip-link">Aller au contenu</a>

  <header class="sys-bar" role="banner">
    <div class="sys-bar__left">
      <span class="sys-bar__dot" aria-hidden="true"></span>
      <span class="sys-bar__brand"><span class="logo-inline">Ambassadeurs</span></span>
      <span class="status-live">OUVERT</span>
    </div>
    <div class="sys-bar__right">
      <div class="sys-bar__actions">
        <a class="sys-bar__btn" href="espace.html" id="account-link">Mon espace</a>
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
            <div class="app-footer__links">
              <a href="produits.html">Produits</a>
              <a href="gains.html">Gains</a>
              <a href="avantages.html">Avantages</a>
              <a href="annuaire.html">Annuaire</a>
              <a href="reglement.html">Règlement</a>
              <a href="postuler.html">Postuler</a>
            </div>
          </div>
          <div class="app-footer__col">
            <h4>Contact</h4>${SOCIAL}
          </div>
          <div class="app-footer__col">
            <h4 class="app-footer__col-spacer" aria-hidden="true">&nbsp;</h4>${SOCIAL2}
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

const SUBNAV = (items, current) => `          <nav class="amb-subnav" aria-label="Sous-navigation">
${items.map(([href, label]) => `            <a href="${href}"${href === current ? ' class="is-active" aria-current="page"' : ''}>${label}</a>`).join('\n')}
          </nav>`;

const PAGES = [];

/* 1. Programme */
const FEED = `
            <div class="amb-feed" aria-hidden="true">
              <div class="amb-feed__head"><span class="amb-feed__dot"></span>Vos gains · exemple</div>
              <ol class="amb-feed__list">
                <li><span class="amb-feed__ico">✓</span><div><b>Nouveau client</b><small>Epicure Premium</small></div><em>+13 770 F</em></li>
                <li><span class="amb-feed__ico">↻</span><div><b>Mois 3 payé</b><small>Mobile Money</small></div><em>+4 590 F</em></li>
                <li><span class="amb-feed__ico">↻</span><div><b>Mois 4 payé</b><small>Mobile Money</small></div><em>+4 590 F</em></li>
                <li><span class="amb-feed__ico">✓</span><div><b>Nouveau client</b><small>Epicure Ultra</small></div><em>+23 970 F</em></li>
              </ol>
              <div class="amb-feed__total"><small>Sur un an, 2 clients</small><b>163 540 FCFA</b></div>
            </div>`;

PAGES.push({
  file: 'index.html',
  title: 'Devenez Ambassadeur UNUSUALL · Programme Ambassadeurs',
  desc: "Votre réseau vaut de l'or. Parlez de nos produits autour de vous et soyez payé chaque mois : 30 % du premier mois, puis 10 % chaque mois. Inscription gratuite.",
  windowTitle: 'Programme Ambassadeurs',
  body: `${SUBNAV([['index.html', 'Programme'], ['postuler.html', 'Postuler']], 'index.html')}
          <div class="amb-hero">
            <div class="pg-copy">
              <div class="pg-pills">
                <span class="pg-pill pg-pill--live"><i></i>Inscriptions ouvertes</span>
              </div>
              <h1 class="pg-title">Parlez de nos produits. <span class="flame-text">Gagnez chaque mois.</span></h1>
              <p class="ep-punch"><span>Vous partagez.</span> <span>Ils s'abonnent.</span> <span>Vous êtes payé.</span></p>
              <p class="pg-lead">Devenez Ambassadeur UNUSUALL. C'est gratuit et vous travaillez quand vous voulez.</p>
              <div class="pg-cta">
                <a class="btn btn--primary" href="connexion.html?mode=inscription">Je deviens ambassadeur →</a>
                <a href="gains.html" class="btn btn--ghost">Combien je gagne ?</a>
              </div>
            </div>${FEED}
          </div>

          <ul class="ep-stats" data-ep-stagger>
            <li><b><span class="ep-count" data-to="30">30</span> <small>%</small></b><span>du 1er mois pour vous</span></li>
            <li><b><span class="ep-count" data-to="10">10</span> <small>%</small></b><span>chaque mois ensuite</span></li>
            <li><b>∞</b><span>tant que le client paie, renouvelé chaque année</span></li>
            <li><b><span class="ep-count" data-to="0">0</span> <small>F</small></b><span>pour commencer</span></li>
          </ul>

          <div class="ep-section">
            <div class="ep-head" data-ep-reveal><h2>Simple comme 1, 2, 3</h2></div>
            <ol class="ep-steps amb-steps3" data-ep-stagger>
              <li><strong>Inscrivez-vous</strong><span>En deux minutes, gratuitement.</span></li>
              <li><strong>Partagez</strong><span>Votre lien personnel ou votre QR code.</span></li>
              <li><strong>Encaissez</strong><span>Chaque mois, sur Mobile Money.</span></li>
            </ol>
          </div>

          <div class="ep-section">
            <div class="ep-head" data-ep-reveal><h2>Ce que vous représentez</h2><p>Vous choisissez vos produits.</p></div>
            <ul class="amb-products amb-products--compact" data-ep-stagger>
              <li class="amb-product is-open"><img src="assets/img/epicure.webp" width="56" height="56" alt=""><div><strong>Epicure</strong><span>Pour les restaurants</span></div><em class="pg-pill pg-pill--live"><i></i>Ouvert</em></li>
              <li class="amb-product"><span class="amb-product__ico"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-4.5-7-11a4 4 0 0 1 7-2.5 4 4 0 0 1 7 2.5c0 6.5-7 11-7 11z"/></svg></span><div><strong>Suite SOFIA</strong><span>Pour la santé</span></div><em class="pg-pill pg-pill--dev">Bientôt</em></li>
              <li class="amb-product"><span class="amb-product__ico"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg></span><div><strong>OMI</strong><span>Pour les données mobiles</span></div><em class="pg-pill pg-pill--dev">Bientôt</em></li>
            </ul>
          </div>
${FINAL('Prêt à gagner avec nous ?', 'Inscription gratuite. Réponse sous 72 heures.')}`
});

/* 2. Produits */
PAGES.push({
  file: 'produits.html',
  title: 'Produits à représenter · Ambassadeurs UNUSUALL',
  desc: "Choisissez les produits UNUSUALL que vous représentez. Epicure, pour les restaurants, est ouvert. La Suite SOFIA et OMI arrivent bientôt.",
  windowTitle: 'Produits',
  back: { href: 'index.html', label: 'Programme' },
  body: `
          <div class="ep-head amb-top" data-ep-reveal>
            <p class="pg-eyebrow">Vous choisissez</p>
            <h1 class="pg-title">Les produits que <span class="flame-text">vous représentez</span></h1>
            <p>Un seul produit ou plusieurs : c'est vous qui décidez.</p>
          </div>

          <article class="amb-feature" data-ep-reveal>
            <div class="amb-feature__art"><img src="assets/img/epicure.webp" width="280" height="280" alt="Logo Epicure"></div>
            <div class="amb-feature__copy">
              <div class="pg-pills"><span class="pg-pill pg-pill--live"><i></i>Ouvert maintenant</span></div>
              <h2>Epicure</h2>
              <p class="amb-feature__lead">Le logiciel qui aide les restaurants à ne plus perdre d'argent.</p>
              ${CHECK(['Pour les restaurants, maquis, bars et fast-foods', 'Dès 27 900 FCFA par mois, sans engagement', '1 mois payé, 1 mois offert pour démarrer', 'Jusqu\'à 103 870 FCFA pour vous la 1re année, puis 111 860 FCFA chaque année, par restaurant'])}
              <div class="pg-cta">
                <a class="btn btn--primary" href="connexion.html?mode=inscription">Je représente Epicure →</a>
                <a class="btn btn--ghost" href="https://unusuall.online/epicure.html" target="_blank" rel="noopener">Voir Epicure ↗</a>
              </div>
            </div>
          </article>

          <div class="ep-section">
            <div class="ep-head" data-ep-reveal><h2>Bientôt disponibles</h2><p>Inscrivez-vous : vous serez prévenu en premier.</p></div>
            <ul class="amb-products" data-ep-stagger>
              <li class="amb-product"><span class="amb-product__ico"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-4.5-7-11a4 4 0 0 1 7-2.5 4 4 0 0 1 7 2.5c0 6.5-7 11-7 11z"/></svg></span><div><strong>Suite SOFIA</strong><span>Pour les cliniques et hôpitaux.</span></div><em class="pg-pill pg-pill--dev">Bientôt</em></li>
              <li class="amb-product"><span class="amb-product__ico"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg></span><div><strong>OMI</strong><span>Pour ranger ses données mobiles.</span></div><em class="pg-pill pg-pill--dev">Bientôt</em></li>
            </ul>
          </div>
${FINAL('Epicure vous parle ?', 'Inscrivez-vous et commencez dès votre validation.')}`
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
  desc: "30 % du premier mois, puis 10 % chaque mois, et 30 % à nouveau chaque année tant que le client paie. Jusqu'à 103 870 FCFA la 1re année pour un seul restaurant. Calculez vos gains.",
  windowTitle: 'Gains',
  back: { href: 'index.html', label: 'Programme' },
  body: `${SUBNAV([['gains.html', 'Gains'], ['avantages.html', 'Avantages']], 'gains.html')}
          <div class="ep-head amb-top" data-ep-reveal>
            <p class="pg-eyebrow">Vos gains</p>
            <h1 class="pg-title">Un client signé, <span class="flame-text">des revenus chaque année.</span></h1>
          </div>

          <div class="amb-rule" data-ep-stagger>
            <div><b>30 %</b><span>du 1er mois, puis à chaque anniversaire (13e, 25e mois…)</span></div>
            <div><b>10 %</b><span>de tous les autres mois payés, sans limite de durée</span></div>
          </div>

          <div class="ep-section">
            <div class="amb-sim" data-ep-reveal>
              <div>
                <h2>Calculez vos gains</h2>
                <p class="amb-sim__hint">Combien de restaurants pouvez-vous convaincre ?</p>${stepper('s-standard', 'Standard', 5)}${stepper('s-premium', 'Premium', 3)}${stepper('s-ultra', 'Ultra', 1)}
              </div>
              <div class="amb-sim__result" aria-live="polite">
                <div><small>À la signature</small><b id="r-sign">107 130</b><span>FCFA</span></div>
                <div><small>Chaque mois</small><b id="r-month">35 710</b><span>FCFA, du 3e au 12e mois</span></div>
                <div class="amb-sim__total"><small>Total la 1re année</small><b id="r-year">464 230</b><span>FCFA</span></div>
                <div class="amb-sim__next"><small>Puis chaque année</small><b id="r-next">499 940</b><span>FCFA, tant qu'ils restent abonnés</span></div>
              </div>
            </div>
          </div>

          <div class="ep-section">
            <div class="ep-head" data-ep-reveal><h2>Par restaurant Epicure</h2></div>
            <div class="amb-table" data-ep-reveal>
              <table>
                <thead><tr><th scope="col">Formule</th><th scope="col">À la signature</th><th scope="col">Chaque mois</th><th scope="col">1re année</th><th scope="col">Années suivantes</th></tr></thead>
                <tbody>
${PLANS.map(([n, p], i) => `                  <tr${i === 1 ? ' class="is-hot"' : ''}><th scope="row">${n}</th><td>${f(p * 0.3)}</td><td>${f(p * 0.1)}</td><td><b>${f(p * 0.3 + p * 0.1 * 10)}</b></td><td><b>${f(p * 0.3 + p * 0.1 * 11)}</b></td></tr>`).join('\n')}
                </tbody>
              </table>
              <p>En FCFA, par an et par restaurant. Le 2e mois est offert au client à son inscription : pas de commission ce mois-là. Dès la 2e année, chaque mois payé rapporte (30 % le mois anniversaire, 10 % les autres). Détails dans le <a href="reglement.html">règlement</a>.</p>
            </div>
          </div>
${FINAL('Ces chiffres vous plaisent ?', 'Inscrivez-vous en deux minutes.', ['avantages.html', 'Voir les avantages'])}`
});

/* 4. Avantages */
const PERK = (ico, t, d, gold) => `<li class="ep-card${gold ? ' ep-card--accent' : ''}"><span class="pg-ico${gold ? ' pg-ico--gold' : ''}"><svg viewBox="0 0 24 24" aria-hidden="true">${ico}</svg></span><div><strong>${t}</strong><small>${d}</small></div></li>`;
PAGES.push({
  file: 'avantages.html',
  title: 'Vos avantages · Ambassadeurs UNUSUALL',
  desc: "Formation offerte, titre officiel, priorité d'embauche, kit complet et liberté totale.",
  windowTitle: 'Avantages',
  back: { href: 'index.html', label: 'Programme' },
  body: `${SUBNAV([['gains.html', 'Gains'], ['avantages.html', 'Avantages']], 'avantages.html')}
          <div class="ep-head amb-top" data-ep-reveal>
            <p class="pg-eyebrow">En plus de l'argent</p>
            <h1 class="pg-title">Vous gagnez <span class="flame-text">bien plus.</span></h1>
          </div>

          <ul class="ep-grid" data-ep-stagger>
            ${PERK('<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>', 'Formation offerte', 'Vente et marketing, avec attestation.')}
            ${PERK('<path d="M20 7H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1z"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>', "Priorité d'embauche", 'Les meilleurs sont recrutés en premier.', true)}
            ${PERK('<circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 8 5-3 5 3-1.5-8"/>', 'Titre officiel', '« Ambassadeur UNUSUALL » sur votre CV.')}
            ${PERK('<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3"/>', 'Kit complet', 'Visuels, vidéos et argumentaire prêts.')}
            ${PERK('<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>', 'Produits offerts', 'Pour faire vos démonstrations.')}
            ${PERK('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 'Liberté totale', 'Vos horaires, votre zone.')}
          </ul>

          <div class="ep-section">
            <div class="ep-head" data-ep-reveal><h2>Montez de niveau</h2></div>
            <div class="amb-levels" data-ep-stagger>
              <div class="amb-level"><p class="amb-level__n">Niveau 1</p><h3>Ambassadeur</h3><p class="amb-level__when">Dès l'inscription</p>${CHECK(['Commissions', 'Formation et kit'])}</div>
              <div class="amb-level"><p class="amb-level__n">Niveau 2</p><h3>Confirmé</h3><p class="amb-level__when">5 clients actifs</p>${CHECK(['Formation avancée', 'Mis en avant sur nos réseaux'])}</div>
              <div class="amb-level amb-level--top"><p class="amb-level__n">Niveau 3</p><h3>Élite</h3><p class="amb-level__when">15 clients actifs</p>${CHECK(["Priorité d'embauche", 'Lettre de recommandation'])}</div>
            </div>
          </div>

          <div class="ep-section">
            <div class="amb-charter" data-ep-reveal>
              <div><h2>Nos 3 règles</h2><p>Vous faites la publicité comme vous voulez, avec ces règles simples. Tout le détail (paiements, durée, fin de partenariat) est dans le <a href="reglement.html">règlement du programme</a>.</p></div>
              ${CHECK(['Dire la vérité sur nos produits', 'Garder nos prix, sans fausses réductions', 'Pas de spam, pas de faux clients'])}
            </div>
          </div>
${FINAL('Envie de nous rejoindre ?', 'Inscription gratuite, réponse sous 72 heures.')}`
});

/* 5. Postuler */
const FAQ = [
  ['Faut-il de l\x27expérience ?', 'Non. L\x27envie de convaincre suffit, on vous forme.'],
  ['Dois-je payer quelque chose ?', 'Non. Tout est gratuit : compte, formation et kit.'],
  ['Comment suis-je payé ?', 'Chaque mois, par Mobile Money, sans minimum et sans frais pour vous. Tout est visible dans votre espace.'],
  ['Pendant combien de temps je touche des commissions ?', 'Tant que votre client reste abonné : 30 % de son 1er mois, puis 10 % de chaque mois payé, et de nouveau 30 % à chaque anniversaire (13e mois, 25e mois…).'],
  ['Comment savez-vous que le client vient de moi ?', 'Grâce à votre lien personnel et à votre QR code : chaque clic, inscription et paiement est compté automatiquement.'],
  ['Puis-je représenter plusieurs produits ?', 'Oui. Epicure est ouvert, les autres arrivent bientôt.'],
  ['Est-ce un emploi salarié ?', 'Non, vous êtes indépendant. Mais les meilleurs sont recrutés en priorité.']
];
PAGES.push({
  file: 'postuler.html',
  title: 'Postuler · Ambassadeurs UNUSUALL',
  desc: 'Créez votre compte, postulez pour devenir Ambassadeur UNUSUALL et choisissez les produits que vous voulez représenter. Gratuit, réponse sous 72 heures.',
  windowTitle: 'Postuler',
  back: { href: 'index.html', label: 'Programme' },
  jsonld: [{ '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }],
  body: `${SUBNAV([['index.html', 'Programme'], ['postuler.html', 'Postuler']], 'postuler.html')}
          <div class="ep-hero">
            <div class="pg-copy">
              <p class="pg-eyebrow">Candidature</p>
              <h1 class="pg-title">Rejoignez <span class="flame-text">l'équipe.</span></h1>
              <p class="pg-lead">Créez votre compte, remplissez votre candidature. Réponse sous 72 heures.</p>
              <div class="pg-cta">
                <a class="btn btn--primary" href="connexion.html?mode=inscription">Créer mon compte et postuler →</a>
                <a class="btn btn--ghost" href="connexion.html">J'ai déjà un compte</a>
              </div>
              <ul class="ep-facts"><li>Gratuit</li><li>Réponse sous 72 heures</li><li>Formation dès votre validation</li></ul>
            </div>
          </div>

          <div class="ep-section">
            <div class="ep-head" data-ep-reveal><h2>En 3 étapes</h2></div>
            <ol class="ep-steps" data-ep-stagger>
              <li><strong>Créez votre compte</strong><span>Avec votre e-mail et un mot de passe.</span></li>
              <li><strong>Postulez</strong><span>En deux minutes.</span></li>
              <li><strong>Suivez vos gains</strong><span>Lien, restaurants et paiements dans votre espace.</span></li>
            </ol>
          </div>

          <div class="ep-section">
            <div class="ep-head" data-ep-reveal><h2>Vos questions</h2></div>
            <div class="ep-faq">
${FAQ.map(([q, a]) => `              <details><summary>${q}</summary><p>${a}</p></details>`).join('\n')}
            </div>
          </div>`
});

/* 5 bis. Règlement du programme */
const RULE = (n, ico, title, paras) => `
            <div class="pg-legal__card">
              <span class="pg-legal__n">${String(n).padStart(2, '0')}</span>
              <div class="pg-legal__head"><span class="pg-ico"><svg viewBox="0 0 24 24" aria-hidden="true">${ico}</svg></span><h2>${title}</h2></div>
${paras.map((p) => `              <p>${p}</p>`).join('\n')}
            </div>`;
PAGES.push({
  file: 'reglement.html',
  title: 'Règlement du programme · Ambassadeurs UNUSUALL',
  desc: 'Règlement du programme Ambassadeurs UNUSUALL : conditions, attribution des clients, calcul et versement des commissions, règles de conduite et fin du partenariat.',
  windowTitle: 'Règlement',
  back: { href: 'index.html', label: 'Programme' },
  body: `
          <div class="ep-head amb-top" data-ep-reveal>
            <p class="pg-eyebrow">En vigueur au 19 novembre 2026</p>
            <h1 class="pg-title">Règlement du <span class="flame-text">programme</span></h1>
            <p>Les règles qui s'appliquent à tous les Ambassadeurs UNUSUALL. En postulant, vous les acceptez.</p>
          </div>

          <article class="pg-legal">${RULE(1, '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', 'Qui peut participer', [
    "Le programme est ouvert à toute personne majeure (18 ans ou plus). L'inscription, la formation et le kit sont gratuits.",
    "Vous devenez ambassadeur une fois votre candidature validée par UNUSUALL. UNUSUALL peut refuser une candidature."
  ])}${RULE(2, '<path d="M20 7H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1z"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>', 'Votre statut', [
    "Vous êtes indépendant : ce n'est ni un emploi salarié, ni un contrat d'agent. Vous organisez votre temps comme vous voulez.",
    "Vous ne signez rien et n'encaissez jamais d'argent au nom d'UNUSUALL : le client paie toujours directement dans Epicure.",
    'Vous déclarez vous-même vos revenus si la loi de votre pays le demande.'
  ])}${RULE(3, '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>', 'Comment un client vous est attribué', [
    "Un restaurant est à vous s'il s'inscrit sur Epicure avec votre lien personnel, votre QR code ou votre code ambassadeur.",
    "Le premier ambassadeur enregistré garde le client. Un restaurant déjà inscrit sur Epicure avant votre contact ne peut pas vous être attribué."
  ])}${RULE(4, '<path d="M4 20V4"/><path d="M4 16h16"/><path d="M8 16V8"/><path d="M12 16V11"/><path d="M16 16V6"/>', 'Calcul des commissions', [
    "<strong>30 %</strong> du 1er mois payé par le client, puis <strong>10 %</strong> de chaque mois payé suivant.",
    "Le 2e mois est offert au client à son inscription : il ne donne pas de commission.",
    "Chaque année, le mois anniversaire (13e mois, 25e mois…) rapporte de nouveau <strong>30 %</strong>. Les commissions continuent tant que le client reste abonné.",
    'La commission est calculée sur le montant réellement encaissé par UNUSUALL, après remise éventuelle.'
  ])}${RULE(5, '<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20M6 15h4"/>', 'Validation et versement', [
    "Une commission est validée 7 jours après le paiement du client. Les commissions validées sont arrêtées le 28 de chaque mois et versées le 5 du mois suivant.",
    "Le versement se fait par Mobile Money, sur le numéro de votre compte. <strong>Il n'y a pas de minimum</strong> et <strong>les frais d'envoi sont payés par UNUSUALL</strong>.",
    'Tout est visible dans votre espace : clients, paiements, commissions et versements.'
  ])}${RULE(6, '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>', 'Remboursement et arrêt du client', [
    "Si un client est remboursé, la commission correspondante est annulée. Si elle vous a déjà été versée, elle est déduite de vos prochains versements.",
    "Si un client arrête de payer, les commissions s'arrêtent avec lui. Elles reprennent s'il se réabonne."
  ])}${RULE(7, '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>', 'Ce qui est interdit', [
    'Mentir sur nos produits, inventer des fonctionnalités ou annoncer de fausses réductions.',
    "Envoyer du spam, créer de faux clients ou payer à la place d'un client pour toucher une commission.",
    "Vous inscrire vous-même comme client : les inscriptions de votre propre restaurant sont vérifiées et peuvent ne pas donner droit à commission.",
    "Vous présenter comme salarié d'UNUSUALL ou utiliser notre nom et nos logos en dehors du programme."
  ])}${RULE(8, '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>', 'Fin du partenariat', [
    'Vous pouvez quitter le programme à tout moment en écrivant à <a href="mailto:services@unusuall.online">services@unusuall.online</a>.',
    "UNUSUALL peut suspendre ou retirer un ambassadeur qui ne respecte pas ce règlement. Son statut apparaît alors dans l'annuaire public.",
    "Les commissions déjà gagnées vous restent acquises et sont versées normalement, <strong>sauf en cas de fraude</strong> : elles sont alors annulées. Après la fin du partenariat, aucune nouvelle commission n'est générée."
  ])}${RULE(9, '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', 'Vos données', [
    "Vos informations (nom, contact, ville, réseau, motivation) servent à étudier votre candidature, suivre vos clients et vous payer. Elles ne sont ni vendues, ni partagées.",
    "Vous n'apparaissez dans l'annuaire public que si vous l'acceptez. Pour consulter, corriger ou supprimer vos données, écrivez à services@unusuall.online."
  ])}${RULE(10, '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>', 'Modifications', [
    "UNUSUALL peut faire évoluer ce règlement. Vous serez prévenu par e-mail ou WhatsApp au moins 30 jours avant tout changement des commissions.",
    "Un changement ne s'applique jamais aux commissions déjà gagnées."
  ])}
          </article>
${FINAL('Ces règles vous conviennent ?', 'Inscription gratuite, réponse sous 72 heures.')}`
});

/* 6. Connexion */
PAGES.push({
  file: 'connexion.html',
  title: 'Connexion · Ambassadeurs UNUSUALL',
  desc: 'Connectez-vous à votre espace ambassadeur UNUSUALL ou créez votre compte pour postuler.',
  windowTitle: 'Connexion',
  back: { href: 'index.html', label: 'Programme' },
  account: 'login',
  noindex: true,
  body: `
          <div class="pg-split pg-split--tight amb-auth">
            <div class="pg-copy">
              <p class="pg-eyebrow">Espace ambassadeur</p>
              <h1 class="pg-title">Votre espace <span class="flame-text">ambassadeur</span></h1>
              <p class="pg-lead">Un seul compte pour postuler, puis suivre vos gains.</p>
              ${CHECK(['Gratuit', 'Vos données ne sont visibles que par vous et UNUSUALL', 'Accessible sur téléphone et ordinateur'])}
            </div>
            <div class="pg-card">
              <div class="amb-tabs" role="tablist">
                <button type="button" role="tab" data-mode="login" aria-selected="true">Se connecter</button>
                <button type="button" role="tab" data-mode="signup" aria-selected="false">Créer un compte</button>
              </div>

              <form class="pg-form amb-form1" id="login-form" novalidate>
                <div class="form-group span-2"><label for="l-email">E-mail</label><input id="l-email" name="email" type="email" class="form-control" autocomplete="email" required></div>
                <div class="form-group span-2"><label for="l-pass">Mot de passe</label><input id="l-pass" name="password" type="password" class="form-control" autocomplete="current-password" required></div>
                <button class="btn btn--primary span-2" type="submit">Se connecter</button>
                <a href="#" class="amb-link span-2" data-mode="reset">Mot de passe oublié ?</a>
              </form>

              <form class="pg-form amb-form1" id="signup-form" novalidate hidden>
                <div class="form-group span-2"><label for="s-name">Nom et prénom</label><input id="s-name" name="nom" type="text" class="form-control" autocomplete="name" required maxlength="100"></div>
                <div class="form-group span-2"><label for="s-email">E-mail</label><input id="s-email" name="email" type="email" class="form-control" autocomplete="email" required></div>
                <div class="form-group"><label for="s-pass">Mot de passe</label><input id="s-pass" name="password" type="password" class="form-control" autocomplete="new-password" minlength="8" required></div>
                <div class="form-group"><label for="s-confirm">Confirmation</label><input id="s-confirm" name="confirm" type="password" class="form-control" autocomplete="new-password" minlength="8" required></div>
                <p class="amb-hint span-2">8 caractères minimum.</p>
                <button class="btn btn--primary span-2" type="submit">Créer mon compte</button>
              </form>

              <form class="pg-form amb-form1" id="reset-form" novalidate hidden>
                <p class="amb-hint span-2">Indiquez votre e-mail : nous vous envoyons un lien pour choisir un nouveau mot de passe.</p>
                <div class="form-group span-2"><label for="r-email">E-mail</label><input id="r-email" name="email" type="email" class="form-control" autocomplete="email" required></div>
                <button class="btn btn--primary span-2" type="submit">Recevoir le lien</button>
                <a href="#" class="amb-link span-2" data-mode="login">← Retour à la connexion</a>
              </form>

              <p class="form-error" id="auth-error" role="alert" hidden></p>
              <p class="amb-info" id="auth-info" role="status" hidden></p>
            </div>
          </div>`
});

/* 7. Mon espace */
PAGES.push({
  file: 'espace.html',
  title: 'Mon espace · Ambassadeurs UNUSUALL',
  desc: 'Votre espace ambassadeur UNUSUALL : candidature, lien personnel, QR code, restaurants, gains et versements.',
  windowTitle: 'Mon espace',
  account: 'space',
  noindex: true,
  body: `
          <div class="amb-space-head">
            <div><p class="pg-eyebrow">Espace ambassadeur</p><h1 class="pg-title" id="space-hello">Bonjour</h1></div>
            <button type="button" class="btn btn--ghost" id="logout">Se déconnecter</button>
          </div>

          <div id="space" aria-live="polite"><p class="amb-empty">Chargement de votre espace…</p></div>

          <form class="pg-form amb-apply-form" id="apply-form" novalidate hidden>
            <div class="pg-card__head span-2"><h2>Votre candidature</h2><p>Les champs marqués d'un * sont obligatoires. Une candidature complète et sérieuse est traitée en priorité.</p></div>
            <div class="form-group"><label for="f-name">Nom et prénom *</label><input id="f-name" name="nom" type="text" class="form-control" autocomplete="name" required maxlength="100"></div>
            <div class="form-group"><label for="f-email">E-mail</label><input id="f-email" name="email" type="email" class="form-control" readonly></div>

            <div class="form-group"><label for="f-phone">Téléphone WhatsApp *</label><input id="f-phone" name="whatsapp" type="tel" class="form-control" autocomplete="tel" inputmode="tel" placeholder="+229 …" required maxlength="30"></div>
            <div class="form-group"><label for="f-city">Ville *</label><input id="f-city" name="ville" type="text" class="form-control" autocomplete="address-level2" required maxlength="80"></div>
            <div class="form-group"><label for="f-district">Quartier *</label><input id="f-district" name="quartier" type="text" class="form-control" autocomplete="address-level3" required maxlength="80" placeholder="Ex. : Fidjrossè, Akpakpa…"></div>
            <div class="form-group"><label for="f-job">Profession actuelle *</label><input id="f-job" name="profession" type="text" class="form-control" required maxlength="100" placeholder="Ex. : étudiant, commercial, gérant…"></div>

            <fieldset class="form-group span-2 amb-choose" data-require-group="reseau">
              <legend>Votre réseau * <small>(au moins un)</small></legend>
              <label class="amb-choice"><input type="checkbox" name="reseau" value="Restaurateurs que je connais"><span><b>Restaurateurs</b><small>Je connais des gérants de restaurants, maquis, bars…</small></span></label>
              <label class="amb-choice"><input type="checkbox" name="reseau" value="Communauté (église, quartier, association)"><span><b>Communauté</b><small>Église, quartier, association, école…</small></span></label>
              <label class="amb-choice"><input type="checkbox" name="reseau" value="Réseaux sociaux"><span><b>Réseaux sociaux</b><small>Facebook, Instagram, TikTok, WhatsApp…</small></span></label>
              <label class="amb-choice"><input type="checkbox" name="reseau" value="Autre"><span><b>Autre</b><small>Un autre réseau utile pour convaincre.</small></span></label>
            </fieldset>

            <div class="form-group span-2"><label for="f-profile-link">Lien vers un profil (Facebook, Instagram, LinkedIn…) *</label><input id="f-profile-link" name="profilLien" type="url" class="form-control" required maxlength="300" placeholder="https://…"><p class="amb-hint">Pour vérifier que votre profil existe. Il ne sera pas publié.</p></div>
            <div class="form-group span-2"><label for="f-photo">Lien vers une photo de profil (facultatif)</label><input id="f-photo" name="photo" type="url" class="form-control" maxlength="300" placeholder="https://…"><p class="amb-hint">Ajoutée à votre fiche dans l'annuaire public.</p></div>

            <fieldset class="form-group span-2 amb-choose">
              <legend>Les produits que vous voulez représenter *</legend>
              <label class="amb-choice"><input type="checkbox" name="produits" value="Epicure" checked required><span><b>Epicure</b><small>Gestion de restaurant · ouvert</small></span></label>
              <label class="amb-choice is-soon"><input type="checkbox" name="produits_futurs" value="Suite SOFIA"><span><b>Suite SOFIA</b><small>Santé · me prévenir à l'ouverture</small></span></label>
              <label class="amb-choice is-soon"><input type="checkbox" name="produits_futurs" value="OMI"><span><b>OMI</b><small>Données mobiles · me prévenir à l'ouverture</small></span></label>
            </fieldset>

            <div class="form-group span-2"><label for="f-motivation">Comment comptes-tu présenter Epicure à un restaurateur ? *</label><textarea id="f-motivation" name="motivation" class="form-control" rows="5" required minlength="80" maxlength="2000" placeholder="Décrivez concrètement votre approche : ce que vous direz au gérant, comment vous gérerez ses objections, comment vous le ferez essayer…"></textarea><p class="amb-hint">Une réponse détaillée (80 caractères minimum) montre que vous avez lu la formation.</p></div>

            <label class="amb-agree span-2"><input type="checkbox" name="annuaire" value="1" checked> J'accepte d'apparaître dans l'<a href="annuaire.html">annuaire public</a> des ambassadeurs certifiés (nom, ville, produits, photo).</label>
            <label class="amb-agree span-2"><input type="checkbox" name="charte" value="acceptee" required> J'accepte le <a href="reglement.html" target="_blank" rel="noopener">règlement du programme</a> et le traitement de mes données pour étudier ma candidature. *</label>
            <p class="form-error" id="apply-error" role="alert" hidden></p>
            <button class="btn btn--primary" type="submit">Envoyer ma candidature →</button>
          </form>`
});

/* 8. Administration (réservée, non référencée) */
PAGES.push({
  file: 'admin.html',
  title: 'Administration · Ambassadeurs UNUSUALL',
  desc: 'Administration du programme Ambassadeurs UNUSUALL.',
  windowTitle: 'Administration',
  account: 'admin',
  noindex: true,
  body: `
          <div class="amb-space-head">
            <div><p class="pg-eyebrow">Réservé à UNUSUALL</p><h1 class="pg-title">Ambassadeurs</h1></div>
            <button type="button" class="btn btn--ghost" id="logout">Se déconnecter</button>
          </div>
          <div id="admin" aria-live="polite"><p class="amb-empty">Chargement…</p></div>`
});

/* 9. Annuaire public des ambassadeurs (vérification) */
PAGES.push({
  file: 'annuaire.html',
  title: 'Annuaire des ambassadeurs · UNUSUALL',
  desc: "Vérifiez qu'une personne est bien un Ambassadeur certifié UNUSUALL. Recherche par nom, code ambassadeur ou numéro de téléphone.",
  windowTitle: 'Annuaire',
  back: { href: 'index.html', label: 'Programme' },
  script: 'annuaire.js',
  body: `
          <div class="ep-head amb-top" data-ep-reveal>
            <p class="pg-eyebrow">Annuaire public</p>
            <h1 class="pg-title">Vérifiez un Ambassadeur <span class="flame-text">UNUSUALL</span></h1>
            <p>Recherchez par nom, code ambassadeur ou numéro de téléphone.</p>
          </div>

          <form class="ann-search" id="ann-search" role="search" novalidate>
            <div class="ann-search__field">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
              <input id="ann-q" type="search" name="q" autocomplete="off" spellcheck="false" placeholder="Nom, code (ex. U7XK2M) ou téléphone" aria-label="Nom, code ambassadeur ou numéro de téléphone">
            </div>
            <button class="btn btn--primary" type="submit">Rechercher</button>
          </form>

          <div id="ann-results" class="ann-results" aria-live="polite">
            <div class="ann-idle">
              <span class="ann-idle__ico"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></span>
              <p>Entrez un nom, un code ou un numéro complet pour vérifier si la personne est un ambassadeur certifié.</p>
            </div>
          </div>

          <p class="ann-help">Un doute sur une personne ? <a href="mailto:services@unusuall.online?subject=Signalement%20ambassadeur%20UNUSUALL">Signalez-la à services@unusuall.online</a>.</p>`
});

for (const p of PAGES) {
  fs.writeFileSync(path.join(root, p.file), page(p));
  console.log('ok', p.file);
}
