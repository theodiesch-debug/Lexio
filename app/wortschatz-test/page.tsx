import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import WortschatzTest from "./wortschatz-test";
import styles from "./wortschatz-test.module.css";

/**
 * `/wortschatz-test` – die öffentliche Seite, die den Wortschatz schätzt.
 *
 * Warum ohne Server
 * -----------------
 * Die Seite zieht keine API und liest keine Datenbank. Sie holt eine
 * statische Wortliste aus `public/` und rechnet im Browser – dieselbe
 * Begründung wie auf /vokabeln-aus-text: eine Seite, die Besucher ohne Konto
 * anspricht, darf von einem Backend nicht abhängen, das sie nicht brauchen.
 *
 * Warum ohne Zugangsschalter
 * --------------------------
 * Anders als die USP-Seite steht diese hinter keinem `USP_ZUGANG`. Eine
 * Schätzung des eigenen Wortschatzes ist kein unfertiges Werkzeug: niemand
 * muss sie zurückholen können, und sie soll gefunden werden. Deshalb ist sie
 * indexierbar und steht in der Sitemap.
 */

const TITEL = "Wortschatz-Test: Wie viele englische Wörter kennst du?";
const BESCHREIBUNG =
  "Miss in zwei Minuten deinen englischen Wortschatz: 25 Wörter aus fünf " +
  "Häufigkeitsstufen, ehrlich hochgerechnet. Ohne Konto, ohne Anmeldung.";

export const metadata: Metadata = {
  title: TITEL,
  description: BESCHREIBUNG,
  alternates: { canonical: "/wortschatz-test" },
  /*
   * Eigene openGraph-Angaben, wie auf /vokabeln-aus-text und /quellen: ohne
   * sie teilt ein Link auf diese Seite Titel und Beschreibung der Startseite.
   */
  openGraph: {
    title: TITEL,
    description: BESCHREIBUNG,
    type: "website",
    url: "/wortschatz-test",
    siteName: "Lexio",
    locale: "de_DE",
    images: ["/images/og-1200x630.png"],
  },
};

/** Sichtbarer Text und JSON-LD aus einer Quelle – siehe /vokabeln-aus-text. */
const FRAGEN = [
  {
    frage: "Wie genau ist die Schätzung?",
    antwort:
      "Sie ist ein Anhaltspunkt, keine Messung. Aus jedem Band werden fünf " +
      "Wörter gezogen; daraus wird die Quote auf das ganze Band hochgerechnet. " +
      "Zehn Wörter mehr oder weniger im Ergebnis sind normal. Für einen " +
      "Überblick, wo man steht, reicht das – für eine Punktzahl im Zeugnis nicht.",
  },
  {
    frage: "Bewertet der Test meine Antworten?",
    antwort:
      "Nein. Es gibt keine richtige oder falsche Antwort und keine Übersetzung, " +
      "mit der abgeglichen wird. Man entscheidet selbst, ob einem ein Wort " +
      "geläufig ist. Besser als eine Maschine, die rät, was man weiß.",
  },
  {
    frage: "Woher kommen die Wörter?",
    antwort:
      "Aus der NGSL (New General Service List), einer frequenzbasierten Liste " +
      "der häufigsten englischen Wörter. Sie ist unter CC BY-SA lizenziert; " +
      "die Aufbereitung für Lexio steht unter /quellen.",
  },
  {
    frage: "Warum sind die Stufen „Alltag“ und „Ausbau“ und nicht A1, B1, C1?",
    antwort:
      "Weil die NGSL keine CEFR-Stufen kennt, sondern Häufigkeitsränge. " +
      "„Alltag 1“ heißt Rang 101 bis 500, „Ausbau 2“ alles ab Rang 1801. " +
      "Eine erfundene CEFR-Angabe wäre genauer, als die Liste weiß.",
  },
  {
    frage: "Wird etwas gespeichert oder gesendet?",
    antwort:
      "Nein. Der Test läuft vollständig in deinem Browser, die Wortliste kommt " +
      "als statische Datei. Erst wenn du ein Konto anlegst, gehören Sets und " +
      "Fortschritt dir – dann aber auch nur in deinem Konto.",
  },
] as const;

