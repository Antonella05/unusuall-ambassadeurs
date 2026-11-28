/* UNUSUALL Ambassadeurs — comptes (Firebase Auth + Firestore + Functions)
   Pages : connexion.html (login/inscription/mot de passe oublié),
           espace.html (candidature, statut, tableau de bord, lien et QR code),
           admin.html (candidatures, suivi des liens, récapitulatif,
           e-mails envoyés, réglages). */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, signOut, updateProfile, sendEmailVerification,
  reauthenticateWithCredential, EmailAuthProvider
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

/* Backend gratuit : Worker Cloudflare (worker/index.js), pas de Cloud Functions. */
const FUNCTIONS_ORIGIN = 'https://unusuall-ambassadeurs.antonellatamadaho.workers.dev';

/* Réessaie une fois en cas d'échec ; le Worker n'envoie chaque e-mail qu'une fois par compte. */
async function sendApplicationMails(user, retry = true) {
  try {
    const token = await user.getIdToken();
    const res = await fetch(`${FUNCTIONS_ORIGIN}/apply-ack`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, keepalive: true });
    if (!res.ok) throw new Error(`apply-ack ${res.status}`);
  } catch (ex) {
    console.error('[e-mails de candidature]', ex);
    if (retry) setTimeout(() => sendApplicationMails(user, false), 5000);
  }
}
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
/* E-mails de validation et de mot de passe : envoyés par le Worker avec la
   charte UNUSUALL ; en cas de panne, repli sur l'e-mail standard de Firebase. */
