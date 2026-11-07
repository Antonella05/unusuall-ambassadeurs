/* UNUSUALL Ambassadeurs — comptes (Firebase Auth + Firestore)
   Pages : connexion.html (login/inscription/mot de passe oublié),
           espace.html (candidature, statut, tableau de bord),
           admin.html (validation, clients, versements). */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, signOut, updateProfile
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs, addDoc, deleteDoc,
  serverTimestamp, increment, Timestamp
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
const PLANS = { Standard: 27900, Premium: 45900, Ultra: 79900 };
const PAGE = document.body.dataset.account;

/* ───────── Outils ───────── */
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fcfa = (n) => Math.round(n || 0).toLocaleString('fr-FR').replace(/\s/g, ' ') + ' FCFA';
const dateFr = (t) => (t && t.toDate ? t.toDate() : t ? new Date(t) : null)?.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) || '—';

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
  'permission-denied': "Action non autorisée. Reconnectez-vous puis réessayez."
};
const errText = (e) => ERRORS[e?.code] || "Une erreur est survenue. Réessayez dans un instant.";

function busy(btn, on, label) {
  if (!btn) return;
  if (on) { btn.dataset.label = btn.textContent; btn.disabled = true; btn.textContent = label || 'Patientez…'; }
  else { btn.disabled = false; btn.textContent = btn.dataset.label || btn.textContent; }
}
function show(el, msg) { if (!el) return; el.textContent = msg; el.hidden = !msg; }

/* Commission d'un client : 30 % du 1er mois payé, puis 10 % des mois payés suivants
   (le 2e mois est offert au client, donc les mois payés 2 à 11 = mois 3 à 12), plafonné à 10. */
function commission(c) {
  const price = Number(c.prix) || PLANS[c.formule] || 0;
  const paid = Math.max(0, Number(c.moisPayes) || 0);
  if (!paid) return 0;
  return price * 0.3 + price * 0.1 * Math.min(paid - 1, 10);
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
          : 'Nous l\'étudions et vous répondons sous 72 heures, par WhatsApp ou par e-mail. Dès sa validation, votre code ambassadeur et votre tableau de bord apparaîtront ici.'}</p>
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
    const [cs, ps] = await Promise.all([
      getDocs(collection(db, 'ambassadors', user.uid, 'clients')),
      getDocs(collection(db, 'ambassadors', user.uid, 'payouts'))
    ]);
    const clients = cs.docs.map((d) => d.data()).sort((x, y) => (y.dateSignature?.seconds || 0) - (x.dateSignature?.seconds || 0));
    const payouts = ps.docs.map((d) => d.data()).sort((x, y) => (y.date?.seconds || 0) - (x.date?.seconds || 0));
    const active = clients.filter((c) => c.statut !== 'resilie').length;
    const earned = clients.reduce((s, c) => s + commission(c), 0);
    const paid = payouts.reduce((s, p) => s + (Number(p.montant) || 0), 0);

    root.innerHTML = `
      <div class="amb-code">
        <div>
          <small>Votre code ambassadeur</small>
          <b id="my-code">${esc(a.code || '—')}</b>
          <span>À donner à chaque client lors de son inscription.</span>
        </div>
        <button type="button" class="btn btn--primary" id="copy-code">Copier le code</button>
      </div>

      <ul class="ep-stats amb-kpis">
        <li><b>${active}</b><span>client${active > 1 ? 's' : ''} actif${active > 1 ? 's' : ''}</span></li>
        <li><b>${esc(fcfa(earned))}</b><span>gagnés à ce jour</span></li>
        <li><b>${esc(fcfa(paid))}</b><span>déjà versés</span></li>
        <li><b>${esc(fcfa(Math.max(0, earned - paid)))}</b><span>à recevoir</span></li>
      </ul>

      <p class="amb-level-line"><span class="pg-pill pg-pill--live"><i></i>${esc(level(active))}</span> Produits : ${esc((a.produits || []).join(', '))}</p>

      <section class="amb-block">
        <h2>Vos clients</h2>
        ${clients.length ? `<div class="amb-table"><table>
          <thead><tr><th scope="col">Client</th><th scope="col">Produit</th><th scope="col">Formule</th><th scope="col">Inscrit le</th><th scope="col">Mois payés</th><th scope="col">Vos gains</th></tr></thead>
          <tbody>${clients.map((c) => `<tr${c.statut === 'resilie' ? ' class="is-off"' : ''}><th scope="row">${esc(c.client)}</th><td>${esc(c.produit)}</td><td>${esc(c.formule)}</td><td>${esc(dateFr(c.dateSignature))}</td><td>${esc(c.moisPayes || 0)}</td><td><b>${esc(fcfa(commission(c)))}</b></td></tr>`).join('')}</tbody>
        </table></div>` : '<p class="amb-empty">Pas encore de client. Partagez votre code : chaque restaurant qui s\'abonne avec lui apparaîtra ici.</p>'}
      </section>

      <section class="amb-block">
        <h2>Vos versements</h2>
        ${payouts.length ? `<ul class="amb-payouts">${payouts.map((p) => `<li><span>${esc(dateFr(p.date))}${p.note ? ' · ' + esc(p.note) : ''}</span><b>${esc(fcfa(p.montant))}</b></li>`).join('')}</ul>`
          : '<p class="amb-empty">Aucun versement pour le moment. Vos commissions sont versées chaque mois par Mobile Money.</p>'}
      </section>

      <section class="amb-block amb-kit">
        <h2>Votre kit</h2>
        <p>Visuels, argumentaire et vidéos vous sont envoyés par WhatsApp après la formation. Pour présenter Epicure, appuyez-vous aussi sur sa page officielle.</p>
        <div class="pg-cta">
          <a class="btn btn--ghost" href="https://unusuall.online/epicure.html" target="_blank" rel="noopener">Page Epicure ↗</a>
          <a class="btn btn--ghost" href="gains.html">Rappel des gains</a>
          <a class="btn btn--ghost" href="avantages.html">La charte</a>
        </div>
      </section>`;

    $('#copy-code').addEventListener('click', async (e) => {
      try { await navigator.clipboard.writeText(a.code || ''); e.target.textContent = 'Code copié'; }
      catch { e.target.textContent = a.code || ''; }
    });
  }
}

