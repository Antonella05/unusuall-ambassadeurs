/* UNUSUALL Ambassadeurs — Worker Cloudflare (plan gratuit, sans Blaze).
   Routes : /go (redirection + clic), /qr (SVG), /search (recherche publique),
            /directory (annuaire public), /webhook (événements Epicure, secret),
            dont restaurant.cancelled (résiliation),
            /admin (actions admin, jeton Firebase),
            /apply-ack (accusé de réception de candidature par e-mail, jeton Firebase),
            /verify-email (lien de confirmation d'adresse, jeton Firebase),
            /reset-password (lien de nouveau mot de passe, public),
            /delete-account (suppression de son propre compte, connexion récente exigée),
            /contact (formulaires de unusuall.online, public).
   L'équipe est alertée par e-mail (TEAM_EMAIL) à chaque candidature et message.
   Tâche planifiée (wrangler.toml) : relances à J+7 et J+14 des comptes sans candidature.
   Les e-mails partent via Resend avec la mise en page de worker/mail.js ;
   chaque envoi est noté dans la collection emailLog (page admin « E-mails envoyés »).
   Les données restent dans Firestore ; ce Worker y accède via l'API REST avec un
   compte de service (secret SERVICE_ACCOUNT_JSON, jamais côté navigateur). */
import qrcode from 'qrcode-generator';
import { applicationAck, verifyEmail, passwordReset, decisionApproved, decisionRejected, teamAlert, applicationReminder, sendMail } from './mail.js';

const PROJECT = 'unusuall-ambassadeurs';
const DOC_ROOT = `projects/${PROJECT}/databases/(default)/documents`;
const API_BASE = `https://firestore.googleapis.com/v1/${DOC_ROOT}`;
const ALLOWED_ORIGINS = ['https://ambassadeurs.unusuall.online', 'http://127.0.0.1:8123', 'http://localhost:8123'];
const CONTINUE_URL = 'https://ambassadeurs.unusuall.online/espace.html';
const SITE_ORIGIN = 'https://ambassadeurs.unusuall.online';
const TEAM_EMAIL = 'contactunusuall@gmail.com';
/* Site principal : seul autorisé à utiliser /contact. */
const CONTACT_ORIGINS = ['https://unusuall.online', 'https://www.unusuall.online', 'http://127.0.0.1:5500', 'http://localhost:5500'];
const CORS_PATHS = ['/admin', '/apply-ack', '/verify-email', '/reset-password', '/delete-account'];
const corsFor = (request) => {
  const origin = request.headers.get('Origin') || '';
  return ALLOWED_ORIGINS.includes(origin)
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400' }
    : {};
};

const DEFAULT_SETTINGS = {
  firstPct: 30, recurringPct: 10, offeredMonth: 2, maxMonths: 12,
  validationDays: 7, closingDay: 28, paymentDay: 5,
  epicureUrl: 'https://app.epicure.unusuall.online'
};

const str = (v) => (typeof v === 'string' ? v.trim() : '');
/* Pour les objets d'e-mail : pas de retour à la ligne, longueur bornée. */
const oneLine = (v) => String(v).replace(/\s+/g, ' ').trim().slice(0, 150);
const norm = (v) => String(v || '').toLowerCase().replace(/\s+/g, ' ').trim();
const digits = (v) => String(v || '').replace(/\D/g, '');
const fold = (v) => String(v || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
const safeId = (v) => {
  const s = encodeURIComponent(String(v));
  return s === '.' || s === '..' ? `_${s}` : s;
};
const docName = (path) => `${DOC_ROOT}/${path}`;
const docId = (name) => String(name).split('/').pop();

function httpErr(status, code, message) {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  return e;
}
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

/* ───────── Encodage Firestore REST ───────── */
function enc(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  return { mapValue: { fields: encFields(v) } };
}
const encFields = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, enc(v)]));
function dec(v) {
  if (!v || typeof v !== 'object') return null;
  if ('nullValue' in v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(dec);
  if ('mapValue' in v) return decFields(v.mapValue.fields || {});
  return null;
}
const decFields = (fields) => Object.fromEntries(Object.entries(fields || {}).map(([k, v]) => [k, dec(v)]));
const eq = (field, value) => ({ fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: enc(value) } });
const and = (...filters) => ({ compositeFilter: { op: 'AND', filters } });

/* ───────── Client Firestore (compte de service → jeton OAuth → REST) ───────── */
const b64url = (s) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlBytes = (buf) => b64url(String.fromCharCode(...new Uint8Array(buf)));
const fromB64url = (s) => {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b + '='.repeat((4 - b.length % 4) % 4)), (c) => c.charCodeAt(0));
};
const pemToDer = (pem) => Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')), (c) => c.charCodeAt(0));

class Firestore {
  constructor(env) {
    this.sa = JSON.parse(env.SERVICE_ACCOUNT_JSON);
    this.tokens = {};
  }
  /* Jeton OAuth du compte de service, mis en cache par périmètre (scope). */
  async accessToken(scope = 'https://www.googleapis.com/auth/datastore') {
    const cached = this.tokens[scope];
    if (cached && Date.now() < cached.expires - 60000) return cached.token;
    const now = Math.floor(Date.now() / 1000);
    const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = b64url(JSON.stringify({
      iss: this.sa.client_email,
      scope,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now, exp: now + 3600
    }));
    const key = await crypto.subtle.importKey('pkcs8', pemToDer(this.sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${claims}`));
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${head}.${claims}.${b64urlBytes(sig)}`
    });
    const data = await res.json();
    if (!res.ok) throw new Error('OAuth Google impossible : ' + JSON.stringify(data));
    this.tokens[scope] = { token: data.access_token, expires: Date.now() + (Number(data.expires_in) || 3600) * 1000 };
    return data.access_token;
  }
  /* Lien d'action Firebase Auth (VERIFY_EMAIL, PASSWORD_RESET) généré sans
     qu'aucun e-mail Firebase ne parte : on l'envoie nous-mêmes via Resend.
     Renvoie null si aucun compte n'existe pour cette adresse. */
  async oobLink(requestType, email) {
    const token = await this.accessToken('https://www.googleapis.com/auth/cloud-platform');
    const send = async (withContinue) => {
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:sendOobCode`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Firebase-Locale': 'fr' },
        body: JSON.stringify({ requestType, email, returnOobLink: true, ...(withContinue ? { continueUrl: CONTINUE_URL } : {}) })
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data, msg: String(data.error?.message || '') };
    };
    let r = await send(true);
    /* Domaine de retour non autorisé dans Firebase : on retente sans lien de retour. */
    if (!r.ok && /CONTINUE_URI|UNAUTHORIZED_DOMAIN|INVALID_CONTINUE/i.test(r.msg)) r = await send(false);
    /* Compte inexistant : erreur explicite, ou succès sans lien quand la
       protection contre l'énumération des e-mails est active dans Firebase. */
    if (!r.ok && /EMAIL_NOT_FOUND|USER_NOT_FOUND/i.test(r.msg)) return null;
    if (r.ok && !r.data.oobLink) return null;
    if (!r.ok) throw new Error('Lien Firebase impossible : ' + (r.msg || `HTTP ${r.status}`));
    return r.data.oobLink;
  }
  /* Tous les comptes de connexion (Firebase Auth). */
  async listAuthUsers() {
    const token = await this.accessToken('https://www.googleapis.com/auth/cloud-platform');
    const users = [];
    let page = '';
    do {
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:batchGet?maxResults=500${page ? `&nextPageToken=${encodeURIComponent(page)}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error('Liste des comptes impossible : ' + (data.error?.message || `HTTP ${res.status}`));
      users.push(...(data.users || []));
      page = data.nextPageToken || '';
    } while (page);
    return users;
  }
  /* Supprime le compte de connexion (Firebase Auth). Déjà absent = succès. */
  async deleteAuthUser(uid) {
    const token = await this.accessToken('https://www.googleapis.com/auth/cloud-platform');
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:delete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: uid })
    });
    const data = await res.json().catch(() => ({}));
    const msg = String(data.error?.message || '');
    if (!res.ok && !/USER_NOT_FOUND|EMAIL_NOT_FOUND/i.test(msg)) throw new Error('Suppression du compte impossible : ' + (msg || `HTTP ${res.status}`));
  }
  async call(path, method = 'GET', body) {
    const token = await this.accessToken();
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    /* 404 = « document absent » seulement pour une lecture. Sur une écriture
       (commit, précondition exists:true), c'est un échec : on le remonte. */
    if (res.status === 404 && method === 'GET') return null;
    const data = await res.json();
    if (!res.ok) {
      const err = (Array.isArray(data) ? data.find((r) => r.error)?.error : data.error) || {};
      const e = new Error(err.message || 'Erreur Firestore');
      e.fsStatus = err.status || '';
      throw e;
    }
    return data;
  }
  getDoc(path) { return this.call(`/${path}`); }
  async data(path) {
    const d = await this.getDoc(path);
    return d ? decFields(d.fields) : null;
  }
  commit(writes) { return this.call(':commit', 'POST', { writes }); }
  async query(collectionId, { where, orderBy, limit, parent = '' } = {}) {
    const structuredQuery = { from: [{ collectionId }], ...(where ? { where } : {}), ...(orderBy ? { orderBy } : {}), ...(limit ? { limit } : {}) };
    const path = parent ? `/${parent}:runQuery` : ':runQuery';
    const rows = await this.call(path, 'POST', { structuredQuery });
    return (rows || []).filter((r) => r.document).map((r) => r.document);
  }
}

