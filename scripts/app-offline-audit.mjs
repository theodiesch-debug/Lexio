/**
 * Live-Audit: Offline-Etappen der App im Browser.
 *
 * Warum im Browser: der App-Code (react-native-web) läuft dort 1:1, und
 * Playwright kann das Netz wirklich abschalten (`context.setOffline`). Damit
 * prüft derselbe Lauf Lesecache, Offline-Runde, Antwort-Queue und das
 * Anlegen ohne Netz — inklusive Gegenprobe gegen die echte API.
 *
 * Start: npx expo start --web --port 8083 (im lexio-app-Ordner).
 * Aufruf: node scripts/app-offline-audit.mjs
 *
 * `--disable-web-security` ist nötig, weil die Produktions-API kein CORS
 * spricht (die echte App ist keine Browser-App) – ohne das schlägt jeder
 * Aufruf als Status 0 fehl und der Test misst nur CORS.
 */
import { chromium } from "playwright";
import fs from "node:fs";

const KONTO_DATEI = process.env.AUDIT_KONTO_DATEI || "/tmp/audit-konto.json";
const APP = process.env.APP_URL || "http://localhost:8083";
const API = process.env.API_URL || "https://lexio-ruby.vercel.app";
/*
 * Jedes Pruefungslauf legt sein eigenes Set an. Mit einem festen Set waere
 * der zweite Lauf kein Test mehr: die Karten von gestern sind nicht faellig,
 * die Runde leer, und „offline gelernt" waere nicht von „nichts zu tun" zu
 * unterscheiden. Das Set wird am Ende wieder geloescht.
 */
const STEMPEL = Date.now();
const SET_NAME = `Offline Audit ${STEMPEL}`;
let SET = null;
/** Das zweite Pruefset (offline angelegt), wird ebenso geloescht. */
let NEUER_SET = null;

const konto = JSON.parse(fs.readFileSync(KONTO_DATEI, "utf8"));

/*
 * Der Token in der Kontodatei ist nach einer Stunde abgelaufen. Statt darauf
 * zu hoffen, wird hier frisch angemeldet – mit denselben Zugangsdaten, die
 * auch der Browser benutzt. Die Anon-Key-Werte stehen in lexio-app/.env.
 */
function envWert(name) {
  const text = fs.readFileSync("lexio-app/.env", "utf8");
  const treffer = text.match(new RegExp(`^${name}=(.*)$`, "m"));
  return treffer ? treffer[1].trim() : null;
}

const SUPABASE = envWert("EXPO_PUBLIC_SUPABASE_URL");
const ANON = envWert("EXPO_PUBLIC_SUPABASE_ANON_KEY");

const anmeldung = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "Content-Type": "application/json" },
  body: JSON.stringify({ email: konto.email, password: konto.passwort }),
}).then((r) => r.json());
if (!anmeldung?.access_token) {
  throw new Error(`Anmeldung am Audit-Konto fehlgeschlagen: ${JSON.stringify(anmeldung)}`);
}
const kopf = { Authorization: `Bearer ${anmeldung.access_token}`, "Content-Type": "application/json" };

let fehler = 0;
const pruefe = (name, ok, extra = "") => {
  if (!ok) fehler += 1;
  console.log(`${ok ? "OK  " : "FEHL"}  ${name}${extra ? " – " + extra : ""}`);
};
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  args: ["--disable-web-security", "--disable-site-isolation-trials"],
});
const ctx = await browser.newContext();
const page = await ctx.newPage();
/*
 * „Netz weg" heißt hier: alles außer der App-Hülle. Ein Handy hat den
 * Bundle lokal und verliert nur die Verbindung nach draußen; ein Browser
 * würde beim echten Offline-Modus auch die Seite von :8083 verlieren.
 */
let netzWeg = false;
await ctx.route("**/*", (route) => {
  const url = route.request().url();
  if (netzWeg && !url.startsWith(APP)) return route.abort("internetdisconnected");
  return route.continue();
});

const seitenfehler = [];
page.on("pageerror", (e) => seitenfehler.push(String(e).slice(0, 200)));
const text = () => page.locator("body").innerText();

