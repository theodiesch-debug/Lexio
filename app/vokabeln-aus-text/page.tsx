import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { beurteileUspZugang, type UspZugang } from "@/lib/usp-zugang";
import Werkzeug from "./werkzeug";
import styles from "./vokabeln-aus-text.module.css";

/**
 * `/vokabeln-aus-text` – die USP-Seite: eine Wortliste einfügen, Karten sehen.
 *
 * Warum sie hinter einem Schalter steht
 * -------------------------------------
 * Eine neue, öffentliche Seite ist das Eine, was man nach dem Veröffent-
 * lichten nicht mehr zurückholen kann: der Index, gespeicherte Ergebnisse,
 * geteilte Links. Deshalb antwortet diese Route mit 404, solange nicht
 * `USP_ZUGANG` steht (siehe `lib/usp-zugang.ts`). Der Normalzustand ist
 * unsichtbar, nicht sichtbar.
 *
 * `noindex` in der Vorschau ist keine Formalie: eine Seite, die man mit
 * einem Link testet, kann trotzdem aus einem Referer-Treffer in der Suche
 * landen. Sie wird erst freigegeben, wenn `USP_ZUGANG=offen` gesetzt ist –
 * dann auch mit Eintrag in der Sitemap.
 *
 * Warum ohne Server
 * -----------------
 * Die Seite ruft keine API auf. Die Parser in `lib/` laufen im Browser,
 * und genau das ist die Bedingung: ein Besucher ohne Konto probiert seine
 * eigene Liste aus, ohne dass sein Text irgendwo ankommt. Ein Nebeneffekt,
 * der kein Nebeneffekt ist – sie funktioniert auch dann, wenn das Backend
 * gerade nicht erreichbar wäre.
 */

type SuchParameter = { [key: string]: string | string[] | undefined };

/** `searchParams` liefert auch Arrays und `undefined`; hier gebraucht wird eins. */
function wert(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

async function zugang(searchParams: Promise<SuchParameter>): Promise<UspZugang> {
  const p = await searchParams;
  return beurteileUspZugang({
    zugang: process.env.USP_ZUGANG,
    schluessel: process.env.USP_VORSCHAU_TOKEN,
    mitgebrachterSchluessel: wert(p.vorschau),
  });
}

const TITEL = "Vokabeln aus Text – Wortliste einfügen, Kartei bekommen";
const BESCHREIBUNG =
  "Wortliste einfügen und als Lernkartei sehen: Lexio erkennt Tabellen, " +
  "Trennzeichen und Wortpaare – jede Karte als Vorschau. Ohne Konto, alles im Browser.";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SuchParameter>;
}): Promise<Metadata> {
  /*
   * Nur die Indexierung hängt vom Schalter ab, nicht der Inhalt: in der
   * Vorschau soll die Seite lesbar und teilbar sein, nur nicht in der Suche
   * auftauchen. `noindex` plus `follow: false` sagt den Suchmaschinen
   * beides in einem Tag.
   */
  const offen = (await zugang(searchParams)).indexieren;

  return {
    title: TITEL,
    description: BESCHREIBUNG,
    alternates: { canonical: "/vokabeln-aus-text" },
    robots: offen ? { index: true, follow: true } : { index: false, follow: false },
    /*
     * Ein eigenes openGraph, obwohl das Layout schon eines hat: ohne dieses
     * Block teilt ein Link auf diese Seite Titel, Beschreibung und URL der
     * STARTSEITE – Next ersetzt die Gruppe "openGraph" beim Seitenwechsel
     * komplett, es gibt kein Zusammenführen. Derselbe Grund wie auf
     * /quellen.
     */
    openGraph: {
      title: TITEL,
      description: BESCHREIBUNG,
      type: "website",
      url: "/vokabeln-aus-text",
      siteName: "Lexio",
      locale: "de_DE",
      images: ["/images/og-1200x630.png"],
    },
  };
}

/**
 * Die Fragen stehen an einer Stelle, damit der sichtbare Text und die
 * strukturierten Daten auseinanderlaufen können – und nicht: damit sie
 * dasselbe sagen. Google verlangt, dass JSON-LD und sichtbarer Inhalt
 * übereinstimmen; zwei getippte Fassungen desselben Inhalts trennen sich
 * mit der Zeit, das ist keine Frage, sondern eine Erfahrung.
 */
