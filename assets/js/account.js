/* UNUSUALL Ambassadeurs — comptes (Firebase Auth + Firestore + Functions)
   Pages : connexion.html (login/inscription/mot de passe oublié),
           espace.html (candidature, statut, tableau de bord, lien et QR code),
           admin.html (candidatures, suivi des liens, récapitulatif, réglages). */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, signOut, updateProfile
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, collection, collectionGroup, getDocs,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const app = initializeApp({
  apiKey: 'AIzaSyB4OLdU0kwFNai7mMuMW-6EGuql0wPkceo',
  authDomain: 'unusuall-ambassadeurs.firebaseapp.com',
  projectId: 'unusuall-ambassadeurs',
  storageBucket: 'unusuall-ambassadeurs.firebasestorage.app',
  messagingSenderId: '156535352236',
  appId: '1:156535352236:web:c6f8a6447570e495826809'
});
const auth = getAuth(app);
auth.languageCode = 'fr';
const db = getFirestore(app);

const FORMSPREE = 'https://formspree.io/f/xzdqanqq';
/* Backend gratuit : Worker Cloudflare (worker/index.js), pas de Cloud Functions. */
const FUNCTIONS_ORIGIN = 'https://unusuall-ambassadeurs.antonellatamadaho.workers.dev';
const PAGE = document.body.dataset.account;

/* Réglages par défaut (miroir de worker/index.js) — l'espace ambassadeur les
   utilise pour l'affichage ; seuls les admins lisent settings/platform. */
const DEFAULT_SETTINGS = {
  firstPct: 30, recurringPct: 10, offeredMonth: 2, maxMonths: 12,
  validationDays: 7, closingDay: 28, paymentDay: 5,
  epicureUrl: 'https://app.epicure.unusuall.online'
};

/* ───────── Outils ───────── */
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fcfa = (n) => Math.round(n || 0).toLocaleString('fr-FR').replace(/\s/g, ' ') + ' FCFA';
const dateFr = (t) => (t && t.toDate ? t.toDate() : t ? new Date(t) : null)?.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) || '—';
const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const periodLabel = (p) => {
  const [y, m] = String(p || '').split('-').map(Number);
  return y && m ? new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '—';
};
const referralLink = (code) => `${FUNCTIONS_ORIGIN}/go?a=${encodeURIComponent(code || '')}`;
const qrLink = (code) => `${FUNCTIONS_ORIGIN}/qr?a=${encodeURIComponent(code || '')}`;

const ERRORS = {
  'auth/invalid-email': "Cette adresse e-mail n'est pas valide.",
  'auth/missing-password': 'Indiquez votre mot de passe.',
  'auth/invalid-credential': 'E-mail ou mot de passe incorrect.',
  'auth/wrong-password': 'E-mail ou mot de passe incorrect.',
  'auth/user-not-found': 'Aucun compte avec cette adresse e-mail.',
  'auth/email-already-in-use': 'Un compte existe déjà avec cette adresse. Connectez-vous.',
  'auth/weak-password': 'Le mot de passe doit contenir au moins 8 caractères.',
  'auth/too-many-requests': 'Trop de tentatives. Réessayez dans quelques minutes.',
  'auth/network-request-failed': 'Connexion internet impossible. Vérifiez votre réseau.',
  'permission-denied': 'Action non autorisée. Reconnectez-vous puis réessayez.',
  'unauthenticated': 'Session expirée. Reconnectez-vous puis réessayez.',
  'failed-precondition': 'Aucune commission payable sur cette période.',
  'not-found': 'Élément introuvable. Rechargez la page puis réessayez.',
  'invalid-argument': 'Informations manquantes ou invalides.'
};
const errText = (e) => ERRORS[e?.code] || ERRORS[String(e?.code || '').replace('functions/', '')]
  || (String(e?.code || '').startsWith('functions/') && e?.message)
  || 'Une erreur est survenue. Réessayez dans un instant.';

function busy(btn, on, label) {
  if (!btn) return;
  if (on) { btn.dataset.label = btn.textContent; btn.disabled = true; btn.textContent = label || 'Patientez…'; }
  else { btn.disabled = false; btn.textContent = btn.dataset.label || btn.textContent; }
}
function show(el, msg) { if (!el) return; el.textContent = msg; el.hidden = !msg; }
async function copyBtn(btn, text, okLabel) {
  const label = btn.textContent;
  try { await navigator.clipboard.writeText(text); btn.textContent = okLabel; }
  catch { btn.textContent = text; }
  setTimeout(() => { btn.textContent = label; }, 2200);
}

const COMMISSION_LABEL = { pending: 'En attente', payable: 'Payable', paid: 'Payé', cancelled: 'Annulé' };
const RESTAURANT_LABEL = { inscrit: 'Inscrit', abonne: 'Abonné', resilie: 'Résilié' };