const isDuplicate = (e) => ['ALREADY_EXISTS', 'FAILED_PRECONDITION', 'ABORTED'].includes(e.fsStatus);

async function getSettings(fs) {
  const s = await fs.data('settings/platform').catch(() => null);
  return { ...DEFAULT_SETTINGS, ...(s || {}) };
}
async function findByCode(fs, code) {
  const docs = await fs.query('ambassadors', { where: and(eq('code', code), eq('status', 'approved')), limit: 1 });
  return docs.length ? { id: docId(docs[0].name), ...decFields(docs[0].fields) } : null;
}
/* Cycle renouvelé chaque année (maxMonths = durée du cycle, 12 par défaut) :
   - 1er mois de chaque cycle (mois 1, 13, 25…) : firstPct (30 %)
   - mois offert au client (mois 2, à l'inscription seulement) : 0
   - tous les autres mois payés : recurringPct (10 %), sans limite de durée */
function commissionFor(amount, moisIndex, settings) {
  const month = Number(moisIndex);
  if (!Number.isInteger(month) || month < 1) return { montant: 0, taux: 0, type: 'invalid' };
  const cycle = Math.max(1, Number(settings.maxMonths) || 12);
  if ((month - 1) % cycle === 0) {
    return { montant: Math.round(amount * Number(settings.firstPct) / 100), taux: Number(settings.firstPct), type: month === 1 ? 'first' : 'anniversary' };
  }
  if (month === Number(settings.offeredMonth)) return { montant: 0, taux: 0, type: 'offered' };
  return { montant: Math.round(amount * Number(settings.recurringPct) / 100), taux: Number(settings.recurringPct), type: 'recurring' };
}

/* ───────── /go : lien personnel ───────── */
/* Les aperçus de liens (WhatsApp, Facebook, etc.) et le prefetch du navigateur
   déclenchent plusieurs requêtes pour un seul clic humain : on ignore les robots
   et on déduplique les requêtes rapprochées d'un même navigateur (cookie 60 s). */
const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|twitterbot|linkedinbot|slackbot|discordbot|preview|embedly|quora|pinterest|curl|wget|python-requests|node-fetch|headless|lighthouse|pingdom|uptimerobot|monitor/i;
async function go(url, fs, request) {
  const code = str(url.searchParams.get('a') || url.searchParams.get('ref') || url.searchParams.get('amb')).toUpperCase();
  const settings = await getSettings(fs);
  let target;
  try { target = new URL(settings.epicureUrl); } catch { target = new URL(DEFAULT_SETTINGS.epicureUrl); }
  const headers = { Location: target.toString() };
  if (/^[A-Z0-9]{4,16}$/.test(code)) {
    const ambassador = await findByCode(fs, code);
    if (ambassador) {
      const ua = request.headers.get('User-Agent') || '';
      const cookies = request.headers.get('Cookie') || '';
      const seen = cookies.split(';').some((c) => c.trim() === `ambclk_${code}=1`);
      if (!BOT_RE.test(ua) && !seen) {
        await fs.commit([{
          transform: {
            document: docName(`ambassadors/${ambassador.id}`),
            fieldTransforms: [
              { fieldPath: 'clicks', increment: { integerValue: '1' } },
              { fieldPath: 'lastClickAt', setToServerValue: 'REQUEST_TIME' }
            ]
          }
        }]);
      }
      if (!BOT_RE.test(ua)) {
        headers['Set-Cookie'] = `ambclk_${code}=1; Max-Age=60; Path=/; SameSite=Lax; Secure`;
      }
      target.searchParams.set('amb', code);
      headers.Location = target.toString();
    }
  }
  return new Response(null, { status: 302, headers });
}