/* ───────── Administration ───────── */
if (PAGE === 'admin') {
  const root = $('#admin');
  let people = [];

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
      const snap = await getDocs(collection(db, 'ambassadors'));
      people = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((x, y) => (y.createdAt?.seconds || 0) - (x.createdAt?.seconds || 0));
      render('pending');
    } catch (ex) { root.innerHTML = `<p class="form-error">${esc(errText(ex))}</p>`; }
  }

  function render(filter) {
    const count = (s) => people.filter((p) => p.status === s).length;
    const list = people.filter((p) => p.status === filter);
    root.innerHTML = `
      <div class="amb-tabs amb-tabs--admin" role="tablist">
        ${[['pending', 'En attente'], ['approved', 'Validés'], ['rejected', 'Refusés']].map(([k, l]) => `<button type="button" role="tab" data-filter="${k}" aria-selected="${k === filter}">${l} <span>${count(k)}</span></button>`).join('')}
      </div>
      ${list.length ? `<ul class="amb-people">${list.map(card).join('')}</ul>` : '<p class="amb-empty">Aucun ambassadeur dans cette liste.</p>'}`;
    $$('[data-filter]', root).forEach((b) => b.addEventListener('click', () => render(b.dataset.filter)));
    $$('[data-act]', root).forEach((b) => b.addEventListener('click', () => act(b.dataset.act, b.dataset.id, filter)));
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
        ${p.status !== 'approved' ? `<button type="button" class="btn btn--primary" data-act="approve" data-id="${esc(p.id)}">Valider et donner un code</button>` : `<button type="button" class="btn btn--primary" data-act="manage" data-id="${esc(p.id)}">Clients et versements</button>`}
        ${p.status !== 'rejected' ? `<button type="button" class="btn btn--ghost" data-act="reject" data-id="${esc(p.id)}">Refuser</button>` : ''}
      </div>
      <div class="amb-manage" id="m-${esc(p.id)}" hidden></div>
    </li>`;
  }

  async function act(what, id, filter) {
    const p = people.find((x) => x.id === id);
    try {
      if (what === 'approve') {
        const code = p.code || 'U' + Math.random().toString(36).slice(2, 7).toUpperCase();
        await updateDoc(doc(db, 'ambassadors', id), { status: 'approved', code, updatedAt: serverTimestamp() });
        Object.assign(p, { status: 'approved', code });
        render(filter);
      } else if (what === 'reject') {
        if (!confirm(`Refuser la candidature de ${p.nom} ?`)) return;
        await updateDoc(doc(db, 'ambassadors', id), { status: 'rejected', updatedAt: serverTimestamp() });
        p.status = 'rejected';
        render(filter);
      } else if (what === 'manage') {
        manage(p);
      }
    } catch (ex) { alert(errText(ex)); }
  }

  async function manage(p) {
    const box = $(`#m-${CSS.escape(p.id)}`);
    if (!box.hidden) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = '<p class="amb-empty">Chargement…</p>';
    const [cs, ps] = await Promise.all([
      getDocs(collection(db, 'ambassadors', p.id, 'clients')),
      getDocs(collection(db, 'ambassadors', p.id, 'payouts'))
    ]);
    const clients = cs.docs.map((d) => ({ id: d.id, ...d.data() }));
    const payouts = ps.docs.map((d) => ({ id: d.id, ...d.data() }));
    const earned = clients.reduce((s, c) => s + commission(c), 0);
    const paid = payouts.reduce((s, x) => s + (Number(x.montant) || 0), 0);

    box.innerHTML = `
      <p class="amb-manage__sum">Gagné : <b>${esc(fcfa(earned))}</b> · Versé : <b>${esc(fcfa(paid))}</b> · À verser : <b>${esc(fcfa(Math.max(0, earned - paid)))}</b></p>
      <h3>Clients</h3>
      ${clients.length ? `<ul class="amb-mini">${clients.map((c) => `<li>
          <span><b>${esc(c.client)}</b> · ${esc(c.produit)} ${esc(c.formule)} · ${esc(c.moisPayes || 0)} mois payé(s)${c.statut === 'resilie' ? ' · résilié' : ''}</span>
          <span class="amb-mini__acts">
            <button type="button" data-c="pay" data-cid="${esc(c.id)}">+1 mois payé</button>
            <button type="button" data-c="${c.statut === 'resilie' ? 'reactivate' : 'cancel'}" data-cid="${esc(c.id)}">${c.statut === 'resilie' ? 'Réactiver' : 'Résilié'}</button>
          </span></li>`).join('')}</ul>` : '<p class="amb-empty">Aucun client.</p>'}
      <form class="amb-inline" data-form="client">
        <input name="client" class="form-control" placeholder="Nom du restaurant" required maxlength="120">
        <select name="formule" class="form-control">${Object.keys(PLANS).map((k) => `<option>${k}</option>`).join('')}</select>
        <input name="date" type="date" class="form-control" required>
        <button class="btn btn--primary" type="submit">Ajouter le client</button>
      </form>
      <h3>Versements</h3>
      ${payouts.length ? `<ul class="amb-mini">${payouts.map((x) => `<li><span>${esc(dateFr(x.date))} · <b>${esc(fcfa(x.montant))}</b>${x.note ? ' · ' + esc(x.note) : ''}</span><span class="amb-mini__acts"><button type="button" data-c="delpay" data-pid="${esc(x.id)}">Supprimer</button></span></li>`).join('')}</ul>` : '<p class="amb-empty">Aucun versement.</p>'}
      <form class="amb-inline" data-form="payout">
        <input name="montant" type="number" min="1" step="1" class="form-control" placeholder="Montant (FCFA)" required>
        <input name="note" class="form-control" placeholder="Note (ex. : octobre, Mobile Money)" maxlength="120">
        <input name="date" type="date" class="form-control" required>
        <button class="btn btn--primary" type="submit">Enregistrer le versement</button>
      </form>`;

    const today = new Date().toISOString().slice(0, 10);
    $$('input[type=date]', box).forEach((i) => { i.value = today; });
    const base = (sub, cid) => doc(db, 'ambassadors', p.id, sub, cid);

    $$('[data-c]', box).forEach((b) => b.addEventListener('click', async () => {
      try {
        if (b.dataset.c === 'pay') await updateDoc(base('clients', b.dataset.cid), { moisPayes: increment(1) });
        if (b.dataset.c === 'cancel') await updateDoc(base('clients', b.dataset.cid), { statut: 'resilie' });
        if (b.dataset.c === 'reactivate') await updateDoc(base('clients', b.dataset.cid), { statut: 'actif' });
        if (b.dataset.c === 'delpay') { if (!confirm('Supprimer ce versement ?')) return; await deleteDoc(base('payouts', b.dataset.pid)); }
        box.hidden = true; manage(p);
      } catch (ex) { alert(errText(ex)); }
    }));

    $('[data-form=client]', box).addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await addDoc(collection(db, 'ambassadors', p.id, 'clients'), {
          client: f.client.value.trim(), produit: 'Epicure', formule: f.formule.value, prix: PLANS[f.formule.value],
          moisPayes: 1, statut: 'actif', dateSignature: Timestamp.fromDate(new Date(f.date.value))
        });
        box.hidden = true; manage(p);
      } catch (ex) { alert(errText(ex)); }
    });

    $('[data-form=payout]', box).addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        await addDoc(collection(db, 'ambassadors', p.id, 'payouts'), {
          montant: Number(f.montant.value), note: f.note.value.trim(), date: Timestamp.fromDate(new Date(f.date.value))
        });
        box.hidden = true; manage(p);
      } catch (ex) { alert(errText(ex)); }
    });
  }
}
