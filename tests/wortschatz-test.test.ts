/**
 * Tests fuer lib/wortschatz-test.ts – Stichprobe und Hochrechnung.
 *
 * Warum: die Schätzung ist eine Zahl, die jemand glaubt. Zieht die Stichprobe
 * ein Wort doppelt, zählt es zweimal und der Anteil verschiebt sich; wird erst
 * am Ende gerundet, passen die Bandwerte nicht zur Summe. Beides fällt im
 * Browser nicht auf – eine Zahl, die plausibel aussieht, sieht immer richtig
 * aus.
 *
 * Aufruf: `npm test`
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  baueTestreihe,
  schaetzeWortschatz,
  stichprobe,
  zahl,
  type BandErgebnis,
  type WortschatzDaten,
} from "../lib/wortschatz-test";

/** Ein Wort im Testformat. */
const W = (frage: string) => ({ frage, antwort: frage.toLowerCase() });

const DATEN: WortschatzDaten = {
  erzeugt: "2026-10-19",
  quelle: "Test",
  gesamt: 5,
  baender: [
    { name: "a", titel: "Band A", groesse: 2, woerter: [W("eins"), W("zwei")] },
    { name: "b", titel: "Band B", groesse: 3, woerter: [W("drei"), W("vier"), W("fünf")] },
  ],
};

test("stichprobe nimmt nicht mehr als vorhanden", () => {
  const gezogen = stichprobe([1, 2, 3], 10);
  assert.equal(gezogen.length, 3);
  assert.deepEqual([...gezogen].sort(), [1, 2, 3]);
});

test("stichprobe zieht ohne Wiederholung", () => {
  // Derselbe Generatorwert für jeden Schritt: ohne Schutz würde hier
  // mehrfach dasselbe Element gezogen.
  const gezogen = stichprobe([1, 2, 3, 4, 5], 4, () => 0);
  const eindeutig = new Set(gezogen);
  assert.equal(eindeutig.size, 4);
});

test("stichprobe ist mit festem Generator reproduzierbar", () => {
  let i = 0;
  const folge = [0.3, 0.7, 0.1, 0.9, 0.5];
  const zufall = () => folge[i++ % folge.length];
  const a = stichprobe([...Array(10).keys()], 3, zufall);
  i = 0;
  const b = stichprobe([...Array(10).keys()], 3, zufall);
  assert.deepEqual(a, b);
});

test("stichprobe mit anzahl 0 nimmt nichts", () => {
  assert.deepEqual(stichprobe([1, 2, 3], 0), []);
});

test("baueTestreihe zieht aus jedem Band die gleiche Zahl", () => {
  const reiheAufgaben = baueTestreihe(DATEN, 1, () => 0);
  assert.equal(reiheAufgaben.length, 2);
  assert.deepEqual(
    reiheAufgaben.map((a) => a.bandName),
    ["a", "b"],
  );
});

test("baueTestreihe behält die Bandreihenfolge (häufig zuerst)", () => {
  const reiheAufgaben = baueTestreihe(DATEN, 2, () => 0);
  assert.deepEqual(
    reiheAufgaben.map((a) => a.bandName),
    ["a", "a", "b", "b"],
  );
});

test("baueTestreihe nimmt pro Band höchstens alle Wörter", () => {
  const reiheAufgaben = baueTestreihe(DATEN, 99, () => 0);
  assert.equal(reiheAufgaben.length, 5);
});

const e = (
  name: string,
  groesse: number,
  getestet: number,
  gekannt: number,
): BandErgebnis => ({ name, titel: name, groesse, getestet, gekannt });

test("schaetzeWortschatz rechnet die Quote auf das Band hoch", () => {
  // 3 von 5 gekannt -> 60 % von 100 = 60.
  const s = schaetzeWortschatz([e("a", 100, 5, 3)]);
  assert.equal(s.baender[0].anteil, 0.6);
  assert.equal(s.baender[0].geschaetzt, 60);
  assert.equal(s.geschaetzt, 60);
});

test("schaetzeWortschatz rundet pro Band, nicht erst am Ende", () => {
  // 1/3 von 100 = 33,33 -> 33; 2/3 von 10 = 6,67 -> 7. Summe 40, nicht 40,33.
  const s = schaetzeWortschatz([e("a", 100, 3, 1), e("b", 10, 3, 2)]);
  assert.equal(s.baender[0].geschaetzt, 33);
  assert.equal(s.baender[1].geschaetzt, 7);
  assert.equal(s.geschaetzt, 40);
});

test("schaetzeWortschatz lässt ungetestete Bänder als null stehen", () => {
  const s = schaetzeWortschatz([e("a", 100, 5, 5), e("b", 50, 0, 0)]);
  assert.equal(s.baender[1].geschaetzt, null);
  assert.equal(s.baender[1].anteil, 0);
  // Die 50 ungetesteten Wörter zählen weder zur Summe noch zur Grundmenge.
  assert.equal(s.geschaetzt, 100);
  assert.equal(s.gesamtGroesse, 100);
});

test("schaetzeWortschatz zählt getestet und gekannt zusammen", () => {
  const s = schaetzeWortschatz([e("a", 100, 5, 4), e("b", 50, 5, 1)]);
  assert.equal(s.getestet, 10);
  assert.equal(s.gekannt, 5);
});

test("schaetzeWortschatz mit leerer Liste ist leer, nicht kaputt", () => {
  const s = schaetzeWortschatz([]);
  assert.deepEqual(s.baender, []);
  assert.equal(s.geschaetzt, 0);
  assert.equal(s.getestet, 0);
});

test("schaetzeWortschatz kann kein Band über seine Größe hinaus schätzen", () => {
  const s = schaetzeWortschatz([e("a", 10, 5, 5)]);
  assert.equal(s.baender[0].geschaetzt, 10);
});

test("zahl setzt den Tausenderpunkt im deutschen Format", () => {
  assert.equal(zahl(2039), "2.039");
  assert.equal(zahl(7), "7");
});