/* ───────── /qr : QR code SVG du lien ───────── */
function qr(url) {
  const code = str(url.searchParams.get('a') || url.searchParams.get('ref') || url.searchParams.get('amb')).toUpperCase();
  if (!/^[A-Z0-9]{4,16}$/.test(code)) return new Response('Code ambassadeur invalide.', { status: 400 });
  const link = `${url.origin}/go?a=${encodeURIComponent(code)}`;
  const q = qrcode(0, 'M');
  q.addData(link);
  q.make();
  const n = q.getModuleCount();
  const size = 240;
  const cell = size / (n + 2);
  let rects = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (q.isDark(r, c)) rects += `<rect x="${((c + 1) * cell).toFixed(2)}" y="${((r + 1) * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}"/>`;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="#ffffff"/><g fill="#0f3321">${rects}</g></svg>`;
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600' } });
}

/* ───────── /search : recherche publique par nom (pour Epicure) ───────── */
async function search(url, fs) {
  const q = norm(url.searchParams.get('q'));
  const headers = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300' };
  if (q.length < 2) return json([], 200, headers);
  const docs = await fs.query('ambassadors', { where: eq('status', 'approved'), limit: 200 });
  const fq = fold(q);
  const out = docs
    .map((d) => decFields(d.fields))
    /* Ceux qui ont refusé l'annuaire ne sortent que sur leur nom complet exact
       (le client qui les connaît peut toujours les retrouver) ou leur code. */
    .filter((a) => a.code && (a.code === q.toUpperCase() || (a.annuaire !== false
      ? norm(a.nom).includes(q)
      : fold(a.nom) === fq)))
    .slice(0, 10)
    .map((a) => ({ name: a.nom, code: a.code }));
  return json(out, 200, headers);
}

/* ───────── /directory : annuaire public (nom, code ou téléphone) ───────── */
async function directory(url, fs) {
  const raw = str(url.searchParams.get('q'));
  const headers = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=120' };
  const q = fold(raw);
  const qd = digits(raw);
  /* Téléphone : numéro complet uniquement (8 chiffres ou plus), pour qu'on ne
     puisse pas parcourir l'annuaire avec un indicatif ou quelques chiffres. */
  const phoneQuery = qd.length >= 8 && qd.length >= raw.replace(/[\s+().-]/g, '').length;
  if (q.length < 2 && !phoneQuery) return json([], 200, headers);
  const statuses = ['approved', 'suspended', 'removed'];
  const statusOf = { approved: 'actif', suspended: 'suspendu', removed: 'retire' };
  const docs = (await Promise.all(statuses.map((s) => fs.query('ambassadors', { where: eq('status', s), limit: 300 })))).flat();
  const out = docs
    .map((d) => decFields(d.fields || {}))
    .filter((a) => a.code && a.annuaire !== false)
    .filter((a) => {
      if (q.length >= 2 && (fold(a.nom).includes(q) || fold(a.code).includes(q))) return true;
      if (phoneQuery) {
        const w = digits(a.whatsapp);
        /* Même numéro, avec ou sans indicatif pays (229…). */
        if (w.length >= 8 && (w === qd || w.endsWith(qd) || qd.endsWith(w))) return true;
      }
      return false;
    })
    .slice(0, 20)
    .map((a) => ({
      nom: a.nom || '',
      code: a.code,
      ville: a.ville || '',
      quartier: a.quartier || '',
      produits: (a.produits || []).concat((a.produitsFuturs || []).map((p) => p + ' (à venir)')),
      entryAt: a.approvedAt || a.createdAt || null,
      status: statusOf[a.status] || 'actif',
      photo: a.photo || ''
    }))
    .sort((x, y) => String(x.nom).localeCompare(String(y.nom), 'fr'));
  return json(out, 200, headers);
}

/* ───────── /webhook : événements Epicure ───────── */
function secretOk(request, env) {
  const expected = env.EPICURE_WEBHOOK_SECRET || '';
  const given = request.headers.get('x-epicure-secret') || '';
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  if (!expected || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function handleRestaurantRegistered(fs, body) {
  const restaurantId = str(body.restaurantId);
  const code = str(body.ambassadorCode || body.ambassadorId).toUpperCase();
  if (!restaurantId || !code) throw httpErr(400, 'invalid-argument', 'restaurantId et ambassadorCode sont requis.');
  const ambassador = await findByCode(fs, code);
  if (!ambassador) return { ignored: true, reason: 'unknown_ambassador' };
  const rid = safeId(restaurantId);
  const index = await fs.data(`restaurantIndex/${rid}`);
  if (index && index.ambassadorUid !== ambassador.id) return { ignored: true, reason: 'already_attached' };

  const autoReferral =
    (digits(body.phone) && digits(body.phone) === digits(ambassador.whatsapp)) ||
    (norm(body.email) && norm(body.email) === norm(ambassador.email)) ||
    (norm(body.name) && norm(body.name) === norm(ambassador.nom));

  const writes = [
    {
      update: {
        name: docName(`events/${safeId(`restaurant:${restaurantId}`)}`),
        fields: encFields({ type: 'restaurant.registered', restaurantId, ambassadorUid: ambassador.id, autoReferral: Boolean(autoReferral), processedAt: new Date() })
      },
      currentDocument: { exists: false }
    },
    {
      update: {
        name: docName(`ambassadors/${ambassador.id}/restaurants/${rid}`),
        fields: encFields({
          restaurantId,
          nom: str(body.name).slice(0, 120),
          telephone: str(body.phone).slice(0, 30),
          email: str(body.email).slice(0, 200),
          formule: str(body.formule).slice(0, 40),
          statut: 'inscrit',
          source: str(body.source).slice(0, 20) || 'link',
          ambassadeurUid: ambassador.id,
          ambassadeurCode: ambassador.code,
          ambassadeurNom: ambassador.nom,
          autoReferral: Boolean(autoReferral),
          createdAt: new Date(),
          updatedAt: new Date()
        })
      }
    },
    {
      update: {
        name: docName(`restaurantIndex/${rid}`),
        fields: encFields({ restaurantId, ambassadorUid: ambassador.id, ambassadorCode: ambassador.code, nom: str(body.name).slice(0, 120) })
      }
    }
  ];
  try { await fs.commit(writes); } catch (e) { if (isDuplicate(e)) return { duplicate: true }; throw e; }
  return { ok: true, autoReferral: Boolean(autoReferral) };
}

async function handlePaymentConfirmed(fs, body) {
  const paymentId = str(body.paymentId);
  const restaurantId = str(body.restaurantId);
  const amount = Number(body.montant ?? body.amount);
  if (!paymentId || !restaurantId || !Number.isFinite(amount) || amount < 0) {
    throw httpErr(400, 'invalid-argument', 'paymentId, restaurantId et montant sont requis.');
  }
  const rid = safeId(restaurantId);
  const index = await fs.data(`restaurantIndex/${rid}`);
  if (!index) return { ignored: true, reason: 'unknown_restaurant' };
  const uid = index.ambassadorUid;
  const pid = safeId(paymentId);
  const settings = await getSettings(fs);

  let moisIndex = Number(body.moisIndex);
  if (!Number.isInteger(moisIndex) || moisIndex < 1) {
    const prior = await fs.query('payments', { where: and(eq('restaurantId', restaurantId), eq('statut', 'encaisse')), parent: `ambassadors/${uid}` });
    moisIndex = prior.length + 1;
  }
  const paidDate = body.date ? new Date(body.date) : new Date();
  const paidAt = Number.isNaN(paidDate.getTime()) ? new Date() : paidDate;
  const payableDate = new Date(paidAt.getTime() + Number(settings.validationDays) * 86400000);
  const period = payableDate.toISOString().slice(0, 7);
  const calc = commissionFor(amount, moisIndex, settings);

  const writes = [
    {
      update: {
        name: docName(`events/${safeId(`payment:${paymentId}`)}`),
        fields: encFields({ type: 'payment.confirmed', paymentId, restaurantId, ambassadorUid: uid, processedAt: new Date() })
      },
      currentDocument: { exists: false }
    },
    {
      update: {
        name: docName(`ambassadors/${uid}/payments/${pid}`),
        fields: encFields({
          paymentId, restaurantId,
          restaurantNom: index.nom || '',
          formule: str(body.formule).slice(0, 40),
          montant: amount,
          date: paidAt,
          periodeDebut: str(body.periodeDebut || body.periodStart).slice(0, 40),
          periodeFin: str(body.periodeFin || body.periodEnd).slice(0, 40),
          moisIndex,
          statut: 'encaisse',
          createdAt: new Date()
        })
      }
    }
  ];
  if (calc.montant > 0) {
    writes.push({
      update: {
        name: docName(`ambassadors/${uid}/commissions/${pid}`),
        fields: encFields({
          paymentId, restaurantId,
          restaurantNom: index.nom || '',
          moisIndex,
          type: calc.type,
          taux: calc.taux,
          montant: calc.montant,
          statut: 'pending',
          period,
          payableAt: payableDate,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      }
    });
  }
  writes.push(
    {
      update: {
        name: docName(`ambassadors/${uid}/restaurants/${rid}`),
        fields: encFields({ restaurantId, statut: 'abonne', ...(str(body.formule) ? { formule: str(body.formule).slice(0, 40) } : {}), updatedAt: new Date() })
      },
      /* Sans précondition : si la fiche a disparu, elle est recréée au lieu de
         faire échouer tout l'enregistrement du paiement. */
      updateMask: { fieldPaths: ['restaurantId', 'statut', 'updatedAt', ...(str(body.formule) ? ['formule'] : [])] }
    },
    {
      update: {
        name: docName(`paymentIndex/${pid}`),
        fields: encFields({ paymentId, restaurantId, ambassadorUid: uid })
      }
    }
  );
  try { await fs.commit(writes); } catch (e) { if (isDuplicate(e)) return { duplicate: true }; throw e; }
  return { ok: true, duplicate: false, commission: calc.montant, moisIndex, period };
}

async function handlePaymentCancelled(fs, body, reason) {
  const paymentId = str(body.paymentId);
  if (!paymentId) throw httpErr(400, 'invalid-argument', 'paymentId est requis.');
  const pid = safeId(paymentId);
  const index = await fs.data(`paymentIndex/${pid}`);
  if (!index) return { ignored: true, reason: 'unknown_payment' };
  const uid = index.ambassadorUid;
  const payment = await fs.getDoc(`ambassadors/${uid}/payments/${pid}`);
  const commission = await fs.getDoc(`ambassadors/${uid}/commissions/${pid}`);

  const writes = [{
    update: {
      name: docName(`events/${safeId(`cancel:${paymentId}`)}`),
      fields: encFields({ type: `payment.${reason}`, paymentId, ambassadorUid: uid, processedAt: new Date() })
    },
    currentDocument: { exists: false }
  }];
  if (payment) {
    writes.push({
      update: { name: payment.name, fields: encFields({ statut: reason, updatedAt: new Date() }) },
      updateMask: { fieldPaths: ['statut', 'updatedAt'] }
    });
  }
  if (commission) {
    const c = decFields(commission.fields);
    writes.push({
      update: { name: commission.name, fields: encFields({ statut: 'cancelled', cancelReason: reason, clawback: c.statut === 'paid', updatedAt: new Date() }) },
      updateMask: { fieldPaths: ['statut', 'cancelReason', 'clawback', 'updatedAt'] }
    });
  }
  try { await fs.commit(writes); } catch (e) { if (isDuplicate(e)) return { duplicate: true }; throw e; }
  return { ok: true };
}

/* Résiliation : le restaurant passe « résilié ». Un paiement confirmé plus tard
   le repasse « abonné » et la numérotation des mois continue (moisIndex). */
async function handleRestaurantCancelled(fs, body) {
  const restaurantId = str(body.restaurantId);
  if (!restaurantId) throw httpErr(400, 'invalid-argument', 'restaurantId est requis.');
  const rid = safeId(restaurantId);
  const index = await fs.data(`restaurantIndex/${rid}`);
  if (!index) return { ignored: true, reason: 'unknown_restaurant' };
  const when = body.date ? new Date(body.date) : new Date();
  const cancelledAt = Number.isNaN(when.getTime()) ? new Date() : when;
  const day = cancelledAt.toISOString().slice(0, 10);
  const writes = [
    {
      update: {
        name: docName(`events/${safeId(`restaurant-cancel:${restaurantId}:${day}`)}`),
        fields: encFields({ type: 'restaurant.cancelled', restaurantId, ambassadorUid: index.ambassadorUid, processedAt: new Date() })
      },
      currentDocument: { exists: false }
    },
    {
      update: {
        name: docName(`ambassadors/${index.ambassadorUid}/restaurants/${rid}`),
        fields: encFields({ restaurantId, statut: 'resilie', resilieAt: cancelledAt, updatedAt: new Date() })
      },
      updateMask: { fieldPaths: ['restaurantId', 'statut', 'resilieAt', 'updatedAt'] }
    }
  ];
  try { await fs.commit(writes); } catch (e) { if (isDuplicate(e)) return { duplicate: true }; throw e; }
  return { ok: true };
}

async function webhook(request, env, fs) {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!secretOk(request, env)) return json({ error: 'unauthorized' }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  if (!body || typeof body !== 'object') return json({ error: 'invalid_body' }, 400);
  let result;
  switch (String(body.type || '')) {
    case 'restaurant.registered': result = await handleRestaurantRegistered(fs, body); break;
    case 'payment.confirmed': result = await handlePaymentConfirmed(fs, body); break;
    case 'payment.refunded': result = await handlePaymentCancelled(fs, body, 'rembourse'); break;
    case 'payment.failed': result = await handlePaymentCancelled(fs, body, 'impaye'); break;
    case 'restaurant.cancelled': result = await handleRestaurantCancelled(fs, body); break;
    default: return json({ error: 'unknown_type' }, 400);
  }
  return json({ ok: true, ...result });
}

/* ───────── /admin : actions réservées (jeton ID Firebase) ───────── */
let CERTS_CACHE = { certs: null, expires: 0 };

function tlv(buf, offset) {
  const tag = buf[offset];
  let i = offset + 1;
  let len = buf[i++];
  if (len & 0x80) {
    const n = len & 0x7f;
    len = 0;
    for (let k = 0; k < n; k++) len = len * 256 + buf[i++];
  }
  return { tag, headerLen: i - offset, total: (i - offset) + len };
}
/* Extrait SubjectPublicKeyInfo d'un certificat X.509 (pour crypto.subtle). */
function pemToSpki(pem) {
  const der = pemToDer(pem);
  const cert = tlv(der, 0);
  let p = cert.headerLen;
  const tbs = tlv(der, p);
  p += tbs.headerLen;
  if (der[p] === 0xA0) p += tlv(der, p).total;
  for (let i = 0; i < 5; i++) p += tlv(der, p).total;
  return der.slice(p, p + tlv(der, p).total);
}

async function verifyIdTokenClaims(token) {
  const bad = () => httpErr(401, 'unauthenticated', 'Session expirée. Reconnectez-vous.');
  if (!token) throw bad();
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) throw bad();
  let header, claims;
  try {
    header = JSON.parse(new TextDecoder().decode(fromB64url(h)));
    claims = JSON.parse(new TextDecoder().decode(fromB64url(p)));
  } catch { throw bad(); }
  if (header.alg !== 'RS256' || !header.kid) throw bad();
  if (!CERTS_CACHE.certs || Date.now() > CERTS_CACHE.expires) {
    const res = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
    const certs = await res.json();
    const m = (res.headers.get('Cache-Control') || '').match(/max-age=(\d+)/);
    CERTS_CACHE = { certs, expires: Date.now() + (m ? Number(m[1]) : 3600) * 1000 };
  }
  const pem = CERTS_CACHE.certs[header.kid];
  if (!pem) throw bad();
  const key = await crypto.subtle.importKey('spki', pemToSpki(pem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, fromB64url(s), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) throw bad();
  const now = Math.floor(Date.now() / 1000);
  if (claims.aud !== PROJECT || claims.iss !== `https://securetoken.google.com/${PROJECT}` || !claims.sub || claims.exp <= now) throw bad();
  return claims;
}
const verifyIdToken = async (token) => (await verifyIdTokenClaims(token)).sub;

