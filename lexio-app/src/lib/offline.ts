/**
 * Offline-Ablage der App – Etappe 1–3 aus dem Plan („komplett offline").
 *
 * Was hier liegt, liegt im AsyncStorage (SQLite unter der Haube). Bewusst
 * keine eigene expo-sqlite-Datenbank: die Daten sind eine Handvoll JSON-
 * Dokumente (ein Set mit 1000 Karten sind rund 200 KB), und AsyncStorage ist
 * bereits fuer Design, Erinnerung und Sitzung im Einsatz. Ein zweiter
 * Speicher waere ein zweiter Ort, an dem etwas kaputtgehen kann.
 *
 * Drei Dinge:
 *
 *   1. Der Lesecache. `GET /api/karten?setSlug=` liefert alle Karten eines
 *      Sets mit dem eigenen Lernstand – genau das, was eine Offline-Runde
 *      braucht. Er wird bei jeder Runde im Hintergrund aufgefrischt.
 *   2. Der Rundenaufbau. Dieselben Regeln wie `app/api/lernen/route.ts`,
 *      mit den geteilten Konstanten aus `@lexio/lernlogik`. Ein Unterschied
 *      ist ehrlich benannt: die Schwierigkeits-Reihenfolge des Servers
 *      (trainiertes Modell) gibt es offline nicht, sortiert wird nach Stufe.
 *   3. Die Antwort-Queue. Antworten landen sofort lokal und werden
 *      nachgeschoben, sobald wieder Netz da ist.
 *
 * Die Fortschrittsregel (Stufe, Faelligkeit, Fehlerzaehler) ist die der
 * Datenbankfunktion `antwort_verbuchen` aus Migration 010: „nochmal" zaehlt
 * als Fehler, alles andere als Treffer.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  LEECH_FEHLER,
  MAX_KARTEN,
  MAX_WIEDERHOLUNG,
  faelligAb,
  stufeNachAntwort,
  type Bewertung,
} from "@lexio/lernlogik";
import type { LernAntwort, LernKarte, LernSetInfo } from "@lexio/types";

const SCHLUESSEL_SET = "lexio.offline.set.";
const SCHLUESSEL_LISTE = "lexio.offline.sets";
const SCHLUESSEL_QUEUE = "lexio.offline.antworten";

/** Eine Karte, wie `GET /api/karten?setSlug=` sie liefert. */
export type KartenListeKarte = {
  id: string;
  frage: string;
  antwort: string;
  beispielsatz: string;
  beispielUebersetzung: string;
  gelernt: boolean;
  stufe: number;
  fehler: number;
  faellig: boolean;
  /** Seit 2026-10-20: das Datum, nicht nur das Ja/Nein. */
  faelligAm: string | null;
};

export type KartenListe = { set: { slug: string; name: string }; karten: KartenListeKarte[] };

export type OfflineStand = {
  v: 1;
  set: LernSetInfo;
  karten: LernKarte[];
  /** Wann die Liste zuletzt vom Server kam (ISO). */
  gespeichert: string;
};

export type WartendeAntwort = {
  kartenId: string;
  bewertung: Bewertung;
  /** Nur fuer die Anzeige und zum Aufraeumen alter Eintraege. */
  zeitpunkt: string;
};

function heute(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ Cache */

/**
 * Karten und Set-Kopf ablegen. `setInfo` kommt aus der Lernrunde (dort steht
 * die Sprache mit Flaechenfarbe), `karten` aus `GET /api/karten`.
 */
export async function setCachen(
  setInfo: LernSetInfo,
  karten: KartenListeKarte[],
): Promise<OfflineStand> {
  const tag = heute();
  const stand: OfflineStand = {
    v: 1,
    set: setInfo,
    gespeichert: new Date().toISOString(),
    karten: karten.map((k) => ({
      id: k.id,
      frage: k.frage,
      antwort: k.antwort,
      beispielsatz: k.beispielsatz || null,
      beispielUebersetzung: k.beispielUebersetzung || null,
      stufe: k.stufe,
      gelernt: k.gelernt,
      // Nie beantwortet: sofort faellig – dieselbe Regel wie der coalesce
      // in der View (faellig_am ?? current_date).
      faelligAm: k.faelligAm ?? tag,
      leech: k.fehler >= LEECH_FEHLER,
      fehler: k.fehler,
    })),
  };
  try {
    await AsyncStorage.setItem(SCHLUESSEL_SET + setInfo.slug, JSON.stringify(stand));
  } catch {
    // Nicht speicherbar: die Runde laeuft trotzdem, nur eben nicht offline.
  }
  return stand;
}

export async function setAusCache(slug: string): Promise<OfflineStand | null> {
  try {
    const roh = await AsyncStorage.getItem(SCHLUESSEL_SET + slug);
    if (!roh) return null;
    const wert = JSON.parse(roh) as Partial<OfflineStand>;
    if (wert.v !== 1 || !wert.set || !Array.isArray(wert.karten)) return null;
    return wert as OfflineStand;
  } catch {
    return null;
  }
}

/** Die Set-Liste der Uebersicht – dieselbe Form wie `/api/karteikarten`. */
export async function listeCachen(daten: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(SCHLUESSEL_LISTE, JSON.stringify(daten));
  } catch {
    // Siehe setCachen.
  }
}

