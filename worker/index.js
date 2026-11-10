/* UNUSUALL Ambassadeurs — Worker Cloudflare (plan gratuit, sans Blaze).
   Routes : /go (redirection + clic), /qr (SVG), /search (recherche publique),
            /webhook (événements Epicure, secret), /admin (actions admin, jeton Firebase).
   Les données restent dans Firestore ; ce Worker y accède via l'API REST avec un
   compte de service (secret SERVICE_ACCOUNT_JSON, jamais côté navigateur). */
import qrcode from 'qrcode-generator';

const PROJECT = 'unusuall-ambassadeurs';
const DOC_ROOT = `projects/${PROJECT}/databases/(default)/documents`;
const API_BASE = `https://firestore.googleapis.com/v1/${DOC_ROOT}`;
const ALLOWED_ORIGINS = ['https://ambassadeurs.unusuall.online', 'http://127.0.0.1:8123', 'http://localhost:8123'];

const DEFAULT_SETTINGS = {
  firstPct: 30, recurringPct: 10, offeredMonth: 2, maxMonths: 12,
  validationDays: 7, closingDay: 28, paymentDay: 5,
  epicureUrl: 'https://app.epicure.unusuall.online'
};

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const norm = (v) => String(v || '').toLowerCase().replace(/\s+/g, ' ').trim();
const digits = (v) => String(v || '').replace(/\D/g, '');
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
    this.token = null;
    this.expires = 0;
  }
  async accessToken() {
    if (this.token && Date.now() < this.expires - 60000) return this.token;
    const now = Math.floor(Date.now() / 1000);
    const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = b64url(JSON.stringify({
      iss: this.sa.client_email,
      scope: 'https://www.googleapis.com/auth/datastore',
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
    if (!res.ok) throw new Error('OAuth Firestore impossible : ' + JSON.stringify(data));
    this.token = data.access_token;
    this.expires = Date.now() + (Number(data.expires_in) || 3600) * 1000;
    return this.token;
  }
  async call(path, method = 'GET', body) {
    const token = await this.accessToken();
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 404) return null;
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
  async query(collectionId, { where, limit, parent = '' } = {}) {
    const structuredQuery = { from: [{ collectionId }], ...(where ? { where } : {}), ...(limit ? { limit } : {}) };
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
function commissionFor(amount, moisIndex, settings) {
  const month = Number(moisIndex);
  if (!Number.isInteger(month) || month < 1) return { montant: 0, taux: 0, type: 'invalid' };
  if (month === 1) return { montant: Math.round(amount * Number(settings.firstPct) / 100), taux: Number(settings.firstPct), type: 'first' };
  if (month === Number(settings.offeredMonth)) return { montant: 0, taux: 0, type: 'offered' };
  if (month <= Number(settings.maxMonths)) return { montant: Math.round(amount * Number(settings.recurringPct) / 100), taux: Number(settings.recurringPct), type: 'recurring' };
  return { montant: 0, taux: 0, type: 'expired' };
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
  const out = docs
    .map((d) => decFields(d.fields))
    .filter((a) => a.code && norm(a.nom).includes(q))
    .slice(0, 10)
    .map((a) => ({ name: a.nom, code: a.code }));
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
        fields: encFields({ statut: 'abonne', ...(str(body.formule) ? { formule: str(body.formule).slice(0, 40) } : {}), updatedAt: new Date() })
      },
      updateMask: { fieldPaths: ['statut', 'updatedAt', ...(str(body.formule) ? ['formule'] : [])] },
      currentDocument: { exists: true }
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

async function verifyIdToken(token) {
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
  return claims.sub;
}

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
  return json({ error: 'unknown_action' }, 400, cors);
}

/* ───────── Point d'entrée ───────── */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors = url.pathname === '/admin' && ALLOWED_ORIGINS.includes(origin)
      ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
      : {};
    try {
      const fs = new Firestore(env);
      if (url.pathname === '/go') return await go(url, fs, request);
      if (url.pathname === '/qr') return qr(url);
      if (url.pathname === '/search') return await search(url, fs);
      if (url.pathname === '/webhook') return await webhook(request, env, fs);
      if (url.pathname === '/admin') return await admin(request, env, fs);
      if (url.pathname === '/') return json({ ok: true, service: 'unusuall-ambassadeurs' });
      return json({ error: 'not_found' }, 404);
    } catch (err) {
      return json({ error: err.message || 'internal', code: err.code || 'internal' }, err.status || 500, cors);
    }
  }
};