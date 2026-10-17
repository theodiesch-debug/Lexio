/**
 * Die E-Mail-Vorlagen von Lexio.
 *
 * Dieses Modul liefert nur den Inhalt. Gesetzt werden die Vorlagen von
 * `scripts/mails-setzen.mjs`.
 *
 * Warum hier und nicht nur im Supabase-Dashboard
 * ----------------------------------------------
 * Die Vorlagen lagen zuerst ausschliesslich im Dashboard. Damit waren sie
 * unsichtbar: keine Versionsgeschichte, kein Diff, und niemand konnte
 * nachsehen, warum eine Farbe so und nicht anders ist. Hier stehen sie als
 * Text – im Stil der Web-App.
 *
 * Warum Tabellen und Inline-Styles
 * --------------------------------
 * Ein Mailprogramm ist kein Browser. Gmail und Outlook werfen <style>-Bloecke
 * und vieles von dem weg, was eine Seite modern aussehen laesst. Verlaesslich
 * ist nur, was direkt am Element steht: eine Tabelle fuer das Layout und ein
 * style-Attribut je Element. Deshalb sieht der Code altmodisch aus – er muss.
 *
 * Die Schrift "Lexio"
 * -------------------
 * In der App ist der Name "Caveat" (siehe app/anmelden/anmelden.module.css,
 * .markeName). Mailprogramme laden keine Web-Schriften. Deshalb liegt die
 * Wortmarke als Bild vor (public/images/lexio-schriftzug-*.png) und wird als
 * <img> eingebunden. Die beiden Dateien sind aus Caveat gerendert:
 *
 *   lexio-schriftzug-creme.png   fuer dunkle Flaechen (Maroon-Band)
 *   lexio-schriftzug-tinte.png   fuer helle Flaechen (Papier)
 *
 * Die Farben stammen aus app/styles/global.css. Das Kopfband der dunklen
 * Fassung ist genau der Verlauf der Anmeldeseite (.marke), der Goldknopf
 * genau der Verlauf von .absenden samt Glow.
 */

export const BASIS_URL = "https://lexio-ruby.vercel.app";

const LOGO = `${BASIS_URL}/images/icon-192.png`;
const SCHRIFTZUG_KREME = `${BASIS_URL}/images/lexio-schriftzug-creme.png`;
const SCHRIFTZUG_TINTE = `${BASIS_URL}/images/lexio-schriftzug-tinte.png`;

const SANS = "'Segoe UI',Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";
const MONO = "'Courier New',Courier,monospace";

/* ---------------------------------------------------------------- Designs */

export const designs = {
  dunkel: {
    beschreibung: "Dunkle Fassung – Maroon-Kopfband, dunkle Karte (Standard der App).",
    aussen: "#0e0c09",
    karte: "#17130e",
    linie: "#332b20",
    bandFest: "#2a1a1c",
    bandVerlauf: "linear-gradient(150deg,#3a2325 0%,#1a1418 55%,#131a1f 100%)",
    bandTitel: "#f3efe3",
    bandLeise: "#b6a88f",
    schriftzug: SCHRIFTZUG_KREME,
    titel: "#f3efe3",
    text: "#e6ddc9",
    leise: "#b6a88f",
    stumm: "#7d7361",
    gold: "#e7b14a",
    knopfBis: "#c99433",
    knopfGlow: "rgba(231,177,74,0.28)",
    tinte: "#17110a",
    haarlinie: "linear-gradient(90deg,transparent,rgba(231,177,74,0.55),transparent)",
    haarlinieFest: "rgba(231,177,74,0.35)",
    codeBg: "#201b14",
  },
  hell: {
    beschreibung: "Helle Fassung – warmes Papier, helles Kopfband (helles Design der App).",
    aussen: "#f4ecdc",
    karte: "#fcf7ec",
    linie: "#e0d2b8",
    bandFest: "#f0e6cf",
    bandVerlauf: "linear-gradient(135deg,#f7efdd 0%,#ecdfc2 70%,#e6d5b0 100%)",
    bandTitel: "#20252a",
    bandLeise: "#8a8070",
    schriftzug: SCHRIFTZUG_TINTE,
    titel: "#20252a",
    text: "#5f5a4e",
    leise: "#8a8070",
    stumm: "#8a8070",
    gold: "#b57f1c",
    knopfBis: "#c99433",
    knopfGlow: "rgba(181,127,28,0.28)",
    tinte: "#17110a",
    haarlinie: "linear-gradient(90deg,transparent,rgba(181,127,28,0.5),transparent)",
    haarlinieFest: "rgba(181,127,28,0.3)",
    codeBg: "#f2e9d7",
  },
};