/* Une commission devient « payable » une fois le délai de validation écoulé. */
function commissionState(c) {
  if (c.statut === 'paid' || c.statut === 'cancelled') return c.statut;
  const due = c.payableAt?.toMillis ? c.payableAt.toMillis() : c.payableAt ? new Date(c.payableAt).getTime() : 0;
  return due && due <= Date.now() ? 'payable' : 'pending';
}
function commissionTotals(list) {
  const t = { pending: 0, payable: 0, paid: 0, cancelled: 0 };
  for (const c of list) t[commissionState(c)] += Number(c.montant) || 0;
  return { ...t, earned: t.pending + t.payable + t.paid };
}
function restaurantGains(restaurantId, commissions) {
  return commissions
    .filter((c) => c.restaurantId === restaurantId && c.statut !== 'cancelled')
    .reduce((s, c) => s + (Number(c.montant) || 0), 0);
}
function level(active) { return active >= 15 ? 'Ambassadeur Élite' : active >= 5 ? 'Ambassadeur Confirmé' : 'Ambassadeur'; }

/* Lien du dock et de la barre du haut selon l'état de connexion */
onAuthStateChanged(auth, (user) => {
  const link = $('#account-link');
  if (link) link.textContent = user ? 'Mon espace' : 'Se connecter';
});

/* ───────── Connexion / inscription ───────── */
if (PAGE === 'login') {
  const forms = { login: $('#login-form'), signup: $('#signup-form'), reset: $('#reset-form') };
  const err = $('#auth-error'), info = $('#auth-info');
  const next = new URLSearchParams(location.search).get('next') || 'espace.html';

  const mode = (m) => {
    Object.entries(forms).forEach(([k, f]) => { f.hidden = k !== m; });
    $$('.amb-tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
    $('.amb-tabs').hidden = m === 'reset';
    show(err, ''); show(info, '');
    const first = forms[m].querySelector('input'); if (first) first.focus();
  };
  $$('[data-mode]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); mode(b.dataset.mode); }));
  if (new URLSearchParams(location.search).get('mode') === 'inscription') mode('signup');

  onAuthStateChanged(auth, (user) => { if (user && !document.body.dataset.working) location.replace(next); });

  forms.login.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = forms.login.querySelector('button[type=submit]');
    show(err, ''); busy(btn, true, 'Connexion…');
    try {
      document.body.dataset.working = '1';
      await signInWithEmailAndPassword(auth, forms.login.email.value.trim(), forms.login.password.value);
      location.replace(next);
    } catch (ex) { delete document.body.dataset.working; show(err, errText(ex)); busy(btn, false); }
  });

  forms.signup.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = forms.signup, btn = f.querySelector('button[type=submit]');
    show(err, '');
    if (f.nom.value.trim().length < 2) return show(err, 'Indiquez votre nom et prénom.');
    if (f.password.value.length < 8) return show(err, 'Le mot de passe doit contenir au moins 8 caractères.');
    if (f.password.value !== f.confirm.value) return show(err, 'Les deux mots de passe ne sont pas identiques.');
    busy(btn, true, 'Création du compte…');
    try {
      document.body.dataset.working = '1';
      const cred = await createUserWithEmailAndPassword(auth, f.email.value.trim(), f.password.value);
      await updateProfile(cred.user, { displayName: f.nom.value.trim() });
      location.replace('espace.html');
    } catch (ex) { delete document.body.dataset.working; show(err, errText(ex)); busy(btn, false); }
  });

  forms.reset.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = forms.reset.querySelector('button[type=submit]');
    show(err, ''); busy(btn, true, 'Envoi…');
    try {
      await sendPasswordResetEmail(auth, forms.reset.email.value.trim());
      show(info, 'Si un compte existe avec cette adresse, vous allez recevoir un e-mail pour choisir un nouveau mot de passe. Pensez à regarder vos spams.');
    } catch (ex) { show(err, errText(ex)); }
    busy(btn, false);
  });
}

