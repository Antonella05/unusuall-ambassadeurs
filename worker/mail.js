/* UNUSUALL Ambassadeurs — e-mails envoyés aux candidats, tous sur la même mise en page.
   verifyEmail   : confirmation de l'adresse e-mail (à la création du compte) ;
   passwordReset : choix d'un nouveau mot de passe ;
   applicationAck : accusé de réception de candidature ;
   decisionApproved / decisionRejected : réponse à la candidature. */

const SITE = 'https://ambassadeurs.unusuall.online';
const WHATSAPP_GROUP = 'https://chat.whatsapp.com/Iq3EsQlbvzS7yzqseZZ13F';
const LOGO = `${SITE}/assets/img/icon-192-mark.png`;

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const firstName = (nom) => String(nom || '').trim().split(/\s+/)[0] || '';
const helloFor = (nom) => (firstName(nom) ? `Bonjour ${firstName(nom)},` : 'Bonjour,');

const P = 'margin:0 0 14px;font-size:16px;line-height:1.6;';
const button = (href, label) => `
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;"><tr>
          <td style="border-radius:999px;background:#1a472a;">
            <a href="${esc(href)}" style="display:inline-block;padding:14px 26px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">${esc(label)}</a>
          </td>
        </tr></table>`;
const fallbackLink = (href) => `
        <p style="margin:0 0 14px;font-size:13px;line-height:1.6;color:#5a7260;">Le bouton ne fonctionne pas&nbsp;? Copiez ce lien dans votre navigateur&nbsp;:<br>
          <a href="${esc(href)}" style="color:#1a472a;word-break:break-all;">${esc(href)}</a></p>`;

/* Cadre commun : logo, carte blanche, pied de page. */
function layout({ subject, preheader, pill, title, body, signoff = 'À très vite,' }) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4faf6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
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
        <p style="margin:0 0 14px;display:inline-block;padding:6px 12px;border-radius:999px;background:#fef3dc;color:#8a5a00;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">${esc(pill)}</p>
        <h1 style="margin:6px 0 18px;font-size:28px;line-height:1.2;font-weight:800;letter-spacing:-0.5px;color:#0d2818;">${title}</h1>
${body}
        <p style="margin:26px 0 0;font-size:16px;line-height:1.6;">${esc(signoff)}<br><b>L'équipe UNUSUALL</b></p>
      </td></tr>

      <tr><td style="padding:20px 8px 0;font-size:13px;line-height:1.6;color:#5a7260;text-align:center;">
        <a href="${SITE}" style="color:#1a472a;font-weight:600;">ambassadeurs.unusuall.online</a>
        &nbsp;·&nbsp; Une question&nbsp;? Répondez à cet e-mail ou écrivez à
        <a href="mailto:services@unusuall.online" style="color:#1a472a;">services@unusuall.online</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

const SIGNATURE = ['', 'À très vite,', "L'équipe UNUSUALL", '', 'Une question ? Répondez à cet e-mail ou écrivez à services@unusuall.online.'];

export function verifyEmail({ nom, link }) {
  const subject = 'Confirmez votre adresse e-mail · Ambassadeurs UNUSUALL';
  const hello = helloFor(nom);
  const html = layout({
    subject,
    preheader: 'Un clic pour confirmer votre adresse, puis vous pourrez envoyer votre candidature.',
    pill: 'Étape 1 sur 2',
    title: 'Confirmez votre adresse e-mail',
    body: `
        <p style="${P}">${esc(hello)}</p>
        <p style="${P}">Merci d'avoir créé votre compte sur la plateforme <b>Ambassadeurs UNUSUALL</b>. Cliquez sur le bouton ci-dessous pour confirmer votre adresse. Vous pourrez ensuite remplir votre candidature.</p>
${button(link, 'Confirmer mon adresse')}
${fallbackLink(link)}
        <p style="margin:0;font-size:14px;line-height:1.6;color:#5a7260;">Vous n'avez pas créé de compte&nbsp;? Ignorez simplement cet e-mail.</p>`
  });
  const text = [hello, '', "Merci d'avoir créé votre compte sur la plateforme Ambassadeurs UNUSUALL. Ouvrez ce lien pour confirmer votre adresse, vous pourrez ensuite remplir votre candidature :", link, '', "Vous n'avez pas créé de compte ? Ignorez simplement cet e-mail.", ...SIGNATURE].join('\n');
  return { subject, html, text };
}