/* ------------------------------------------------------------- Bausteine */

function ueberschrift(d, t) {
  return (
    `<h1 style="font-family:${SERIF};font-size:23px;line-height:31px;` +
    `color:${d.titel};margin:0 0 12px;font-weight:600;">${t}</h1>`
  );
}

function absatz(d, t) {
  return `<p style="margin:0 0 14px;color:${d.text};">${t}</p>`;
}

function hinweis(d, t) {
  return (
    `<p style="margin:18px 0 0;font-size:13px;line-height:21px;` +
    `color:${d.leise};">${t}</p>`
  );
}

function knopf(d, text, url) {
  return (
    `<a href="${url}" style="display:inline-block;background-color:${d.gold};` +
    `background-image:linear-gradient(135deg,${d.gold} 0%,${d.knopfBis} 100%);` +
    `color:${d.tinte};font-family:${SANS};font-size:16px;font-weight:700;` +
    `text-decoration:none;padding:16px 36px;border-radius:12px;` +
    `box-shadow:0 12px 26px ${d.knopfGlow};">${text}</a>`
  );
}

function knopfZart(d, text, url) {
  return (
    `<a href="${url}" style="display:inline-block;background-color:transparent;` +
    `border:2px solid ${d.gold};color:${d.gold};font-family:${SANS};` +
    `font-size:15px;font-weight:700;text-decoration:none;` +
    `padding:13px 30px;border-radius:12px;">${text}</a>`
  );
}

function codeBlock(d, t) {
  return (
    `<div style="font-family:${MONO};font-size:32px;letter-spacing:8px;` +
    `background-color:${d.codeBg};border:1px solid ${d.linie};border-radius:12px;` +
    `padding:20px;text-align:center;color:${d.titel};font-weight:700;">${t}</div>`
  );
}

function fallbackLink(d, url) {
  return (
    `<p style="margin:0;font-size:12px;line-height:19px;color:${d.stumm};` +
    `word-break:break-all;">Falls der Knopf nicht funktioniert, kopiere diesen ` +
    `Link in deinen Browser:<br>` +
    `<a href="${url}" style="color:${d.gold};">${url}</a></p>`
  );
}

/** Kopfband: Logo und Wortmarke nebeneinander, darunter der Zusatz. */
function kopfband(d) {
  return (
    `<tr><td align="center" style="padding:34px 34px 24px;border-radius:23px 23px 0 0;` +
    `background-color:${d.bandFest};background-image:${d.bandVerlauf};">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">` +
    `<tr>` +
    `<td style="vertical-align:middle;padding-right:12px;">` +
    `<img src="${LOGO}" width="42" height="42" alt="" style="display:block;border:0;">` +
    `</td>` +
    `<td style="vertical-align:middle;">` +
    `<img src="${d.schriftzug}" width="84" height="41" alt="Lexio" style="display:block;border:0;">` +
    `</td>` +
    `</tr></table>` +
    `<div style="font-family:${SANS};font-size:10px;letter-spacing:3px;color:${d.bandLeise};` +
    `margin-top:12px;text-transform:uppercase;">Vokabeln lernen</div>` +
    `</td></tr>`
  );
}

