"use client";

/*
 * Das Werkzeug der USP-Seite: Text einsehen, Karten entstehen sehen.
 *
 * Alles laeuft hier im Browser. Das ist keine Optimierung, sondern die
 * Bedingung unter der diese Seite gebaut wurde: ein Besucher ohne Konto
 * soll seine Wortliste ausprobieren koennen, ohne dass sein Text irgendwo
 * ankommt. Kein POST, kein Token, kein Konto – die Parser in `lib/` sind
 * reines TypeScript und brauchen dafuer keinen Server.
 *
 * Damit haelt die Seite auch dann, was sie sagt, wenn das Backend gerade
 * nicht erreichbar waere: es gibt nichts, was erreichbar sein muesste.
 *
 * Der Parser ist getestet (`tests/einzelimport.test.ts`, 18 Tests;
 * `tests/datei-import.test.ts`, 35 Tests). Hier liegt keine Logik dazu,
 * nur die Anbindung – die Faelle stehen in `lib/`, nicht in der
 * Oberflaeche.
 */

import { useEffect, useState } from "react";
import {
  dateiEinlesen,
  dateiZuGross,
  groesseText,
  istTextdatei,
} from "@/lib/datei-import";
import { meldungFuer, textblockEinlesen, type EinzelErgebnis } from "@/lib/einzelimport";
import styles from "./vokabeln-aus-text.module.css";

/*
 * Ein kleines, sauberes Beispiel. Bewusst so gewaehlt, dass alle Zeilen
 * erkannt werden: keine Zeile enthaelt "ist" oder "means" als
 * Wortbestandteil, weil die als Trennerwoerter mitlaufen, und die
 * Uebersetzungen bleiben bei hoechstens zwei Woertern – das ist die
 * Grenze, ab der der Parser eine Uebersetzung als Satz erkennt und
 * verwirft.
 */
const BEISPIEL = [
  "der Bahnhof = station",
  "die Verbindung = connection",
  "umsteigen -> to change",
  "die Verspätung = delay",
  "ankommen = to arrive",
  "verpassen = to miss",
  "1. die Fahrkarte = ticket",
].join("\n");

/** Wie lange gewartet wird, bis neu gelesen wird – s. Kommentar unten. */
const LESE_TAKT = 120;