export function passwordReset({ link }) {
  const subject = 'Choisissez un nouveau mot de passe · Ambassadeurs UNUSUALL';
  const html = layout({
    subject,
    preheader: 'Le lien pour choisir un nouveau mot de passe est valable une heure.',
    pill: 'Mot de passe',
    title: 'Choisissez un nouveau mot de passe',
    body: `
        <p style="${P}">Bonjour,</p>
        <p style="${P}">Vous avez demandé à changer le mot de passe de votre compte <b>Ambassadeurs UNUSUALL</b>. Cliquez sur le bouton ci-dessous pour en choisir un nouveau. Le lien est valable une heure.</p>
${button(link, 'Choisir un nouveau mot de passe')}
${fallbackLink(link)}
        <p style="margin:0;font-size:14px;line-height:1.6;color:#5a7260;">Vous n'êtes pas à l'origine de cette demande&nbsp;? Ignorez cet e-mail : votre mot de passe actuel reste valable.</p>`
  });
  const text = ['Bonjour,', '', 'Vous avez demandé à changer le mot de passe de votre compte Ambassadeurs UNUSUALL. Ouvrez ce lien pour en choisir un nouveau (valable une heure) :', link, '', "Vous n'êtes pas à l'origine de cette demande ? Ignorez cet e-mail : votre mot de passe actuel reste valable.", ...SIGNATURE].join('\n');
  return { subject, html, text };
}

export function applicationAck({ nom, ville } = {}) {
  const hello = helloFor(nom);
  const city = String(ville || '').trim();
  const share = `Je viens de postuler au programme Ambassadeurs UNUSUALL : on fait connaître leurs solutions et on est payé chaque mois. C'est gratuit, ouvert dans toutes les villes. Regarde : ${SITE}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(share)}`;
  const subject = 'Votre candidature Ambassadeur UNUSUALL est bien reçue';
  const html = layout({
    subject,
    preheader: "Réponse sous 72 heures. En attendant, aidez-nous à trouver des ambassadeurs dans d'autres villes.",
    pill: 'Candidature reçue',
    title: "Merci, c'est bien noté&nbsp;!",
    body: `
        <p style="${P}">${esc(hello)}</p>
        <p style="${P}">Votre candidature au programme <b>Ambassadeurs UNUSUALL</b> est bien arrivée chez nous.</p>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.6;">Notre équipe l'étudie et vous répond <b>sous 72&nbsp;heures</b>, par e-mail ou sur WhatsApp. Dès qu'elle est validée, votre lien personnel, votre QR code et votre tableau de bord apparaîtront dans <a href="${SITE}/espace.html" style="color:#1a472a;font-weight:600;">votre espace</a>.</p>

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
        </table>`
  });
  const text = [
    hello, '',
    'Merci pour votre candidature au programme Ambassadeurs UNUSUALL. Elle est bien arrivée chez nous.', '',
    "Notre équipe l'étudie et vous répond sous 72 heures, par e-mail ou sur WhatsApp. Dès qu'elle est validée, votre lien personnel, votre QR code et votre tableau de bord apparaîtront dans votre espace :",
    `${SITE}/espace.html`, '',
    `Un coup de pouce en attendant ? Nous voulons des ambassadeurs dans un maximum de villes et de régions${city ? `, pas seulement à ${city}` : ''}. Si vous connaissez quelqu'un ailleurs qui aimerait rejoindre l'aventure, envoyez-lui ce lien :`,
    SITE, '',
    `Partager sur WhatsApp : ${whatsapp}`,
    ...SIGNATURE
  ].join('\n');
  return { subject, html, text };
}

