/**
 * Export von Wortpaaren als Text – CSV für Excel, TSV für Anki und Quizlet.
 *
 * Warum eine eigene Datei und kein Template in der Route: die Formatierung
 * hat Fallstricke, die nichts mit Supabase zu tun hat und die man deshalb
 * testen können muss, ohne eine Datenbank anzuziehen. Ein Semikolon in einem
 * Beispielsatz zerlegt eine CSV-Zeile in drei Felder, und ein Tab in einem
 * TSV-Feld bekommt in Anki eine eigene Spalte. Beides fällt in der Handprobe
 * nicht auf und taucht erst bei Import auf – als „Warum steht da ein Wort in
 * der falschen Spalte?".
 *
 * Spaltenreihenfolge, in beiden Formaten gleich:
 *
 *   1. Vorderseite (das deutsche Wort)
 *   2. Rückseite (das Fremdwort)
 *   3. Beispielsatz
 *   4. Übersetzung des Beispielsatzes
 *
 * Erste zwei Spalten sind die, die Anki und Quizlet erwarten. Die Sätze
 * stehen dahinter, weil sie in einem Import meistens nicht gebraucht werden –
 * aber auch nicht fehlen dürfen, wenn doch.
 *
 * Bewusst KEINE Kopfzeile. Anki macht aus der ersten Zeile eine Karte und
 * Quizlet auch, und „frage;antwort" als Vokabel ist niemandes Ziel. Wer eine
 * Kopfzeile will, hat sie in Excel mit zwei Klicks oben drin.
 */

/** Ein Wortpaar, wie es der Export entgegennimmt. */
export type ExportPaar = {
  frage: string;
  antwort: string;
  beispielsatz?: string | null;
  beispielUebersetzung?: string | null;
};

export type ExportFormat = "csv" | "tsv";

/** Zeilenumbruch in CSV: Windows-CR-LF, weil Excel sonst die letzze Zeile klebt. */
const ZEILE_CSV = "\r\n";

/** Zeilenumbruch in TSV: LF, wie Anki, Quizlet und die Unix-Welt es erwarten. */
const ZEILE_TSV = "\n";

/**
 * Das Zeichen am Zeilenanfang, das Excel braucht, um UTF-8 zu erkennen.
 *
 * Ohne diese drei Bytes liest die deutsche Excel-Version „schön" als
 * „schÃ¶n" – die Umlaute der importierten Wörter sind also genau die
 * Stelle, an der der Export auffällt. Sie kostet drei Bytes und erspart
 * die erste Supportfrage.
 */
export const UTF8_BOM = "﻿";

/** Trennzeichen, die eine CSV-Zeile zerlegen würden. */
const ZERLEGEND_CSV = /[;\n\r"]/;

function feldCsv(wert: string): string {
  // Gequotet wird nur, was es nötig macht. Alles andere zu quoten wäre
  // gültig, aber unleserlich – und Excel zeigt die Anführungszeichen dann
  // trotzdem nicht an, was es schwerer macht, den Export zu prüfen.
  if (!ZERLEGEND_CSV.test(wert)) return wert;
  return `"${wert.replace(/"/g, '""')}"`;
}

/**
 * Ein Feld für TSV. Tabs und Zeilenumbrüche werden zu einem Leerzeichen.
 *
 * Anki hat keinen Quoting-Mechanismus im einfachen Import: es splittet auf
 * dem Tab und fertig. Ein Tab im Feld würde also eine sechste Spalte
 * erzeugen, und ein Zeilenumbruch eine zweite Karte. Beides still – der
 * Import sieht erfolgreich aus und ist falsch. Ein Leerzeichen ist der
 * ehrliche Kompromiss: der Satz bleibt lesbar, die Spalte bleibt eine.
 */
function feldTsv(wert: string): string {
  return wert.replace(/[\t\n\r]+/g, " ").trim();
}

/**
 * Formatiert die Paare im gewählten Format – inklusive BOM.
 *
 * Leere Felder bleiben leer und werden nicht zu einem Leerstring mit
 * Anführungszeichen; ein Export einer Liste ohne Beispielsätze soll nicht
 * aussehen, als hätte jemand Absicht.
 */
export function exportText(karten: ExportPaar[], format: ExportFormat): string {
  const zeile = format === "csv" ? ZEILE_CSV : ZEILE_TSV;
  const feld = format === "csv" ? feldCsv : feldTsv;

  const zeilen = karten.map((karte) =>
    [
      feld(karte.frage ?? ""),
      feld(karte.antwort ?? ""),
      feld(karte.beispielsatz ?? ""),
      feld(karte.beispielUebersetzung ?? ""),
    ].join(format === "csv" ? ";" : "\t"),
  );

  return UTF8_BOM + zeilen.join(zeile) + (zeilen.length > 0 ? zeile : "");
}

/**
 * Der Dateiname, den der Browser speichert.
 *
 * Der Slug ist aus Buchstaben, Ziffern und Bindestrichen (siehe
 * lib/set-slug.ts), also ASCII – `filename` braucht keine
 * `filename*-Kodierung`. Ein Set, dessen Name Umlaute hat, exportiert
 * trotzdem unter seinem Slug.
 */
export function exportDateiname(slug: string, format: ExportFormat): string {
  const basis = slug.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "export";
  return `${basis}.${format}`;
}

/** Der MIME-Typ, den der Browser für das Format erwartet. */
export function exportMimeType(format: ExportFormat): string {
  return format === "csv" ? "text/csv; charset=utf-8" : "text/tab-separated-values; charset=utf-8";
}