async function markPaid(fs, body) {
  const ambassadorUid = str(body.ambassadorUid);
  const period = str(body.period);
  if (!ambassadorUid || !/^\d{4}-\d{2}$/.test(period)) throw httpErr(400, 'invalid-argument', 'ambassadorUid et period (AAAA-MM) sont requis.');
  const docs = await fs.query('commissions', { parent: `ambassadors/${ambassadorUid}` });
  const now = Date.now();
  const eligible = docs.filter((d) => {
    const c = decFields(d.fields);
    const due = c.payableAt ? new Date(c.payableAt).getTime() : 0;
    return (c.statut === 'pending' || c.statut === 'payable') && Number(c.montant) > 0 && due <= now && c.period === period;
  });
  if (!eligible.length) throw httpErr(400, 'failed-precondition', 'Aucune commission payable sur cette période.');
  const total = eligible.reduce((s, d) => s + Number(decFields(d.fields).montant || 0), 0);
  const payoutId = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  const paidDate = body.date ? new Date(body.date) : new Date();
  const writes = [{
    update: {
      name: docName(`ambassadors/${ambassadorUid}/payouts/${payoutId}`),
      fields: encFields({
        montant: total,
        period,
        note: str(body.note).slice(0, 120) || `Récapitulatif ${period}`,
        date: Number.isNaN(paidDate.getTime()) ? new Date() : paidDate,
        commissionIds: eligible.map((d) => docId(d.name)),
        createdAt: new Date()
      })
    }
  }];
  for (const d of eligible) {
    writes.push({
      update: { name: d.name, fields: encFields({ statut: 'paid', paidAt: new Date(), payoutId, updatedAt: new Date() }) },
      updateMask: { fieldPaths: ['statut', 'paidAt', 'payoutId', 'updatedAt'] }
    });
  }
  await fs.commit(writes);
  return { ok: true, payoutId, montant: total, count: eligible.length };
}

