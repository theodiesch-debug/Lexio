import assert from "node:assert/strict";
import test from "node:test";

import {
    bereinigeOcrPaare,
    normalisiereImport,
    normalisiereSeite,
    pruefePaare,
    siehtDeutschAus,
} from "../lib/vokabel-ocr";

/*
 * Grundlage sind Fehler, die ein Vision-Modell bei echten Vokabelfotos macht:
 * Nummerierung, doppelte Zeilen, Beispielsätze in der Zelle, vertauschte
 * Spalten. Nichts davon wird stillschweigend verbessert – bereinigt wird nur,
 * was eindeutig Müll ist, alles andere wird markiert.
 */

test("Nummerierung, Leerzeichen und Endpunkte verschwinden", () => {
    assert.equal(normalisiereSeite(" 1. der   Hund. "), "der Hund");
    assert.equal(normalisiereSeite("a) casa"), "casa");
    assert.equal(normalisiereSeite("12) Haus"), "Haus");
    assert.equal(normalisiereSeite("- casa"), "casa");
    assert.equal(normalisiereSeite("• to learn"), "to learn");
});

test("Normalisieren ist idempotent", () => {
    const einmal = normalisiereSeite("1. der Hund");
    assert.equal(normalisiereSeite(einmal), einmal);
});

test("Zahlen im Wort bleiben stehen", () => {
    assert.equal(normalisiereSeite("3D"), "3D");
    assert.equal(normalisiereSeite("4x4"), "4x4");
});

test("Nullbreite und Steuerzeichen kommen nicht durch", () => {
    assert.equal(normalisiereSeite("Haus\u200b"), "Haus");
});

test("Leere Paare fallen raus, einseitige bleiben", () => {
    const ergebnis = bereinigeOcrPaare([
        { frage: "", antwort: "" },
        { frage: "Haus", antwort: "" },
        { frage: "Hund", antwort: "dog" },
    ]);

    assert.equal(ergebnis.leer, 1);
    assert.deepEqual(ergebnis.paare, [
        { frage: "Haus", antwort: "" },
        { frage: "Hund", antwort: "dog" },
    ]);
});

test("Dubletten werden entfernt, auch gegen den Bestand", () => {
    const ergebnis = bereinigeOcrPaare(
        [
            { frage: "Hund", antwort: "dog" },
            { frage: " hund ", antwort: "Dog" },
            { frage: "Katze", antwort: "cat" },
        ],
        { bestehende: [{ frage: "Katze", antwort: "cat" }] },
    );

    assert.equal(ergebnis.doppelt, 2);
    assert.deepEqual(ergebnis.paare, [{ frage: "Hund", antwort: "dog" }]);
});

test("Beispielsätze und Garbage werden verworfen", () => {
    const ergebnis = bereinigeOcrPaare([
        { frage: "Der Hund läuft schnell durch den Garten.", antwort: "The dog runs quickly" },
        { frage: "aaaa", antwort: "bbbb" },
        { frage: "123", antwort: "456" },
        { frage: "Haus", antwort: "house" },
    ]);

    assert.ok(ergebnis.verworfen >= 3);
    assert.deepEqual(ergebnis.paare, [{ frage: "Haus", antwort: "house" }]);
});

test("Kopfzeilen sind keine Vokabeln", () => {
    const ergebnis = bereinigeOcrPaare([
        { frage: "Unit 3", antwort: "Vokabeln" },
        { frage: "Haus", antwort: "house" },
    ]);

    assert.deepEqual(ergebnis.paare, [{ frage: "Haus", antwort: "house" }]);
});

test("Feldnamen des Modells werden tolerant gelesen", () => {
    const ergebnis = bereinigeOcrPaare([
        { deutsch: "Haus", englisch: "house" },
        { word: "cat", translation: "Katze" },
    ]);

    assert.deepEqual(ergebnis.paare, [
        { frage: "Haus", antwort: "house" },
        { frage: "cat", antwort: "Katze" },
    ]);
});

test("Deutsch-Score erkennt Umlaute und Funktionswörter", () => {
    assert.ok(siehtDeutschAus("das Mädchen") >= 3);
    assert.ok(siehtDeutschAus("mit dem Hund") >= 3);
    assert.ok(siehtDeutschAus("house") < 1.5);
});

test("Vertauschte Seiten werden markiert, nicht gedreht", () => {
    const befunde = pruefePaare(
        [
            { frage: "house", antwort: "das Haus" },
            { frage: "dog", antwort: "der Hund" },
            { frage: "cat", antwort: "die Katze" },
        ],
        { sprache: "en" },
    );

    assert.equal(befunde.length, 3);
});

test("Bei Lernsprache Deutsch entfällt die Tauschwarnung", () => {
    const befunde = pruefePaare([{ frage: "maison", antwort: "das Haus" }], { sprache: "de" });
    assert.equal(befunde.length, 0);
});

test("Gleiche Antwort in vielen Zeilen gilt als Verdacht", () => {
    const befunde = pruefePaare([
        { frage: "Haus", antwort: "the" },
        { frage: "Baum", antwort: "the" },
        { frage: "Auto", antwort: "the" },
        { frage: "Hund", antwort: "dog" },
    ]);

    assert.ok(befunde.length >= 3);
});

test("Saubere Paare erzeugen keinen Befund", () => {
    const befunde = pruefePaare([
        { frage: "Haus", antwort: "house" },
        { frage: "Katze", antwort: "cat" },
        { frage: "Baum", antwort: "tree" },
    ]);

    assert.deepEqual(befunde, []);
});

test("Textblockimport verliert keine selbst geschriebenen Zeilen", () => {
    const ergebnis = normalisiereImport([
        { frage: "1. Haus", antwort: "house", beispiel: "" },
        { frage: "", antwort: "" , beispiel: "" },
        { frage: "Haus", antwort: "house", beispiel: "" },
    ]);

    assert.equal(ergebnis.leer, 1);
    assert.equal(ergebnis.doppelt, 1);
    assert.deepEqual(ergebnis.paare, [{ frage: "Haus", antwort: "house", beispiel: "" }]);
});

test("Höchstzahl wird eingehalten", () => {
    const viele = Array.from({ length: 200 }, (_, i) => ({ frage: `Wort${i}`, antwort: `word${i}` }));
    const ergebnis = bereinigeOcrPaare(viele, { maxPaare: 150 });
    assert.equal(ergebnis.paare.length, 150);
});