/* ───────── Espace ambassadeur ───────── */
if (PAGE === 'space') {
  const root = $('#space'), form = $('#apply-form');

  onAuthStateChanged(auth, async (user) => {
    if (!user) return location.replace('connexion.html?next=espace.html');
    $('#space-hello').textContent = `Bonjour ${user.displayName || ''}`.trim();
    $('#logout').addEventListener('click', () => signOut(auth).then(() => location.replace('connexion.html')));
    try {
      const snap = await getDoc(doc(db, 'ambassadors', user.uid));
      if (!snap.exists()) return showApply(user);
      const a = snap.data();
      if (a.status === 'approved') return showDashboard(user, a);
      root.innerHTML = statusCard(a);
    } catch (ex) { root.innerHTML = `<p class="form-error">${esc(errText(ex))}</p>`; }
  });

  function statusCard(a) {
    const rejected = a.status === 'rejected';
    return `
      <div class="amb-status ${rejected ? 'is-rejected' : ''}">
        <span class="pg-pill ${rejected ? '' : 'pg-pill--beta'}">${rejected ? 'Candidature non retenue' : '<i></i>En cours d\'étude'}</span>
        <h2>${rejected ? 'Merci pour votre candidature.' : 'Votre candidature est bien reçue.'}</h2>
        <p>${rejected
          ? 'Elle n\'a pas été retenue cette fois. Vous pourrez repostuler lors de l\'ouverture de nouveaux produits. Une question ? Écrivez-nous à services@unusuall.online.'
          : 'Nous l\'étudions et vous répondons sous 72 heures, par WhatsApp ou par e-mail. Dès sa validation, votre lien personnel, votre QR code et votre tableau de bord apparaîtront ici.'}</p>
        <dl class="amb-summary">
          <div><dt>Envoyée le</dt><dd>${esc(dateFr(a.createdAt))}</dd></div>
          <div><dt>Produits</dt><dd>${esc((a.produits || []).join(', '))}</dd></div>
          <div><dt>Ville</dt><dd>${esc(a.ville)}</dd></div>
          <div><dt>WhatsApp</dt><dd>${esc(a.whatsapp)}</dd></div>
        </dl>
      </div>`;
  }

  function showApply(user) {
    root.innerHTML = '';
    form.hidden = false;
    form.email.value = user.email || '';
    form.nom.value = user.displayName || '';
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#apply-error');
      const bad = $$('[required]', form).filter((f) => {
        const ko = f.type === 'checkbox' ? !f.checked : !f.value.trim();
        f.setAttribute('aria-invalid', String(ko));
        return ko;
      });
      if (bad.length) { show(err, 'Merci de remplir tous les champs obligatoires.'); return bad[0].focus(); }
      show(err, '');
      const btn = form.querySelector('button[type=submit]');
      busy(btn, true, 'Envoi en cours…');
      const data = {
        nom: form.nom.value.trim().slice(0, 100),
        whatsapp: form.whatsapp.value.trim().slice(0, 30),
        email: user.email,
        ville: form.ville.value.trim().slice(0, 80),
        profil: form.profil.value.slice(0, 60),
        methode: form.methode.value.trim().slice(0, 2000),
        reseaux: form.reseaux.value.trim().slice(0, 300),
        produits: $$('input[name=produits]:checked', form).map((i) => i.value),
        produitsFuturs: $$('input[name=produits_futurs]:checked', form).map((i) => i.value),
        charte: true,
        status: 'pending',
        code: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      try {
        await setDoc(doc(db, 'ambassadors', user.uid), data);
        // Alerte e-mail pour l'équipe (non bloquante)
        const mail = new FormData();
        mail.append('_subject', '[Ambassadeur UNUSUALL] Nouvelle candidature');
        ['nom', 'whatsapp', 'email', 'ville', 'profil', 'methode', 'reseaux'].forEach((k) => mail.append(k, data[k]));
        mail.append('produits', data.produits.concat(data.produitsFuturs.map((p) => p + ' (à l\'ouverture)')).join(', '));
        fetch(FORMSPREE, { method: 'POST', body: mail, headers: { Accept: 'application/json' } }).catch(() => {});
        form.hidden = true;
        root.innerHTML = statusCard({ ...data, createdAt: new Date() });
      } catch (ex) { show(err, errText(ex)); busy(btn, false); }
    });
  }

  async function showDashboard(user, a) {
    const [rs, ps, cs, vs] = await Promise.all([
      getDocs(collection(db, 'ambassadors', user.uid, 'restaurants')),
      getDocs(collection(db, 'ambassadors', user.uid, 'payments')),
      getDocs(collection(db, 'ambassadors', user.uid, 'commissions')),
      getDocs(collection(db, 'ambassadors', user.uid, 'payouts'))
    ]);
    const restaurants = rs.docs.map((d) => d.data()).sort((x, y) => (y.createdAt?.seconds || 0) - (x.createdAt?.seconds || 0));
    const payments = ps.docs.map((d) => d.data());
    const commissions = cs.docs.map((d) => d.data());
    const payouts = vs.docs.map((d) => d.data()).sort((x, y) => (y.date?.seconds || 0) - (x.date?.seconds || 0));
    const inscrits = restaurants.filter((r) => r.statut !== 'resilie').length;
    const abonnes = restaurants.filter((r) => r.statut === 'abonne').length;
    const totals = commissionTotals(commissions);
    const link = referralLink(a.code);
    const waText = `Je vous recommande Epicure, le logiciel qui aide les restaurants à ne plus perdre d'argent. Découvrez-le ici : ${link}`;

    root.innerHTML = `
      <div class="amb-code amb-share">
        <div>
          <small>Votre lien personnel</small>
          <b id="my-code">${esc(a.code || '—')}</b>
          <span class="amb-link-url" id="my-link">${esc(link)}</span>
          <span>Partagez ce lien ou votre QR code : chaque clic, inscription et paiement est compté automatiquement.</span>
        </div>
        <div class="amb-share__acts">
          <button type="button" class="btn btn--primary" id="copy-link">Copier le lien</button>
          <a class="btn btn--ghost" href="https://wa.me/?text=${encodeURIComponent(waText)}" target="_blank" rel="noopener">Partager sur WhatsApp</a>
          <button type="button" class="btn btn--ghost" id="show-qr">Mon QR code</button>
        </div>
      </div>

      <dialog id="qr-dialog" class="amb-qr">
        <img src="${esc(qrLink(a.code))}" alt="QR code de votre lien ambassadeur" width="240" height="240">
        <p>${esc(link)}</p>
        <small>Faites scanner ce QR code ou enregistrez l'image pour l'imprimer.</small>
        <button type="button" class="btn btn--primary amb-qr__close" id="close-qr">Fermer</button>
      </dialog>

      <ul class="ep-stats amb-kpis">
        <li><b>${Number(a.clicks) || 0}</b><span>clic${(Number(a.clicks) || 0) > 1 ? 's' : ''} sur votre lien</span></li>
        <li><b>${inscrits}</b><span>restaurant${inscrits > 1 ? 's' : ''} inscrit${inscrits > 1 ? 's' : ''}</span></li>
        <li><b>${abonnes}</b><span>abonné${abonnes > 1 ? 's' : ''}</span></li>
        <li><b>${esc(fcfa(totals.pending))}</b><span>en attente</span></li>
        <li><b>${esc(fcfa(totals.payable))}</b><span>payable</span></li>
        <li><b>${esc(fcfa(totals.paid))}</b><span>déjà versés</span></li>
      </ul>

      <p class="amb-level-line"><span class="pg-pill pg-pill--live"><i></i>${esc(level(abonnes))}</span> Produits : ${esc((a.produits || []).join(', '))}</p>

      <section class="amb-block">
        <h2>Vos restaurants</h2>
        ${restaurants.length ? `<div class="amb-table"><table>
          <thead><tr><th scope="col">Restaurant</th><th scope="col">Formule</th><th scope="col">Inscrit le</th><th scope="col">Statut</th><th scope="col">Mois payés</th><th scope="col">Vos gains</th></tr></thead>
          <tbody>${restaurants.map((r) => {
            const paidMonths = payments.filter((p) => p.restaurantId === r.restaurantId && p.statut === 'encaisse').length;
            return `<tr${r.statut === 'resilie' ? ' class="is-off"' : ''}><th scope="row">${esc(r.nom || r.restaurantId)}</th><td>${esc(r.formule || '—')}</td><td>${esc(dateFr(r.createdAt))}</td><td>${esc(RESTAURANT_LABEL[r.statut] || r.statut)}</td><td>${paidMonths}</td><td><b>${esc(fcfa(restaurantGains(r.restaurantId, commissions)))}</b></td></tr>`;
          }).join('')}</tbody>
        </table></div>` : '<p class="amb-empty">Pas encore de restaurant. Partagez votre lien : chaque restaurant qui s\'inscrit avec lui apparaîtra ici, et ses paiements mettront vos gains à jour automatiquement.</p>'}
      </section>

      <section class="amb-block">
        <h2>Vos versements</h2>
        ${payouts.length ? `<ul class="amb-payouts">${payouts.map((p) => `<li><span>${esc(dateFr(p.date))}${p.period ? ' · ' + esc(periodLabel(p.period)) : ''}${p.note ? ' · ' + esc(p.note) : ''}</span><b>${esc(fcfa(p.montant))}</b></li>`).join('')}</ul>`
          : '<p class="amb-empty">Aucun versement pour le moment. Vos commissions sont versées chaque mois par Mobile Money.</p>'}
      </section>

      <section class="amb-block amb-kit">
        <h2>Votre kit</h2>
        <p>Votre lien et votre QR code sont en haut de page. Visuels, argumentaire et vidéos vous sont envoyés par WhatsApp après la formation. Pour présenter Epicure, appuyez-vous aussi sur sa page officielle.</p>
        <div class="pg-cta">
          <a class="btn btn--ghost" href="${esc(DEFAULT_SETTINGS.epicureUrl)}" target="_blank" rel="noopener">Page Epicure ↗</a>
          <a class="btn btn--ghost" href="gains.html">Rappel des gains</a>
          <a class="btn btn--ghost" href="avantages.html">La charte</a>
        </div>
      </section>`;

    $('#copy-link').addEventListener('click', (e) => copyBtn(e.currentTarget, link, 'Lien copié'));
    $('#show-qr').addEventListener('click', () => $('#qr-dialog').showModal());
    $('#close-qr').addEventListener('click', () => $('#qr-dialog').close());
    $('#qr-dialog').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });
  }
}