try {
  // ------------------------------------------------------- Set fuer den Lauf
  const angelegt = await fetch(`${API}/api/sets`, {
    method: "POST",
    headers: kopf,
    body: JSON.stringify({ name: SET_NAME, spracheCode: "en" }),
  }).then((r) => r.json());
  SET = angelegt?.set?.slug ?? null;
  if (!SET) throw new Error(`Set nicht angelegt: ${JSON.stringify(angelegt)}`);
  await fetch(`${API}/api/karten`, {
    method: "POST",
    headers: kopf,
    body: JSON.stringify({
      setSlug: SET,
      paare: ["Apfel", "Birne", "Pflaume"].map((wort) => ({
        frage: `die ${wort}`,
        antwort: `the ${wort.toLowerCase() === "apfel" ? "apple" : wort === "Birne" ? "pear" : "plum"}`,
        beispielsatz: null,
        beispiel_uebersetzung: null,
      })),
    }),
  });
  pruefe("Pruefset angelegt", true, SET);

  // ---------------------------------------------------------------- Anmelden
  await page.goto(APP, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(12000);
  await page.locator('input[autocomplete="email"]').fill(konto.email);
  await page.locator('input[autocomplete="current-password"]').fill(konto.passwort);
  await page.getByText("Anmelden", { exact: true }).last().click();
  await page.waitForTimeout(7000);
  pruefe("Anmeldung landet auf der Übersicht", page.url() === `${APP}/`, page.url());

  /*
   * "Einmal mit Netz": Sprachkatalog und Set-Liste liegen danach in der
   * Ablage. Ohne diesen einen Besuch waere offline nicht nur die Verbindung
   * weg, sondern auch die Sprachliste, und ein neues Set ließe sich nicht
   * mehr benennen. Genau das Verhalten, das der Plan beschreibt.
   */
  await page.goto(`${APP}/hinzufuegen`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(7000);
  pruefe("Sprachliste mit Netz sichtbar", (await text()).includes("Neues Set"));

  // -------------------------------------------------- Online-Runde + Cache
  await page.goto(`${APP}/lernen/${SET}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);
  const online = await text();
  pruefe("Runde lädt mit Netz", online.includes("Antwort aufdecken"), online.slice(0, 80));
  await page.getByText("Antwort aufdecken", { exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByText("Gut", { exact: true }).first().click();
  await page.waitForTimeout(1500);
  pruefe("Bewertung mit Netz ohne Fehlermeldung", !(await text()).includes("Keine Verbindung"));
  // Hintergrund-Cache abwarten (setCachen nach der Runde).
  await warte(4000);

  // ------------------------------------------------------------ Offline
  netzWeg = true;
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);
  const offlineText = await text();
  pruefe(
    "Offline-Runde kommt vom Gerät",
    offlineText.includes("Offline · die Runde kommt vom Gerät"),
    offlineText.slice(0, 80),
  );
  pruefe("Offline-Runde hat Karten", offlineText.includes("Antwort aufdecken"));

  await page.getByText("Antwort aufdecken", { exact: true }).click();
  await page.waitForTimeout(600);
  await page.getByText("Gut", { exact: true }).first().click();
  await page.waitForTimeout(1500);
  const nachAntwort = await text();
  pruefe("Bewertung ohne Netz ohne Fehlerbild", !nachAntwort.includes("Keine Verbindung"));

  // ------------------------------------------- Karte anlegen ohne Netz
  await page.goto(`${APP}/hinzufuegen`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(7000);
  pruefe(
    "Set-Auswahl offline aus der Ablage",
    (await text()).includes(SET_NAME),
    "das eigene Set steht in der Liste",
  );
  await page.getByText(SET_NAME, { exact: true }).first().click();
  await page.getByText("Weiter", { exact: true }).click();
  await page.waitForTimeout(2000);
  const wort = `Audit-Wort-${STEMPEL}`;
  await page.locator('input[aria-label="Begriff"]').fill(wort);
  await page.locator('input[aria-label="Übersetzung"]').fill("audit word");
  await page.getByText("Fertig", { exact: true }).click();
  await page.waitForTimeout(1500);
  const schritt3 = await text();
  pruefe("Schritt 3 ist sauber", !schritt3.includes("Keine Verbindung zum Server"), schritt3.replace(/\n/g, " / ").slice(0, 160));
  await page.locator('button[aria-label$="speichern"]').first().click();
  await page.waitForTimeout(3000);
  const erfolg = await text();
  pruefe("Anlegen ohne Netz gemeldet", erfolg.includes("Offline gespeichert"), erfolg.slice(0, 100));
  pruefe(
    "Bestehendes Set behält seinen Slug („Jetzt lernen“ geht)",
    erfolg.includes("Jetzt lernen"),
    erfolg.replace(/\n/g, " / ").slice(0, 90),
  );

  // --------------------------------------------------- Neues Set ohne Netz
  await page.goto(`${APP}/hinzufuegen`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(7000);
  await page.getByText("＋ Neues Set", { exact: true }).click();
  await page.getByText("Weiter", { exact: true }).click();
  await page.waitForTimeout(1500);
  const wortB = `Audit-Neu-${STEMPEL}`;
  await page.locator('input[aria-label="Begriff"]').fill(wortB);
  await page.locator('input[aria-label="Übersetzung"]').fill("audit new set");
  await page.getByText("Fertig", { exact: true }).click();
  await page.waitForTimeout(1500);
  const neuName = `Offline Neu ${STEMPEL}`;
  await page.locator('input[aria-label="Name des Sets"]').fill(neuName);
  const sprachPille = page.getByText("Englisch", { exact: true }).first();
  if (await sprachPille.count()) await sprachPille.click();
  else pruefe("Sprachpille offline da", false, "keine Sprachpille zu finden");
  await page.locator('button[aria-label$="speichern"]').first().click();
  await page.waitForTimeout(3500);
  const neuErfolg = await text();
  pruefe(
    "Neues Set offline gespeichert",
    neuErfolg.includes("Offline gespeichert"),
    neuErfolg.replace(/\n/g, " / ").slice(0, 110),
  );
  pruefe(
    "Ohne Slug kein „Jetzt lernen“",
    !neuErfolg.includes("Jetzt lernen"),
    "der Slug existiert noch nicht",
  );
  // ------------------------------------------------------ Netz zurück
  netzWeg = false;
  await page.goto(`${APP}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(14000);

  const karten = await (
    await fetch(`${API}/api/karten?setSlug=${SET}`, { headers: kopf })
  ).json();
  const liste = Array.isArray(karten.karten) ? karten.karten : [];
  pruefe(
    "offline angelegte Karte ist im Web",
    liste.some((k) => k.frage === wort),
    `${liste.length} Karten`,
  );
  pruefe(
    "offline bewertete Karte hat Stufe",
    liste.some((k) => k.stufe > 0),
    liste.map((k) => k.stufe).join(","),
  );

  // Und das offline angelegte neue Set: existiert es, und ist die Karte drin?
  const setsNeu = await (
    await fetch(`${API}/api/karteikarten`, { headers: kopf })
  ).json();
  const neuZeile = Array.isArray(setsNeu) ? setsNeu.find((x) => x.name === neuName) : null;
  pruefe("offline angelegtes Set existiert im Web", !!neuZeile, neuZeile?.id ?? "nicht gefunden");
  if (neuZeile) {
    NEUER_SET = neuZeile.id;
    const neuKarten = await (
      await fetch(`${API}/api/karten?setSlug=${NEUER_SET}`, { headers: kopf })
    ).json();
    pruefe(
      "Karte aus dem neuen Set ist im Web",
      (neuKarten.karten ?? []).some((k) => k.frage === wortB),
      `${(neuKarten.karten ?? []).length} Karten`,
    );
  }

  const profil = await (
    await fetch(`${API}/api/profil`, { headers: kopf })
  ).json();
  pruefe("XP sind beim Server angekommen", (profil?.xp ?? 0) > 0, `xp=${profil?.xp}`);

  pruefe("keine Seitenfehler", seitenfehler.length === 0, seitenfehler.join(" | "));
} finally {
  await browser.close();
  // Aufraeumen: das Pruefset wieder weg, damit der Audit-Account nicht
  // zumuellt. Fehler hier duerfen das Ergebnis nicht kippen.
  for (const slug of [SET, NEUER_SET]) {
    if (!slug) continue;
    await fetch(`${API}/api/sets/${slug}`, { method: "DELETE", headers: kopf }).catch(() => {});
  }
}

console.log(fehler === 0 ? "\nAlle Prüfungen bestanden." : `\n${fehler} Prüfung(en) fehlgeschlagen.`);
process.exit(fehler === 0 ? 0 : 1);
