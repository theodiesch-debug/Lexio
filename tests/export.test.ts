/**
 * Tests fuer lib/export.ts – dem Formatierer für CSV und TSV.
 *
 * Warum: das sind genau die Fehler, die in der Handprobe nicht auffallen und
 * erst beim Import in Anki, Quizlet oder Excel sichtbar werden. Ein
 * Beispielsatz mit Semikolon zerlegt die CSV-Zeile in drei Felder; ein Tab
 * im TSV-Feld erzeugt in Anki eine sechste Spalte. Beides sieht auf dem
 * Bildschirm trotzdem wie ein sauberer Export aus.
 *
 * Aufruf: `npm test`
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  UTF8_BOM,
  exportDateiname,
  exportMimeType,
  exportText,
  type ExportPaar,
} from "../lib/export";

const PAAR: ExportPaar = {
  frage: "Bahnhof",
  antwort: "station",
  beispielsatz: "Der Bahnhof ist nah.",
  beispielUebersetzung: "The station is close.",
};

test("CSV trennt mit Semikolon und hat keine Kopfzeile", () => {
  const text = exportText([PAAR], "csv");
  assert.equal(text, `${UTF8_BOM}Bahnhof;station;Der Bahnhof ist nah.;The station is close.\r\n`);
});

test("TSV trennt mit Tab und LF", () => {
  const text = exportText([PAAR], "tsv");
  assert.equal(text, `${UTF8_BOM}Bahnhof\tstation\tDer Bahnhof ist nah.\tThe station is close.\n`);
});

test("die BOM steht am Anfang, damit Excel UTF-8 erkennt", () => {
  for (const format of ["csv", "tsv"] as const) {
    assert.ok(exportText([PAAR], format).startsWith(UTF8_BOM), format);
  }
});

test("ein Semikolon im Feld zerlegt die Zeile nicht", () => {
  const text = exportText(
    [{ ...PAAR, beispielsatz: "Bahnhof; Hotel; Flughafen" }],
    "csv",
  );
  const zeile = text.slice(UTF8_BOM.length).trimEnd();

  /*
   * Einfach auf ";" splitten ist hier falsch: das gequotete Feld enthält
   * ja drei Semikolons, und die gehören NICHT zu den Trennern. Deshalb
   * ein kleiner Splitter, der Quotes mitliest – genau so wird auch Excel
   * die Zeile lesen, und genau das ist der Punkt des Tests.
   */
  const felder: string[] = [];
  let aktuell = "";
  let inQuotes = false;
  for (let i = 0; i < zeile.length; i += 1) {
    const zeichen = zeile[i];
    if (zeichen === '"') {
      if (inQuotes && zeile[i + 1] === '"') {
        aktuell += '"';
        i += 1;
      } else inQuotes = !inQuotes;
    } else if (zeichen === ";" && !inQuotes) {
      felder.push(aktuell);
      aktuell = "";
    } else aktuell += zeichen;
  }
  felder.push(aktuell);

  assert.equal(felder.length, 4, JSON.stringify(felder));
  assert.equal(felder[2], "Bahnhof; Hotel; Flughafen");
});

test("Anführungszeichen im CSV-Feld werden verdoppelt", () => {
  const text = exportText([{ ...PAAR, antwort: 'say "hallo"' }], "csv");
  assert.ok(text.includes('say ""hallo""'), text);
});

test("ein Zeilenumbruch im CSV-Feld bleibt erhalten und wird gequotet", () => {
  const text = exportText([{ ...PAAR, beispielsatz: "Erste Zeile.\nZweite Zeile." }], "csv");
  // Ohne Quotes waeren das zwei Zeilen und damit zwei Karten.
  const zeilen = text.slice(UTF8_BOM.length).trimEnd().split("\r\n");
  assert.equal(zeilen.length, 1);
  assert.ok(zeilen[0].includes('"Erste Zeile.\nZweite Zeile."'), zeilen[0]);
});

test("Tabs und Zeilenumbrüche im TSV-Feld werden zu Leerzeichen", () => {
  const text = exportText(
    [{ ...PAAR, beispielsatz: "Ein\tTab\nund ein Umbruch" }],
    "tsv",
  );
  const zeilen = text.slice(UTF8_BOM.length).trimEnd().split("\n");
  assert.equal(zeilen.length, 1, "aus dem Umbruch darf keine zweite Zeile werden");
  assert.equal(zeilen[0].split("\t").length, 4, "aus dem Tab darf keine fünfte Spalte werden");
  assert.ok(zeilen[0].includes("Ein Tab und ein Umbruch"), zeilen[0]);
});

test("leere Felder bleiben leer, ohne Anführungszeichen", () => {
  const text = exportText([{ frage: "Hund", antwort: "dog" }], "csv");
  assert.equal(text, `${UTF8_BOM}Hund;dog;;\r\n`);
});

test("eine leere Liste liefert nur die BOM", () => {
  // Ein File ohne Inhalt ist ehrlicher als eine Zeile mit vier leeren
  // Feldern – das sähe aus, als wäre eine Karte exportiert worden.
  assert.equal(exportText([], "csv"), UTF8_BOM);
  assert.equal(exportText([], "tsv"), UTF8_BOM);
});

test("Umlaute und Sonderzeichen kommen unverändert durch", () => {
  const text = exportText([{ frage: "die Überschneidung", antwort: "overlap" }], "csv");
  assert.ok(text.includes("Überschneidung"), text);
  // Die BOM ist U+FEFF, nicht ASCII – der Rest bleibt UTF-8.
  assert.equal(text.codePointAt(0), 0xfeff);
});

test("viele Paare ergeben viele Zeilen", () => {
  const viele = Array.from({ length: 25 }, (_, i) => ({
    frage: `Wort ${i}`,
    antwort: `word ${i}`,
  }));
  const zeilen = exportText(viele, "csv").slice(UTF8_BOM.length).trimEnd().split("\r\n");
  assert.equal(zeilen.length, 25);
  assert.ok(zeilen[24].startsWith("Wort 24;word 24"), zeilen[24]);
});

test("der Dateiname folgt dem Slug und bleibt ASCII", () => {
  assert.equal(exportDateiname("italienisch-urlaub", "csv"), "italienisch-urlaub.csv");
  assert.equal(exportDateiname("italienisch-urlaub", "tsv"), "italienisch-urlaub.tsv");
});

test("der Dateiname verträgt auch einen Namen ohne Slug-Charaktere", () => {
  // Notausgang: wenn der Slug aus nicht-ASCII besteht, darf der Dateiname
  // nicht leer werden – ein Download ohne Namen landet im Nirgendwo.
  assert.equal(exportDateiname("日本語", "csv"), "export.csv");
  assert.equal(exportDateiname("--", "tsv"), "export.tsv");
});

test("die MIME-Typen passen zu den Formaten", () => {
  assert.equal(exportMimeType("csv"), "text/csv; charset=utf-8");
  assert.equal(exportMimeType("tsv"), "text/tab-separated-values; charset=utf-8");
});