async function correctAttribution(fs, body) {
  const restaurantId = str(body.restaurantId);
  const code = str(body.ambassadorCode).toUpperCase();
  if (!restaurantId || !code) throw httpErr(400, 'invalid-argument', 'restaurantId et ambassadorCode sont requis.');
  const ambassador = await findByCode(fs, code);
  if (!ambassador) throw httpErr(404, 'not-found', 'Code ambassadeur inconnu ou non validé.');
  const rid = safeId(restaurantId);
  const index = await fs.data(`restaurantIndex/${rid}`);
  if (!index) throw httpErr(404, 'not-found', 'Restaurant inconnu.');
  const oldUid = index.ambassadorUid;
  if (oldUid === ambassador.id) return { ok: true, unchanged: true };
  const old = await fs.getDoc(`ambassadors/${oldUid}/restaurants/${rid}`);
  if (!old) throw httpErr(404, 'not-found', 'Fiche restaurant introuvable.');
  const [payments, commissions] = await Promise.all([
    fs.query('payments', { where: eq('restaurantId', restaurantId), parent: `ambassadors/${oldUid}` }),
    fs.query('commissions', { where: eq('restaurantId', restaurantId), parent: `ambassadors/${oldUid}` })
  ]);
  const movedFields = {
    ...old.fields,
    ambassadeurUid: enc(ambassador.id),
    ambassadeurCode: enc(ambassador.code),
    ambassadeurNom: enc(ambassador.nom),
    updatedAt: enc(new Date())
  };
  const writes = [
    { update: { name: docName(`ambassadors/${ambassador.id}/restaurants/${rid}`), fields: movedFields } },
    { delete: old.name },
    { update: { name: docName(`restaurantIndex/${rid}`), fields: encFields({ restaurantId, ambassadorUid: ambassador.id, ambassadorCode: ambassador.code, nom: index.nom || '' }) } }
  ];
  for (const d of payments) {
    writes.push(
      { update: { name: docName(`ambassadors/${ambassador.id}/payments/${docId(d.name)}`), fields: d.fields } },
      { delete: d.name },
      { update: { name: docName(`paymentIndex/${docId(d.name)}`), fields: encFields({ paymentId: decFields(d.fields).paymentId, restaurantId, ambassadorUid: ambassador.id }) } }
    );
  }
  for (const d of commissions) {
    writes.push(
      { update: { name: docName(`ambassadors/${ambassador.id}/commissions/${docId(d.name)}`), fields: d.fields } },
      { delete: d.name }
    );
  }
  await fs.commit(writes);
  return { ok: true, moved: payments.length + commissions.length };
}

/* ───────── Journal des e-mails ───────── */
const EMAIL_LOG_LIMIT = 500;

/* Envoie un e-mail et note le résultat dans emailLog. On n'enregistre ni le
   contenu ni les liens (ils donnent accès au compte). Une panne du journal ne
   doit jamais bloquer ni faire échouer un envoi. */
async function sendLogged(fs, env, { type, to, uid = '' }, mail) {
  const record = (status, extra) => fs.commit([{
    update: { name: docName(`emailLog/${crypto.randomUUID()}`), fields: encFields({ sentAt: new Date(), type, to: to.toLowerCase(), uid, subject: mail.subject, status, ...extra }) },
    currentDocument: { exists: false }
  }]).catch((e) => console.error('[emailLog]', e.message));
  let result;
  try {
    result = await sendMail(env, { to, ...mail });
  } catch (e) {
    await record('failed', { error: String(e.message).slice(0, 300) });
    throw e;
  }
  await record('sent', { resendId: str(result?.id) });
  return result;
}

/* Les envois les plus récents, pour la page admin. */
async function listEmails(fs) {
  const docs = await fs.query('emailLog', { orderBy: [{ field: { fieldPath: 'sentAt' }, direction: 'DESCENDING' }], limit: EMAIL_LOG_LIMIT });
  return { ok: true, emails: docs.map((d) => decFields(d.fields)), limit: EMAIL_LOG_LIMIT };
}

/* E-mail de décision (validée / refusée), une seule fois par statut et par compte. */
async function notifyDecision(fs, env, body, origin) {
  const uid = str(body.ambassadorUid);
  if (!uid) throw httpErr(400, 'invalid-argument', 'ambassadorUid est requis.');
  const a = await fs.data(`ambassadors/${uid}`);
  if (!a) throw httpErr(404, 'not-found', 'Ambassadeur introuvable.');
  if (!str(a.email)) throw httpErr(400, 'invalid-argument', "Pas d'adresse e-mail sur cette fiche.");
  let mail;
  if (a.status === 'approved' && a.code) {
    const s = await getSettings(fs);
    mail = decisionApproved({
      nom: a.nom, code: a.code, link: `${origin}/go?a=${encodeURIComponent(a.code)}`,
      firstPct: s.firstPct, recurringPct: s.recurringPct, paymentDay: s.paymentDay
    });
  } else if (a.status === 'rejected') {
    mail = decisionRejected({ nom: a.nom });
  } else {
    return { ok: true, skipped: true };
  }
  const log = docName(`decisionLog/${uid}_${a.status}`);
  try {
    await fs.commit([{ update: { name: log, fields: encFields({ sentAt: new Date(), to: a.email, status: a.status }) }, currentDocument: { exists: false } }]);
  } catch (e) {
    if (isDuplicate(e)) return { ok: true, already: true };
    throw e;
  }
  try {
    await sendLogged(fs, env, { type: a.status, to: a.email, uid }, mail);
  } catch (e) {
    console.error('[notifyDecision]', e.message);
    await fs.commit([{ delete: log }]).catch(() => {});
    throw httpErr(502, 'unavailable', "L'e-mail n'a pas pu être envoyé.");
  }
  return { ok: true, sent: true };
}

