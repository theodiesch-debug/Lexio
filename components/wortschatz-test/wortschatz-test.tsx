"use client";

/**
 * Der Wortschatz-Test – das Bauteil, das sowohl die oeffentliche Seite
 * /wortschatz-test als auch die App-Seite /mein-wortschatz rendert.
 *
 * Ablauf: Start -> 25 Woerter (5 je Frequenzband) -> Schatzung.
 *
 * Warum das Aufdecken kam
 * -----------------------
 * Zunaechst hieß es auf der Vorderseite „Kennst du dieses Wort?" und der
 * Knopf „Kenne ich" kam, bevor irgendeine Antwort zu sehen war. Das verlangt
 * Fremdwissen ohne Pruftafel: man muss zuerst wissen, dass das deutsche Wort
 * englische Stichprobe ist, sonst weiß man nicht, wofuer man sich selbst
 * einschaetzen soll. Jetzt steht zwischen Frage und Bewertung eine
 * Aufdeck-Zeile: erst nachdenken, dann hinschreiben lassen, dann bewerten.
 *
 * Warum die Datei erst beim Start geholt wird
 * -------------------------------------------
 * `public/wortschatz-test.json` ist 81 kB. Wer die Seite nur liest und sich
 * gegen den Test entscheidet, soll sie nicht herunterladen. Deshalb holt der
 * Start-Knopf die Datei, nicht das Laden der Seite.
 *
 * Warum keine Antwort bewertet wird
 * ----------------------------------
 * Es gibt keine Uebersetzungsmaschine auf dieser Seite. Man entscheidet
 * selbst, ob man ein Wort kennt – und weil das so ist, steht auf dem
 * Ergebnis hinterher, dass es eine Selbsteinschaetzung ist und keine Messung.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  baueTestreihe,
  schaetzeWortschatz,
  zahl,
  type BandErgebnis,
  type Testaufgabe,
  type WortschatzDaten,
  type WortschatzWort,
} from "@/lib/wortschatz-test";
import { holeJson, ApiFehler } from "@/lib/api-client";
import styles from "./wortschatz-test.module.css";

/** Woerter je Frequenzband. 5 mal 5 Baender – in gut zwei Minuten zu schaffen. */
const PRO_BAND = 5;

/**
 * Die Tests sind englisch. Die Karte zeigt das deutsche Wort als Stichprobe,
 * die Antwort ist das englische – und genau in dieser Reihenfolge landet es
 * spaeter im Set.
 */
const SPRACHE_CODE = "en";

type Phase = "start" | "laedt" | "test" | "ende" | "fehler";

/**
 * Variante 1 – "werbung" ist die oeffentliche Seite: kein Konto, kein
 * Datenspeicher, am Ende der Weg zur Anmeldung und die Quellenangabe.
 * Variante 2 – "konto" ist die Seite innerhalb der App: nichts zur
 * Anmeldung, stattdessen die eigentliche Wirkung – aus den nicht gekannten
 * Woertern entsteht ein Set.
 */
type Variante = "werbung" | "konto";

