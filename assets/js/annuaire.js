/* UNUSUALL Ambassadeurs — annuaire public
   Recherche par nom, code ambassadeur ou numéro de téléphone via le Worker (/directory). */
const FUNCTIONS_ORIGIN = 'https://unusuall-ambassadeurs.antonellatamadaho.workers.dev';

const $ = (s, c = document) => c.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dateFr = (t) => {
  if (!t) return '—';
  const d = new Date(String(t).replace(/(\.\d{3})\d*/, '$1'));
  return isNaN(d) ? '—' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};
const initials = (nom) => String(nom || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';

const SEARCH_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
const CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
const CROSS_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';

const form = $('#ann-search');
const input = $('#ann-q');
const results = $('#ann-results');

if (form && input && results) {
  const STATUT = { actif: 'Actif', suspendu: 'Suspendu', retire: 'Retiré' };
  const CLS = { actif: 'ann-card--actif', suspendu: 'ann-card--suspendu', retire: 'ann-card--retire' };
  const BADGE = { actif: 'ann-badge--actif', suspendu: 'ann-badge--suspendu', retire: 'ann-badge--retire' };

  const idle = () => {
    results.innerHTML = `<div class="ann-idle"><span class="ann-idle__ico">${SEARCH_SVG}</span><p>Entrez un nom, un code ou un numéro pour vérifier si la personne est un ambassadeur certifié.</p></div>`;
  };

  const notFound = (q) => `<div class="ann-none">
    <span class="ann-none__ico">${CROSS_SVG}</span>
    <h2>Cette personne n'est pas ambassadeur UNUSUALL.</h2>
    <p>Aucun résultat pour « ${esc(q)} ». Si quelqu'un se présente comme ambassadeur sans figurer ici,
      <a href="mailto:services@unusuall.online?subject=${encodeURIComponent('Signalement d\'un faux ambassadeur UNUSUALL')}">signalez-le à services@unusuall.online</a>.</p>
  </div>`;

  const card = (a) => {
    const certified = a.status === 'actif';
    const st = certified ? 'actif' : (a.status === 'suspendu' ? 'suspendu' : 'retire');
    const photo = a.photo && /^https?:\/\//i.test(a.photo)
      ? `<img src="${esc(a.photo)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'ann-avatar',textContent:this.dataset.i}))" data-i="${esc(initials(a.nom))}">`
      : `<span class="ann-avatar">${esc(initials(a.nom))}</span>`;
    const verify = certified
      ? `<p class="ann-verify"><span class="ann-verify__ico">${CHECK_SVG}</span>Ambassadeur certifié UNUSUALL</p>`
      : `<p class="ann-verify ann-verify--warn"><span class="ann-verify__ico">!</span>Badge ${st === 'suspendu' ? 'suspendu' : 'retiré'}</p>`;
    return `<article class="ann-card ${CLS[st]}">
      <div class="ann-card__photo">${photo}</div>
      <div class="ann-card__main">
        ${verify}
        <h2 class="ann-name">${esc(a.nom || 'Ambassadeur UNUSUALL')}</h2>
        <dl class="ann-meta">
          <div><dt>Ville</dt><dd>${esc(a.ville || '—')}${a.quartier ? ' · ' + esc(a.quartier) : ''}</dd></div>
          <div><dt>Produits</dt><dd>${esc((a.produits || []).join(', ') || '—')}</dd></div>
          <div><dt>Ambassadeur depuis</dt><dd>${esc(dateFr(a.entryAt))}</dd></div>
          <div><dt>Code</dt><dd><code class="ann-code">${esc(a.code || '—')}</code></dd></div>
        </dl>
        <span class="ann-badge ${BADGE[st]}">${esc(STATUT[st] || st)}</span>
        ${certified ? '' : `<p class="ann-warn">Cette personne n'est pas autorisée à représenter UNUSUALL actuellement. Signalez toute usurpation à <a href="mailto:services@unusuall.online">services@unusuall.online</a>.</p>`}
      </div>
    </article>`;
  };

  let seq = 0;
  async function run(q) {
    const term = q.trim();
    if (term.length < 2) { idle(); return; }
    const my = ++seq;
    results.innerHTML = `<div class="ann-loading"><span class="ann-spinner" aria-hidden="true"></span>Recherche…</div>`;
    try {
      const res = await fetch(`${FUNCTIONS_ORIGIN}/directory?q=${encodeURIComponent(term)}`, { headers: { Accept: 'application/json' } });
      const list = await res.json().catch(() => null);
      if (my !== seq) return;
      if (!Array.isArray(list)) throw new Error('bad response');
      if (!list.length) { results.innerHTML = notFound(term); return; }
      results.innerHTML = `<p class="ann-count">${list.length} résultat${list.length > 1 ? 's' : ''}</p>${list.map(card).join('')}`;
    } catch {
      if (my !== seq) return;
      results.innerHTML = `<div class="ann-none"><span class="ann-none__ico">${CROSS_SVG}</span><h2>Recherche momentanément indisponible</h2><p>Vérifiez votre connexion puis réessayez.</p></div>`;
    }
  }

  function setUrl(q) {
    const u = new URL(location.href);
    if (q.trim()) u.searchParams.set('q', q.trim()); else u.searchParams.delete('q');
    history.replaceState(null, '', u);
  }

  let timer;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(timer);
    run(input.value);
    setUrl(input.value);
  });
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { run(input.value); setUrl(input.value); }, 350);
  });

  const initial = new URLSearchParams(location.search).get('q');
  if (initial && initial.trim().length >= 2) { input.value = initial; run(initial); }
}
