/* UNUSUALL Ambassadeurs — e-mails envoyés aux candidats.
   applicationAck : accusé de réception de candidature (envoyé une seule fois,
   juste après l'enregistrement de la candidature). */

const SITE = 'https://ambassadeurs.unusuall.online';
const LOGO = `${SITE}/assets/img/icon-192-mark.png`;

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const firstName = (nom) => String(nom || '').trim().split(/\s+/)[0] || '';

export function applicationAck({ nom, ville } = {}) {
  const prenom = firstName(nom);
  const hello = prenom ? `Bonjour ${prenom},` : 'Bonjour,';
  const city = String(ville || '').trim();
  const share = `Je viens de postuler au programme Ambassadeurs UNUSUALL : on fait connaître leurs solutions et on est payé chaque mois. C'est gratuit, ouvert dans toutes les villes. Regarde : ${SITE}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(share)}`;
  const subject = 'Votre candidature Ambassadeur UNUSUALL est bien reçue';

  const text = [
    hello,
    '',
    'Merci pour votre candidature au programme Ambassadeurs UNUSUALL. Elle est bien arrivée chez nous.',
    '',
    'Notre équipe l\'étudie et vous répond sous 72 heures, par e-mail ou sur WhatsApp. Dès qu\'elle est validée, votre lien personnel, votre QR code et votre tableau de bord apparaîtront dans votre espace.',
    '',
    `Un coup de pouce en attendant ? Nous voulons des ambassadeurs dans un maximum de villes et de régions${city ? `, pas seulement à ${city}` : ''}. Si vous connaissez quelqu'un ailleurs qui aimerait rejoindre l'aventure, envoyez-lui ce lien :`,
    SITE,
    '',
    `Partager sur WhatsApp : ${whatsapp}`,
    '',
    'À très vite,',
    'L\'équipe UNUSUALL',
    '',
    `Suivre votre candidature : ${SITE}/espace.html`,
    'Une question ? Répondez simplement à cet e-mail ou écrivez à services@unusuall.online.'
  ].join('\n');

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4faf6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Réponse sous 72 heures. En attendant, aidez-nous à trouver des ambassadeurs dans d'autres villes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4faf6;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#0d2818;">

      <tr><td style="padding:0 4px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;"><img src="${LOGO}" width="36" height="36" alt="" style="display:block;border:0;"></td>
          <td style="vertical-align:middle;padding-left:10px;font-size:16px;font-weight:700;letter-spacing:3px;color:#0d2818;">UNUSUALL</td>
        </tr></table>
      </td></tr>

      <tr><td style="background:#ffffff;border:1px solid #c5ddd0;border-radius:20px;padding:36px 32px;">
        <p style="margin:0 0 14px;display:inline-block;padding:6px 12px;border-radius:999px;background:#fef3dc;color:#8a5a00;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Candidature reçue</p>
        <h1 style="margin:6px 0 18px;font-size:28px;line-height:1.2;font-weight:800;letter-spacing:-0.5px;color:#0d2818;">Merci, c'est bien noté&nbsp;!</h1>
        <p style="margin:0 0 14px;font-size:16px;line-height:1.6;">${esc(hello)}</p>
        <p style="margin:0 0 14px;font-size:16px;line-height:1.6;">Votre candidature au programme <b>Ambassadeurs UNUSUALL</b> est bien arrivée chez nous.</p>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.6;">Notre équipe l'étudie et vous répond <b>sous 72&nbsp;heures</b>, par e-mail ou sur WhatsApp. Dès qu'elle est validée, votre lien personnel, votre QR code et votre tableau de bord apparaîtront dans votre espace.</p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eaf5ee;border-radius:16px;">
          <tr><td style="padding:24px 22px;">
            <p style="margin:0 0 8px;font-size:17px;font-weight:800;color:#1a472a;">Un coup de pouce en attendant&nbsp;?</p>
            <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#3d5a47;">Nous voulons des ambassadeurs dans un maximum de villes et de régions${city ? `, pas seulement à ${esc(city)}` : ''}. Si vous connaissez quelqu'un ailleurs qui aimerait rejoindre l'aventure, envoyez-lui le lien.</p>
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td style="border-radius:999px;background:#1a472a;">
                <a href="${whatsapp}" style="display:inline-block;padding:13px 22px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">Partager sur WhatsApp</a>
              </td>
            </tr></table>
            <p style="margin:14px 0 0;font-size:14px;color:#3d5a47;">Ou copiez le lien&nbsp;: <a href="${SITE}" style="color:#1a472a;font-weight:700;">ambassadeurs.unusuall.online</a></p>
          </td></tr>
        </table>

        <p style="margin:26px 0 0;font-size:16px;line-height:1.6;">À très vite,<br><b>L'équipe UNUSUALL</b></p>
      </td></tr>

      <tr><td style="padding:20px 8px 0;font-size:13px;line-height:1.6;color:#5a7260;text-align:center;">
        <a href="${SITE}/espace.html" style="color:#1a472a;font-weight:600;">Suivre ma candidature</a>
        &nbsp;·&nbsp; Une question&nbsp;? Répondez à cet e-mail ou écrivez à
        <a href="mailto:services@unusuall.online" style="color:#1a472a;">services@unusuall.online</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  return { subject, html, text };
}

/* Envoi via l'API Resend (https://resend.com). Secret RESEND_API_KEY,
   expéditeur MAIL_FROM (domaine vérifié chez Resend). */
export async function sendMail(env, { to, subject, html, text }) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY manquant');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'UNUSUALL Ambassadeurs <ambassadeurs@unusuall.online>',
      to: [to],
      reply_to: 'services@unusuall.online',
      subject,
      html,
      text
    })
  });
  if (!res.ok) throw new Error(`Resend ${res.status} : ${await res.text()}`);
  return res.json();
}