const FAQ_DATEN = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FRAGEN.map((f) => ({
    "@type": "Question",
    name: f.frage,
    acceptedAnswer: { "@type": "Answer", text: f.antwort },
  })),
};

export default async function WortschatzTestSeite() {
  // Ohne den Nonce blockiert die Content-Security-Policy aus proxy.ts das
  // JSON-LD. Derselbe Weg wie auf /vokabeln-aus-text.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <main className={styles.seite}>
      <div className={styles.kopf}>
        <Link href="/" className={styles.zurueck}>
          &larr; Lexio
        </Link>
      </div>

      <div className={styles.text}>
        <h1>Wie viele englische Wörter kennst du wirklich?</h1>

        <p className={styles.einleitung}>
          Die meisten schätzen ihren Wortschatz nach Gefühl – und liegen weit daneben, in beide
          Richtungen. Dieser Test macht aus dem Gefühl eine Zahl: 25 Wörter aus fünf
          Häufigkeitsstufen, deine Einschätzung, eine ehrliche Hochrechnung. Zwei Minuten, ohne
          Konto.
        </p>

        <WortschatzTest />

        <div className={styles.abschnitt}>
          <h2>Wie die Schätzung entsteht</h2>
          <p>
            Aus jeder der fünf Stufen werden fünf Wörter gezogen – zufällig, bei jedem Durchlauf
            andere. Aus dem Anteil, den du kennst, wird auf die ganze Stufe geschlossen: kennst du
            drei von fünf Wörtern einer Stufe, die 500 Wörter umfasst, gelten 300 als bekannt.
            Zusammengezählt ergibt das die Endsumme.
          </p>
          <p>
            Diese Art der Hochrechnung heißt Stichprobe, und sie hat eine Grenze: fünf Wörter je
            Stufe sind wenig. Genau deshalb steht die Stichprobengröße im Ergebnis mit dabei und
            nicht nur die große Zahl. Eine Schätzung, die verschweigt, woraus sie kommt, ist keine
            Schätzung, sondern eine Behauptung.
          </p>

          <h2>Was der Test nicht ist</h2>
          <p>
            Kein Zertifikat und kein Ersatz für eine Sprachprüfung. Er sagt nicht, wie gut du
            Englisch sprichst, schreibst oder verstehst – nur, wie viele Wörter aus dieser Liste
            dir vorkommen. Grammatik, Aussprache und die Wörter, die nicht in der Liste stehen,
            zählt er gar nicht.
          </p>
          <p>
            Und er bewertet deine Antworten nicht. Es gibt keine Übersetzung, gegen die geprüft
            würde: ob du ein Wort kennst, entscheidest du. Wer dabei schummelt, betrügt nur die
            eigene Zahl.
          </p>

          <h2>Häufige Fragen</h2>
          <dl>
            {FRAGEN.map((f) => (
              <div key={f.frage}>
                <dt>{f.frage}</dt>
                <dd>{f.antwort}</dd>
              </div>
            ))}
          </dl>
        </div>

        <section className={styles.abschluss}>
          <h2>Und dann?</h2>
          <p>
            Eine Zahl allein lernt keine Vokabeln. Wer aus dem Ergebnis etwas machen will, braucht
            einen Ort für den Stoff: in Lexio liegen deine Sets, dein Fortschritt über alle Geräte
            hinweg und die tägliche Erinnerung. Die 100 häufigsten Wörter sind schon enthalten –
            genau die Stufe, die im Test am leichtesten fällt.
          </p>
          <div className={styles.abschlussAktion}>
            <Link href="/anmelden" className={styles.knopf}>
              Konto anlegen
            </Link>
            <Link href="/quellen" className={styles.knopfLeise}>
              Woher die Wörter kommen
            </Link>
          </div>
        </section>

        <p className={styles.klein}>
          Der Test läuft im Browser, auf deinem Gerät. Es wird nichts hochgeladen und nichts
          gespeichert.
        </p>
      </div>

      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_DATEN) }}
      />
    </main>
  );
}
