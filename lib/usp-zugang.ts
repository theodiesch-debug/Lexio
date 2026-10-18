/*
 * Zugang zur USP-Seite `/vokabeln-aus-text`.
 *
 * Das Problem
 * -----------
 * Die Seite soll gebaut werden, bevor sie existieren darf. Nicht aus
 * Sparsamkeit, sondern weil eine neue, oeffentliche Seite etwas ist, das
 * niemand rueckgaengig machen kann, sobald sie indexiert ist: der Google-
 * Cache, gespeicherte Ergebnisse, geteilte Links. Deshalb steht zwischen
 * „fertig" und „fuer alle sichtbar" ein Schalter, und der Schalter ist
 * standardmaessig AUS.
 *
 * Die drei Stufen
 * ---------------
 *   aus      – niemand sieht die Seite, sie antwortet mit 404 (Vorgabe)
 *   vorschau – nur mit dem richtigen Schluessel in `?vorschau=…`, immer
 *              noindex, damit nichts in die Suche gerät
 *   offen    – fuer alle und indexierbar. Das ist die Freigabe.
 *
 * Was hier bewusst NICHT passiert
 * -------------------------------
 * Kein Cookie. Ein Cookie muesste in einem Route-Handler gesetzt werden,
 * waehrend die Seite selbst nur liest – zwei Stellen fuer einen Zustand,
 * der in einem Satz beschrieben ist. Die Vorschau haelt sich an der URL,
 * und die Seite ist genau eine: es gibt nichts, auf dem man sich verlaufen
 * koennte.
 *
 * Kein Raten. Der Vergleich laeuft ueber SHA-256 und `timingSafeEqual`,
 * damit die Laufzeit nichts verrät. Das ist fuer einen Vorschau-Schluessel
 * uebertrieben – aber teurer wird es auch nicht, und „uebertrieben" ist die
 * bessere Richtung als „genug".
 *
 * Ohne React und ohne Next, wie `lernlogik.ts` und `einzelimport.ts`:
 * reine Funktionen, damit die Regel ohne Server geprueft werden kann.
 */

import { createHash, timingSafeEqual } from "node:crypto";

/** Ergebnis der Zugangspruefung. */
export type UspZugang = {
  /** Darf der Besucher die Seite sehen? */
  sichtbar: boolean;
  /** Darf die Seite von Suchmaschinen aufgenommen werden? */
  indexieren: boolean;
};

/** Der Zustand, der ohne jeden weiteren Wert gilt. */
export const USP_WEG: UspZugang = { sichtbar: false, indexieren: false };

/**
 * Unterste Schluessellaenge.
 *
 * Ein kuerzerer Wert waere mit dem Rate-Limit des Proxys immer noch nicht
 * ratbar, aber ein Schluessel wie `test` waerde die Seite fuer jeden
 * oeffentlich machen, der es probiert. Wer zu kurz konfiguriert, bekommt
 * 404 statt einer halb offenen Seite.
 */
export const MIN_SCHLUESSEL = 8;

/** Werte, die `USP_ZUGANG` annehmen darf. */
export const USP_STUFEN = ["aus", "vorschau", "offen"] as const;

function stimmt(ziel: string, mitgebracht: string): boolean {
  // Beide Seiten hashen, bevor verglichen wird: `timingSafeEqual` verlangt
  // gleiche Laenge, und ein Unterschied in der Laenge waere sonst sofort
  // und ohne Timing-Angriff sichtbar.
  const a = createHash("sha256").update(ziel, "utf8").digest();
  const b = createHash("sha256").update(mitgebracht, "utf8").digest();
  return timingSafeEqual(a, b);
}

/**
 * Prueft, ob die USP-Seite in dieser Anfrage sichtbar sein darf.
 *
 * @param umgebung.zugang Wert aus `USP_ZUGANG`
 * @param umgebung.schluessel Wert aus `USP_VORSCHAU_TOKEN`
 * @param umgebung.mitgebrachterSchluessel Wert aus `?vorschau=…`
 *
 * Alles, was nicht eindeutig zusammenpasst, ergibt `USP_WEG`. Der
 * Schluessel darf auch dann nicht durchreichen, wenn `USP_ZUGANG` gar
 * nicht gesetzt ist – Vorschau und Freigabe sind zwei getrennte
 * Entscheidungen.
 */
export function beurteileUspZugang(umgebung: {
  zugang: string | undefined;
  schluessel: string | undefined;
  mitgebrachterSchluessel: string | undefined;
}): UspZugang {
  const zugang = umgebung.zugang?.trim().toLowerCase();

  if (zugang === "offen") {
    return { sichtbar: true, indexieren: true };
  }

  if (zugang === "vorschau") {
    // Beide Seiten trimmen: ein Zeilenumbruch am Ende einer .env-Zeile oder
    // ein kopiertes Leerzeichen duerfen nicht den Unterschied zwischen 404
    // und sichtbar machen.
    const schluessel = umgebung.schluessel?.trim();
    const mitgebracht = umgebung.mitgebrachterSchluessel?.trim();
    if (!schluessel || schluessel.length < MIN_SCHLUESSEL) return USP_WEG;
    if (!mitgebracht) return USP_WEG;
    if (!stimmt(schluessel, mitgebracht)) return USP_WEG;
    return { sichtbar: true, indexieren: false };
  }

  return USP_WEG;
}
