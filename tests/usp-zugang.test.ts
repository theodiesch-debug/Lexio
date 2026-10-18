/**
 * Tests fuer lib/usp-zugang.ts – den Zugang zur USP-Seite.
 *
 * Warum ueberhaupt: das ist die einzige Stelle, die entscheidet, ob eine
 * neue oeffentliche Seite im Netz steht oder nicht. Falsch herum gebaut
 * bedeutet 404 auf einer Seite, die gerade ueberall verlinkt werden soll –
 * oder umgekehrt eine Seite in der Suche, die noch nicht stehen soll. Beides
 * faellt nicht von selbst auf, weil „geht nicht" und „sieht gut aus" von
 * aussen wie derselbe Zustand aussehen.
 *
 * Besonders wichtig ist die Falle mit `vorschau`: ein Schluessel allein
 * darf nie reichen. Wer `USP_VORSCHAU_TOKEN` vergisst, aber in der URL
 * etwas mitbringt, bekommt sonst eine Seite, die aus Versehen fuer alle
 * erreichbar waere – mit `indexieren: false` waere sie zwar aus der Suche
 * draussen, aber jeder mit dem Link haette sie.
 *
 * Aufruf: `npm test`
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MIN_SCHLUESSEL,
  USP_WEG,
  beurteileUspZugang,
} from "../lib/usp-zugang";

const SCHLUESSEL = "t0ch-mal-nicht-raten-bitte";

test("ohne Konfiguration ist die Seite nicht da", () => {
  const b = beurteileUspZugang({
    zugang: undefined,
    schluessel: undefined,
    mitgebrachterSchluessel: undefined,
  });
  assert.deepEqual(b, USP_WEG);
});

test("aus bleibt aus, auch mit Schluessel in der URL", () => {
  const b = beurteileUspZugang({
    zugang: "aus",
    schluessel: SCHLUESSEL,
    mitgebrachterSchluessel: SCHLUESSEL,
  });
  assert.deepEqual(b, USP_WEG);
});

test("offen ist sichtbar und indexierbar", () => {
  const b = beurteileUspZugang({
    zugang: "offen",
    schluessel: undefined,
    mitgebrachterSchluessel: undefined,
  });
  assert.deepEqual(b, { sichtbar: true, indexieren: true });
});

test("offen mit unnoetigem Schluessel ist ebenfalls offen", () => {
  const b = beurteileUspZugang({
    zugang: "offen",
    schluessel: SCHLUESSEL,
    mitgebrachterSchluessel: "irgendwas",
  });
  assert.deepEqual(b, { sichtbar: true, indexieren: true });
});

test("Schreibweisen von USP_ZUGANG werden verziehen", () => {
  for (const zugang of ["OFFEN", "  offen  ", "Offen"]) {
    const b = beurteileUspZugang({ zugang, schluessel: undefined, mitgebrachterSchluessel: undefined });
    assert.equal(b.sichtbar, true, `fuer "${zugang}" erwartet`);
    assert.equal(b.indexieren, true, `fuer "${zugang}" erwartet`);
  }
});

test("vorschau mit passendem Schluessel: sichtbar, aber nicht indexiert", () => {
  const b = beurteileUspZugang({
    zugang: "vorschau",
    schluessel: SCHLUESSEL,
    mitgebrachterSchluessel: SCHLUESSEL,
  });
  assert.deepEqual(b, { sichtbar: true, indexieren: false });
});

test("vorschau ohne gesetzten Schluessel bleibt 404", () => {
  const b = beurteileUspZugang({
    zugang: "vorschau",
    schluessel: undefined,
    mitgebrachterSchluessel: SCHLUESSEL,
  });
  assert.deepEqual(b, USP_WEG);
});

test("vorschau ohne mitgebrachten Schluessel bleibt 404", () => {
  const b = beurteileUspZugang({
    zugang: "vorschau",
    schluessel: SCHLUESSEL,
    mitgebrachterSchluessel: undefined,
  });
  assert.deepEqual(b, USP_WEG);
});

test("falscher Schluessel bleibt 404", () => {
  const b = beurteileUspZugang({
    zugang: "vorschau",
    schluessel: SCHLUESSEL,
    mitgebrachterSchluessel: `${SCHLUESSEL}x`,
  });
  assert.deepEqual(b, USP_WEG);
});

test("ein Buchstabe zu wenig reicht nicht", () => {
  const lang = "a".repeat(MIN_SCHLUESSEL);
  const b = beurteileUspZugang({
    zugang: "vorschau",
    schluessel: lang,
    mitgebrachterSchluessel: lang.slice(0, -1),
  });
  assert.deepEqual(b, USP_WEG);
});

test("zu kurzer konfigurierter Schluessel wird abgelehnt", () => {
  const kurz = "a".repeat(MIN_SCHLUESSEL - 1);
  const b = beurteileUspZugang({
    zugang: "vorschau",
    schluessel: kurz,
    mitgebrachterSchluessel: kurz,
  });
  assert.deepEqual(b, USP_WEG);
});

test("ein unbekannter Wert in USP_ZUGANG ist aus, nicht vorschau", () => {
  const b = beurteileUspZugang({
    zugang: "vielleicht",
    schluessel: SCHLUESSEL,
    mitgebrachterSchluessel: SCHLUESSEL,
  });
  assert.deepEqual(b, USP_WEG);
});

test("ein leerer Schluessel ist kein Schluessel", () => {
  const b = beurteileUspZugang({
    zugang: "vorschau",
    schluessel: "   ",
    mitgebrachterSchluessel: "   ",
  });
  assert.deepEqual(b, USP_WEG);
});
