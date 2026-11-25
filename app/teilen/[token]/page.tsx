import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import styles from "./teilen.module.css";

type Ctx = { params: Promise<{ token: string }> };

type Geteilt = {
  name: string;
  sprache: { name: string };
  kartenAnzahl: number;
  karten: Array<{ frage: string; antwort: string; beispielsatz?: string | null; beispielUebersetzung?: string | null }>;
};

async function lade(token: string): Promise<Geteilt | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("geteiltes_set_abrufen", { p_token: token });
  if (error || !data) return null;
  return data as Geteilt;
}

export async function generateMetadata({ params }: Ctx): Promise<Metadata> {
  const { token } = await params;
  const set = await lade(token);
  if (!set) return { title: "Geteiltes Set nicht gefunden · Lexio", robots: { index: false, follow: false } };
  const titel = `${set.name} – Vokabelset teilen`;
  const beschreibung = `${set.kartenAnzahl} Vokabeln (${set.sprache?.name ?? "Sprache"}) auf Lexio lernen oder ins eigene Konto kopieren.`;
  return {
    title: `${titel} · Lexio`,
    description: beschreibung,
    robots: { index: false, follow: false },
    openGraph: { title: `${titel} · Lexio`, description: beschreibung, type: "website" },
  };
}

export default async function GeteiltesSetSeite({ params }: Ctx) {
  const { token } = await params;
  const set = await lade(token);

  if (!set) {
    return (
      <main className={styles.seite}>
        <div className={styles.karte}>
          <p className={styles.marke}>Lexio</p>
          <h1 className={styles.titel}>Dieses geteilte Set wurde nicht gefunden</h1>
          <p className={styles.text}>Der Link ist ungültig oder das Teilen wurde deaktiviert.</p>
          <Link href="/" className={styles.knopf}>Zu Lexio</Link>
        </div>
      </main>
    );
  }

  const weiter = encodeURIComponent(`/teilen/${token}`);
  return (
    <main className={styles.seite}>
      <div className={styles.karte}>
        <p className={styles.marke}>Lexio</p>
        <p className={styles.badge}>Geteiltes Vokabelset</p>
        <h1 className={styles.titel}>{set.name}</h1>
        <p className={styles.text}>
          {set.kartenAnzahl} Vokabeln · {set.sprache?.name ?? "Sprache"}
        </p>

        <div className={styles.aktionen}>
          <Link href={`/anmelden?weiter=${weiter}`} className={styles.knopf}>Bei Lexio anmelden und kopieren</Link>
          <Link href="/anmelden" className={styles.knopfLeise}>Konto erstellen</Link>
        </div>

        <section className={styles.vorschau} aria-labelledby="vorschau-titel">
          <h2 id="vorschau-titel" className={styles.vorschauTitel}>Vorschau</h2>
          <ul className={styles.liste}>
            {set.karten.slice(0, 12).map((k, i) => (
              <li key={`${k.frage}-${i}`} className={styles.eintrag}>
                <span className={styles.frage}>{k.frage}</span>
                <span className={styles.antwort}>{k.antwort}</span>
              </li>
            ))}
          </ul>
          {set.kartenAnzahl > 12 && <p className={styles.mehr}>+ {set.kartenAnzahl - 12} weitere Vokabeln nach Anmeldung.</p>}
        </section>
      </div>
    </main>
  );
}