/* ───────── Administration ───────── */
if (PAGE === 'admin') {
  const root = $('#admin');
  let people = [];
  let settings = { ...DEFAULT_SETTINGS };

  async function adminCall(action, data) {
    const token = await auth.currentUser.getIdToken();
    const res = await fetch(`${FUNCTIONS_ORIGIN}/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...data })
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw { code: out.code || 'internal', message: out.error };
    return out;
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) return location.replace('connexion.html?next=admin.html');
    $('#logout').addEventListener('click', () => signOut(auth).then(() => location.replace('connexion.html')));
    const me = await getDoc(doc(db, 'admins', user.uid)).catch(() => null);
    if (!me || !me.exists()) {
      root.innerHTML = `<div class="amb-status is-rejected"><h2>Accès réservé</h2><p>Ce compte n'est pas administrateur. Votre identifiant : <code>${esc(user.uid)}</code></p></div>`;
      return;
    }
    load();
  });

  async function load() {
    root.innerHTML = '<p class="amb-empty">Chargement…</p>';
    try {
      const [snap, sset] = await Promise.all([
        getDocs(collection(db, 'ambassadors')),
        getDoc(doc(db, 'settings', 'platform')).catch(() => null)
      ]);
      people = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((x, y) => (y.createdAt?.seconds || 0) - (x.createdAt?.seconds || 0));
      if (sset && sset.exists()) settings = { ...DEFAULT_SETTINGS, ...sset.data() };
      renderMain('candidates');
    } catch (ex) { root.innerHTML = `<p class="form-error">${esc(errText(ex))}</p>`; }
  }

  function renderMain(tab) {
    const tabs = [['candidates', 'Candidatures'], ['links', 'Suivi des liens'], ['recap', 'Récapitulatif'], ['settings', 'Réglages']];
    root.innerHTML = `
      <div class="amb-tabs amb-main-tabs" role="tablist">
        ${tabs.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${k === tab}">${l}</button>`).join('')}
      </div>
      <div id="admin-pane"></div>`;
    $$('[data-tab]', root).forEach((b) => b.addEventListener('click', () => renderMain(b.dataset.tab)));
    const pane = $('#admin-pane');
    if (tab === 'candidates') renderCandidates(pane, 'pending');
    else if (tab === 'links') renderLinks(pane);
    else if (tab === 'recap') renderRecap(pane);
    else renderSettings(pane);
  }

  /* ── Candidatures ── */
  function renderCandidates(pane, filter) {
    const count = (s) => people.filter((p) => p.status === s).length;
    const list = people.filter((p) => p.status === filter);
    pane.innerHTML = `
      <div class="amb-tabs amb-tabs--admin" role="tablist">
        ${[['pending', 'En attente'], ['approved', 'Validés'], ['rejected', 'Refusés']].map(([k, l]) => `<button type="button" role="tab" data-filter="${k}" aria-selected="${k === filter}">${l} <span>${count(k)}</span></button>`).join('')}
      </div>
      ${list.length ? `<ul class="amb-people">${list.map(card).join('')}</ul>` : '<p class="amb-empty">Aucun ambassadeur dans cette liste.</p>'}`;
    $$('[data-filter]', pane).forEach((b) => b.addEventListener('click', () => renderCandidates(pane, b.dataset.filter)));
    $$('[data-act]', pane).forEach((b) => b.addEventListener('click', () => act(b.dataset.act, b.dataset.id, pane, filter)));
  }

  function card(p) {
    return `<li class="amb-person">
      <div class="amb-person__head">
        <div><strong>${esc(p.nom)}</strong><span>${esc(p.ville)} · ${esc(p.profil)} · envoyée le ${esc(dateFr(p.createdAt))}</span></div>
        ${p.code ? `<code>${esc(p.code)}</code>` : ''}
      </div>
      <dl class="amb-summary">
        <div><dt>WhatsApp</dt><dd>${esc(p.whatsapp)}</dd></div>
        <div><dt>E-mail</dt><dd>${esc(p.email)}</dd></div>
        <div><dt>Produits</dt><dd>${esc((p.produits || []).join(', '))}${p.produitsFuturs?.length ? ' · plus tard : ' + esc(p.produitsFuturs.join(', ')) : ''}</dd></div>
        <div><dt>Réseaux</dt><dd>${esc(p.reseaux || '—')}</dd></div>
        <div class="is-wide"><dt>Sa méthode</dt><dd>${esc(p.methode)}</dd></div>
      </dl>
      <div class="pg-cta">
        ${p.status !== 'approved' ? `<button type="button" class="btn btn--primary" data-act="approve" data-id="${esc(p.id)}">Valider et créer son lien</button>` : `<button type="button" class="btn btn--primary" data-act="manage" data-id="${esc(p.id)}">Restaurants et gains</button>`}
        ${p.status !== 'rejected' ? `<button type="button" class="btn btn--ghost" data-act="reject" data-id="${esc(p.id)}">Refuser</button>` : ''}
      </div>
      <div class="amb-manage" id="m-${esc(p.id)}" hidden></div>
    </li>`;
  }

  function uniqueCode() {
    const used = new Set(people.map((p) => p.code).filter(Boolean));
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let i = 0; i < 50; i++) {
      const code = 'U' + [...crypto.getRandomValues(new Uint8Array(6))].map((b) => chars[b % chars.length]).join('');
      if (!used.has(code)) return code;
    }
    return 'U' + Date.now().toString(36).toUpperCase();
  }

  async function act(what, id, pane, filter) {
    const p = people.find((x) => x.id === id);
    try {
      if (what === 'approve') {
        const code = p.code || uniqueCode();
        await updateDoc(doc(db, 'ambassadors', id), { status: 'approved', code, updatedAt: serverTimestamp() });
        Object.assign(p, { status: 'approved', code });
        renderCandidates(pane, filter);
      } else if (what === 'reject') {
        if (!confirm(`Refuser la candidature de ${p.nom} ?`)) return;
        await updateDoc(doc(db, 'ambassadors', id), { status: 'rejected', updatedAt: serverTimestamp() });
        p.status = 'rejected';
        renderCandidates(pane, filter);
      } else if (what === 'manage') {
        const box = $(`#m-${CSS.escape(p.id)}`);
        if (!box.hidden) { box.hidden = true; return; }
        await renderDetail(box, p);
      }
    } catch (ex) { alert(errText(ex)); }
  }

  async function renderDetail(box, p) {
    box.hidden = false;
    box.innerHTML = '<p class="amb-empty">Chargement…</p>';
    try {
      const [rs, ps, cs, vs] = await Promise.all([
        getDocs(collection(db, 'ambassadors', p.id, 'restaurants')),
        getDocs(collection(db, 'ambassadors', p.id, 'payments')),
        getDocs(collection(db, 'ambassadors', p.id, 'commissions')),
        getDocs(collection(db, 'ambassadors', p.id, 'payouts'))
      ]);
      const restaurants = rs.docs.map((d) => d.data()).sort((x, y) => (y.createdAt?.seconds || 0) - (x.createdAt?.seconds || 0));
      const payments = ps.docs.map((d) => d.data()).sort((x, y) => (x.date?.seconds || 0) - (y.date?.seconds || 0));
      const commissions = cs.docs.map((d) => d.data()).sort((x, y) => (x.createdAt?.seconds || 0) - (y.createdAt?.seconds || 0));
      const payouts = vs.docs.map((d) => d.data()).sort((x, y) => (y.date?.seconds || 0) - (x.date?.seconds || 0));
      const totals = commissionTotals(commissions);

      box.innerHTML = `
        <p class="amb-manage__sum">En attente : <b>${esc(fcfa(totals.pending))}</b> · Payable : <b>${esc(fcfa(totals.payable))}</b> · Versé : <b>${esc(fcfa(totals.paid))}</b></p>
        <h3>Restaurants</h3>
        ${restaurants.length ? `<ul class="amb-mini">${restaurants.map((r, i) => {
          const rp = payments.filter((x) => x.restaurantId === r.restaurantId);
          const rc = commissions.filter((x) => x.restaurantId === r.restaurantId);
          const paidMonths = rp.filter((x) => x.statut === 'encaisse').length;
          return `<li class="amb-rest">
            <span><b>${esc(r.nom || r.restaurantId)}</b> · ${esc(r.formule || '—')} · ${esc(RESTAURANT_LABEL[r.statut] || r.statut)} · ${paidMonths} mois payé(s) · ${esc(fcfa(restaurantGains(r.restaurantId, commissions)))}${r.autoReferral ? ' <span class="amb-flag">Auto-parrainage ?</span>' : ''}</span>
            <span class="amb-mini__acts">
              <button type="button" data-rest-toggle="${i}">Détail</button>
              <button type="button" data-correct="${esc(r.restaurantId)}">Corriger l'attribution</button>
            </span>
            <div class="amb-rest__detail" id="rd-${i}" hidden>
              ${rp.length ? `<p>Paiements</p><ul>${rp.map((x) => `<li>Mois ${esc(x.moisIndex)} · ${esc(fcfa(x.montant))} · ${esc(dateFr(x.date))} · ${esc(x.statut)}</li>`).join('')}</ul>` : '<p>Aucun paiement.</p>'}
              ${rc.length ? `<p>Commissions</p><ul>${rc.map((x) => `<li>Mois ${esc(x.moisIndex)} · ${esc(x.taux)} % · ${esc(fcfa(x.montant))} · ${esc(COMMISSION_LABEL[commissionState(x)])} · ${esc(periodLabel(x.period))}${x.cancelReason ? ' (' + esc(x.cancelReason) + ')' : ''}</li>`).join('')}</ul>` : '<p>Aucune commission.</p>'}
            </div>
          </li>`;
        }).join('')}</ul>` : '<p class="amb-empty">Aucun restaurant pour le moment. Ils arrivent automatiquement via le lien de l\'ambassadeur.</p>'}
        <h3>Versements</h3>
        ${payouts.length ? `<ul class="amb-mini">${payouts.map((x) => `<li><span>${esc(dateFr(x.date))}${x.period ? ' · ' + esc(periodLabel(x.period)) : ''} · <b>${esc(fcfa(x.montant))}</b>${x.note ? ' · ' + esc(x.note) : ''}</span></li>`).join('')}</ul>` : '<p class="amb-empty">Aucun versement. Utilisez le Récapitulatif pour marquer les commissions payées.</p>'}`;

      $$('[data-rest-toggle]', box).forEach((b) => b.addEventListener('click', () => {
        const d = $(`#rd-${b.dataset.restToggle}`, box);
        d.hidden = !d.hidden;
      }));
      $$('[data-correct]', box).forEach((b) => b.addEventListener('click', async () => {
        const code = prompt('Code du bon ambassadeur pour ce restaurant ?');
        if (!code || !code.trim()) return;
        busy(b, true, 'Correction…');
        try {
          await adminCall('correctAttribution', { restaurantId: b.dataset.correct, ambassadorCode: code.trim().toUpperCase() });
          await renderDetail(box, p);
        } catch (ex) { alert(errText(ex)); busy(b, false); }
      }));
    } catch (ex) { box.innerHTML = `<p class="form-error">${esc(errText(ex))}</p>`; }
  }

  /* ── Suivi des liens ── */
  async function renderLinks(pane) {
    pane.innerHTML = '<p class="amb-empty">Chargement…</p>';
    const approved = people.filter((p) => p.status === 'approved' && p.code);
    try {
      const snap = await getDocs(collectionGroup(db, 'restaurants'));
      const rests = snap.docs.map((d) => d.data());
      pane.innerHTML = approved.length ? `<div class="amb-table"><table>
        <thead><tr><th scope="col">Ambassadeur</th><th scope="col">Code</th><th scope="col">Lien</th><th scope="col">Clics</th><th scope="col">Inscrits</th><th scope="col">Abonnés</th></tr></thead>
        <tbody>${approved.map((p) => {
          const mine = rests.filter((r) => r.ambassadeurUid === p.id);
          return `<tr><th scope="row">${esc(p.nom)}</th><td>${esc(p.code)}</td><td><button type="button" class="amb-copy" data-copy="${esc(referralLink(p.code))}">Copier</button></td><td>${Number(p.clicks) || 0}</td><td>${mine.filter((r) => r.statut !== 'resilie').length}</td><td>${mine.filter((r) => r.statut === 'abonne').length}</td></tr>`;
        }).join('')}</tbody>
      </table></div>` : '<p class="amb-empty">Aucun ambassadeur validé pour le moment.</p>';
      $$('[data-copy]', pane).forEach((b) => b.addEventListener('click', () => copyBtn(b, b.dataset.copy, 'Copié')));
    } catch (ex) { pane.innerHTML = `<p class="form-error">${esc(errText(ex))}</p>`; }
  }

  /* ── Récapitulatif mensuel ── */
  async function renderRecap(pane) {
    pane.innerHTML = '<p class="amb-empty">Chargement…</p>';
    try {
      const snap = await getDocs(collectionGroup(db, 'commissions'));
      const all = snap.docs.map((d) => ({ id: d.id, uid: d.ref.parent.parent.id, ...d.data() }));
      let period = monthKey();

      const draw = () => {
        const rows = all.filter((c) => c.period === period && c.statut !== 'cancelled');
        const groups = [];
        for (const c of rows) {
          let g = groups.find((x) => x.uid === c.uid);
          if (!g) {
            const p = people.find((x) => x.id === c.uid);
            g = { uid: c.uid, name: p?.nom || c.uid, code: p?.code || '—', rows: [], total: 0, payable: 0 };
            groups.push(g);
          }
          g.rows.push(c);
          g.total += Number(c.montant) || 0;
          if (commissionState(c) === 'payable') g.payable += Number(c.montant) || 0;
        }
        pane.innerHTML = `
          <div class="amb-recap__filters">
            <label for="recap-period">Période</label>
            <input type="month" id="recap-period" class="form-control" value="${period}">
            <button type="button" class="btn btn--ghost" id="recap-csv" ${rows.length ? '' : 'disabled'}>Exporter CSV</button>
          </div>
          ${groups.length ? `<div class="amb-table"><table>
            <thead><tr><th scope="col">Ambassadeur</th><th scope="col">Restaurant</th><th scope="col">Mois</th><th scope="col">Montant</th><th scope="col">Statut</th><th scope="col">Action</th></tr></thead>
            <tbody>${groups.map((g) => `
              <tr class="amb-recap__head"><th scope="row">${esc(g.name)} <span>${esc(g.code)}</span></th><td></td><td></td><td><b>${esc(fcfa(g.total))}</b></td><td></td><td>${g.payable > 0 ? `<button type="button" class="amb-copy" data-paid="${esc(g.uid)}">Marquer payé (${esc(fcfa(g.payable))})</button>` : '—'}</td></tr>
              ${g.rows.map((c) => `<tr><td></td><td>${esc(c.restaurantNom || c.restaurantId)}</td><td>${esc(c.moisIndex)}</td><td>${esc(fcfa(c.montant))}</td><td>${esc(COMMISSION_LABEL[commissionState(c)])}</td><td></td></tr>`).join('')}`).join('')}
            </tbody>
          </table></div>` : '<p class="amb-empty">Aucune commission sur cette période.</p>'}`;

        $('#recap-period', pane).addEventListener('change', (e) => { period = e.target.value || monthKey(); draw(); });
        $('#recap-csv', pane).addEventListener('click', () => exportCsv(rows, period));
        $$('[data-paid]', pane).forEach((b) => b.addEventListener('click', async () => {
          const g = groups.find((x) => x.uid === b.dataset.paid);
          if (!confirm(`Marquer ${fcfa(g.payable)} comme versés à ${g.name} pour ${periodLabel(period)} ?`)) return;
          busy(b, true, 'Enregistrement…');
          try {
            await adminCall('markPaid', { ambassadorUid: g.uid, period, note: `Récapitulatif ${periodLabel(period)}` });
            await renderRecap(pane);
          } catch (ex) { alert(errText(ex)); busy(b, false); }
        }));
      };
      draw();
    } catch (ex) { pane.innerHTML = `<p class="form-error">${esc(errText(ex))}</p>`; }
  }

  function exportCsv(rows, period) {
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['Ambassadeur', 'Code', 'Restaurant', 'Mois', 'Type', 'Taux (%)', 'Montant (FCFA)', 'Statut', 'Période', 'Payable le'].map(cell).join(';')];
    for (const c of rows) {
      const p = people.find((x) => x.id === c.uid);
      lines.push([p?.nom || c.uid, p?.code || '', c.restaurantNom || c.restaurantId, c.moisIndex, c.type, c.taux, c.montant, COMMISSION_LABEL[commissionState(c)], c.period, dateFr(c.payableAt)].map(cell).join(';'));
    }
    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `recap-ambassadeurs-${period}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ── Réglages ── */
  function renderSettings(pane) {
    const fields = [
      ['firstPct', 'Commission du 1er mois (%)', 0, 100],
      ['recurringPct', 'Commission des mois suivants (%)', 0, 100],
      ['offeredMonth', 'Mois offert au client (n°)', 1, 12],
      ['maxMonths', 'Durée des commissions (mois)', 1, 36],
      ['validationDays', 'Délai de validation (jours)', 0, 60],
      ['closingDay', 'Jour de clôture du mois', 1, 28],
      ['paymentDay', 'Jour de versement', 1, 28]
    ];
    pane.innerHTML = `
      <form class="pg-form amb-settings" id="settings-form" novalidate>
        ${fields.map(([k, l, min, max]) => `<div class="form-group"><label for="set-${k}">${l}</label><input id="set-${k}" name="${k}" type="number" min="${min}" max="${max}" step="1" class="form-control" value="${esc(settings[k])}" required></div>`).join('')}
        <div class="form-group span-2"><label for="set-url">URL de la page Epicure (cible des liens)</label><input id="set-url" name="epicureUrl" type="url" class="form-control" value="${esc(settings.epicureUrl)}" required></div>
        <p class="amb-hint span-2">Ces réglages s'appliquent aux prochains événements envoyés par Epicure. Les commissions déjà créées ne changent pas.</p>
        <p class="form-error span-2" id="settings-error" role="alert" hidden></p>
        <button class="btn btn--primary" type="submit">Enregistrer les réglages</button>
      </form>`;
    $('#settings-form', pane).addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target, btn = f.querySelector('button[type=submit]'), err = $('#settings-error', pane);
      const data = {};
      for (const [k] of fields) {
        const n = Number(f[k].value);
        if (!Number.isFinite(n)) return show(err, 'Vérifiez les valeurs saisies.');
        data[k] = n;
      }
      data.epicureUrl = f.epicureUrl.value.trim();
      show(err, ''); busy(btn, true, 'Enregistrement…');
      try {
        await setDoc(doc(db, 'settings', 'platform'), data);
        settings = { ...DEFAULT_SETTINGS, ...data };
        btn.textContent = 'Enregistré';
        setTimeout(() => busy(btn, false), 1600);
      } catch (ex) { show(err, errText(ex)); busy(btn, false); }
    });
  }
}
