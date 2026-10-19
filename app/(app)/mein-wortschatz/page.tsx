import type { Metadata } from "next";
import WortschatzTest from "@/components/wortschatz-test/wortschatz-test";
import styles from "./mein-wortschatz.module.css";

/**
 * `/mein-wortschatz` – der Wortschatz-Test innerhalb der App.
 *
 * Dieselbe Mechanik wie auf der oeffentlichen Seite, aber ohne Werbung: kein
 * „Konto anlegen“, keine Quellen-Fussnote, dafuer am Ende die eigentliche
 * Wirkung – die Woerter, die man nicht kannte, werden ein Set.
 *
 * Warum eine eigene Seite und nicht die oeffentliche
 * ---------------------------------------------------
 * `/wortschatz-test` liegt ausserhalb von `(app)`: keine Seitenleiste, kein
 * noindex, eigene Texte fuer Besucher ohne Konto. Ein Test mitten in der App
 * braucht den Rahmen der App. Zwei Routen, ein Bauteil – die Variante
 * entscheidet nur ueber Texte und die Abschluss-Aktionen.
 *
 * noindex kommt vom (app)-Layout; hier steht nur der Titel.
 */
export const metadata: Metadata = {
  title: "Wortschatz-Test",
};

export default function MeinWortschatzSeite() {
  return (
    <div className={styles.seite}>
      <header className={styles.kopf}>
        <h1 className={styles.titel}>Wortschatz-Test</h1>
        <p className={styles.untertitel}>
          25 Wörter, etwa zwei Minuten. Am Ende weißt du ungefähr, wie groß dein englischer
          Wortschatz ist – und kannst die Wörter, die du nicht kanntest, direkt als Set anlegen.
        </p>
      </header>

      <WortschatzTest variante="konto" />
    </div>
  );
}
