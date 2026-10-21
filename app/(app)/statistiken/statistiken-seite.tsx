"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { holeJson } from "@/lib/api-client";
import { TAGESZIEL_XP } from "@/lib/profil";
import type { SprachStat, TagesXpTyp, WochenXpTyp } from "@/lib/types";
import styles from "./statistiken.module.css";

const WOCHENTAGE = [
  { key: "mo", label: "Mo" },
  { key: "di", label: "Di" },
  { key: "mi", label: "Mi" },
  { key: "do", label: "Do" },
  { key: "fr", label: "Fr" },
  { key: "sa", label: "Sa" },
  { key: "so", label: "So" },
] as const;

const LEERE_WOCHE: WochenXpTyp = { mo: 0, di: 0, mi: 0, do: 0, fr: 0, sa: 0, so: 0 };

/** Statistiken – nach Muster „Schrittweise aufgebaut“. */
export default function StatistikenSeite() {
  const router = useRouter();

  const [woche, setWoche] = useState<WochenXpTyp>(LEERE_WOCHE);
  const [tages, setTages] = useState<TagesXpTyp>({ erreicht: 0, ziel: 0 });
  const [sprachen, setSprachen] = useState<SprachStat[]>([]);
  const [laden, setLaden] = useState(true);

  useEffect(() => {
    let abgebrochen = false;

    Promise.all([
      holeJson<WochenXpTyp>("/api/wochen-xp", LEERE_WOCHE),
      holeJson<TagesXpTyp>("/api/tages-xp", { erreicht: 0, ziel: 0 }),
      holeJson<SprachStat[]>("/api/sprachen-stats", []),
    ])
      .then(([w, t, s]) => {
        if (abgebrochen) return;
        setWoche({ ...LEERE_WOCHE, ...w });
        setTages(t);
        setSprachen(Array.isArray(s) ? s : []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!abgebrochen) setLaden(false);
      });

    return () => {
      abgebrochen = true;
    };
  }, []);

  const kennzahlen = useMemo(() => {
    const xpGesamt = sprachen.reduce((sum, s) => sum + (s.xp ?? 0), 0);
    const gelernt = sprachen.reduce((sum, s) => sum + (s.gelernt ?? 0), 0);
    const total = sprachen.reduce((sum, s) => sum + (s.total ?? 0), 0);
    const xpWoche = WOCHENTAGE.reduce((sum, t) => sum + (woche[t.key] ?? 0), 0);
    const besterTag = WOCHENTAGE.reduce(
      (best, t) => ((woche[t.key] ?? 0) > (woche[best.key] ?? 0) ? t : best),
      WOCHENTAGE[0],
    );

    return {
      xpGesamt,
      gelernt,
      total,
      xpWoche,
      quote: total > 0 ? Math.round((gelernt / total) * 100) : 0,
      besterTag,
      hoechsterTag: Math.max(...WOCHENTAGE.map((t) => woche[t.key] ?? 0), 1),
    };
  }, [sprachen, woche]);

  const tagesZiel = tages.ziel > 0 ? tages.ziel : TAGESZIEL_XP;
  const tagesProzent = Math.min(100, Math.round(((tages.erreicht ?? 0) / tagesZiel) * 100));

  return (
    <div className={styles.seite}>
      <header
        className={`${styles.kopf} ${styles.rein}`}
        style={{ ["--reinVersatz" as string]: "0ms" } as React.CSSProperties}
      >
        <h1 className={styles.titel}>Statistiken</h1>
        <p className={styles.untertitel}>Dein Fortschritt im Überblick.</p>
      </header>

      {laden ? (
        <>
          <span role="status" className={styles.nurVorlesen}>
            Statistiken werden geladen …
          </span>
          <div className={styles.skelettKopfleiste} aria-hidden="true">
            <div className={styles.skelettTitel} />
            <div className={styles.skelettUnter} />
          </div>
          <div className={styles.skelettKacheln} aria-hidden="true">
            <div className={styles.skelettKachel} />
            <div className={styles.skelettKachel} />
            <div className={styles.skelettKachel} />
            <div className={styles.skelettKachel} />
          </div>
          <div className={styles.skelettBlock} aria-hidden="true" />
          <div className={styles.skelettBlock} aria-hidden="true" />
          <div className={styles.skelettBlock} aria-hidden="true" />
        </>
      ) : (
        <>
          <section
            className={`${styles.kacheln} ${styles.rein}`}
            aria-label="Kennzahlen"
            style={{ ["--reinVersatz" as string]: "80ms" } as React.CSSProperties}
          >
            {[
              { wert: kennzahlen.xpGesamt, label: "XP gesamt" },
              { wert: kennzahlen.gelernt, label: "Karten gelernt" },
              { wert: `${kennzahlen.quote}%`, label: "Quote" },
              { wert: kennzahlen.xpWoche, label: "XP diese Woche" },
            ].map((item, i) => (
              <div
                key={item.label}
                className={`${styles.kachel} ${styles.kachelEingang}`}
                style={{ ["--kachelVersatz" as string]: `${i * 40}ms` } as React.CSSProperties}
              >
                <span className={styles.kachelZahl}>{item.wert}</span>
                <span className={styles.kachelLabel}>{item.label}</span>
              </div>
            ))}
          </section>

          <section
            className={`${styles.block} ${styles.rein}`}
            style={{ ["--reinVersatz" as string]: "160ms" } as React.CSSProperties}
          >
            <h2 className={styles.blockTitel}>Heute</h2>
            <div className={styles.heute}>
              <div className={styles.heuteKopf}>
                <span className={styles.heuteZahl}>{tages.erreicht ?? 0} XP</span>
                <span className={styles.heuteZiel}>von {tagesZiel} XP</span>
              </div>
              <div
                className={styles.balken}
                role="progressbar"
                aria-valuenow={tages.erreicht ?? 0}
                aria-valuemin={0}
                aria-valuemax={tagesZiel}
                aria-label="Tagesziel"
              >
                <div
                  className={styles.balkenFuellung}
                  style={{ width: `${tagesProzent}%` }}
                />
              </div>
              <p className={styles.heuteText}>
                {tagesProzent >= 100
                  ? "Tagesziel erreicht. Alles Weitere ist Bonus."
                  : `Noch ${tagesZiel - (tages.erreicht ?? 0)} XP bis zum Tagesziel.`}
              </p>
            </div>
          </section>

          <section
            className={`${styles.block} ${styles.rein}`}
            style={{ ["--reinVersatz" as string]: "240ms" } as React.CSSProperties}
          >
            <h2 className={styles.blockTitel}>Diese Woche</h2>
            <div className={styles.woche}>
              {WOCHENTAGE.map((tag) => {
                const xp = woche[tag.key] ?? 0;
                const anteil = Math.max(3, Math.round((xp / kennzahlen.hoechsterTag) * 100));
                return (
                  <div className={styles.tag} key={tag.key} title={`${tag.label}: ${xp} XP`}>
                    <div className={styles.tagBalkenHuelle}>
                      <div
                        className={styles.tagBalken}
                        style={{ height: `${anteil}%` }}
                      />
                    </div>
                    <span className={styles.tagLabel}>{tag.label}</span>
                    <span className={styles.tagXp}>{xp > 0 ? xp : ""}</span>
                  </div>
                );
              })}
            </div>
            <p className={styles.fussnote}>
              Bester Tag: {kennzahlen.besterTag.label} mit {woche[kennzahlen.besterTag.key] ?? 0} XP
            </p>
          </section>

          <section
            className={`${styles.block} ${styles.rein}`}
            style={{ ["--reinVersatz" as string]: "320ms" } as React.CSSProperties}
          >
            <h2 className={styles.blockTitel}>Sprachen</h2>
            {sprachen.length === 0 ? (
              <p className={styles.leer}>Noch keine Lernaktivität in einer Sprache.</p>
            ) : (
              <ul className={styles.sprachen}>
                {sprachen.map((s) => {
                  const quote = s.total > 0 ? Math.round(((s.gelernt ?? 0) / s.total) * 100) : 0;
                  return (
                    <li className={styles.sprache} key={s.code ?? s.sprache}>
                      <button
                        type="button"
                        className={styles.spracheKopf}
                        onClick={() => router.push("/karteikarten")}
                      >
                        <span
                          className={styles.punkt}
                          style={{ backgroundColor: s.flaeche }}
                          aria-hidden="true"
                        />
                        <span className={styles.spracheName}>{s.sprache}</span>
                        <span className={styles.spracheXp}>{s.xp ?? 0} XP</span>
                      </button>
                      <div className={styles.spracheBalken}>
                        <div
                          className={styles.spracheFuellung}
                          style={{ width: `${quote}%` }}
                        />
                      </div>
                      <span className={styles.spracheMeta}>
                        {s.gelernt ?? 0} von {s.total} Karten gelernt · {quote} %
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