export async function listeAusCache<T>(): Promise<T | null> {
  try {
    const roh = await AsyncStorage.getItem(SCHLUESSEL_LISTE);
    if (!roh) return null;
    return JSON.parse(roh) as T;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------- Rundenaufbau */

/**
 * Eine Runde aus dem Cache bauen – die Regeln aus `app/api/lernen`:
 *
 *   normal   faellig (heute oder frueher), keine Problemskarte, max. 20
 *   ueben    alle Karten, max. 40
 *   leech    nur Problemskarten, max. 40
 *   quaelen  nur Karten im Minus (fehler >= 1), nach Fehlern absteigend, max. 40
 *
 * Sortiert wird nach Stufe, dann nach Faelligkeit, dann nach id – damit
 * dieselbe Runde zweimal gleich aussieht. Die Schwierigkeits-Reihenfolge des
 * Servers braucht ein trainiertes Modell ueber alle Karten des Kontos; das
 * gibt es offline nicht, und eine erfundene Reihenfolge waere schlechter als
 * eine erklaerbare.
 */
export function baueRunde(stand: OfflineStand, modus?: string): LernAntwort {
  const tag = heute();
  const alle = stand.karten.map((karte) => ({
    ...karte,
    leech: (karte.fehler ?? 0) >= LEECH_FEHLER,
  }));

  const sortiert = alle
    .slice()
    .sort(
      (a, b) =>
        a.stufe - b.stufe ||
        a.faelligAm.localeCompare(b.faelligAm) ||
        a.id.localeCompare(b.id),
    );

  const istLeech = (karte: LernKarte) => karte.leech === true;
  const istQuael = (karte: LernKarte) => (karte.fehler ?? 0) >= 1;
  const faellig = sortiert.filter((karte) => karte.faelligAm <= tag && !istLeech(karte));

  let karten: LernKarte[];
  if (modus === "quaelen") {
    karten = sortiert
      .filter(istQuael)
      .sort((a, b) => (b.fehler ?? 0) - (a.fehler ?? 0))
      .slice(0, MAX_WIEDERHOLUNG);
  } else if (modus === "leech") {
    karten = sortiert.filter(istLeech).slice(0, MAX_WIEDERHOLUNG);
  } else if (modus === "ueben") {
    karten = sortiert.slice(0, MAX_WIEDERHOLUNG);
  } else {
    karten = faellig.slice(0, MAX_KARTEN);
  }

  return {
    set: stand.set,
    karten,
    faelligGesamt: faellig.length,
    kartenGesamt: alle.length,
    leechAnzahl: sortiert.filter(istLeech).length,
    quaelAnzahl: sortiert.filter(istQuael).length,
    ...(modus === "ueben" ? { uebungsmodus: true } : {}),
    ...(modus === "leech" ? { leechModus: true } : {}),
    ...(modus === "quaelen" ? { quaelModus: true } : {}),
  };
}

/* --------------------------------------------------- Fortschritt + Queue */

/**
 * Verbucht eine Antwort lokal im Cache – dieselben Regeln wie die
 * Datenbankfunktion `antwort_verbuchen`. Gibt die neue Stufe zurueck.
 *
 * Der Cache ist die Wahrheit fuer die naechste Offline-Runde; weicht er vom
 * Server ab, gewinnt beim naechsten Verbinden der Server (die Queue wird
 * nachgeschoben, dann wird neu gelesen).
 */
export async function fortschrittLokal(
  slug: string,
  kartenId: string,
  bewertung: Bewertung,
): Promise<number | null> {
  const stand = await setAusCache(slug);
  if (!stand) return null;

  let neueStufe: number | null = null;
  const karten = stand.karten.map((karte) => {
    if (karte.id !== kartenId) return karte;
    const stufe = stufeNachAntwort(karte.stufe, bewertung);
    neueStufe = stufe;
    return {
      ...karte,
      stufe,
      gelernt: stufe >= 2,
      faelligAm: faelligAb(stufe),
      fehler: (karte.fehler ?? 0) + (bewertung === "nochmal" ? 1 : 0),
      leech: ((karte.fehler ?? 0) + (bewertung === "nochmal" ? 1 : 0)) >= LEECH_FEHLER,
    };
  });

  try {
    await AsyncStorage.setItem(
      SCHLUESSEL_SET + slug,
      JSON.stringify({ ...stand, karten } satisfies OfflineStand),
    );
  } catch {
    // Siehe setCachen.
  }
  return neueStufe;
}

export async function antwortMerken(kartenId: string, bewertung: Bewertung): Promise<void> {
  const liste = await wartendeAntworten();
  liste.push({ kartenId, bewertung, zeitpunkt: new Date().toISOString() });
  try {
    await AsyncStorage.setItem(SCHLUESSEL_QUEUE, JSON.stringify(liste));
  } catch {
    // Siehe setCachen.
  }
}

export async function wartendeAntworten(): Promise<WartendeAntwort[]> {
  try {
    const roh = await AsyncStorage.getItem(SCHLUESSEL_QUEUE);
    if (!roh) return [];
    const wert = JSON.parse(roh) as unknown;
    if (!Array.isArray(wert)) return [];
    return wert.filter(
      (eintrag): eintrag is WartendeAntwort =>
        typeof eintrag === "object" &&
        eintrag !== null &&
        typeof (eintrag as WartendeAntwort).kartenId === "string" &&
        typeof (eintrag as WartendeAntwort).bewertung === "string",
    );
  } catch {
    return [];
  }
}

async function queueSchreiben(liste: WartendeAntwort[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SCHLUESSEL_QUEUE, JSON.stringify(liste));
  } catch {
    // Siehe setCachen.
  }
}

/**
 * Schiebt wartende Antworten nach – in der Reihenfolge, in der sie gefallen
 * sind, weil der Server die Stufe aus dem eigenen Stand weiterrechnet. Eine
 * umsortierte Queue wuerde andere Stufen ergeben als die, die das Geraet
 * waehrend der Offline-Runde angezeigt hat.
 *
 * `senden` ist der Netzaufruf; er wird hereingereicht, damit diese Datei
 * nichts ueber die API wissen muss (und damit sie testbar bleibt).
 *
 * Rueckgabe: wie viele Antworten uebertragen wurden. Ein Netzfehler beendet
 * den Lauf still – die restlichen bleiben in der Queue. Ein Fehler des
 * Servers (400/404) verwirft den Eintrag: er wuerde nie besser werden.
 */
export async function antwortenNachschieben(
  senden: (kartenId: string, bewertung: Bewertung) => Promise<void>,
): Promise<number> {
  const liste = await wartendeAntworten();
  if (liste.length === 0) return 0;

  let uebertragen = 0;
  const rest: WartendeAntwort[] = [];
  let netzWeg = false;

  for (const eintrag of liste) {
    if (netzWeg) {
      rest.push(eintrag);
      continue;
    }
    try {
      await senden(eintrag.kartenId, eintrag.bewertung);
      uebertragen += 1;
    } catch (fehler: unknown) {
      const status =
        typeof fehler === "object" && fehler !== null && "status" in fehler
          ? (fehler as { status?: unknown }).status
          : undefined;
      if (status === 0) {
        // Weiterhin kein Netz: alles Weitere bleibt liegen.
        netzWeg = true;
        rest.push(eintrag);
      } else {
        // Der Server will diese Antwort nicht (geloeschte Karte, kaputte
        // Bewertung). Nochmal senden wuerde es nicht besser machen.
        console.warn(`[offline] Antwort verworfen: ${String(fehler)}`);
      }
    }
  }

  await queueSchreiben(rest);
  return uebertragen;
}