/** Die gemeinsame Huelle: Tabellenlayout, Kopfband, Fusszeile. */
function huelle(d, inhalt, { knopfHtml = "", knopfUrl = null, vorschau = "Lexio" } = {}) {
  const knopfBlock = knopfHtml
    ? `<tr><td align="center" style="padding:26px 34px 6px;">${knopfHtml}</td></tr>`
    : "";
  const fallbackBlock = knopfUrl
    ? `<tr><td style="padding:12px 34px 0;">${fallbackLink(d, knopfUrl)}</td></tr>`
    : "";
  return (
    `<!doctype html>\n<html lang="de">\n<head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>Lexio</title></head>\n` +
    `<body style="margin:0;padding:0;background-color:${d.aussen};">\n` +
    `<div style="display:none;font-size:1px;color:${d.aussen};line-height:1px;` +
    `max-height:0;max-width:0;opacity:0;overflow:hidden;">${vorschau}</div>\n` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ` +
    `style="background-color:${d.aussen};padding:28px 12px;">\n` +
    `<tr><td align="center">\n` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ` +
    `style="max-width:540px;background-color:${d.karte};border:1px solid ${d.linie};` +
    `border-radius:24px;">\n` +
    kopfband(d) +
    `<tr><td style="height:1px;font-size:0;line-height:0;background-color:${d.haarlinieFest};` +
    `background-image:${d.haarlinie};">&nbsp;</td></tr>\n` +
    `<tr><td style="padding:28px 34px 0;font-family:${SANS};font-size:15px;line-height:24px;` +
    `color:${d.text};">\n${inhalt}\n</td></tr>\n` +
    knopfBlock +
    fallbackBlock +
    `<tr><td style="padding:28px 34px 0;">` +
    `<div style="height:1px;background-color:${d.linie};font-size:0;line-height:0;">&nbsp;</div>` +
    `</td></tr>\n` +
    `<tr><td align="center" style="padding:16px 34px 30px;font-family:${SANS};font-size:12px;` +
    `line-height:19px;color:${d.stumm};">` +
    `Du erhältst diese E-Mail, weil du ein Konto bei Lexio hast.<br>` +
    `<a href="${BASIS_URL}" style="color:${d.gold};text-decoration:none;">` +
    `lexio-ruby.vercel.app</a></td></tr>\n` +
    `</table>\n</td></tr>\n</table>\n</body>\n</html>`
  );
}

/* ------------------------------------------------------------- Vorlagen */

const BESTAETIGUNGS_URL = "{{ .ConfirmationURL }}";

/**
 * Liefert alle Vorlagen fuer ein Design.
 *
 * Rueckgabe: { name: { betreff, inhalt } }. `name` ist genau der Teil, den
 * Supabase zwischen `mailer_subjects_` und `mailer_templates_..._content`
 * erwartet.
 */