export function decisionApproved({ nom, code, link, firstPct = 30, recurringPct = 10, paymentDay = 5 }) {
  const hello = helloFor(nom);
  const subject = 'Bienvenue parmi les Ambassadeurs UNUSUALL !';
  const step = (n, t) => `
          <tr>
            <td style="width:34px;vertical-align:top;padding:0 0 12px;"><span style="display:inline-block;width:26px;height:26px;line-height:26px;border-radius:50%;background:#1a472a;color:#ffffff;font-size:13px;font-weight:700;text-align:center;">${n}</span></td>
            <td style="vertical-align:top;padding:2px 0 12px;font-size:15px;line-height:1.55;color:#0d2818;">${t}</td>
          </tr>`;
  const html = layout({
    subject,
    preheader: `Votre candidature est validée. Votre code ambassadeur : ${code}.`,
    pill: 'Candidature validée',
    title: 'Bienvenue parmi les ambassadeurs&nbsp;!',
    body: `
        <p style="${P}">${esc(hello)}</p>
        <p style="${P}">Bonne nouvelle&nbsp;: votre candidature est validée. Vous êtes officiellement <b>Ambassadeur UNUSUALL</b>.</p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;background:#eaf5ee;border-radius:16px;">
          <tr><td style="padding:22px;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#3d5a47;">Votre code ambassadeur</p>
            <p style="margin:0 0 14px;font-size:28px;font-weight:800;letter-spacing:3px;color:#1a472a;font-family:Consolas,Menlo,monospace;">${esc(code)}</p>
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#3d5a47;">Votre lien personnel</p>
            <p style="margin:0;font-size:14px;word-break:break-all;"><a href="${esc(link)}" style="color:#1a472a;font-weight:600;">${esc(link)}</a></p>
          </td></tr>
        </table>

        <p style="margin:0 0 12px;font-size:17px;font-weight:800;color:#0d2818;">Comment ça marche</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${step(1, 'Partagez votre lien ou votre QR code aux restaurants autour de vous.')}
${step(2, 'Le restaurant s\'inscrit sur Epicure avec votre lien&nbsp;: il vous est attribué automatiquement.')}
${step(3, `Vous touchez <b>${firstPct}&nbsp;%</b> de son 1er mois payé, puis <b>${recurringPct}&nbsp;%</b> de chaque mois suivant, versés le ${paymentDay} de chaque mois sur Mobile Money.`)}
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:#fff8e6;border:1px solid #f0d98a;border-radius:16px;">
          <tr><td style="padding:18px 22px;">
            <p style="margin:0 0 6px;font-size:16px;font-weight:800;color:#0d2818;">Dernière étape&nbsp;: rejoignez le groupe WhatsApp</p>
            <p style="margin:0;font-size:15px;line-height:1.6;color:#0d2818;">Vous devez rejoindre le <b>groupe WhatsApp des ambassadeurs</b> pour recevoir les informations importantes et échanger avec l'équipe et les autres ambassadeurs&nbsp;: <a href="${WHATSAPP_GROUP}" style="color:#1a472a;font-weight:700;">rejoindre le groupe</a>.</p>
          </td></tr>
        </table>
${button(`${SITE}/espace.html`, 'Ouvrir mon espace')}
        <p style="margin:0;font-size:14px;line-height:1.6;color:#5a7260;">Votre QR code, vos restaurants et vos gains sont dans votre espace. Avant de commencer, prenez deux minutes pour relire <a href="${SITE}/reglement.html" style="color:#1a472a;font-weight:600;">les règles du programme</a>.</p>`
  });
  const text = [
    hello, '',
    'Bonne nouvelle : votre candidature est validée. Vous êtes officiellement Ambassadeur UNUSUALL.', '',
    `Votre code ambassadeur : ${code}`,
    `Votre lien personnel : ${link}`, '',
    'Comment ça marche :',
    '1. Partagez votre lien ou votre QR code aux restaurants autour de vous.',
    "2. Le restaurant s'inscrit sur Epicure avec votre lien : il vous est attribué automatiquement.",
    `3. Vous touchez ${firstPct} % de son 1er mois payé, puis ${recurringPct} % de chaque mois suivant, versés le ${paymentDay} de chaque mois sur Mobile Money.`, '',
    `Dernière étape : vous devez rejoindre le groupe WhatsApp des ambassadeurs : ${WHATSAPP_GROUP}`, '',
    `Votre espace (QR code, restaurants, gains) : ${SITE}/espace.html`,
    `Les règles du programme : ${SITE}/reglement.html`,
    ...SIGNATURE
  ].join('\n');
  return { subject, html, text };
}

export function decisionRejected({ nom }) {
  const hello = helloFor(nom);
  const subject = 'Votre candidature Ambassadeur UNUSUALL';
  const html = layout({
    subject,
    preheader: 'Merci pour votre candidature au programme Ambassadeurs UNUSUALL.',
    pill: 'Votre candidature',
    title: 'Merci pour votre candidature',
    signoff: 'Bien cordialement,',
    body: `
        <p style="${P}">${esc(hello)}</p>
        <p style="${P}">Merci de l'intérêt que vous portez au programme <b>Ambassadeurs UNUSUALL</b> et du temps que vous avez pris pour postuler.</p>
        <p style="${P}">Après étude, nous ne pouvons pas donner suite à votre candidature pour le moment. Cette décision ne remet pas en cause vos qualités&nbsp;: nous avons dû faire des choix selon les besoins actuels du programme.</p>
        <p style="margin:0;font-size:16px;line-height:1.6;">Si vous avez une question, répondez simplement à cet e-mail.</p>`
  });
  const text = [
    hello, '',
    "Merci de l'intérêt que vous portez au programme Ambassadeurs UNUSUALL et du temps que vous avez pris pour postuler.", '',
    'Après étude, nous ne pouvons pas donner suite à votre candidature pour le moment. Cette décision ne remet pas en cause vos qualités : nous avons dû faire des choix selon les besoins actuels du programme.', '',
    'Si vous avez une question, répondez simplement à cet e-mail.', '',
    'Bien cordialement,', "L'équipe UNUSUALL"
  ].join('\n');
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
