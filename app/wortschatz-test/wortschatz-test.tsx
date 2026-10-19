"use client";

/**
 * Der Wortschatz-Test – die interaktive Seite hinter /wortschatz-test.
 *
 * Ablauf: Start -> 25 Wörter (5 je Frequenzband) -> Schätzung.
 *
 * Warum die Datei erst beim Start geholt wird
 * -------------------------------------------
 * `public/wortschatz-test.json` ist 81 kB. Wer die Seite nur liest und sich
 * gegen den Test entscheidet, soll sie nicht herunterladen. Deshalb holt der
 * Start-Knopf die Datei, nicht das Laden der Seite.
 *
 * Warum keine Antwort bewertet wird
 * ----------------------------------
 * Es gibt keine Übersetzungsmaschine auf dieser Seite. Man entscheidet
 * selbst, ob man ein Wort kennt – und weil das so ist, steht auf dem
 * Ergebnis hinterher, dass es eine Selbsteinschätzung ist und keine Messung.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  baueTestreihe,
  schaetzeWortschatz,
  zahl,
  type BandErgebnis,
  type Testaufgabe,
  type WortschatzDaten,
} from "@/lib/wortschatz-test";
import styles from "./wortschatz-test.module.css";

/** Wörter je Frequenzband. 5 mal 5 Bänder – in gut zwei Minuten zu schaffen. */
const PRO_BAND = 5;

type Phase = "start" | "laedt" | "test" | "ende" | "fehler";