export function vorlagen(designName = "dunkel") {
  const d = designs[designName];
  if (!d) {
    throw new Error(
      `Unbekanntes Design "${designName}". Möglich: ${Object.keys(designs).join(", ")}.`,
    );
  }

  const stellvertreter = (feld) => `<strong style="color:${d.titel};">${feld}</strong>`;

  return {
    recovery: {
      betreff: "Passwort zurücksetzen · Lexio",
      inhalt: huelle(
        d,
        ueberschrift(d, "Passwort zurücksetzen") +
          absatz(
            d,
            "Wir haben eine Anfrage erhalten, dein Passwort zurückzusetzen. " +
              "Wähle über den Knopf ein neues Passwort – der Link ist eine " +
              "Stunde lang gültig.",
          ) +
          hinweis(
            d,
            "Wenn du das nicht angefordert hast, kannst du diese E-Mail " +
              "ignorieren. Dein Passwort bleibt dann unverändert.",
          ),
        {
          knopfHtml: knopf(d, "Neues Passwort wählen", BESTAETIGUNGS_URL),
          knopfUrl: BESTAETIGUNGS_URL,
          vorschau: "Neues Passwort für dein Lexio-Konto wählen",
        },
      ),
    },

    confirmation: {
      betreff: "Bestätige deine E-Mail-Adresse · Lexio",
      inhalt: huelle(
        d,
        ueberschrift(d, "Willkommen bei Lexio") +
          absatz(
            d,
            "Schön, dass du da bist. Bestätige kurz deine E-Mail-Adresse, " +
              "dann kann es mit dem Lernen losgehen.",
          ) +
          hinweis(
            d,
            "Wenn du dich nicht bei Lexio registriert hast, ignoriere " +
              "diese E-Mail einfach.",
          ),
        {
          knopfHtml: knopf(d, "E-Mail-Adresse bestätigen", BESTAETIGUNGS_URL),
          knopfUrl: BESTAETIGUNGS_URL,
          vorschau: "Bestätige kurz deine E-Mail-Adresse",
        },
      ),
    },

    magic_link: {
      betreff: "Dein Anmeldelink · Lexio",
      inhalt: huelle(
        d,
        ueberschrift(d, "Dein Anmeldelink") +
          absatz(
            d,
            "Melde dich mit einem Klick bei Lexio an. Der Link ist nur kurze " +
              "Zeit gültig.",
          ) +
          hinweis(d, "Wenn du das nicht angefordert hast, ignoriere diese E-Mail."),
        {
          knopfHtml: knopf(d, "Jetzt anmelden", BESTAETIGUNGS_URL),
          knopfUrl: BESTAETIGUNGS_URL,
          vorschau: "Dein Link zur Anmeldung bei Lexio",
        },
      ),
    },

    email_change: {
      betreff: "Bestätige deine neue E-Mail-Adresse · Lexio",
      inhalt: huelle(
        d,
        ueberschrift(d, "Neue E-Mail-Adresse bestätigen") +
          absatz(
            d,
            "Fast geschafft. Bestätige deine neue Adresse, damit sie künftig " +
              "für dein Lexio-Konto gilt.",
          ) +
          hinweis(d, "Wenn du das nicht angefordert hast, ignoriere diese E-Mail."),
        {
          knopfHtml: knopf(d, "Neue Adresse bestätigen", BESTAETIGUNGS_URL),
          knopfUrl: BESTAETIGUNGS_URL,
          vorschau: "Bestätige deine neue E-Mail-Adresse",
        },
      ),
    },

    invite: {
      betreff: "Du wurdest zu Lexio eingeladen",
      inhalt: huelle(
        d,
        ueberschrift(d, "Du wurdest eingeladen") +
          absatz(
            d,
            "Du wurdest eingeladen, Lexio zu nutzen. Richte über den Knopf " +
              "dein Konto ein.",
          ),
        {
          knopfHtml: knopf(d, "Einladung annehmen", BESTAETIGUNGS_URL),
          knopfUrl: BESTAETIGUNGS_URL,
          vorschau: "Deine Einladung zu Lexio",
        },
      ),
    },

    reauthentication: {
      betreff: "Dein Bestätigungscode · Lexio",
      inhalt: huelle(
        d,
        ueberschrift(d, "Dein Bestätigungscode") +
          absatz(d, "Gib diesen Code ein, um fortzufahren:") +
          codeBlock(d, "{{ .Token }}") +
          hinweis(
            d,
            "Der Code ist nur kurze Zeit gültig. Wenn du ihn nicht " +
              "angefordert hast, ignoriere diese E-Mail.",
          ),
        { vorschau: "Dein Lexio-Bestätigungscode" },
      ),
    },

    password_changed_notification: {
      betreff: "Dein Lexio-Passwort wurde geändert",
      inhalt: huelle(
        d,
        ueberschrift(d, "Dein Passwort wurde geändert") +
          absatz(
            d,
            "Das Passwort für dein Lexio-Konto wurde gerade geändert. " +
              "Wenn du das warst, ist alles in Ordnung.",
          ) +
          hinweis(d, "Warst du das nicht? Dann setze dein Passwort sofort zurück."),
        {
          knopfHtml: knopfZart(d, "Passwort zurücksetzen", `${BASIS_URL}/passwort-zuruecksetzen`),
          vorschau: "Dein Lexio-Passwort wurde geändert",
        },
      ),
    },

    email_changed_notification: {
      betreff: "Deine E-Mail-Adresse wurde geändert",
      inhalt: huelle(
        d,
        ueberschrift(d, "Deine E-Mail-Adresse wurde geändert") +
          absatz(
            d,
            `Die E-Mail-Adresse deines Lexio-Kontos lautet jetzt ` +
              `${stellvertreter("{{ .Email }}")}.`,
          ) +
          hinweis(d, "Warst du das nicht? Dann sichere dein Konto umgehend."),
        { vorschau: "Deine E-Mail-Adresse bei Lexio wurde geändert" },
      ),
    },

    identity_linked_notification: {
      betreff: "Neue Anmeldemethode verknüpft",
      inhalt: huelle(
        d,
        ueberschrift(d, "Neue Anmeldemethode verknüpft") +
          absatz(
            d,
            `Dein ${stellvertreter("{{ .Provider }}")}-Konto wurde mit deinem ` +
              "Lexio-Konto verknüpft.",
          ) +
          hinweis(d, "Warst du das nicht? Dann sichere dein Konto."),
        { vorschau: "Eine neue Anmeldemethode wurde verknüpft" },
      ),
    },

    identity_unlinked_notification: {
      betreff: "Anmeldemethode entfernt",
      inhalt: huelle(
        d,
        ueberschrift(d, "Anmeldemethode entfernt") +
          absatz(
            d,
            `Dein ${stellvertreter("{{ .Provider }}")}-Konto wurde von deinem ` +
              "Lexio-Konto entfernt.",
          ) +
          hinweis(d, "Warst du das nicht? Dann sichere dein Konto."),
        { vorschau: "Eine Anmeldemethode wurde entfernt" },
      ),
    },
  };
}
