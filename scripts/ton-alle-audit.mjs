/**
 * Audit „Alle Karten vorlesen" (Web).
 *
 * Geprueft wird, was der Nutzer verlangt hat:
 *   1. In den Einstellungen gibt es den Schalter, Vorgabe ist AUS.
 *   2. Die Wahl haelt ueber das Neuladen hinweg (localStorage lexio.ton.v1).
 *   3. Ohne Toene gibt es den Schalter nicht – er wuerde sonst etwas
 *      versprechen, das die Karte nicht haelt.
 *   4. Aufdecken spricht NICHT von selbst (Vorgabe), der Lautsprecher auf
 *      der Karte spricht weiterhin beim Druecken.
 *   5. Mit gesetztem Schalter spricht das Aufdecken die Antwort.
 *
 * Aufruf: node --env-file=.env /home/theo/.cache/lexio/ton-alle-audit.mjs
 * Laeuft gegen den laufenden Produktionsserver auf :3000.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASIS = process.env.AUDIT_BASIS ?? "http://localhost:3000";
const KONTO = JSON.parse(readFileSync("/tmp/audit-konto.json", "utf8"));

const fehler = [];
function pruefe(text, wahr) {
    console.log(`  ${wahr ? "OK  " : "FEHL"}: ${text}`);
    if (!wahr) fehler.push(text);
}

const browser = await chromium.launch();
const kontext = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "de-DE" });

/*
 * Ersatz fuer die Sprachausgabe: headless Chromium hat keine Stimme, und
 * genau darum muesste man raten, ob die Seite spricht. Hier wird jede
 * Anfrage gezaehlt, statt sie zu raten.
 */
await kontext.addInitScript(() => {
    window.__sprechAufrufe = 0;
    class Utterance {
        constructor(text) {
            this.text = text;
        }
    }
    window.SpeechSynthesisUtterance = Utterance;
    const synth = {
        getVoices: () => [{ lang: "en-US", localService: true, name: "Test", default: true }],
        speak: () => {
            window.__sprechAufrufe += 1;
        },
        cancel: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
    };
    Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
});

await kontext.addCookies([
    {
        name: KONTO.cookieName,
        value: KONTO.cookieValue,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
    },
]);

const seite = await kontext.newPage();
const konsoleFehler = [];
seite.on("pageerror", (e) => konsoleFehler.push(String(e)));

console.log(`\n1. Einstellungen ${BASIS}/einstellungen`);
await seite.goto(`${BASIS}/einstellungen`, { waitUntil: "networkidle" });

const tonAlle = seite.locator("#tonAlle");
pruefe("Schalter #tonAlle ist da", (await tonAlle.count()) === 1);
pruefe("Vorgabe ist aus", !(await tonAlle.isChecked()));
let stand = await seite.evaluate(() => JSON.parse(localStorage.getItem("lexio.ton.v1") ?? "{}"));
pruefe(`vorlesenAlle beim Start nicht gesetzt oder aus (${stand.vorlesenAlle})`, stand.vorlesenAlle !== true);

console.log(`\n2. Schalter um, Neuladen, Schalter noch da`);
await seite.locator("label:has(#tonAlle)").click();
stand = await seite.evaluate(() => JSON.parse(localStorage.getItem("lexio.ton.v1") ?? "{}"));
pruefe(`Speicher nach dem Klick: vorlesenAlle=${stand.vorlesenAlle}`, stand.vorlesenAlle === true);
await seite.reload({ waitUntil: "networkidle" });
pruefe("nach dem Neuladen wieder an", await seite.locator("#tonAlle").isChecked());

console.log(`\n3. Toene aus -> Schalter weg`);
await seite.locator("label:has(#tonAn)").click();
await seite.waitForTimeout(300);
pruefe("ohne Toene kein #tonAlle", (await seite.locator("#tonAlle").count()) === 0);
await seite.locator("label:has(#tonAn)").click();
await seite.waitForTimeout(300);
pruefe("mit Toenen kommt er zurueck", (await seite.locator("#tonAlle").count()) === 1);