export default function WortschatzTest() {
  const [phase, setPhase] = useState<Phase>("start");
  const [daten, setDaten] = useState<WortschatzDaten | null>(null);
  const [reihe, setReihe] = useState<Testaufgabe[]>([]);
  const [index, setIndex] = useState(0);
  const [antworten, setAntworten] = useState<boolean[]>([]);

  const kartenRef = useRef<HTMLDivElement | null>(null);
  const ergebnisRef = useRef<HTMLHeadingElement | null>(null);

  const starten = useCallback(async () => {
    setPhase("laedt");
    try {
      const antwort = await fetch("/wortschatz-test.json", { cache: "force-cache" });
      if (!antwort.ok) throw new Error(String(antwort.status));
      const geladen = (await antwort.json()) as WortschatzDaten;
      if (!Array.isArray(geladen.baender) || geladen.baender.length === 0) {
        throw new Error("leer");
      }
      setDaten(geladen);
      setReihe(baueTestreihe(geladen, PRO_BAND));
      setIndex(0);
      setAntworten([]);
      setPhase("test");
    } catch {
      setPhase("fehler");
    }
  }, []);

  const antworten_ = useCallback(
    (gekannt: boolean) => {
      setAntworten((alt) => {
        const neu = [...alt];
        neu[index] = gekannt;
        return neu;
      });
      if (index + 1 >= reihe.length) {
        setPhase("ende");
      } else {
        setIndex((i) => i + 1);
      }
    },
    [index, reihe.length],
  );

  // Tastatur wie in der Lernrunde: 1 kennt es, 2 kennt es nicht.
  useEffect(() => {
    if (phase !== "test") return;
    const aufTaste = (e: KeyboardEvent) => {
      if (e.key === "1") antworten_(true);
      if (e.key === "2") antworten_(false);
    };
    window.addEventListener("keydown", aufTaste);
    return () => window.removeEventListener("keydown", aufTaste);
  }, [phase, antworten_]);

  // Fokus mitnehmen, wenn eine neue Phase beginnt – sonst steht der Fokus
  // nach dem Klick auf einem Knopf, den es nicht mehr gibt.
  useEffect(() => {
    if (phase === "test") kartenRef.current?.focus();
    if (phase === "ende") ergebnisRef.current?.focus();
  }, [phase]);

  /**
   * Ergebnis aus den Antworten. Läuft nur im Endschirm, ist dann also billig.
   * Die Zuordnung Wort -> Band kommt aus `reihe`, nicht aus dem Index in
   * `antworten`: die Reihenfolge der Aufgaben ist die Anzeige, die Bänder
   * bleiben die Wahrheit.
   */
  const ergebnis = useMemo(() => {
    if (!daten || phase !== "ende") return null;
    const proBand = new Map<string, { getestet: number; gekannt: number }>();
    reihe.forEach((aufgabe, i) => {
      const stand = proBand.get(aufgabe.bandName) ?? { getestet: 0, gekannt: 0 };
      stand.getestet += 1;
      if (antworten[i]) stand.gekannt += 1;
      proBand.set(aufgabe.bandName, stand);
    });
    const ergebnisse: BandErgebnis[] = daten.baender.map((band) => {
      const stand = proBand.get(band.name) ?? { getestet: 0, gekannt: 0 };
      return {
        name: band.name,
        titel: band.titel,
        groesse: band.groesse,
        getestet: stand.getestet,
        gekannt: stand.gekannt,
      };
    });
    return schaetzeWortschatz(ergebnisse);
  }, [daten, phase, reihe, antworten]);

  if (phase === "start" || phase === "laedt" || phase === "fehler") {
    return (
      <div className={styles.kasten}>
        <p className={styles.hinweisKlein}>Selbsteinschätzung, kein Multiple-Choice</p>
        <h2 className={styles.kastenTitel}>25 Wörter, etwa zwei Minuten</h2>
        <p className={styles.kastenText}>
          Du siehst nacheinander 25 englische Wörter aus fünf Häufigkeitsstufen und entscheidest
          bei jedem: kenne ich, oder kenne ich nicht. Am Ende steht eine Schätzung, wie groß dein
          Wortschatz ist – aufgeschlüsselt nach Stufen.
        </p>
        <p className={styles.kastenText}>
          Es gibt kein Richtig oder Falsch und keine Punkte. Nur du weißt, ob dir ein Wort
          geläufig ist.
        </p>
        <button
          type="button"
          className={styles.startKnopf}
          onClick={starten}
          disabled={phase === "laedt"}
        >
          {phase === "laedt" ? "Wörter werden geladen …" : "Test starten"}
        </button>
        {phase === "fehler" && (
          <p className={styles.fehler} role="alert">
            Die Wortliste ließ sich nicht laden. Prüf die Verbindung und versuch es nochmal.
          </p>
        )}
      </div>
    );
  }

  if (phase === "test") {
    const aufgabe = reihe[index];
    const fortschritt = Math.round((index / reihe.length) * 100);
    return (
      <div className={styles.kasten}>
        <div className={styles.fortschritt}>
          <div
            className={styles.fortschrittBalken}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={reihe.length}
            aria-valuenow={index}
            aria-label="Fortschritt im Test"
          >
            <div className={styles.fortschrittFuellung} style={{ width: `${fortschritt}%` }} />
          </div>
          <span className={styles.fortschrittText}>
            {index + 1} / {reihe.length}
          </span>
        </div>

        <div className={styles.karte} ref={kartenRef} tabIndex={-1}>
          <p className={styles.karteFrage} aria-live="polite">
            {aufgabe.wort.frage}
          </p>
          <p className={styles.karteAuftrag}>Kennst du dieses Wort?</p>
        </div>

        <div className={styles.antworten}>
          <button type="button" className={styles.ja} onClick={() => antworten_(true)}>
            Kenne ich
            <span className={styles.taste}>1</span>
          </button>
          <button type="button" className={styles.nein} onClick={() => antworten_(false)}>
            Kenn ich nicht
            <span className={styles.taste}>2</span>
          </button>
        </div>
      </div>
    );
  }

  // Endschirm
  if (!ergebnis) return null;
  const prozent = ergebnis.gesamtGroesse > 0 ? ergebnis.geschaetzt / ergebnis.gesamtGroesse : 0;

  return (
    <div className={styles.kasten}>
      <h2 className={styles.ergebnisTitel} ref={ergebnisRef} tabIndex={-1}>
        Etwa <strong>{zahl(ergebnis.geschaetzt)}</strong> Wörter
      </h2>
      <p className={styles.ergebnisUnterzeile}>
        von {zahl(ergebnis.gesamtGroesse)} Wörtern dieser Liste – geschätzt aus{" "}
        {ergebnis.getestet} Stichproben, {ergebnis.gekannt} davon bekannt.
      </p>

      <div className={styles.gesamtbalken} aria-hidden="true">
        <div className={styles.gesamtfuellung} style={{ width: `${Math.round(prozent * 100)}%` }} />
      </div>

      <ul className={styles.baender}>
        {ergebnis.baender.map((band) => (
          <li key={band.name} className={styles.band}>
            <div className={styles.bandKopf}>
              <span className={styles.bandTitel}>{band.titel}</span>
              <span className={styles.bandWert}>
                {band.gekannt} / {band.getestet}
              </span>
            </div>
            <div className={styles.bandBalken} aria-hidden="true">
              <div
                className={styles.bandFuellung}
                style={{ width: `${Math.round(band.anteil * 100)}%` }}
              />
            </div>
            <p className={styles.bandSchaetzung}>
              {band.geschaetzt === null
                ? "nicht getestet"
                : `geschätzt ${zahl(band.geschaetzt)} von ${zahl(band.groesse)}`}
            </p>
          </li>
        ))}
      </ul>

      <p className={styles.ehrlich}>
        Das ist eine Selbsteinschätzung aus je {PRO_BAND} Wörtern pro Stufe – ein Anhaltspunkt,
        keine Messung. Wer mag, wiederholt den Test: es kommen andere Wörter.
      </p>

      <div className={styles.ergebnisAktionen}>
        <button type="button" className={styles.startKnopf} onClick={starten}>
          Nochmal
        </button>
        <a className={styles.leiseKnopf} href="/anmelden">
          Konto anlegen
        </a>
      </div>
      <p className={styles.quelle}>
        Wortlisten: NGSL unter CC BY-SA, aufbereitet für Lexio –{" "}
        <a href="/quellen">woher die Wörter kommen</a>.
      </p>
    </div>
  );
}
