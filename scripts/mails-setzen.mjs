#!/usr/bin/env node
/**
 * Setzt die Lexio-Mailvorlagen in Supabase.
 *
 * Aufruf:
 *   node scripts/mails-setzen.mjs                 # dunkle Fassung setzen
 *   node scripts/mails-setzen.mjs --hell          # helle Fassung setzen
 *   node scripts/mails-setzen.mjs --hell --nur-vorschau   # hell bauen, aber nicht setzen
 *   node scripts/mails-setzen.mjs --vorschau      # zusaetzlich HTML zur Ansicht ablegen
 *   node scripts/mails-setzen.mjs --test-mail du@example.com   # Testmail schicken
 *
 * --nur-vorschau ist der Schutz, bevor man wechselt: Damit laesst sich die
 * andere Fassung ansehen und pruefen, ohne die live gehende Aenderung mit
 * auszuloesen.
 *
 * Warum ein Skript und nicht das Dashboard
 * ----------------------------------------
 * Die Vorlagen stehen als Text in `scripts/mails-vorlagen.mjs` und damit in
 * der Versionsgeschichte. Das Dashboard ist der Zielort, nicht die Quelle.
 * So laesst sich jede Aenderung nachlesen und wiederholen.
 *
 * Was es braucht
 * --------------
 * SUPABASE_ACCESS_TOKEN aus .env. Das ist der persoenliche Zugriffsschluessel
 * aus dem Supabase-Konto (Account -> Access Tokens) – nicht der anon Key der
 * App. Er darf nur lokal liegen und gehoert nicht in die CI und nicht auf
 * Vercel.
 *
 * Die Projekt-Kennung wird aus NEXT_PUBLIC_SUPABASE_URL abgeleitet, damit
 * hier keine zweite feste Zahl steht, die auseinanderlaufen kann.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { designs, vorlagen } from "./mails-vorlagen.mjs";

const WURZEL = path.resolve(import.meta.dirname, "..");

/** Liest .env ohne Bibliothek: keine Abhaengigkeit, keine Auswertung von Code. */
function liesEnv() {
  const datei = path.join(WURZEL, ".env");
  if (!fs.existsSync(datei)) {
    console.error(".env nicht gefunden. Erwartet wird u. a. SUPABASE_ACCESS_TOKEN.");
    process.exit(1);
  }
  const raus = {};
  for (const zeile of fs.readFileSync(datei, "utf8").split("\n")) {
    if (!zeile.includes("=") || zeile.trim().startsWith("#")) continue;
    const i = zeile.indexOf("=");
    raus[zeile.slice(0, i).trim()] = zeile
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return raus;
}

const ok = (t) => `\x1b[32m${t}\x1b[0m`;
const schlecht = (t) => `\x1b[31m${t}\x1b[0m`;
const gelb = (t) => `\x1b[33m${t}\x1b[0m`;
const fett = (t) => `\x1b[1m${t}\x1b[0m`;

/* -------------------------------------------------------------- Argumente */

const args = process.argv.slice(2);
const design = args.includes("--hell") ? "hell" : "dunkel";
const vorschauGewuenscht = args.includes("--vorschau");
const nurVorschau = args.includes("--nur-vorschau");
const testIndex = args.indexOf("--test-mail");
const testAdresse = testIndex >= 0 ? args[testIndex + 1] : null;

if (testIndex >= 0 && !testAdresse) {
  console.error("Zu --test-mail fehlt die Adresse, z. B. --test-mail du@example.com");
  process.exit(1);
}

/* ------------------------------------------------------------------ Bauten */

const env = liesEnv();
const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!TOKEN) {
  console.error(
    schlecht("SUPABASE_ACCESS_TOKEN fehlt in .env.") +
      "\n  Dashboard -> Account -> Access Tokens -> neuen erzeugen.",
  );
  process.exit(1);
}
if (!SUPABASE_URL) {
  console.error(schlecht("NEXT_PUBLIC_SUPABASE_URL fehlt in .env."));
  process.exit(1);
}

const REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const d = designs[design];
const alle = vorlagen(design);

console.log(`\nProjekt: ${REF}   Design: ${fett(design)}`);
console.log(`${d.beschreibung}\n`);

/* ----------------------------------------------------- 1. Vorschau ablegen */

if (vorschauGewuenscht || nurVorschau) {
  const ziel = path.join(os.tmpdir(), "lexio-mails", design);
  fs.mkdirSync(ziel, { recursive: true });
  for (const [name, { inhalt }] of Object.entries(alle)) {
    fs.writeFileSync(path.join(ziel, `${name}.html`), inhalt);
  }
  console.log(`Vorschau abgelegt: ${gelb(ziel)}`);
  console.log("  (im Browser oeffnen, um das Aussehen zu pruefen)");
}

if (nurVorschau) {
  console.log(`\n${ok("Nur Vorschau geschrieben.")} Nichts geaendert.\n`);
  process.exit(0);
}
console.log("");

/* -------------------------------------------------- 2. In Supabase setzen */

const patch = {};
for (const [name, { betreff, inhalt }] of Object.entries(alle)) {
  patch[`mailer_subjects_${name}`] = betreff;
  patch[`mailer_templates_${name}_content`] = inhalt;
}

const antwort = await fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify(patch),
});

if (!antwort.ok) {
  console.error(schlecht(`Setzen fehlgeschlagen (HTTP ${antwort.status}).`));
  console.error(await antwort.text());
  process.exit(1);
}
console.log(ok(`Gesetzt: ${Object.keys(alle).length} Vorlagen.`));

/* ------------------------------------------------------- 3. Gegenpruefung */

const kontrolle = await fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
}).then((r) => r.json());

let passend = 0;
for (const [name, { betreff, inhalt }] of Object.entries(alle)) {
  const istBetreff = kontrolle[`mailer_subjects_${name}`];
  const istInhalt = kontrolle[`mailer_templates_${name}_content`] ?? "";
  const gut = istBetreff === betreff && istInhalt === inhalt;
  if (gut) passend += 1;
  console.log(
    gut
      ? ok(`  stimmt   ${name}`)
      : schlecht(`  weicht   ${name}`) + `  Betreff ${istInhalt.length} Zeichen HTML`,
  );
}
if (passend !== Object.keys(alle).length) {
  console.error(schlecht("Nicht alle Vorlagen stimmen mit der Quelle überein."));
  process.exit(1);
}

/* --------------------------------------------------------- 4. Testmail */

if (testAdresse) {
  if (!ANON) {
    console.error(gelb("Kein anon Key – Testmail uebersprungen."));
  } else {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: "POST",
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: testAdresse }),
    });
    console.log(
      r.ok
        ? ok(`Testmail (Passwort zuruecksetzen) an ${testAdresse} ausgeloest.`)
        : schlecht(`Testmail fehlgeschlagen (HTTP ${r.status}).`),
    );
  }
}

console.log(`\n${ok("Fertig.")} Im Dashboard nachzulesen: Authentication → Emails → Templates\n`);