/* ───────── Suppression de compte ───────── */
const SUBCOLLECTIONS = ['restaurants', 'payments', 'commissions', 'payouts', 'clients'];

/* Commissions pas encore versées (en attente ou payables, non annulées). */
async function unpaidTotal(fs, uid) {
  const docs = await fs.query('commissions', { parent: `ambassadors/${uid}` });
  return docs.map((d) => decFields(d.fields))
    .filter((c) => (c.statut === 'pending' || c.statut === 'payable') && Number(c.montant) > 0)
    .reduce((t, c) => t + Number(c.montant), 0);
}

/* Efface la fiche, ses sous-collections, les index d'attribution (les
   prochains événements Epicure de ses restaurants seront ignorés), les journaux
   d'e-mails, puis le compte de connexion. */
async function purgeAccount(fs, uid) {
  const rest = [];
  /* Journal des e-mails : par compte, et par adresse (les demandes publiques de
     mot de passe ne portent pas d'uid). */
  const email = str((await fs.data(`ambassadors/${uid}`))?.email).toLowerCase();
  const logs = await fs.query('emailLog', { where: eq('uid', uid) });
  if (email) logs.push(...await fs.query('emailLog', { where: eq('to', email) }));
  rest.push(...new Set(logs.map((d) => d.name)));
  for (const sub of SUBCOLLECTIONS) {
    (await fs.query(sub, { parent: `ambassadors/${uid}` })).forEach((d) => rest.push(d.name));
  }
  for (const idx of ['restaurantIndex', 'paymentIndex']) {
    (await fs.query(idx, { where: eq('ambassadorUid', uid) })).forEach((d) => rest.push(d.name));
  }
  rest.push(docName(`mailLog/${uid}`), docName(`alertLog/${uid}`), docName(`reminderLog/${uid}`), docName(`verifyLog/${uid}`),
    docName(`decisionLog/${uid}_approved`), docName(`decisionLog/${uid}_rejected`));
  for (let i = 0; i < rest.length; i += 400) {
    await fs.commit(rest.slice(i, i + 400).map((name) => ({ delete: name })));
  }
  /* Fiche en dernier : si une étape échoue, la suppression peut être relancée. */
  await fs.commit([{ delete: docName(`ambassadors/${uid}`) }]);
  await fs.deleteAuthUser(uid);
  return { ok: true, deleted: rest.length + 1 };
}

/* Un compte administrateur ne se supprime pas par ce biais. */
async function assertNotAdmin(fs, uid) {
  if (await fs.getDoc(`admins/${uid}`)) throw httpErr(403, 'permission-denied', 'Un compte administrateur ne peut pas être supprimé ici.');
}

async function adminDeleteAccount(fs, body, adminUid) {
  const uid = str(body.ambassadorUid);
  if (!uid) throw httpErr(400, 'invalid-argument', 'ambassadorUid est requis.');
  if (uid === adminUid) throw httpErr(403, 'permission-denied', 'Vous ne pouvez pas supprimer votre propre compte administrateur.');
  await assertNotAdmin(fs, uid);
  const unpaid = await unpaidTotal(fs, uid);
  if (unpaid > 0 && body.force !== true) {
    throw Object.assign(httpErr(409, 'failed-precondition', `Cet ambassadeur a ${Math.round(unpaid).toLocaleString('fr-FR')} FCFA de commissions non versées.`), { unpaid });
  }
  return purgeAccount(fs, uid);
}

/* Lien de nouveau mot de passe envoyé par l'administration à l'ambassadeur. */
async function adminSendReset(fs, env, body) {
  const uid = str(body.ambassadorUid);
  if (!uid) throw httpErr(400, 'invalid-argument', 'ambassadorUid est requis.');
  const a = await fs.data(`ambassadors/${uid}`);
  if (!a || !str(a.email)) throw httpErr(404, 'not-found', "Aucune adresse e-mail sur cette fiche.");
  const email = str(a.email).toLowerCase();
  await throttle(fs, `resetLog/${await sha256Hex(email)}`, 'lastAt');
  const link = await fs.oobLink('PASSWORD_RESET', email);
  if (!link) throw httpErr(404, 'not-found', 'Aucun compte de connexion pour cette adresse.');
  await sendLogged(fs, env, { type: 'reset', to: email, uid }, passwordReset({ link }));
  return { ok: true, to: email };
}

/* L'ambassadeur supprime lui-même son compte : connexion de moins de 5 minutes exigée. */
async function deleteAccountRoute(request, fs) {
  const cors = corsFor(request);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);
  const claims = await verifyIdTokenClaims((request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''));
  if (Math.floor(Date.now() / 1000) - (Number(claims.auth_time) || 0) > 300) {
    throw httpErr(401, 'unauthenticated', 'Confirmez votre mot de passe pour supprimer le compte.');
  }
  let body = {};
  try { body = await request.json(); } catch { /* corps facultatif */ }
  await assertNotAdmin(fs, claims.sub);
  const unpaid = await unpaidTotal(fs, claims.sub);
  if (unpaid > 0 && body.force !== true) {
    return json({ error: 'Des commissions ne vous ont pas encore été versées.', code: 'failed-precondition', unpaid }, 409, cors);
  }
  return json(await purgeAccount(fs, claims.sub), 200, cors);
}

async function admin(request, env, fs) {
  const origin = request.headers.get('Origin') || '';
  const cors = ALLOWED_ORIGINS.includes(origin)
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400' }
    : {};
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);
  const uid = await verifyIdToken((request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''));
  const me = await fs.getDoc(`admins/${uid}`);
  if (!me) throw httpErr(403, 'permission-denied', 'Réservé aux administrateurs.');
  let body;
  try { body = await request.json(); } catch { throw httpErr(400, 'invalid-argument', 'Corps JSON invalide.'); }
  if (body.action === 'markPaid') return json(await markPaid(fs, body), 200, cors);
  if (body.action === 'correctAttribution') return json(await correctAttribution(fs, body), 200, cors);
  if (body.action === 'deleteAccount') {
    try { return json(await adminDeleteAccount(fs, body, uid), 200, cors); }
    catch (e) { if (e.unpaid) return json({ error: e.message, code: e.code, unpaid: e.unpaid }, e.status, cors); throw e; }
  }
  if (body.action === 'sendReset') return json(await adminSendReset(fs, env, body), 200, cors);
  if (body.action === 'listEmails') return json(await listEmails(fs), 200, cors);
  if (body.action === 'notifyDecision') return json(await notifyDecision(fs, env, body, new URL(request.url).origin), 200, cors);
  return json({ error: 'unknown_action' }, 400, cors);
}

/* Alerte à l'équipe pour une nouvelle candidature, une seule fois par compte.
   Renvoie false en cas d'échec, pour que le navigateur puisse réessayer. */