/*
 * Der Speicher des Kontexts traegt den Klick aus Abschnitt 2 noch mit.
 * Zurueck auf die Vorgabe, sonst misst Abschnitt 4 das Gegenteil von dem,
 * was es messen will.
 */
await seite.evaluate(() =>
    localStorage.setItem(
        "lexio.ton.v1",
        JSON.stringify({ v: 1, an: true, vorlesenAlle: false, lautstaerke: "normal" }),
    ),
);

console.log(`\n4. Lernseite: Set anlegen und aufdecken`);
const slug = await seite.evaluate(async () => {
    const set = await fetch("/api/sets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Ton-Audit", spracheCode: "en" }),
    }).then((r) => r.json());
    const s = set?.set?.slug;
    if (!s) return null;
    await fetch("/api/karten", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ setSlug: s, paare: [{ frage: "das beispiel", antwort: "the example" }] }),
    });
    return s;
});
pruefe(`Set angelegt: ${slug}`, Boolean(slug));
await seite.goto(`${BASIS}/lernen/${slug}`, { waitUntil: "networkidle" });

/*
 * Der Knopf und die Karte selbst tragen denselben Namen (die Karte ist
 * aria-label="Antwort aufdecken"), deshalb wird hier ueber die
 * CSS-Modulklasse gesucht: genau der Button, den der Nutzer meint.
 */
const aufdeckKnopf = seite.locator('button[class*="aufdecken"]');
pruefe('Knopf Antwort aufdecken ist da', (await aufdeckKnopf.count()) === 1);

let zaehler = await seite.evaluate(() => window.__sprechAufrufe);
await aufdeckKnopf.first().click();
await seite.waitForTimeout(400);
zaehler = await seite.evaluate(() => window.__sprechAufrufe);
pruefe(`Aufdecken spricht nicht von selbst (Aufrufe=${zaehler})`, zaehler === 0);
pruefe(
    "Antwort steht jetzt auf der Karte",
    (await seite.getByText("the example", { exact: true }).count()) >= 1,
);

const lautsprecher = seite.getByRole("button", { name: /aussprechen|vorlesen|sprich/i });
if ((await lautsprecher.count()) > 0) {
    await lautsprecher.first().click();
    await seite.waitForTimeout(300);
    zaehler = await seite.evaluate(() => window.__sprechAufrufe);
    pruefe(`Lautsprecherknoepfchen spricht (Aufrufe=${zaehler})`, zaehler > 0);
} else {
    pruefe("Lautsprecherknoepfchen gefunden", false);
}

console.log(`\n5. Mit gesetztem Schalter: Aufdecken spricht`);
await seite.evaluate(() =>
    localStorage.setItem(
        "lexio.ton.v1",
        JSON.stringify({ v: 1, an: true, vorlesenAlle: true, lautstaerke: "normal" }),
    ),
);
await seite.goto(`${BASIS}/lernen/${slug}`, { waitUntil: "networkidle" });
await seite.evaluate(() => (window.__sprechAufrufe = 0));
await seite.locator('button[class*="aufdecken"]').click();
await seite.waitForTimeout(400);
zaehler = await seite.evaluate(() => window.__sprechAufrufe);
pruefe(`Aufdecken spricht die Antwort (Aufrufe=${zaehler})`, zaehler > 0);

pruefe(`keine Seitenfehler (${konsoleFehler.length})`, konsoleFehler.length === 0);
if (konsoleFehler.length > 0) console.log(konsoleFehler.slice(0, 3));

await browser.close();
console.log(fehler.length === 0 ? "\nAlle Pruefungen bestanden." : `\n${fehler.length} Fehlschlaege.`);
process.exit(fehler.length === 0 ? 0 : 1);