export default function WortschatzTest({ variante = "werbung" }: { variante?: Variante }) {
  const [phase, setPhase] = useState<Phase>("start");
  const [daten, setDaten] = useState<WortschatzDaten | null>(null);
  const [reihe, setReihe] = useState<Testaufgabe[]>([]);
  const [index, setIndex] = useState(0);
  const [antworten, setAntworten] = useState<boolean[]>([]);
  const [aufgedeckt, setAufgedeckt] = useState(false);

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
      setAufgedeckt(false);
      setPhase("test");
    } catch {
      setPhase("fehler");
    }
  }, []);

  const aufdecken = useCallback(() => setAufgedeckt(true), []);

  const antworten_ = useCallback(
    (gekannt: boolean) => {
      setAntworten((alt) => {
        const neu = [...alt];
        neu[index] = gekannt;
        return neu;
      });
      setAufgedeckt(false);
      if (index + 1 >= reihe.length) {
        setPhase("ende");
      } else {
        setIndex((i) => i + 1);
      }
    },
    [index, reihe.length],
  );

  /*
   * Tastatur wie in der Lernrunde: erst Leertaste oder Enter zum Aufdecken,
   * danach 1 kennt es, 2 kennt es nicht. Ohne diese Staffelung wuerde ein
   * gehaltenes „1“ die naechsten zwei Karten beantworten, bevor die
   * Antwortzeile ueberhaupt da waere – deshalb `e.repeat`.
   */
  useEffect(() => {
    if (phase !== "test") return;
    const aufTaste = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (!aufgedeckt) {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          aufdecken();
        }
        return;
      }
      if (e.key === "1") antworten_(true);
      if (e.key === "2") antworten_(false);
    };
    window.addEventListener("keydown", aufTaste);
    return () => window.removeEventListener("keydown", aufTaste);
  }, [phase, aufgedeckt, antworten_, aufdecken]);

  // Fokus mitnehmen, wenn eine neue Phase beginnt – sonst steht der Fokus
  // nach dem Klick auf einem Knopf, den es nicht mehr gibt.
  useEffect(() => {
    if (phase === "test") kartenRef.current?.focus();
    if (phase === "ende") ergebnisRef.current?.focus();
  }, [phase]);

  /**
   * Ergebnis aus den Antworten. Laeuft nur im Endschirm, ist dann also
   * billig. Die Zuordnung Wort -> Band kommt aus `reihe`, nicht aus dem Index
   * in `antworten`: die Reihenfolge der Aufgaben ist die Anzeige, die Baender
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

  /*
   * Die Woerter, die nicht geklappt haben – in der REIHENFOLGE des Tests,
   * denn genau diese Ordnung bekommt auch der Spieler hinterher zu sehen.
   * `antworten[i] === false`, nicht `!antworten[i]`: eine noch nicht
   * beantwortete Stelle ist kein Fehlschlag.
   */
  const unbekannt = useMemo(() => {
    if (phase !== "ende") return [];
    return reihe.filter((_, i) => antworten[i] === false).map((aufgabe) => aufgabe.wort);
  }, [phase, reihe, antworten]);

  if (phase === "start" || phase === "laedt" || phase === "fehler") {
    return (
      <div className={styles.kasten}>
        <p className={styles.hinweisKlein}>
          {variante === "werbung" ? "Selbsteinschätzung, kein Multiple-Choice" : "Wortschatz-Check"}
        </p>
        <h2 className={styles.kastenTitel}>25 Wörter, etwa zwei Minuten</h2>
        <p className={styles.kastenText}>
          {variante === "werbung"
            ? "Du siehst nacheinander 25 deutsche Wörter aus fünf Häufigkeitsstufen. Überleg kurz, wie sie auf Englisch heißen, deck die Antwort auf und entscheid dann: kenne ich, oder kenne ich nicht. Am Ende steht eine Schätzung, wie groß dein Wortschatz ist – aufgeschlüsselt nach Stufen."
            : "Du siehst nacheinander 25 deutsche Wörter aus fünf Häufigkeitsstufen. Überleg kurz, wie sie auf Englisch heißen, deck die Antwort auf und entscheid dann ehrlich, ob du sie kanntest."}
        </p>
        {variante === "werbung" ? (
          <p className={styles.kastenText}>
            Es gibt kein Richtig oder Falsch und keine Punkte. Nur du weißt, ob dir ein Wort
            geläufig ist.
          </p>
        ) : (
          <p className={styles.kastenText}>
            Hinterher kannst du dir die Wörter, die du nicht kanntest, als eigenes Set anlegen –
            dann lernst du genau diese.
          </p>
        )}
      <button
        type="button"
        className={styles.startKnopf}
        onClick={starten}
        disabled={phase === "laedt"}
      >
        {phase === "laedt" ? "Wörter werden geladen …" : "Test starten"}
      </button>
      {phase === "laedt" && (
        <div className={styles.baender} aria-busy="true">
          <span role="status" className={styles.nurVorlesen}>
            Wörter werden geladen …
          </span>
          <div className={styles.skelettKarte} aria-hidden="true">
            <span className={styles.skelettKarteTitel} />
            <span className={styles.skelettKarteText} />
            <span className={`${styles.skelettKarteText} ${styles.skelettKarteTextKurz}`} />
          </div>
          <div className={styles.skelettKarte} aria-hidden="true">
            <span className={styles.skelettKarteTitel} />
            <span className={styles.skelettKarteText} />
            <span className={`${styles.skelettKarteText} ${styles.skelettKarteTextKurz}`} />
          </div>
        </div>
      )}
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
          <p className={styles.karteFrage}>{aufgabe.wort.frage}</p>
          {aufgedeckt ? (
            <p className={styles.karteAntwort} aria-live="polite" lang="en">
              {aufgabe.wort.antwort}
            </p>
          ) : (
            <p className={styles.karteAuftrag}>Wie heißt das auf Englisch?</p>
          )}
        </div>

        {aufgedeckt ? (
          <div className={styles.antworten}>
            <button type="button" className={styles.ja} onClick={() => antworten_(true)}>
              Wusste ich
              <span className={styles.taste}>1</span>
            </button>
            <button type="button" className={styles.nein} onClick={() => antworten_(false)}>
              Wusste ich nicht
              <span className={styles.taste}>2</span>
            </button>
          </div>
        ) : (
          <div className={styles.antworten}>
            <button type="button" className={styles.aufdeckKnopf} onClick={aufdecken}>
              Antwort aufdecken
              <span className={styles.taste}>Leertaste</span>
            </button>
          </div>
        )}
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

      {variante === "konto" ? <SetAusTest woerter={unbekannt} /> : null}

      <div className={styles.ergebnisAktionen}>
        <button type="button" className={styles.startKnopf} onClick={starten}>
          Nochmal
        </button>
        {variante === "werbung" && (
          <a className={styles.leiseKnopf} href="/anmelden">
            Konto anlegen
          </a>
        )}
      </div>

      {variante === "werbung" && (
        <p className={styles.quelle}>
          Wortlisten: NGSL unter CC BY-SA, aufbereitet für Lexio –{" "}
          <a href="/quellen">woher die Wörter kommen</a>.
        </p>
      )}
    </div>
  );
}