async function alertApplication(fs, env, uid, a, email) {
  const log = docName(`alertLog/${uid}`);
  try {
    await fs.commit([{ update: { name: log, fields: encFields({ sentAt: new Date() }) }, currentDocument: { exists: false } }]);
  } catch (e) {
    if (isDuplicate(e)) return true;
    console.error('[alerte candidature]', e.message);
    return false;
  }
  const list = (v) => (Array.isArray(v) ? v.join(', ') : '');
  const later = list(a.produitsFuturs);
  const mail = teamAlert({
    subject: oneLine(`[Ambassadeur UNUSUALL] Nouvelle candidature : ${str(a.nom)}`),
    title: 'Nouvelle candidature',
    pill: 'À traiter sous 72 h',
    rows: [
      ['Nom', a.nom], ['WhatsApp', a.whatsapp], ['E-mail', email],
      ['Ville · quartier', [a.ville, a.quartier].filter(Boolean).join(' · ')],
      ['Profession', a.profession], ['Réseau', list(a.reseau)],
      ['Produits', [list(a.produits), later && `à l’ouverture : ${later}`].filter(Boolean).join(' ; ')],
      ['Profil', a.profilLien], ['Photo', a.photo], ['Motivation', a.motivation]
    ],
    link: `${SITE_ORIGIN}/admin.html`,
    linkLabel: 'Ouvrir l’administration'
  });
  try {
    await sendLogged(fs, env, { type: 'alert', to: env.TEAM_EMAIL || TEAM_EMAIL, uid }, { ...mail, replyTo: email });
    return true;
  } catch (e) {
    console.error('[alerte candidature]', e.message);
    await fs.commit([{ delete: log }]).catch(() => {});
    return false;
  }
}

/* Accusé de réception envoyé au candidat, une seule fois par compte :
   mailLog/{uid} est créé avant l'envoi (création conditionnelle = pas de doublon). */
async function applyAck(request, env, fs) {
  const origin = request.headers.get('Origin') || '';
  const cors = ALLOWED_ORIGINS.includes(origin)
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400' }
    : {};
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);
  const claims = await verifyIdTokenClaims((request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''));
  if (!claims.email || claims.email_verified !== true) throw httpErr(403, 'permission-denied', 'Adresse e-mail non confirmée.');
  const a = await fs.data(`ambassadors/${claims.sub}`);
  if (!a) throw httpErr(404, 'not-found', 'Aucune candidature pour ce compte.');
  if (a.status !== 'pending') return json({ ok: true, skipped: true }, 200, cors);
  const alerted = await alertApplication(fs, env, claims.sub, a, claims.email);
  const done = (extra) => (alerted
    ? json({ ok: true, ...extra }, 200, cors)
    : json({ error: "L'alerte à l'équipe n'a pas pu être envoyée.", code: 'alert-failed' }, 502, cors));
  const log = docName(`mailLog/${claims.sub}`);
  try {
    await fs.commit([{ update: { name: log, fields: encFields({ applicationAckAt: new Date(), to: claims.email }) }, currentDocument: { exists: false } }]);
  } catch (e) {
    if (isDuplicate(e)) return done({ already: true });
    throw e;
  }
  try {
    await sendLogged(fs, env, { type: 'ack', to: claims.email, uid: claims.sub }, applicationAck({ nom: a.nom, ville: a.ville }));
  } catch (e) {
    console.error('[apply-ack]', e.message);
    await fs.commit([{ delete: log }]).catch(() => {});
    throw httpErr(502, 'mail-failed', "L'e-mail de confirmation n'a pas pu être envoyé.");
  }
  return done({});
}

/* Anti-abus : un envoi par minute et par clé (compte ou adresse). */
async function throttle(fs, path, field, seconds = 60) {
  const prev = await fs.data(path);
  const last = prev && prev[field] ? new Date(prev[field]).getTime() : 0;
  if (Date.now() - last < seconds * 1000) throw httpErr(429, 'too-many-requests', "Trop d'envois rapprochés. Patientez une minute avant de redemander l'e-mail.");
  await fs.commit([{ update: { name: docName(path), fields: encFields({ [field]: new Date() }) }, updateMask: { fieldPaths: [field] } }]);
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* Confirmation d'adresse : remplace l'e-mail Firebase par le nôtre. */
async function verifyEmailRoute(request, env, fs) {
  const cors = corsFor(request);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);
  const claims = await verifyIdTokenClaims((request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''));
  if (!claims.email) throw httpErr(400, 'invalid-argument', 'Aucune adresse e-mail sur ce compte.');
  if (claims.email_verified === true) return json({ ok: true, alreadyVerified: true }, 200, cors);
  await throttle(fs, `verifyLog/${claims.sub}`, 'lastAt');
  const link = await fs.oobLink('VERIFY_EMAIL', claims.email);
  if (!link) throw httpErr(404, 'not-found', 'Compte introuvable.');
  await sendLogged(fs, env, { type: 'verify', to: claims.email, uid: claims.sub }, verifyEmail({ nom: claims.name, link }));
  return json({ ok: true }, 200, cors);
}

/* Mot de passe oublié : même réponse que le compte existe ou non (pas de fuite). */
async function resetPasswordRoute(request, env, fs) {
  const cors = corsFor(request);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);
  let body;
  try { body = await request.json(); } catch { throw httpErr(400, 'invalid-argument', 'Corps JSON invalide.'); }
  const email = str(body.email).toLowerCase().slice(0, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw httpErr(400, 'invalid-argument', 'Adresse e-mail invalide.');
  await throttle(fs, `resetLog/${await sha256Hex(email)}`, 'lastAt');
  const link = await fs.oobLink('PASSWORD_RESET', email);
  if (link) await sendLogged(fs, env, { type: 'reset', to: email }, passwordReset({ link }));
  return json({ ok: true }, 200, cors);
}

/* ───────── /contact : formulaires de unusuall.online ───────── */
const CONTACT_SOURCES = {
  contact: { label: 'Contact', required: ['name', 'message'] },
  'studio-projet': { label: 'Studio sur mesure', required: ['name', 'message'] },
  'omi-beta': { label: 'Bêta OMI', required: ['name'] },
  'sofia-waitlist': { label: 'Liste d’attente SOFIA', required: [] }
};
/* Le quota d'envoi est partagé avec les e-mails de compte : on plafonne les messages publics. */
const CONTACT_DAILY_MAX = 30;
const CONTACT_MIN_MS = 2500;

/* Chaque message est enregistré (contactMessages) avant l'envoi de l'alerte.
   Aucun e-mail n'est envoyé à l'adresse saisie : un robot ne peut pas se servir
   du formulaire pour écrire à des tiers. */
