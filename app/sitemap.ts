import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/meta";
import { beurteileUspZugang } from "@/lib/usp-zugang";

/**
 * sitemap.xml.
 *
 * /anmelden, /passwort-aendern und /passwort-zuruecksetzen sind per
 * `robots: { index: false }` noindex, und der gesamte (app)-Bereich liegt
 * hinter einer Anmeldung. Die Sitemap listet deshalb nur die Seiten, die
 * ohne Konto abrufbar sind: die Startseite, /quellen und /wortschatz-test.
 *
 * /quellen steht mit drin, weil die Quellenangabe nicht nur dekorativ ist.
 * Die Wortlisten sind Bearbeitungen fremder Quellen unter CC BY-SA; wer sie
 * weitergibt, muss sagen, woher sie kommen. Eine Quellenangabe, die nur in
 * einer nicht gelisteten Seite steht, ist fuer niemanden auffindbar.
 *
 * Die Schleife unten rechnet jede spaetere Route selbst um, damit hier nie
 * eine URL auseinanderfaehrt.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  /*
   * Nur die oeffentlichen Seiten. Alles andere liegt hinter der Anmeldung
   * und traegt zentral `robots: { index: false }` – eine Sitemap mit noindex-
   * Adressen sagt Suchmaschinen nur, wo nichts zu finden ist.
   */
  const routes: string[] = ["/", "/quellen", "/wortschatz-test"];

  /*
   * Die USP-Seite nur, wenn sie wirklich offen ist. Eine Adresse in der
   * Sitemap, die mit 404 antwortet, ist der schnellste Weg, einer neuen
   * Seite zu sagen, dass sie nicht vertrauenswuerdig ist – und passiert,
   * sobald hier einmal `offen` stand und danach auf `aus` zurueckgesetzt
   * wurde.
   *
   * Geprueft wird derselbe Schalter wie auf der Seite selbst, nicht der
   * Rohwert: was die Route freigibt, steht auch in der Sitemap, und was
   * sie verschweigt, nicht. Zwei Stellen, dieselbe Regel.
   */
  const zugang = beurteileUspZugang({
    zugang: process.env.USP_ZUGANG,
    schluessel: process.env.USP_VORSCHAU_TOKEN,
    mitgebrachterSchluessel: undefined,
  });
  if (zugang.indexieren) routes.push("/vokabeln-aus-text");

  /*
   * Bewusst ohne `lastModified`.
   *
   * Vorher stand hier `lastModified: new Date()` – bei JEDEM Abruf die
   * aktuelle Zeit. Die Route laeuft dynamisch, die Angabe war also immer
   * "gerade eben geaendert". Eine Aenderungszeit, die sich nie aendert und
   * nie stimmt, ist keine Auskunft, sondern Rauschen: Google verwirft ein
   * `lastmod` als unzuverlaessig, sobald es offensichtlich falsch ist, und
   * ignoriert das Feld danach ganz. Ohne die Angabe greift Googles eigene
   * Crawl-Heuristik – ehrlicher und am Ende wirksamer.
   */
  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
  }));
}

/*
 * Die Sitemap wird standardmaessig beim Build eingefroren (im Build-Report
 * steht "○ (Static)"). Der Zugangsschalter ist aber ein Laufzeitwert. Wer
 * ihn zuruecksetzt, haette dann eine Sitemap, die noch die alte Ausgabe
 * zeigt – und im schlimmsten Fall eine Adresse darin, die mit 404
 * antwortet.
 *
 * Deshalb pro Anfrage. Das kostet nichts: die Route liefert eine Liste aus
 * drei Zeilen, und sie wird nur von Suchmaschinen aufgerufen.
 */
export const dynamic = "force-dynamic";