/**
 * Der Block „Set aus diesen Wörtern anlegen“.
 *
 * Zwei Anfragen, in dieser Reihenfolge: erst das Set, dann die Karten –
 * umgekehrt ginge es nicht, weil `/api/karten` den Slug eines bestehenden Sets
 * braucht. Schlägt die zweite Anfrage fehl, steht das Set da und ist dennoch
 * nutzbar: es ist dann schlicht leer. Deshalb steht im Fehler die Zahl der
 * Wörter dabei, nicht nur „geht nicht“.
 */
function SetAusTest({ woerter }: { woerter: WortschatzWort[] }) {
  const [zustand, setZustand] = useState<"ruhe" | "laeuft" | "fertig" | "fehler">("ruhe");
  const [meldung, setMeldung] = useState("");
  const [slug, setSlug] = useState("");

  const anlegen = useCallback(async () => {
    setZustand("laeuft");
    setMeldung("");
    try {
      const jetzt = new Date();
      const datum = jetzt.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const setAntwort = await holeJson<{ set: { id: string; slug: string } }>(
        "/api/sets",
        undefined,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: `Wortschatz-Test ${datum}`, spracheCode: SPRACHE_CODE }),
        },
      );
      await holeJson("/api/karten", undefined, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setSlug: setAntwort.set.slug,
          paare: woerter.map((wort) => ({ frage: wort.frage, antwort: wort.antwort })),
        }),
      });
      setSlug(setAntwort.set.slug);
      setZustand("fertig");
    } catch (fehler) {
      setZustand("fehler");
      setMeldung(
        fehler instanceof ApiFehler
          ? fehler.message
          : "Das Set ließ sich nicht anlegen. Bitte nochmal.",
      );
    }
  }, [woerter]);

  if (woerter.length === 0) {
    return (
      <div className={styles.setBlock}>
        <p className={styles.setErfolg}>Du kanntest alle 25 Wörter. Nichts, das übrig bliebe.</p>
      </div>
    );
  }

  if (zustand === "fertig") {
    return (
      <div className={styles.setBlock}>
        <p className={styles.setErfolg}>
          {woerter.length} {woerter.length === 1 ? "Wort" : "Wörter"} liegen jetzt in einem Set
          unter diesem Namen.
        </p>
        <div className={styles.ergebnisAktionen}>
          <a className={styles.startKnopf} href={`/lernen/${slug}`}>
            Jetzt lernen
          </a>
          <a className={styles.leiseKnopf} href={`/wortschatz/${slug}`}>
            Zum Set
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.setBlock}>
      <p className={styles.setTitel}>Diese {woerter.length} kanntest du nicht:</p>
      <p className={styles.setText}>{woerter.map((wort) => wort.frage).join(", ")}</p>
      <button type="button" className={styles.startKnopf} onClick={anlegen} disabled={zustand === "laeuft"}>
        {zustand === "laeuft" ? "Set wird angelegt …" : "Daraus ein Set anlegen"}
      </button>
      {zustand === "fehler" && (
        <p className={styles.fehler} role="alert">
          {meldung}
        </p>
      )}
    </div>
  );
}