async function contactRoute(request, env, fs) {
  const origin = request.headers.get('Origin') || '';
  const allowed = CONTACT_ORIGINS.includes(origin);
  const cors = allowed
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' }
    : {};
  const reply = (data, status = 200) => json(data, status, cors);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
  if (!allowed) return reply({ error: 'origin_not_allowed' }, 403);
  if (!(request.headers.get('Content-Type') || '').startsWith('application/json')) return reply({ error: 'json_required' }, 415);
  const raw = await request.text();
  if (raw.length > 12000) return reply({ error: 'too_large' }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return reply({ error: 'invalid_json' }, 400); }
  if (!body || typeof body !== 'object') return reply({ error: 'invalid_json' }, 400);
  /* Champ piège, invisible pour un visiteur : réponse normale, rien n'est envoyé. */
  if (str(body._gotcha)) return reply({ ok: true });
  if (!(Number(body.elapsed) >= CONTACT_MIN_MS)) return reply({ error: 'too_fast' }, 429);

  const source = str(body.source);
  if (!Object.hasOwn(CONTACT_SOURCES, source)) return reply({ error: 'invalid_source' }, 400);
  const kind = CONTACT_SOURCES[source];
  const data = {
    source,
    name: oneLine(str(body.name)).slice(0, 100),
    email: str(body.email).toLowerCase().slice(0, 200),
    sujet: oneLine(str(body.sujet)).slice(0, 80),
    message: str(body.message).slice(0, 4000)
  };
  if (!/^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]{2,}$/.test(data.email) || kind.required.some((k) => !data[k])) {
    return reply({ error: 'invalid_fields' }, 400);
  }

  const day = new Date().toISOString().slice(0, 10);
  const count = Number((await fs.data(`contactQuota/${day}`))?.count) || 0;
  if (count >= CONTACT_DAILY_MAX) return reply({ error: 'daily_limit' }, 429);
  const ip = request.headers.get('CF-Connecting-IP') || '';
  try {
    if (ip) await throttle(fs, `contactLog/${await sha256Hex(`ip:${ip}`)}`, 'lastAt', 30);
    await throttle(fs, `contactLog/${await sha256Hex(`${source}:${data.email}`)}`, 'lastAt', 60);
  } catch (e) {
    if (e.status === 429) return reply({ error: 'too_many_requests' }, 429);
    throw e;
  }

  await fs.commit([
    { update: { name: docName(`contactMessages/${crypto.randomUUID()}`), fields: encFields({ ...data, createdAt: new Date() }) }, currentDocument: { exists: false } },
    { update: { name: docName(`contactQuota/${day}`), fields: encFields({ count: count + 1 }) } }
  ]);
  const mail = teamAlert({
    subject: oneLine(`[UNUSUALL] ${kind.label} : ${data.name || data.email}`),
    title: `Nouveau message · ${kind.label}`,
    pill: 'Site unusuall.online',
    rows: [['Nom', data.name], ['E-mail', data.email], ['Sujet', data.sujet], ['Message', data.message]]
  });
  try {
    await sendLogged(fs, env, { type: 'contact', to: env.TEAM_EMAIL || TEAM_EMAIL }, { ...mail, replyTo: data.email });
  } catch (e) {
    console.error('[contact]', e.message);
    return reply({ error: 'mail_failed' }, 502);
  }
  return reply({ ok: true });
}

/* ───────── Relances : compte créé, candidature jamais envoyée ───────── */
const DAY_MS = 24 * 3600 * 1000;
const REMINDER_MARGIN_MS = DAY_MS / 4;
/* Au-delà, un compte jamais relancé est considéré comme abandonné. */
const REMINDER_MAX_AGE_DAYS = 30;
/* Le plan gratuit limite à 50 requêtes sortantes par exécution (environ 3 par envoi). */
const REMINDER_BATCH = 8;

/* Première relance 7 jours après l'inscription, seconde et dernière 14 jours
   après (au moins 7 jours après la première). Exclus : administrateurs, comptes
   désactivés, adresses de REMINDER_SKIP, toute personne ayant déjà postulé, et
   les comptes dont reminderLog/{uid} porte stop = true (demande d'arrêt). */
async function sendReminders(fs, env, now = Date.now()) {
  const [users, ambassadors, acks, admins, logs] = await Promise.all([
    fs.listAuthUsers(),
    fs.query('ambassadors'),
    fs.query('mailLog'),
    fs.query('admins'),
    fs.query('reminderLog')
  ]);
  const excluded = new Set([...ambassadors, ...acks, ...admins].map((d) => docId(d.name)));
  const sentBefore = new Map(logs.map((d) => [docId(d.name), d]));
  const skip = new Set(String(env.REMINDER_SKIP || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean));
  const elapsed = (since, days) => now - since >= days * DAY_MS - REMINDER_MARGIN_MS;

  let sent = 0;
  let attempts = 0;
  for (const u of users.sort((a, b) => Number(a.createdAt) - Number(b.createdAt))) {
    if (attempts >= REMINDER_BATCH) break;
    const uid = u.localId;
    const email = str(u.email).toLowerCase();
    const created = Number(u.createdAt);
    if (!email || !created || u.disabled || excluded.has(uid) || skip.has(email)) continue;
    const doc = sentBefore.get(uid);
    const prev = doc ? decFields(doc.fields) : {};
    const count = Number(prev.count) || 0;
    if (prev.stop === true || count >= 2) continue;
    if (count === 0 && (!elapsed(created, 7) || now - created > REMINDER_MAX_AGE_DAYS * DAY_MS)) continue;
    if (count === 1 && (!elapsed(created, 14) || !elapsed(new Date(prev.lastAt).getTime(), 7))) continue;

    attempts += 1;
    const name = docName(`reminderLog/${uid}`);
    try {
      /* Réservation avant l'envoi : deux exécutions ne peuvent pas doubler un e-mail. */
      const claim = await fs.commit([{
        update: { name, fields: encFields({ count: count + 1, lastAt: new Date(now), to: email }) },
        updateMask: { fieldPaths: ['count', 'lastAt', 'to'] },
        currentDocument: doc ? { updateTime: doc.updateTime } : { exists: false }
      }]);
      try {
        await sendLogged(fs, env, { type: 'reminder', to: email, uid }, { ...applicationReminder({ nom: u.displayName, last: count === 1 }), replyTo: env.TEAM_EMAIL || TEAM_EMAIL });
        sent += 1;
      } catch (e) {
        /* Envoi raté : on annule la réservation pour réessayer au prochain passage. */
        await fs.commit([doc
          ? { update: { name, fields: doc.fields }, currentDocument: { updateTime: claim.writeResults?.[0]?.updateTime } }
          : { delete: name }]);
        throw e;
      }
    } catch (e) {
      console.error('[relance]', e.message);
    }
  }
  console.log(`[relance] ${sent} envoyée(s)`);
  return sent;
}

/* ───────── Point d'entrée ───────── */
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendReminders(new Firestore(env), env));
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors = CORS_PATHS.includes(url.pathname) && ALLOWED_ORIGINS.includes(origin)
      ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
      : {};
    try {
      const fs = new Firestore(env);
      if (url.pathname === '/go') return await go(url, fs, request);
      if (url.pathname === '/qr') return qr(url);
      if (url.pathname === '/search') return await search(url, fs);
      if (url.pathname === '/directory') return await directory(url, fs);
      if (url.pathname === '/webhook') return await webhook(request, env, fs);
      if (url.pathname === '/admin') return await admin(request, env, fs);
      if (url.pathname === '/apply-ack') return await applyAck(request, env, fs);
      if (url.pathname === '/verify-email') return await verifyEmailRoute(request, env, fs);
      if (url.pathname === '/reset-password') return await resetPasswordRoute(request, env, fs);
      if (url.pathname === '/delete-account') return await deleteAccountRoute(request, fs);
      if (url.pathname === '/contact') return await contactRoute(request, env, fs);
      if (url.pathname === '/') return json({ ok: true, service: 'unusuall-ambassadeurs' });
      return json({ error: 'not_found' }, 404);
    } catch (err) {
      return json({ error: err.message || 'internal', code: err.code || 'internal' }, err.status || 500, cors);
    }
  }
};