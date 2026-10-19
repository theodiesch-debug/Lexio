/**
 * Wortschatz-Test: Stichprobe ziehen und hochrechnen.
 *
 * Die Idee in einem Satz: aus jedem Frequenzband 5 Wörter zeigen, zählen,
 * wie viele jemand kennt, und die Quote auf das ganze Band hochrechnen.
 *
 * Warum überhaupt hochrechnen
 * ---------------------------
 * Alle 2039 Wörter abzufragen wäre kein Test mehr, sondern Arbeit. Eine
 * Stichprobe von 5 aus 97 bis 677 Wörtern schätzt die Quote grob, aber der
 * Fehler ist ehrlicher als das, was sonst üblich ist: eine glatte Zahl ohne
 * Herkunft. Deshalb nennt die Seite die Stichprobengröße mit, statt ein
 * Ergebnis als Messung auszugeben.
 *
 * Was hier NICHT passiert: keine Antwort wird als richtig oder falsch
 * bewertet. Es gibt keinen Abgleich mit einer Übersetzung – man kennt ein
 * Wort oder nicht, und das entscheidet man selbst. Das ist Absicht: eine
 * automatische Bewertung würde eine Übersetzungsmaschine brauchen, und
 * deren Antworten wären nicht besser als die eigene Einschätzung.
 */

export type WortschatzWort = {
  frage: string;
  antwort: string;
};

export type WortschatzBand = {
  name: string;
  titel: string;
  /** Anzahl der Wörter nach dem Deduplizieren – die Größe der Menge. */
  groesse: number;
  woerter: WortschatzWort[];
};

export type WortschatzDaten = {
  erzeugt: string;
  quelle: string;
  gesamt: number;
  baender: WortschatzBand[];
};

/** Eine gezogene Aufgabe: das Wort und das Band, aus dem es stammt. */
export type Testaufgabe = {
  bandName: string;
  wort: WortschatzWort;
};

/**
 * Zieht `anzahl` zufällige Einträge, ohne ein Element doppelt zu nehmen.
 *
 * Teilweiser Fisher-Yates: nur die ersten `anzahl` Plätze werden gemischt,
 * der Rest bleibt, wie er war. Ein volles Mischen und danach `slice` wäre
 * genauso richtig, aber unnötig – bei 677 Wörtern und 5 gezogenen werden
 * 672 Elemente umsonst bewegt.
 *
 * `zufall` ist injizierbar, damit die Tests mit einem festen Generator
 * eine feste Ziehung bekommen und nicht bei jedem Lauf wackeln.
 */
export function stichprobe<T>(liste: readonly T[], anzahl: number, zufall: () => number = Math.random): T[] {
  const kopie = [...liste];
  const n = Math.max(0, Math.min(anzahl, kopie.length));
  for (let i = 0; i < n; i += 1) {
    const j = i + Math.floor(zufall() * (kopie.length - i));
    const merker = kopie[i];
    kopie[i] = kopie[j];
    kopie[j] = merker;
  }
  return kopie.slice(0, n);
}

/**
 * Baut die Reihenfolge des Tests: aus jedem Band `proBand` Wörter.
 *
 * Die Bänder kommen in ihrer Reihenfolge (häufig zuerst), innerhalb eines
 * Bandes wird gezogen. Damit beginnt der Test mit den häufigen Wörtern –
 * die Wahrscheinlichkeit, dass jemand bei Wort 1 schon aufgibt, ist dort
 * am kleinsten.
 *
 * Die Bänder werden NICHT gemischt: wer weiß, dass die letzten Wörter die
 * seltenen sind, antwortet ehrlicher, als wenn er über jedes Wort erst
 * nachdenken muss, aus welcher Ecke es kommt. Die Karte verrät das Band
 * aber nicht – man sieht nur das Wort.
 */
export function baueTestreihe(
  daten: WortschatzDaten,
  proBand: number,
  zufall: () => number = Math.random,
): Testaufgabe[] {
  const reihe: Testaufgabe[] = [];
  for (const band of daten.baender) {
    for (const wort of stichprobe(band.woerter, proBand, zufall)) {
      reihe.push({ bandName: band.name, wort });
    }
  }
  return reihe;
}

/** Was der Test pro Band gezählt hat. */
export type BandErgebnis = {
  name: string;
  titel: string;
  groesse: number;
  getestet: number;
  gekannt: number;
};

export type BandSchaetzung = BandErgebnis & {
  /** Anteil der bekannten Wörter, 0 bis 1. */
  anteil: number;
  /**
   * Hochgerechnet auf das ganze Band. `null`, wenn aus diesem Band nichts
   * getestet wurde – eine Null würde eine Nicht-Aussage als Aussage tarnen.
   */
  geschaetzt: number | null;
};

export type Schaetzung = {
  baender: BandSchaetzung[];
  /** Summe der geschätzten Wörter über die getesteten Bänder. */
  geschaetzt: number;
  /** Summe der Bandgrößen über die getesteten Bänder. */
  gesamtGroesse: number;
  getestet: number;
  gekannt: number;
};

/**
 * Rechnet die Stichprobe auf die Bänder hoch.
 *
 * Pro Band: `groesse × gekannt / getestet`. Gerundet wird pro Band, nicht
 * erst am Ende: die Zahl, die in der Anzeige neben dem Band steht, ist
 * dieselbe, aus der die Summe gebildet wird. Sonst ärgert sich jemand, dass
 * die Einzelwerte nicht die Summe ergeben.
 */
export function schaetzeWortschatz(ergebnisse: readonly BandErgebnis[]): Schaetzung {
  const baender: BandSchaetzung[] = ergebnisse.map((e) => {
    const anteil = e.getestet > 0 ? e.gekannt / e.getestet : 0;
    return {
      ...e,
      anteil,
      geschaetzt: e.getestet > 0 ? Math.round(e.groesse * anteil) : null,
    };
  });

  const getestet = baender.reduce((s, b) => s + b.getestet, 0);
  const gekannt = baender.reduce((s, b) => s + b.gekannt, 0);
  const geschaetzt = baender.reduce((s, b) => s + (b.geschaetzt ?? 0), 0);
  const gesamtGroesse = baender.reduce((s, b) => s + (b.geschaetzt === null ? 0 : b.groesse), 0);

  return { baender, geschaetzt, gesamtGroesse, getestet, gekannt };
}

/**
 * Formatiert eine Zahl im deutschen Format mit Tausenderpunkt.
 *
 * `Intl` ist im Browser und in Node da, aber die Ausgabe soll sich nicht je
 * nach Umgebung unterscheiden – deshalb fest `de-DE`.
 */
export function zahl(n: number): string {
  return new Intl.NumberFormat("de-DE").format(n);
}