const FRAGEN = [
  {
    frage: "Muss ich mich anmelden, um meine Wortliste auszuprobieren?",
    antwort:
      "Nein. Einfügen, prüfen und die Karten ansehen geht ohne Konto. " +
      "Auf dieser Seite wird nichts übertragen: der Text wird in deinem " +
      "Browser gelesen und nirgends hochgeladen.",
  },
  {
    frage: "Welche Formate erkennt Lexio?",
    antwort:
      "Tabulator, Semikolon und Pipe als Spaltentrenner mit bis zu vier " +
      "Spalten (Begriff, Übersetzung, Beispielsatz, Übersetzung des " +
      "Beispiels). Dazu die Trenner =, ->, =>, :, „ - „ sowie die Wörter " +
      "means, mean, ist, sind, heißt und heisst. Eine Nummerierung davor " +
      "wird entfernt. Eine Zeile ohne Trenner wird als Begriff genommen – " +
      "ihre Übersetzung fehlt dann noch und ist in der Vorschau sichtbar.",
  },
  {
    frage: "Kann ich auch einen Fließtext einfügen, zum Beispiel einen Artikel?",
    antwort:
      "Nein. Lexio braucht Wortpaare – Zeilen mit Begriff und Übersetzung. " +
      "Eine Zeile mit mehr als sechs Wörtern wird übersprungen, weil nicht " +
      "sicher ist, wo der Begriff aufhört. Aus einem Artikel wird so keine " +
      "Kartei, aus der Wortliste dazu sehr wohl.",
  },
  {
    frage: "Was passiert mit meinem Text?",
    antwort:
      "Nichts. Die Seite speichert nichts und sendet nichts ab. Erst wenn " +
      "du ein Konto anlegst und dort etwas speicherst, liegt es in deinem " +
      "Konto – dann aber auch nur dort.",
  },
  {
    frage: "Wie groß darf meine Liste sein?",
    antwort:
      "Eingefügt gibt es keine praktische Grenze. Als Datei erwartet Lexio " +
      "eine .txt-, .csv- oder .tsv-Datei bis 500 kB – bei einer Wortliste " +
      "ist das sehr viel.",
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

const FORMATE = [
  { beispiel: "der Bahnhof = station", erklaerung: "Gleichheitszeichen" },
  { beispiel: "der Bahnhof -> station", erklaerung: "Pfeil, auch =>" },
  { beispiel: "der Bahnhof means station", erklaerung: "Trennwort, auch „ist“, „heißt“" },
  { beispiel: "der Bahnhof - station", erklaerung: "Bindestrich mit Leerzeichen" },
  {
    beispiel: "der Bahnhof | station | We arrive at the station. | Wir kommen am Bahnhof an.",
    erklaerung: "Semikolon, Pipe oder Tab – bis zu vier Spalten",
  },
] as const;

export default async function VokabelnAusTextSeite({
  searchParams,
}: {
  searchParams: Promise<SuchParameter>;
}) {
  if (!(await zugang(searchParams)).sichtbar) notFound();

  // Derselbe Wert wie im Root-Layout, aber dort steht er einmal für die
  // ganze App. Dieses Skript gehört nur dieser Seite und kann erst hier
  // stehen, weil die FAQ erst hier existiert. Ohne den Nonce würde die
  // Content-Security-Policy aus proxy.ts es blockieren.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <main className={styles.seite}>
      <div className={styles.kopf}>
        <Link href="/" className={styles.zurueck}>
          &larr; Lexio
        </Link>
      </div>

      <div className={styles.text}>
        <h1>Jeder Text wird dein Vokabelkurs.</h1>

        <p className={styles.einleitung}>
          Du hast eine Wortliste – aus dem Lehrbuch, aus der Lern-App, aus dem Unterricht, aus
          deinen eigenen Notizen. Füg sie ein, und du siehst sofort, was daraus wird: jede Zeile
          als Karte, jede Übersetzung, die noch fehlt, sichtbar markiert. Ohne Konto, ohne
          Anmeldung, und ohne dass dein Text irgendwohin unterwegs ist.
        </p>

        <Werkzeug />

        <div className={styles.abschnitt}>
          <h2>Was Lexio versteht</h2>
          <p>
            Der Zahlenpunkt ist die erste Spalte, der Rest die zweite – und wer mehr Spalten
            hat, bekommt mehr Karten. Diese Formate werden erkannt:
          </p>
          <ul>
            {FORMATE.map((f) => (
              <li key={f.beispiel}>
                <code>{f.beispiel}</code> – {f.erklaerung}
              </li>
            ))}
          </ul>
          <p>
            Als Datei kommen <code>.txt</code>, <code>.csv</code> und <code>.tsv</code> dazu, bis
            500 kB. Eine Kopfzeile wie <code>wort;übersetzung</code> wird erkannt und weggelassen.
          </p>

          <h2>Was hier nicht funktioniert</h2>
          <p>
            Ein Fließtext ist keine Wortliste. Wer einen Artikel einfügt, bekommt keine Karten,
            weil aus einer Zeile mit vielen Wörtern nicht sicher hervorgeht, welches Wort die
            Übersetzung sein soll – und raten würde eine falsche Karte erzeugen, die man erst
            merkt, wenn sie falsch gelernt ist.
          </p>
          <p>
            Übersetzungen werden auch nicht erfunden. Es gibt auf dieser Seite keine KI und kein
            Wörterbuch, das nachschlägt: was du eingibst, steht so auf der Karte. Eine Zeile ohne
            Übersetzung bleibt sichtbar eine Lücke, bis du sie füllst.
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
          <h2>Und weiter?</h2>
          <p>
            Diese Vorschau speichert nichts – sie läuft nur in deinem Browser. Wer mit dem
            Lernen anfängt, braucht ein Konto: darin liegen deine Sets, dein Fortschritt über
            alle Geräte hinweg und die tägliche Erinnerung. Die ersten 100 englischen
            Grundwörter sind schon enthalten.
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
          Die Prüfung deiner Liste läuft im Browser, auf deinem Gerät. Es wird nichts
          hochgeladen und nichts gespeichert.
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