export default function Werkzeug() {
  const [text, setText] = useState("");
  const [ergebnis, setErgebnis] = useState<EinzelErgebnis | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const /*
     * Steuert, welcher Parser die Zeilen liest: eine frisch eingelesene
     * Datei bekommt ihre Kopfzeile und ihre Spalten entfernt
     * (`dateiEinlesen`), getippter Text dagegen nicht – in einem Textfeld
     * steht keine Tabelle.
     *
     * Beim ersten Tastendruck danach faellt der Schalter, weil der Nutzer
     * dann selbst ueber den Inhalt entscheidet und die Datei nur noch der
     * Rohstoff ist.
     */
    [ausDatei, setAusDatei] = useState(false);
  const [dateiname, setDateiname] = useState("");

  /*
   * Taktendes Lesen statt Lesen bei jedem Zeichen. Beim Einfuegen einer
   * grossen Liste passiert genau ein Takt, und die 120 ms sind unsichtbar;
   * beim Tippen verhindern sie, dass jede Taste eine vollstaendige
   * Analyse des ganzen Textes ausloest.
   *
   * Auch der leere Text laeuft durch den Takt, statt vorher abzubrechen:
   * ein `setErgebnis(null)` vor dem Timeout waere ein setState, der
   * synchron im Effect passiert – genau das, wofuer die Regel in
   * `eslint` steht, und in diesem Fall auch ohne Regel schlecht, weil der
   * Effekt dann in zwei verschiedenen Welten aufgeraeumt wird.
   */
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!text.trim()) {
        setErgebnis(null);
      } else if (ausDatei && dateiname) {
        setErgebnis(dateiEinlesen(text, dateiname));
      } else {
        setErgebnis(textblockEinlesen(text));
      }
    }, LESE_TAKT);
    return () => window.clearTimeout(t);
  }, [text, ausDatei, dateiname]);

  function textAendern(neu: string) {
    setText(neu);
    setFehler(null);
    setAusDatei(false);
    setDateiname("");
  }

  async function dateiLesen(datei: File) {
    setFehler(null);

    if (dateiZuGross(datei.size)) {
      setFehler(
        `Die Datei ist ${groesseText(datei.size)} groß. ` +
          "Bitte eine Liste bis 500 kB wählen – bei einer Wortliste ist das sehr viel.",
      );
      return;
    }

    let inhalt: string;
    try {
      inhalt = await datei.text();
    } catch {
      setFehler("Die Datei konnte nicht gelesen werden.");
      return;
    }

    if (!inhalt.trim()) {
      setFehler("Die Datei ist leer. Es steht nichts drin, was Vokabeln sein könnte.");
      return;
    }

    if (!istTextdatei(inhalt, datei.name, datei.type)) {
      setFehler(
        `„${datei.name}" ist keine Textdatei. ` +
          "Erwartet wird eine Wortliste als .txt, .csv oder .tsv.",
      );
      return;
    }

    setText(inhalt);
    setDateiname(datei.name);
    setAusDatei(true);
  }

  const meldung = ergebnis ? meldungFuer(ergebnis) : null;
  const uebersprungen = ergebnis?.uebersprungen ?? 0;
  const paare = ergebnis?.paare ?? [];

  return (
    <div className={styles.werkzeug}>
      <label className={styles.feldBeschriftung} htmlFor="usp-text">
        Deine Wortliste
      </label>

      <textarea
        id="usp-text"
        className={styles.eingabe}
        value={text}
        onChange={(e) => textAendern(e.target.value)}
        placeholder={
          "der Bahnhof = station\n" +
          "die Verbindung = connection\n" +
          "umsteigen -> to change"
        }
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-describedby="usp-meldung"
      />

      <div className={styles.leiste}>
        {/*
          Ein echter Datei-Input in einem Label: angesprochen wird das
          sichtbare Stueck, der Input selbst bleibt unsichtbar. Ohne dieses
          Paar muesste der Nutzer wissen, dass ein Input da ist – und auf
          dem Telefon waere er zwei Pixel gross.
        */}
        <label className={styles.dateiBeschriftung}>
          <input
            type="file"
            className={styles.dateiVersteckt}
            accept=".txt,.csv,.tsv,text/plain,text/csv,text/tab-separated-values"
            onChange={(e) => {
              const datei = e.target.files?.[0];
              if (datei) void dateiLesen(datei);
              // Ohne Reset ließe sich dieselbe Datei nicht ein zweites Mal
              // waehlen, wenn der erste Versuch falsch war.
              e.target.value = "";
            }}
          />
          Datei wählen
        </label>

        <button
          type="button"
          className={styles.knopfLeise}
          onClick={() => textAendern(BEISPIEL)}
        >
          Beispiel einfügen
        </button>

        {text ? (
          <button type="button" className={styles.knopfLeise} onClick={() => textAendern("")}>
            Leeren
          </button>
        ) : null}
      </div>

      {/*
        `role="status"` mit `aria-live`: die Meldung ist das Einzige, was
        sich beim Tippen ohne Blick auf die Karten aendert. Wer den Screen
        Reader benutzt, soll die Zahl der erkannten Zeilen hoeren, ohne die
        Liste durchzulaufen.
      */}
      <p
        id="usp-meldung"
        role="status"
        aria-live="polite"
        className={
          fehler
            ? styles.meldungFehler
            : ergebnis && paare.length === 0
              ? styles.meldungLeer
              : styles.meldung
        }
      >
        {fehler ??
          (ergebnis
            ? [
                meldung,
                uebersprungen > 0
                  ? `${uebersprungen} ${uebersprungen === 1 ? "Zeile" : "Zeilen"} ` +
                    "übersprungen – zu viele Wörter oder zu viele Spalten."
                  : null,
              ]
                .filter(Boolean)
                .join(" ")
            : "Füg deine Liste ein oder wähle eine Datei. Die Karten entstehen dabei hier im Browser.")}
      </p>

      {paare.length > 0 ? (
        <ul className={styles.karten}>
          {paare.map((paar, i) => (
            <li className={styles.karte} key={`${i}-${paar.frage}`}>
              <span className={styles.karteNummer}>{i + 1}</span>
              <span className={styles.karteFrage}>{paar.frage}</span>
              {paar.antwort ? (
                <span className={styles.karteAntwort}>{paar.antwort}</span>
              ) : (
                <span className={styles.karteLuecke}>Übersetzung fehlt</span>
              )}
              {paar.beispiel ? (
                <span className={styles.karteBeispiel}>{paar.beispiel}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
