import type { Metadata } from "next";

/**
 * Bausteine für die Metadaten der oeffentlichen Seiten, an einer Stelle.
 *
 * Der Grund, warum das hier steht und nicht viermal kopiert: Next mischt die
 * Gruppe `openGraph` beim Seitenwechsel NICHT tief zusammen. Setzt eine Seite
 * ein eigenes `openGraph`, ersetzt sie das des Layouts vollstaendig – und ohne
 * `images` als Objekt verschwinden dabei Breite, Hoehe und Alternativtext, die
 * das Layout sorgfaeltig gesetzt hat. Genau dieser Fehler stand auf vier
 * Seiten gleichzeitig, weil jede ihr eigenes `images: ["/…"]` als blosse
 * Zeichenkette schrieb.
 *
 * Zwei weitere Dinge, die leicht untergehen und hier einmal richtig stehen:
 *
 *   – `twitter`. Wer nur `openGraph` setzt, bekommt auf X/Twitter weiter die
 *     Karte des Layouts – also Titel und Beschreibung der Startseite. Das
 *     `twitter`-Block spiegelt deshalb bewusst dieselben Werte.
 *   – `googleBot.max-image-preview: "large"`. Ohne die Direktive zeigt Google
 *     in den Suchergebnissen ein kleines Vorschaubild; mit ihr das grosse.
 */

/** Dieselbe Datei wie im Layout – 1200x630, das Format, das Vorschauen nutzen. */
const OG_BILD = {
  url: "/images/og-1200x630.png",
  width: 1200,
  height: 630,
  alt: "Lexio – Vokabeln lernen mit Beispielsätzen",
} as const;

type SeitenEingabe = {
  /** Vollstaendiger Titel ohne Marken-Suffix – das `template` haengt ihn an. */
  titel: string;
  beschreibung: string;
  /** Kanonischer Pfad, beginnt mit "/". */
  pfad: string;
  /** Standardmaessig indexierbar. `false` setzt noindex/nofollow. */
  indexieren?: boolean;
};

/**
 * Metadaten einer oeffentlichen Seite: Titel, Beschreibung, kanonischer Link,
 * Open Graph mit vollstaendigem Bild, gespiegelte Twitter-Karte und die
 * Google-Bot-Direktive. Der Aufrufer entscheidet nur noch Inhalt und Pfad.
 */
export function seitenMeta({
  titel,
  beschreibung,
  pfad,
  indexieren = true,
}: SeitenEingabe): Metadata {
  const robots = indexieren
    ? {
        index: true,
        follow: true,
        googleBot: { index: true, follow: true, "max-image-preview": "large" as const },
      }
    : { index: false, follow: false };

  return {
    title: titel,
    description: beschreibung,
    alternates: { canonical: pfad },
    robots,
    openGraph: {
      title: titel,
      description: beschreibung,
      type: "website",
      url: pfad,
      siteName: "Lexio",
      locale: "de_DE",
      images: [OG_BILD],
    },
    twitter: {
      card: "summary_large_image",
      title: titel,
      description: beschreibung,
      images: [OG_BILD.url],
    },
  };
}
