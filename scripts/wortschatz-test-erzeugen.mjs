#!/usr/bin/env node
/**
 * Erzeugt `public/wortschatz-test.json` für die Seite /wortschatz-test.
 *
 * Was drinsteht
 * -------------
 * Fünf Frequenzbänder der NGSL-Liste (New General Service List), jeweils
 * `frage` (deutsch) und `antwort` (englisch) – sonst nichts. Die
 * Beispielsätze der Wortlisten bleiben draußen: der Test zeigt nur das
 * Wort, und ein Satz würde die Datei vervielfachen, ohne dass ihn jemand
 * zu sehen bekäme.
 *
 * Warum dedupliziert wird
 * -----------------------
 * Dieselbe Vokabel steht in mehreren Bändern (236 Fälle, bandintern und
 * über Bandgrenzen). Für die Schätzung ist das tödlich: dieselbe Karte
 * würde in zwei Bändern getestet, und die zweite Schätzung wäre nicht mehr
 * unabhängig von der ersten. Deshalb bleibt jedes Wort im HÄUFIGSTEN Band,
 * in dem es vorkommt. Damit sind die Bänder disjunkt, und `groesse` ist die
 * echte Größe der Menge, aus der gezogen wird.
 *
 * Warum `public/` und nicht `lib/`
 * --------------------------------
 * Die Datei wird zur Laufzeit im Browser geholt, nicht mitgebündelt. Sie
 * ist Daten, kein Code: sie ändert sich, wenn die Wortlisten sich ändern,
 * und muss dann nicht durch den Build. `scripts/toten-code.mjs` ignoriert
 * `public/` ohnehin.
 *
 * Aufruf: node scripts/wortschatz-test-erzeugen.mjs
 */

import fs from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(import.meta.dirname, "..");
const WORTLISTEN = path.join(WURZEL, "scripts", "wortlisten");
const ZIEL = path.join(WURZEL, "public", "wortschatz-test.json");
/*
 * Zweite Ablage fuer die App.
 *
 * Die Webseite holt die Liste zur Laufzeit; die App kann das nicht, wenn sie
 * offline laufen soll – sie buendelt sie als Asset. Zwei Dateien sind eine
 * Duplikatgefahr, deshalb schreibt dieser Generator beide aus derselben Quelle.
 */
const ZIEL_APP = path.join(WURZEL, "lexio-app", "assets", "wortschatz-test.json");

/**
 * Reihenfolge = Häufigkeit, von häufig nach selten. Genau diese Reihenfolge
 * entscheidet beim Deduplizieren, in welchem Band ein Wort landet.
 */
const BAENDER = [
  { name: "top100", titel: "Die 100 häufigsten Wörter", datei: "ngsl-top100.json" },
  { name: "alltag-1", titel: "Alltag 1 (Rang 101–500)", datei: "ngsl-alltag-1.json" },
  { name: "alltag-2", titel: "Alltag 2 (Rang 501–1000)", datei: "ngsl-alltag-2.json" },
  { name: "ausbau-1", titel: "Ausbau 1 (Rang 1001–1800)", datei: "ngsl-ausbau-1.json" },
  { name: "ausbau-2", titel: "Ausbau 2 (Rang ab 1801)", datei: "ngsl-ausbau-2.json" },
];

/**
 * Schlüssel für den Vergleich. `trim` und Kleinschreibung: „Der, die, das“
 * und „der, die, das“ sind dieselbe Karte, und zwei Schreibweisen desselben
 * Wortes im Test wären nur verwirrend.
 */
function schluessel(frage) {
  return String(frage).trim().toLowerCase();
}

const gesehen = new Set();
const baender = [];
let doppelt = 0;

for (const band of BAENDER) {
  const quelle = path.join(WORTLISTEN, band.datei);
  if (!fs.existsSync(quelle)) {
    console.error(`Wortliste fehlt: ${quelle}`);
    process.exit(1);
  }
  const roh = JSON.parse(fs.readFileSync(quelle, "utf8"));
  if (!Array.isArray(roh)) {
    console.error(`Wortliste ist kein Array: ${quelle}`);
    process.exit(1);
  }

  const woerter = [];
  for (const eintrag of roh) {
    const frage = String(eintrag.frage ?? "").trim();
    const antwort = String(eintrag.antwort ?? "").trim();
    if (!frage || !antwort) continue;
    const k = schluessel(frage);
    if (gesehen.has(k)) {
      doppelt += 1;
      continue;
    }
    gesehen.add(k);
    woerter.push({ frage, antwort });
  }

  baender.push({
    name: band.name,
    titel: band.titel,
    groesse: woerter.length,
    woerter,
  });
  console.log(`${band.name}: ${woerter.length} Wörter (Quelle: ${roh.length})`);
}

const gesamt = baender.reduce((summe, b) => summe + b.groesse, 0);

const daten = {
  erzeugt: new Date().toISOString().slice(0, 10),
  quelle:
    "NGSL (New General Service List) von Browne, Culligan und Culligan, " +
    "CC BY-SA 4.0. Aufbereitung und Beispielsätze: Lexio – siehe /quellen.",
  gesamt,
  baender,
};

fs.mkdirSync(path.dirname(ZIEL), { recursive: true });
fs.writeFileSync(ZIEL, JSON.stringify(daten));
fs.mkdirSync(path.dirname(ZIEL_APP), { recursive: true });
fs.writeFileSync(ZIEL_APP, JSON.stringify(daten));

const bytes = fs.statSync(ZIEL).size;
console.log(`\nDoppelte Einträge übersprungen: ${doppelt}`);
console.log(`Wörter gesamt: ${gesamt}`);
console.log(`Geschrieben: ${path.relative(WURZEL, ZIEL)} (${(bytes / 1024).toFixed(1)} kB)`);
console.log(`Geschrieben: ${path.relative(WURZEL, ZIEL_APP)} (${(bytes / 1024).toFixed(1)} kB)`);