async function workerMail(path, { user, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (user) headers.Authorization = `Bearer ${await user.getIdToken(true)}`;
  const res = await fetch(`${FUNCTIONS_ORIGIN}${path}`, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  if (res.status === 429) throw Object.assign(new Error('too-many-requests'), { code: 'auth/too-many-requests' });
  if (!res.ok) throw new Error(`Worker ${path} : ${res.status}`);
}
const tooMany = (ex) => ex?.code === 'auth/too-many-requests';
const sendVerification = (user) => workerMail('/verify-email', { user })
  .catch((ex) => (tooMany(ex) ? Promise.reject(ex) : sendEmailVerification(user)));
const sendReset = (email) => workerMail('/reset-password', { body: { email } })
  .catch((ex) => (tooMany(ex) ? Promise.reject(ex) : sendPasswordResetEmail(auth, email)));

const referralLink = (code) => `${FUNCTIONS_ORIGIN}/go?a=${encodeURIComponent(code || '')}`;
const qrLink = (code) => `${FUNCTIONS_ORIGIN}/qr?a=${encodeURIComponent(code || '')}`;

const ERRORS = {
  'auth/invalid-email': "Cette adresse e-mail n'est pas valide (exemple : nom@domaine.com).",
  'auth/missing-email': 'Indiquez votre adresse e-mail.',
  'auth/missing-password': 'Indiquez votre mot de passe.',
  'auth/invalid-credential': 'E-mail ou mot de passe incorrect. Vérifiez la casse, puis réessayez.',
  'auth/invalid-login-credentials': 'E-mail ou mot de passe incorrect. Vérifiez la casse, puis réessayez.',
  'auth/wrong-password': 'E-mail ou mot de passe incorrect. Vérifiez la casse, puis réessayez.',
  'auth/user-not-found': 'Aucun compte avec cette adresse e-mail. Vérifiez l’orthographe ou créez un compte.',
  'auth/email-already-in-use': 'Un compte existe déjà avec cette adresse. Connectez-vous plutôt.',
  'auth/weak-password': 'Le mot de passe doit contenir au moins 8 caractères.',
  'auth/invalid-password': 'Le mot de passe doit contenir au moins 8 caractères.',
  'auth/user-disabled': 'Ce compte a été désactivé. Écrivez à services@unusuall.online.',
  'auth/operation-not-allowed': "La connexion par e-mail n'est pas disponible pour le moment. Écrivez à services@unusuall.online.",
  'auth/unauthorized-domain': "Ce site n'est pas autorisé par le service de connexion. Écrivez à services@unusuall.online.",
  'auth/too-many-requests': 'Trop de tentatives de connexion. Patientez quelques minutes puis réessayez.',
  'auth/quota-exceeded': 'Le service de connexion reçoit trop de demandes. Réessayez plus tard.',
  'auth/network-request-failed': 'Connexion internet impossible. Vérifiez votre réseau puis réessayez.',
  'auth/internal-error': 'Erreur interne du service de connexion. Réessayez dans un instant.',
  'permission-denied': 'Action non autorisée. Reconnectez-vous puis réessayez.',
  'unauthenticated': 'Votre session a expiré. Reconnectez-vous puis réessayez.',
  'failed-precondition': 'Cette action ne peut pas être effectuée dans l’état actuel.',
  'not-found': 'Élément introuvable. Rechargez la page puis réessayez.',
  'invalid-argument': 'Informations manquantes ou invalides. Vérifiez le formulaire.',
  'already-exists': 'Cet élément existe déjà.',
  'unavailable': 'Service momentanément indisponible. Vérifiez votre connexion puis réessayez.',
  'deadline-exceeded': 'Le serveur met trop de temps à répondre. Réessayez dans un instant.',
  'resource-exhausted': 'Trop de demandes en peu de temps. Patientez quelques minutes.',
  'aborted': 'L’opération a été interrompue. Réessayez.',
  'cancelled': 'L’opération a été annulée. Réessayez.'
};
const errText = (e) => ERRORS[e?.code] || ERRORS[String(e?.code || '').replace('functions/', '')]
  || (String(e?.code || '').startsWith('functions/') && e?.message)
  || 'Une erreur est survenue. Réessayez dans un instant.';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const emailOk = (v) => EMAIL_RE.test(String(v || '').trim());
const flag = (el, ko = true) => { if (el) el.setAttribute('aria-invalid', String(ko)); };
const clearFlags = (...els) => els.forEach((el) => flag(el, false));

function busy(btn, on, label) {
  if (!btn) return;
  if (on) { btn.dataset.label = btn.textContent; btn.disabled = true; btn.textContent = label || 'Patientez…'; }
  else { btn.disabled = false; btn.textContent = btn.dataset.label || btn.textContent; }
}
function show(el, msg) { if (!el) return; el.textContent = msg; el.hidden = !msg; }
const isHttpUrl = (v) => { try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; } };
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
    const f = forms.login, btn = f.querySelector('button[type=submit]');
    const mail = f.email.value.trim(), pass = f.password.value;
    show(err, '');
    clearFlags(f.email, f.password);
    if (!mail) { flag(f.email); show(err, 'Indiquez votre adresse e-mail pour vous connecter.'); return f.email.focus(); }
    if (!emailOk(mail)) { flag(f.email); show(err, `« ${mail} » n'est pas une adresse e-mail valide. Exemple : nom@domaine.com`); return f.email.focus(); }
    if (!pass) { flag(f.password); show(err, 'Indiquez votre mot de passe.'); return f.password.focus(); }
    busy(btn, true, 'Connexion…');
    try {
      document.body.dataset.working = '1';
      await signInWithEmailAndPassword(auth, mail, pass);
      location.replace(next);
    } catch (ex) {
      console.error('[connexion]', ex);
      delete document.body.dataset.working;
      show(err, errText(ex));
      busy(btn, false);
    }
  });

  forms.signup.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = forms.signup, btn = f.querySelector('button[type=submit]');
    show(err, '');
    clearFlags(f.nom, f.email, f.password, f.confirm);
    const nom = f.nom.value.trim(), mail = f.email.value.trim(), pass = f.password.value;
    if (nom.length < 2) { flag(f.nom); show(err, 'Indiquez votre nom et prénom (2 caractères minimum).'); return f.nom.focus(); }
    if (!mail) { flag(f.email); show(err, 'Indiquez votre adresse e-mail.'); return f.email.focus(); }
    if (!emailOk(mail)) { flag(f.email); show(err, `« ${mail} » n'est pas une adresse e-mail valide. Exemple : nom@domaine.com`); return f.email.focus(); }
    if (pass.length < 8) { flag(f.password); show(err, `Votre mot de passe compte ${pass.length} caractère${pass.length > 1 ? 's' : ''} : il en faut au moins 8.`); return f.password.focus(); }
    if (pass !== f.confirm.value) { flag(f.confirm); show(err, 'Les deux mots de passe ne sont pas identiques. Retapez le même mot de passe dans les deux champs.'); return f.confirm.focus(); }
    busy(btn, true, 'Création du compte…');
    try {
      document.body.dataset.working = '1';
      const cred = await createUserWithEmailAndPassword(auth, mail, pass);
      await updateProfile(cred.user, { displayName: nom });
      /* E-mail de confirmation : la candidature n'est possible qu'une fois l'adresse vérifiée. */
      await sendVerification(cred.user).catch((ex) => console.error('[vérification e-mail]', ex));
      location.replace('espace.html');
    } catch (ex) {
      console.error('[inscription]', ex);
      delete document.body.dataset.working;
      show(err, errText(ex));
      busy(btn, false);
    }
  });

  forms.reset.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = forms.reset, btn = f.querySelector('button[type=submit]');
    show(err, '');
    clearFlags(f.email);
    const mail = f.email.value.trim();
    if (!mail) { flag(f.email); show(err, 'Indiquez votre adresse e-mail pour recevoir le lien.'); return f.email.focus(); }
    if (!emailOk(mail)) { flag(f.email); show(err, `« ${mail} » n'est pas une adresse e-mail valide. Exemple : nom@domaine.com`); return f.email.focus(); }
    busy(btn, true, 'Envoi…');
    try {
      await sendReset(mail);
      show(info, 'Si un compte existe avec cette adresse, vous allez recevoir un e-mail pour choisir un nouveau mot de passe. Pensez à regarder vos spams.');
    } catch (ex) {
      console.error('[mot de passe oublié]', ex);
      show(err, errText(ex));
    }
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
    setupDeleteAccount(user);
    try {
      const snap = await getDoc(doc(db, 'ambassadors', user.uid));
      if (!snap.exists()) return user.emailVerified ? showApply(user) : showVerify(user);
      const a = snap.data();
      if (a.status === 'approved') return showDashboard(user, a);
      root.innerHTML = statusCard(a);
    } catch (ex) {
      console.error('[espace]', ex);
      root.innerHTML = `<p class="form-error">${esc(errText(ex))}</p>`;
    }
  });

  /* Suppression de son propre compte (admins exclus côté serveur) :
     mot de passe redemandé, puis le Worker efface la fiche, les données et l'accès. */
  function setupDeleteAccount(user) {
    if ($('#danger-zone')) return;
    root.insertAdjacentHTML('afterend', `
      <section class="amb-block amb-danger-zone" id="danger-zone">
        <h2>Supprimer mon compte</h2>
        <p>Vous pouvez quitter le programme à tout moment. Votre compte, votre candidature, votre lien personnel, vos restaurants et l'historique de vos gains seront effacés définitivement, sans retour possible.</p>
        <button type="button" class="btn btn--ghost amb-danger" id="delete-open">Supprimer mon compte</button>
      </section>
      <dialog id="delete-dialog" class="amb-qr amb-delete">
        <form id="delete-form" novalidate>
          <h3>Supprimer définitivement mon compte ?</h3>
          <p>Cette action est irréversible. Confirmez avec votre mot de passe.</p>
          <p class="amb-info" id="delete-unpaid" hidden></p>
          <div class="form-group"><label for="delete-pass">Mot de passe</label><input id="delete-pass" name="password" type="password" class="form-control" autocomplete="current-password" required></div>
          <p class="form-error" id="delete-error" role="alert" hidden></p>
          <div class="pg-cta"><button type="submit" class="btn btn--primary amb-danger-btn">Supprimer définitivement</button><button type="button" class="btn btn--ghost" id="delete-cancel">Annuler</button></div>
        </form>
      </dialog>`);
    const dlg = $('#delete-dialog'), f = $('#delete-form'), err = $('#delete-error'), unpaidBox = $('#delete-unpaid');
    let force = false;
    $('#delete-open').addEventListener('click', () => { force = false; f.reset(); show(err, ''); show(unpaidBox, ''); dlg.showModal(); f.password.focus(); });
    $('#delete-cancel').addEventListener('click', () => dlg.close());
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = f.querySelector('button[type=submit]');
      show(err, '');
      if (!f.password.value) { flag(f.password); return show(err, 'Indiquez votre mot de passe.'); }
      busy(btn, true, 'Suppression…');
      try {
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, f.password.value));
        const res = await fetch(`${FUNCTIONS_ORIGIN}/delete-account`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken(true)}` },
          body: JSON.stringify({ force })
        });
        const out = await res.json().catch(() => ({}));
        if (res.status === 409 && out.unpaid) {
          force = true;
          show(unpaidBox, `Attention : ${fcfa(out.unpaid)} de commissions ne vous ont pas encore été versées. Si vous supprimez votre compte, elles seront perdues. Cliquez de nouveau sur « Supprimer définitivement » pour confirmer.`);
          return busy(btn, false);
        }
        if (!res.ok) throw { code: out.code || 'internal', message: out.error };
        await signOut(auth).catch(() => {});
        location.replace('index.html?compte=supprime');
      } catch (ex) {
        console.error('[suppression du compte]', ex);
        show(err, errText(ex));
        busy(btn, false);
      }
    });
  }

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
          <div><dt>Ville · quartier</dt><dd>${esc(a.ville)}${a.quartier ? ' · ' + esc(a.quartier) : ''}</dd></div>
          <div><dt>Profession</dt><dd>${esc(a.profession || a.profil || '—')}</dd></div>
          <div><dt>WhatsApp</dt><dd>${esc(a.whatsapp)}</dd></div>
        </dl>
      </div>`;
  }

  /* Adresse e-mail pas encore confirmée : pas de candidature possible (règle Firestore). */
  function showVerify(user) {
    root.innerHTML = `
      <div class="amb-status">
        <span class="pg-pill pg-pill--beta"><i></i>Étape 1 sur 2</span>
        <h2>Confirmez votre adresse e-mail.</h2>
        <p>Nous avons envoyé un lien de confirmation à <b>${esc(user.email)}</b>. Ouvrez-le (pensez à regarder vos spams), puis revenez ici pour remplir votre candidature.</p>
        <div class="pg-cta">
          <button type="button" class="btn btn--primary" id="verify-done">J'ai confirmé mon adresse</button>
          <button type="button" class="btn btn--ghost" id="verify-resend">Renvoyer l'e-mail</button>
        </div>
        <p class="form-error" id="verify-error" role="alert" hidden></p>
        <p class="amb-info" id="verify-info" role="status" hidden></p>
      </div>`;
    const err = $('#verify-error'), info = $('#verify-info');
    $('#verify-done').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      show(err, ''); show(info, '');
      busy(btn, true, 'Vérification…');
      try {
        await user.reload();
        if (!auth.currentUser.emailVerified) {
          show(err, "Votre adresse n'est pas encore confirmée. Cliquez sur le lien reçu par e-mail, puis réessayez.");
          return busy(btn, false);
        }
        await auth.currentUser.getIdToken(true);
        showApply(auth.currentUser);
      } catch (ex) {
        console.error('[vérification e-mail]', ex);
        show(err, errText(ex));
        busy(btn, false);
      }
    });
    $('#verify-resend').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      show(err, ''); show(info, '');
      busy(btn, true, 'Envoi…');
      try {
        await sendVerification(user);
        show(info, 'E-mail renvoyé. Il peut mettre quelques minutes à arriver.');
      } catch (ex) {
        console.error('[vérification e-mail]', ex);
        show(err, ex?.code === 'auth/too-many-requests' ? "Trop d'envois rapprochés. Patientez quelques minutes avant de redemander l'e-mail." : errText(ex));
      }
      busy(btn, false);
    });
  }

  function showApply(user) {
    root.innerHTML = '';
    form.hidden = false;
    form.email.value = user.email || '';
    form.nom.value = user.displayName || '';
    form.addEventListener('input', (e) => {
      if (e.target.getAttribute?.('aria-invalid') === 'true') flag(e.target, false);
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#apply-error');
      show(err, '');
      const missing = [], wrong = [], first = [];
      const need = (el, label) => {
        const empty = el.type === 'checkbox' ? !el.checked : !el.value.trim();
        flag(el, empty);
        if (empty) { missing.push(label); first.push(el); }
      };
      const bad = (el, label) => { flag(el, true); wrong.push(label); first.push(el); };

      need(form.nom, 'votre nom et prénom');
      need(form.whatsapp, 'votre téléphone WhatsApp');
      need(form.ville, 'votre ville');
      need(form.quartier, 'votre quartier');
      need(form.profession, 'votre profession actuelle');
      need(form.profilLien, 'le lien vers un profil');
      need(form.charte, 'la case « J’accepte la charte »');

      const produits = $$('input[name=produits]', form);
      if (!produits.some((b) => b.checked)) {
        produits.forEach((b) => flag(b));
        missing.push('au moins un produit (Epicure)');
        first.push(produits[0]);
      }

      const reseauBoxes = $$('input[name=reseau]', form);
      if (!reseauBoxes.some((b) => b.checked)) {
        reseauBoxes.forEach((b) => flag(b));
        missing.push('au moins un type de réseau');
        first.push(reseauBoxes[0]);
      }

      const motivation = form.motivation.value.trim();
      if (!motivation) { flag(form.motivation); missing.push('votre motivation'); first.push(form.motivation); }
      else if (motivation.length < 80) bad(form.motivation, `la motivation doit faire 80 caractères minimum (il en manque ${80 - motivation.length})`);

      const profilLien = form.profilLien.value.trim();
      if (profilLien && !isHttpUrl(profilLien)) bad(form.profilLien, 'le lien de profil doit commencer par https://');
      const photo = form.photo.value.trim();
      if (photo && !isHttpUrl(photo)) bad(form.photo, 'le lien de photo doit commencer par https:// (ou rester vide)');

      if (missing.length || wrong.length) {
        show(err, [
          missing.length ? `Merci de compléter : ${missing.join(', ')}.` : '',
          wrong.length ? `À corriger : ${wrong.join(' ; ')}.` : ''
        ].filter(Boolean).join(' '));
        first[0]?.focus({ preventScroll: true });
        err?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }

      const btn = form.querySelector('button[type=submit]');
      busy(btn, true, 'Envoi en cours…');
      const data = {
        nom: form.nom.value.trim().slice(0, 100),
        whatsapp: form.whatsapp.value.trim().slice(0, 30),
        email: user.email,
        ville: form.ville.value.trim().slice(0, 80),
        quartier: form.quartier.value.trim().slice(0, 80),
        profession: form.profession.value.trim().slice(0, 100),
        reseau: $$('input[name=reseau]:checked', form).map((i) => i.value),
        profilLien: profilLien.slice(0, 300),
        photo: photo.slice(0, 300),
        motivation: motivation.slice(0, 2000),
        produits: $$('input[name=produits]:checked', form).map((i) => i.value),
        produitsFuturs: $$('input[name=produits_futurs]:checked', form).map((i) => i.value),
        annuaire: form.annuaire.checked,
        charte: true,
        status: 'pending',
        code: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      try {
        await setDoc(doc(db, 'ambassadors', user.uid), data);
        // Alerte à l'équipe et accusé de réception, envoyés par le Worker (non bloquants)
        sendApplicationMails(user);
        form.hidden = true;
        root.innerHTML = statusCard({ ...data, createdAt: new Date() });
      } catch (ex) {
        console.error('[candidature]', ex);
        show(err, errText(ex));
        busy(btn, false);
      }
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
          <a class="btn btn--ghost" href="reglement.html">Le règlement</a>
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
  /* Recherche et filtres des candidatures (conservés quand on change d'onglet). */
  const query = { text: '', ville: '', produit: '', sort: 'recent' };

  /* Villes : « cotonou », « Cotonou » et « COTONOU » sont regroupées. */
  const foldKey = (v) => String(v || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const cityLabel = (v) => String(v || '').trim().replace(/\s+/g, ' ').toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
  function cityGroups() {
    const map = new Map();
    for (const p of people) {
      const key = foldKey(p.ville) || '—';
      if (!map.has(key)) map.set(key, { key, label: key === '—' ? 'Ville non indiquée' : cityLabel(p.ville), people: [] });
      map.get(key).people.push(p);
    }
    return [...map.values()];
  }
  const createdMs = (p) => (p.createdAt?.seconds ? p.createdAt.seconds * 1000 : 0);
  const HOURS_72 = 72 * 3600 * 1000;

  /* E-mail de décision envoyé par le Worker (non bloquant pour l'action). */
  function notifyDecision(p) {
    return adminCall('notifyDecision', { ambassadorUid: p.id })
      .catch((ex) => { console.error('[e-mail de décision]', ex); alert(`La décision est enregistrée, mais l'e-mail à ${p.nom} n'a pas pu partir. Prévenez-le par WhatsApp.`); });
  }

  async function adminCall(action, data) {
    const token = await auth.currentUser.getIdToken();
    const res = await fetch(`${FUNCTIONS_ORIGIN}/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...data })
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw { code: out.code || 'internal', message: out.error, unpaid: out.unpaid };
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
      renderMain('overview');
    } catch (ex) { root.innerHTML = `<p class="form-error">${esc(errText(ex))}</p>`; }
  }

  function renderMain(tab) {
    const tabs = [['overview', 'Vue d’ensemble'], ['candidates', 'Candidatures'], ['links', 'Suivi des liens'], ['recap', 'Récapitulatif'], ['emails', 'E-mails envoyés'], ['settings', 'Réglages']];
    root.innerHTML = `
      <div class="amb-tabs amb-main-tabs" role="tablist">
        ${tabs.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${k === tab}">${l}</button>`).join('')}
      </div>
      <div id="admin-pane"></div>`;
    $$('[data-tab]', root).forEach((b) => b.addEventListener('click', () => renderMain(b.dataset.tab)));
    const pane = $('#admin-pane');
    if (tab === 'overview') renderOverview(pane);
    else if (tab === 'candidates') renderCandidates(pane, 'pending');
    else if (tab === 'links') renderLinks(pane);
    else if (tab === 'recap') renderRecap(pane);
    else if (tab === 'emails') renderEmails(pane);
    else renderSettings(pane);
  }

  /* ── Vue d'ensemble ── */
  async function renderOverview(pane) {
    pane.innerHTML = '<p class="amb-empty">Chargement…</p>';
    try {
      /* Restaurants et commissions : si leur lecture échoue, on affiche quand même
         tout ce qui vient des candidatures, avec un avertissement. */
      let partial = false;
      const safeGroup = (name) => getDocs(collectionGroup(db, name)).then((s) => s.docs.map((d) => d.data()))
        .catch((ex) => { console.error(`[vue d'ensemble] ${name}`, ex); partial = true; return []; });
      const [rests, comms] = await Promise.all([safeGroup('restaurants'), safeGroup('commissions')]);
      const now = Date.now();
      const pending = people.filter((p) => p.status === 'pending');
      const late = pending.filter((p) => createdMs(p) && now - createdMs(p) > HOURS_72);
      const active = people.filter((p) => p.status === 'approved');
      const week = people.filter((p) => createdMs(p) && now - createdMs(p) < 7 * 24 * 3600 * 1000).length;
      const inscrits = rests.filter((r) => r.statut !== 'resilie').length;
      const abonnes = rests.filter((r) => r.statut === 'abonne').length;
      const month = monthKey();
      const monthTotal = comms.filter((c) => c.period === month && c.statut !== 'cancelled').reduce((t, c) => t + (Number(c.montant) || 0), 0);
      const clicks = active.reduce((t, p) => t + (Number(p.clicks) || 0), 0);

      const cities = cityGroups().map((g) => {
        const ids = new Set(g.people.map((p) => p.id));
        return {
          ...g,
          active: g.people.filter((p) => p.status === 'approved').length,
          pending: g.people.filter((p) => p.status === 'pending').length,
          rests: rests.filter((r) => ids.has(r.ambassadeurUid) && r.statut !== 'resilie').length
        };
      }).filter((g) => g.active || g.pending || g.rests)
        .sort((x, y) => (y.active - x.active) || (y.pending - x.pending) || x.label.localeCompare(y.label, 'fr'));
      const covered = cities.filter((g) => g.active > 0 && g.key !== '—').length;
      const toCover = cities.filter((g) => g.active === 0 && g.pending > 0 && g.key !== '—');
      const max = Math.max(1, ...cities.map((g) => g.active + g.pending));

      pane.innerHTML = `
        ${partial ? '<p class="form-error">Les restaurants et les commissions n’ont pas pu être chargés (règles Firestore à publier). Les chiffres des candidatures ci-dessous sont à jour.</p>' : ''}
        ${pending.length ? `<div class="amb-alert ${late.length ? 'is-late' : ''}">
          <p><b>${pending.length} candidature${pending.length > 1 ? 's' : ''} en attente</b>${late.length ? ` dont <b>${late.length}</b> depuis plus de 72 heures (le délai annoncé aux candidats)` : ''}.</p>
          <button type="button" class="btn btn--primary" data-go="candidates">Traiter les candidatures</button>
        </div>` : ''}
        <ul class="ep-stats amb-kpis amb-overview">
          <li><b>${active.length}</b><span>ambassadeur${active.length > 1 ? 's' : ''} actif${active.length > 1 ? 's' : ''}</span></li>
          <li><b>${pending.length}</b><span>en attente</span></li>
          <li><b>${week}</b><span>candidature${week > 1 ? 's' : ''} cette semaine</span></li>
          <li><b>${covered}</b><span>ville${covered > 1 ? 's' : ''} couverte${covered > 1 ? 's' : ''}</span></li>
          <li><b>${clicks}</b><span>clic${clicks > 1 ? 's' : ''} sur les liens</span></li>
          <li><b>${inscrits}</b><span>restaurant${inscrits > 1 ? 's' : ''} inscrit${inscrits > 1 ? 's' : ''}</span></li>
          <li><b>${abonnes}</b><span>abonné${abonnes > 1 ? 's' : ''}</span></li>
          <li><b>${esc(fcfa(monthTotal))}</b><span>commissions ${esc(periodLabel(month))}</span></li>
        </ul>

        <h2 class="amb-h2">Répartition par ville</h2>
        ${toCover.length ? `<p class="amb-hint">À couvrir en priorité : ${toCover.map((g) => `<b>${esc(g.label)}</b>`).join(', ')}. Des candidats y attendent, mais aucun ambassadeur n'y est encore actif.</p>` : ''}
        ${cities.length ? `<div class="amb-table"><table>
          <thead><tr><th scope="col">Ville</th><th scope="col">Actifs</th><th scope="col">En attente</th><th scope="col">Restaurants</th><th scope="col" class="amb-bar-col">Présence</th></tr></thead>
          <tbody>${cities.map((g) => `<tr class="${g.active === 0 && g.pending > 0 ? 'is-hot' : ''}">
            <th scope="row"><button type="button" class="amb-linkbtn" data-city="${esc(g.key)}">${esc(g.label)}</button></th>
            <td>${g.active}</td><td>${g.pending}</td><td>${g.rests}</td>
            <td class="amb-bar-col"><span class="amb-bar" role="img" aria-label="${g.active} actifs, ${g.pending} en attente"><i style="width:${(g.active / max) * 100}%"></i><i class="is-pending" style="width:${(g.pending / max) * 100}%"></i></span></td>
          </tr>`).join('')}</tbody>
        </table><p>Cliquez sur une ville pour voir ses candidats. Barre verte : actifs ; dorée : en attente.</p></div>` : '<p class="amb-empty">Aucune candidature pour le moment.</p>'}`;

      $$('[data-go]', pane).forEach((b) => b.addEventListener('click', () => renderMain(b.dataset.go)));
      $$('[data-city]', pane).forEach((b) => b.addEventListener('click', () => {
        Object.assign(query, { ville: b.dataset.city, text: '', produit: '' });
        const g = cities.find((x) => x.key === b.dataset.city);
        renderMain('candidates');
        if (g && !g.pending && g.active) renderCandidates($('#admin-pane'), 'approved');
      }));
    } catch (ex) { pane.innerHTML = `<p class="form-error">${esc(errText(ex))}</p>`; }
  }

  /* ── E-mails envoyés (journal tenu par le Worker) ── */
  const EMAIL_TYPES = { alert: 'Alerte équipe : candidature', contact: 'Alerte équipe : message du site', verify: 'Confirmation d’adresse', ack: 'Candidature reçue', approved: 'Candidature validée', rejected: 'Candidature refusée', reset: 'Mot de passe' };
  const dateTimeFr = (t) => (t ? new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

  async function renderEmails(pane) {
    /* Conteneur propre à cet affichage : si l'admin change d'onglet pendant le
       chargement, la réponse tardive ne remplace pas la page ouverte entre-temps. */
    pane.innerHTML = '<div><p class="amb-empty">Chargement…</p></div>';
    const box = pane.firstElementChild;
    let emails, limit;
    try {
      ({ emails, limit } = await adminCall('listEmails'));
    } catch (ex) {
      console.error('[e-mails envoyés]', ex);
      box.innerHTML = '<p class="form-error">Le journal des e-mails n’a pas pu être chargé. Réessayez dans un instant.</p>';
      return;
    }
    if (!box.isConnected) return;
    const byUid = new Map(people.map((p) => [p.id, p.nom]));
    const byEmail = new Map(people.map((p) => [String(p.email || '').toLowerCase(), p.nom]));
    const rows = emails.map((m) => ({ ...m, nom: byUid.get(m.uid) || byEmail.get(m.to) || '', typeLabel: EMAIL_TYPES[m.type] || m.type }));
    const opt = ([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`;
    box.innerHTML = `
      <div class="amb-toolbar">
        <input type="search" id="m-text" class="form-control amb-toolbar__search" placeholder="Rechercher : nom ou e-mail…" aria-label="Rechercher un e-mail envoyé">
        <select id="m-type" class="form-control" aria-label="Filtrer par type">${[['', 'Tous les types'], ...Object.entries(EMAIL_TYPES)].map(opt).join('')}</select>
        <select id="m-status" class="form-control" aria-label="Filtrer par résultat">${[['', 'Tous les résultats'], ['sent', 'Partis'], ['failed', 'Échecs']].map(opt).join('')}</select>
        <button type="button" class="btn btn--ghost" id="m-export">Exporter (CSV)</button>
        <button type="button" class="btn btn--ghost" id="m-refresh">Actualiser</button>
      </div>
      <p class="amb-hint" aria-live="polite" id="m-count"></p>
      <div id="m-list"></div>
      <p class="amb-hint">« Parti » : Resend a accepté l’e-mail. Sa réception (délivré ou rejeté) se vérifie sur <a href="https://resend.com/emails" target="_blank" rel="noopener">resend.com ↗</a>. Le journal commence à sa mise en service${rows.length >= limit ? ` ; seuls les ${limit} envois les plus récents sont affichés` : ''}. Les e-mails de secours envoyés par Firebase n’y figurent pas.</p>`;

    let current = rows;
    const draw = () => {
      const t = foldKey($('#m-text', box).value);
      const type = $('#m-type', box).value;
      const status = $('#m-status', box).value;
      current = rows.filter((m) => (!t || foldKey(`${m.nom} ${m.to}`).includes(t)) && (!type || m.type === type) && (!status || m.status === status));
      const failed = current.filter((m) => m.status === 'failed').length;
      $('#m-count', box).textContent = `${current.length} e-mail${current.length > 1 ? 's' : ''}${failed ? `, dont ${failed} en échec` : ''}.`;
      $('#m-export', box).disabled = !current.length;
      $('#m-list', box).innerHTML = current.length ? `<div class="amb-table"><table>
        <thead><tr><th scope="col">Destinataire</th><th scope="col">E-mail</th><th scope="col">Date</th><th scope="col">Résultat</th></tr></thead>
        <tbody>${current.map((m) => `<tr>
          <th scope="row">${m.nom ? `${esc(m.nom)}<br>` : ''}<small>${esc(m.to)}</small></th>
          <td title="${esc(m.subject)}">${esc(m.typeLabel)}</td>
          <td>${esc(dateTimeFr(m.sentAt))}</td>
          <td><em class="amb-state ${m.status === 'sent' ? 'amb-state--approved' : 'amb-state--rejected'}"${m.error ? ` title="${esc(m.error)}"` : ''}>${m.status === 'sent' ? 'Parti' : 'Échec'}</em></td>
        </tr>`).join('')}</tbody>
      </table></div>` : `<p class="amb-empty">${rows.length ? 'Aucun e-mail ne correspond à ces filtres.' : 'Aucun e-mail enregistré pour le moment.'}</p>`;
    };
    draw();
    $('#m-text', box).addEventListener('input', draw);
    $('#m-type', box).addEventListener('change', draw);
    $('#m-status', box).addEventListener('change', draw);
    $('#m-refresh', box).addEventListener('click', () => renderEmails(pane));
    $('#m-export', box).addEventListener('click', () => exportEmails(current));
  }

  function exportEmails(list) {
    /* Cellules commençant par = + - @ neutralisées (formules dans un tableur). */
    const cell = (v) => `"${String(v ?? '').replace(/^(?=[=+\-@])/, "'").replace(/"/g, '""')}"`;
    const lines = [['Date', 'Nom', 'E-mail', 'Type', 'Objet', 'Résultat', 'Erreur'].map(cell).join(';')];
    for (const m of list) {
      lines.push([dateTimeFr(m.sentAt), m.nom, m.to, m.typeLabel, m.subject, m.status === 'sent' ? 'Parti' : 'Échec', m.error || ''].map(cell).join(';'));
    }
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `emails-envoyes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ── Candidatures ── */
  const BUCKETS = { pending: ['pending'], approved: ['approved', 'suspended', 'removed'], rejected: ['rejected'] };
  const STATE_LABEL = { pending: 'En attente', approved: 'Actif', suspended: 'Suspendu', removed: 'Retiré', rejected: 'Refusé' };
  const STATE_CLS = { pending: 'amb-state--pending', approved: 'amb-state--approved', suspended: 'amb-state--suspended', removed: 'amb-state--removed', rejected: 'amb-state--rejected' };

  function matches(p) {
    const t = foldKey(query.text);
    if (t) {
      const hay = foldKey([p.nom, p.email, p.code, p.ville, p.quartier, p.profession].join(' '));
      const tel = String(p.whatsapp || '').replace(/\D/g, '');
      const tDigits = query.text.replace(/\D/g, '');
      if (!hay.includes(t) && !(tDigits.length >= 3 && tel.includes(tDigits))) return false;
    }
    if (query.ville && (foldKey(p.ville) || '—') !== query.ville) return false;
    if (query.produit && ![...(p.produits || []), ...(p.produitsFuturs || [])].includes(query.produit)) return false;
    return true;
  }
  const SORTS = {
    recent: (x, y) => createdMs(y) - createdMs(x),
    old: (x, y) => createdMs(x) - createdMs(y),
    name: (x, y) => String(x.nom || '').localeCompare(String(y.nom || ''), 'fr'),
    city: (x, y) => cityLabel(x.ville).localeCompare(cityLabel(y.ville), 'fr') || String(x.nom || '').localeCompare(String(y.nom || ''), 'fr'),
    clicks: (x, y) => (Number(y.clicks) || 0) - (Number(x.clicks) || 0)
  };

  function renderCandidates(pane, filter) {
    const inBucket = (p, k) => BUCKETS[k].includes(p.status);
    const cities = cityGroups().sort((x, y) => x.label.localeCompare(y.label, 'fr'));
    const products = [...new Set(people.flatMap((p) => [...(p.produits || []), ...(p.produitsFuturs || [])]))].sort();
    if (query.ville && !cities.some((g) => g.key === query.ville)) query.ville = '';
    const opt = (v, l, cur) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`;
    pane.innerHTML = `
      <div class="amb-tabs amb-tabs--admin" role="tablist" id="cand-tabs"></div>
      <div class="amb-toolbar">
        <input type="search" id="q-text" class="form-control amb-toolbar__search" placeholder="Rechercher : nom, téléphone, e-mail, code…" value="${esc(query.text)}" aria-label="Rechercher un candidat">
        <select id="q-ville" class="form-control" aria-label="Filtrer par ville">${opt('', 'Toutes les villes', query.ville)}${cities.map((g) => opt(g.key, `${g.label} (${g.people.length})`, query.ville)).join('')}</select>
        <select id="q-produit" class="form-control" aria-label="Filtrer par produit">${opt('', 'Tous les produits', query.produit)}${products.map((x) => opt(x, x, query.produit)).join('')}</select>
        <select id="q-sort" class="form-control" aria-label="Trier">${[['recent', 'Plus récentes'], ['old', 'Plus anciennes'], ['name', 'Nom (A → Z)'], ['city', 'Ville'], ['clicks', 'Clics']].map(([v, l]) => opt(v, l, query.sort)).join('')}</select>
        <button type="button" class="btn btn--ghost" id="q-export">Exporter (CSV)</button>
        <button type="button" class="amb-linkbtn" id="q-reset">Effacer les filtres</button>
      </div>
      <p class="amb-hint" id="cand-count" aria-live="polite"></p>
      <div id="cand-list"></div>`;

    const drawList = () => {
      const filtered = people.filter(matches);
      const count = (k) => filtered.filter((p) => inBucket(p, k)).length;
      $('#cand-tabs', pane).innerHTML = [['pending', 'En attente'], ['approved', 'Validés'], ['rejected', 'Refusés']].map(([k, l]) => `<button type="button" role="tab" data-filter="${k}" aria-selected="${k === filter}">${l} <span>${count(k)}</span></button>`).join('');
      const list = filtered.filter((p) => inBucket(p, filter)).sort(SORTS[query.sort] || SORTS.recent);
      const active = query.text || query.ville || query.produit;
      $('#cand-count', pane).textContent = active ? `${list.length} résultat${list.length > 1 ? 's' : ''} avec ces filtres.` : '';
      $('#q-reset', pane).hidden = !active;
      $('#cand-list', pane).innerHTML = list.length ? `<ul class="amb-people">${list.map(card).join('')}</ul>` : `<p class="amb-empty">${active ? 'Aucun candidat ne correspond à ces filtres.' : 'Aucun ambassadeur dans cette liste.'}</p>`;
      $$('[data-filter]', pane).forEach((b) => b.addEventListener('click', () => { filter = b.dataset.filter; drawList(); }));
      $$('[data-act]', pane).forEach((b) => b.addEventListener('click', () => act(b.dataset.act, b.dataset.id, pane, filter)));
      return list;
    };
    let current = drawList();
    const redraw = () => { current = drawList(); };
    $('#q-text', pane).addEventListener('input', (e) => { query.text = e.target.value; redraw(); });
    $('#q-ville', pane).addEventListener('change', (e) => { query.ville = e.target.value; redraw(); });
    $('#q-produit', pane).addEventListener('change', (e) => { query.produit = e.target.value; redraw(); });
    $('#q-sort', pane).addEventListener('change', (e) => { query.sort = e.target.value; redraw(); });
    $('#q-reset', pane).addEventListener('click', () => { Object.assign(query, { text: '', ville: '', produit: '' }); renderCandidates(pane, filter); });
    $('#q-export', pane).addEventListener('click', () => exportPeople(current, filter));
  }

  function exportPeople(list, filter) {
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['Nom', 'Statut', 'Code', 'WhatsApp', 'E-mail', 'Ville', 'Quartier', 'Profession', 'Réseau', 'Produits', 'Produits (à l’ouverture)', 'Annuaire public', 'Clics', 'Candidature le', 'Motivation'];
    const lines = [head.map(cell).join(';')];
    for (const p of list) {
      lines.push([p.nom, STATE_LABEL[p.status] || p.status, p.code || '', p.whatsapp, p.email, cityLabel(p.ville), p.quartier, p.profession || p.profil || '',
        (p.reseau || []).join(', '), (p.produits || []).join(', '), (p.produitsFuturs || []).join(', '), p.annuaire === false ? 'Non' : 'Oui',
        Number(p.clicks) || 0, dateFr(p.createdAt), p.motivation || ''].map(cell).join(';'));
    }
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ambassadeurs-${{ pending: 'en-attente', approved: 'valides', rejected: 'refuses' }[filter] || filter}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function card(p) {
    const manage = ['approved', 'suspended', 'removed'].includes(p.status);
    return `<li class="amb-person">
      <div class="amb-person__head">
        <div><strong>${esc(p.nom)}</strong><span>${esc(p.ville)}${p.quartier ? ' · ' + esc(p.quartier) : ''} · ${esc(p.profession || p.profil || '—')} · envoyée le ${esc(dateFr(p.createdAt))}</span></div>
        ${p.code ? `<code>${esc(p.code)}</code>` : ''}
        <em class="amb-state ${STATE_CLS[p.status] || ''}">${esc(STATE_LABEL[p.status] || p.status)}</em>
      </div>
      <dl class="amb-summary">
        <div><dt>WhatsApp</dt><dd>${esc(p.whatsapp)}</dd></div>
        <div><dt>E-mail</dt><dd>${esc(p.email)}</dd></div>
        <div><dt>Ville · quartier</dt><dd>${esc(p.ville)}${p.quartier ? ' · ' + esc(p.quartier) : ''}</dd></div>
        <div><dt>Profession</dt><dd>${esc(p.profession || p.profil || '—')}</dd></div>
        <div><dt>Réseau</dt><dd>${esc((p.reseau || []).join(', ') || p.reseaux || '—')}</dd></div>
        <div><dt>Profil</dt><dd>${p.profilLien && isHttpUrl(p.profilLien) ? `<a href="${esc(p.profilLien)}" target="_blank" rel="noopener">Voir le profil ↗</a>` : (p.profilLien ? esc(p.profilLien) : '—')}</dd></div>
        <div><dt>Produits</dt><dd>${esc([(p.produits || []).join(', '), p.produitsFuturs?.length ? 'plus tard : ' + p.produitsFuturs.join(', ') : ''].filter(Boolean).join(' · ') || '—')}</dd></div>
        <div><dt>Annuaire public</dt><dd>${p.annuaire === false ? 'Refusé' : 'Accepté'}</dd></div>
        <div class="is-wide"><dt>Motivation</dt><dd>${esc(p.motivation || p.methode || '—')}</dd></div>
      </dl>
      <div class="pg-cta">
        ${p.status === 'pending' ? `<button type="button" class="btn btn--primary" data-act="approve" data-id="${esc(p.id)}">Valider et créer son lien</button>` : ''}
        ${manage ? `<button type="button" class="btn btn--primary" data-act="manage" data-id="${esc(p.id)}">Restaurants et gains</button>` : ''}
        ${p.status === 'approved' ? `<button type="button" class="btn btn--ghost" data-act="suspend" data-id="${esc(p.id)}">Suspendre</button>` : ''}
        ${(p.status === 'suspended' || p.status === 'removed') ? `<button type="button" class="btn btn--primary" data-act="reactivate" data-id="${esc(p.id)}">Réactiver</button>` : ''}
        ${(p.status === 'approved' || p.status === 'suspended') ? `<button type="button" class="btn btn--ghost" data-act="remove" data-id="${esc(p.id)}">Retirer</button>` : ''}
        ${p.status === 'pending' ? `<button type="button" class="btn btn--ghost" data-act="reject" data-id="${esc(p.id)}">Refuser</button>` : ''}
        <button type="button" class="btn btn--ghost" data-act="edit" data-id="${esc(p.id)}">Modifier la fiche</button>
        ${p.email ? `<button type="button" class="btn btn--ghost" data-act="reset" data-id="${esc(p.id)}">Lien mot de passe</button>` : ''}
        <button type="button" class="btn btn--ghost amb-danger" data-act="delete" data-id="${esc(p.id)}">Supprimer le compte</button>
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
        if (!confirm(`Valider la candidature de ${p.nom} ? Un e-mail de bienvenue avec son code et son lien lui sera envoyé.`)) return;
        const code = p.code || uniqueCode();
        await updateDoc(doc(db, 'ambassadors', id), { status: 'approved', code, approvedAt: serverTimestamp(), updatedAt: serverTimestamp() });
        Object.assign(p, { status: 'approved', code });
        renderCandidates(pane, filter);
        notifyDecision(p);
      } else if (what === 'reject') {
        if (!confirm(`Refuser la candidature de ${p.nom} ? Un e-mail l'en informera.`)) return;
        await updateDoc(doc(db, 'ambassadors', id), { status: 'rejected', updatedAt: serverTimestamp() });
        p.status = 'rejected';
        renderCandidates(pane, filter);
        notifyDecision(p);
      } else if (what === 'suspend') {
        if (!confirm(`Suspendre ${p.nom} ? Son lien cesse de compter et sa fiche sera signalée comme suspendue dans l'annuaire.`)) return;
        await updateDoc(doc(db, 'ambassadors', id), { status: 'suspended', updatedAt: serverTimestamp() });
        p.status = 'suspended';
        renderCandidates(pane, filter);
      } else if (what === 'remove') {
        if (!confirm(`Retirer ${p.nom} du programme ? Son lien cessera de fonctionner.`)) return;
        await updateDoc(doc(db, 'ambassadors', id), { status: 'removed', updatedAt: serverTimestamp() });
        p.status = 'removed';
        renderCandidates(pane, filter);
      } else if (what === 'reactivate') {
        await updateDoc(doc(db, 'ambassadors', id), { status: 'approved', updatedAt: serverTimestamp() });
        p.status = 'approved';
        renderCandidates(pane, filter);
      } else if (what === 'manage') {
        const box = $(`#m-${CSS.escape(p.id)}`);
        if (!box.hidden) { box.hidden = true; return; }
        await renderDetail(box, p);
      } else if (what === 'edit') {
        const box = $(`#m-${CSS.escape(p.id)}`);
        if (!box.hidden && box.dataset.mode === 'edit') { box.hidden = true; return; }
        renderEdit(box, p, pane, filter);
      } else if (what === 'reset') {
        if (!confirm(`Envoyer à ${p.nom} (${p.email}) un e-mail pour choisir un nouveau mot de passe ?`)) return;
        await adminCall('sendReset', { ambassadorUid: id });
        alert(`E-mail envoyé à ${p.email}.`);
      } else if (what === 'delete') {
        await deleteAccount(p, pane, filter);
      }
    } catch (ex) { alert(ex?.code === 'too-many-requests' ? 'Un e-mail vient déjà d’être envoyé. Patientez une minute.' : errText(ex)); }
  }

  /* Suppression définitive : fiche, restaurants, gains, versements et accès de connexion. */
  async function deleteAccount(p, pane, filter) {
    const typed = prompt(`Supprimer DÉFINITIVEMENT le compte de ${p.nom} ?\n\nSa fiche, ses restaurants, ses commissions, ses versements et son accès de connexion seront effacés. Son lien cessera de fonctionner. Cette action est irréversible.\n\nTapez SUPPRIMER pour confirmer.`);
    if (typed === null) return;
    if (typed.trim().toUpperCase() !== 'SUPPRIMER') return alert('Suppression annulée : le mot de confirmation est incorrect.');
    try {
      await adminCall('deleteAccount', { ambassadorUid: p.id });
    } catch (ex) {
      if (ex?.code !== 'failed-precondition' || !ex.unpaid) throw ex;
      if (!confirm(`${p.nom} a encore ${fcfa(ex.unpaid)} de commissions non versées. Supprimer quand même ? Ces données seront perdues.`)) return;
      await adminCall('deleteAccount', { ambassadorUid: p.id, force: true });
    }
    people = people.filter((x) => x.id !== p.id);
    renderCandidates(pane, filter);
  }

  /* Modification des coordonnées par l'administration. */
  function renderEdit(box, p, pane, filter) {
    const fields = [['nom', 'Nom et prénom', 100], ['whatsapp', 'WhatsApp', 30], ['ville', 'Ville', 80], ['quartier', 'Quartier', 80], ['profession', 'Profession', 100]];
    box.hidden = false;
    box.dataset.mode = 'edit';
    box.innerHTML = `
      <form class="pg-form amb-settings" novalidate>
        ${fields.map(([k, l, max]) => `<div class="form-group"><label for="ed-${esc(p.id)}-${k}">${l}</label><input id="ed-${esc(p.id)}-${k}" name="${k}" class="form-control" maxlength="${max}" value="${esc(p[k] || '')}" required></div>`).join('')}
        <div class="form-group span-2"><label><input type="checkbox" name="annuaire" ${p.annuaire === false ? '' : 'checked'}> Visible dans l'annuaire public</label></div>
        <p class="form-error span-2" role="alert" hidden></p>
        <div class="pg-cta span-2"><button class="btn btn--primary" type="submit">Enregistrer</button><button class="btn btn--ghost" type="button" data-cancel>Annuler</button></div>
      </form>`;
    const f = $('form', box), err = $('.form-error', box);
    $('[data-cancel]', box).addEventListener('click', () => { box.hidden = true; });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {};
      for (const [k, l, max] of fields) {
        const v = f[k].value.trim().slice(0, max);
        if (v.length < (k === 'whatsapp' ? 6 : 2)) return show(err, `Vérifiez le champ « ${l} ».`);
        data[k] = v;
      }
      data.annuaire = f.annuaire.checked;
      const btn = f.querySelector('button[type=submit]');
      show(err, ''); busy(btn, true, 'Enregistrement…');
      try {
        await updateDoc(doc(db, 'ambassadors', p.id), { ...data, updatedAt: serverTimestamp() });
        Object.assign(p, data);
        renderCandidates(pane, filter);
      } catch (ex) { show(err, errText(ex)); busy(btn, false); }
    });
  }

  async function renderDetail(box, p) {
    box.hidden = false;
    box.dataset.mode = 'manage';
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
      ['recurringPct', 'Commission des autres mois payés (%)', 0, 100],
      ['offeredMonth', 'Mois offert au client à l’inscription (n°)', 1, 12],
      ['maxMonths', 'Durée d’un cycle (mois) : le 1er mois de chaque cycle repaie le taux du 1er mois', 1, 36],
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
