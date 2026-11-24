"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./erststart-tour.module.css";

type Schritt = {
  id: string;
  titel: string;
  text: string;
  selector?: string;
};

const SPEICHER = "lexio.erststart.v1";

const SCHRITTE: Schritt[] = [
  {
    id: "willkommen",
    titel: "Willkommen bei Lexio",
    text: "Kurze Tour: In unter einer Minute siehst du, wo du lernst, Wörter hinzufügst und deinen Fortschritt findest.",
  },
  {
    id: "uebersicht",
    titel: "Übersicht",
    text: "Hier startest du. Du siehst fällige Wörter, deinen Fortschritt und kommst direkt ins Lernen.",
    selector: '[data-tour="uebersicht"]',
  },
  {
    id: "hinzufuegen",
    titel: "Wörter hinzufügen",
    text: "Lege neue Sets an oder füge Vokabeln hinzu – einzeln, als Textblock oder per Foto.",
    selector: '[data-tour="hinzufuegen"]',
  },
  {
    id: "wortschatz",
    titel: "Wortschatz",
    text: "Hier findest du deine Sets und alle Vokabeln. Du kannst suchen, bearbeiten, exportieren oder einen Lern-Podcast erstellen.",
    selector: '[data-tour="wortschatz"]',
  },
  {
    id: "statistiken",
    titel: "Statistiken",
    text: "Sieh, wie regelmäßig du lernst, wie viele Wörter sitzen und wo sich Wiederholung lohnt.",
    selector: '[data-tour="statistiken"]',
  },
  {
    id: "profil",
    titel: "Profil & Einstellungen",
    text: "Im Profil siehst du deinen Stand. Unter Einstellungen passt du Lexio an dein Gerät an.",
    selector: '[data-tour="profil"], [data-tour="einstellungen"]',
  },
];

function clipPfad(rechteck: DOMRect | null, padding = 8): string {
  if (!rechteck) return "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%)";
  const oben = Math.max(0, rechteck.top - padding);
  const rechts = Math.min(window.innerWidth, rechteck.right + padding);
  const unten = Math.min(window.innerHeight, rechteck.bottom + padding);
  const links = Math.max(0, rechteck.left - padding);
  return `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${links}px ${oben}px, ${links}px ${unten}px, ${rechts}px ${unten}px, ${rechts}px ${oben}px, ${links}px ${oben}px)`;
}

export default function ErststartTour() {
  const [offen, setOffen] = useState(() => {
    try {
      return !window.localStorage.getItem(SPEICHER);
    } catch {
      return false;
    }
  });
  const [index, setIndex] = useState(0);
  const [rechteck, setRechteck] = useState<DOMRect | null>(null);
  const [bereit, setBereit] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setBereit(true), 0);
    return () => window.clearTimeout(t);
  }, []);

  const schritt = SCHRITTE[index];
  const letzter = index === SCHRITTE.length - 1;

  useLayoutEffect(() => {
    if (!offen) return;
    const aktualisieren = () => {
      if (!schritt?.selector) {
        setRechteck(null);
        return;
      }
      const el = document.querySelector<HTMLElement>(schritt.selector);
      if (!el) {
        setRechteck(null);
        return;
      }
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
      setRechteck(el.getBoundingClientRect());
    };
    aktualisieren();
    window.addEventListener("resize", aktualisieren);
    window.addEventListener("scroll", aktualisieren, true);
    return () => {
      window.removeEventListener("resize", aktualisieren);
      window.removeEventListener("scroll", aktualisieren, true);
    };
  }, [offen, index, schritt]);

  useEffect(() => {
    if (!offen) return;
    const aufTaste = (e: KeyboardEvent) => {
      if (e.key === "Escape") beenden();
      if (e.key === "ArrowRight") weiter();
      if (e.key === "ArrowLeft") zurueck();
    };
    document.addEventListener("keydown", aufTaste);
    return () => document.removeEventListener("keydown", aufTaste);
  });

  function merken() {
    try {
      window.localStorage.setItem(SPEICHER, "1");
    } catch {
      /* ignorieren */
    }
  }

  function beenden() {
    merken();
    setOffen(false);
  }

  function weiter() {
    if (letzter) {
      beenden();
      return;
    }
    setIndex((i) => Math.min(SCHRITTE.length - 1, i + 1));
  }

  function zurueck() {
    setIndex((i) => Math.max(0, i - 1));
  }

  if (!bereit || !offen) return null;

  const kartenStil: React.CSSProperties = {};
  if (rechteck) {
    const platzUnten = window.innerHeight - rechteck.bottom;
    const oben = platzUnten < 220 && rechteck.top > 220;
    kartenStil.left = Math.min(Math.max(16, rechteck.left), window.innerWidth - 340);
    kartenStil.top = oben ? Math.max(16, rechteck.top - 190) : Math.min(window.innerHeight - 210, rechteck.bottom + 16);
  }

  return createPortal(
    <div className={styles.wurzel} role="dialog" aria-modal="true" aria-label="Einführung">
      <div className={styles.schleier} style={{ clipPath: clipPfad(rechteck) }} />
      {rechteck && (
        <div
          className={styles.fokus}
          style={{
            top: rechteck.top - 8,
            left: rechteck.left - 8,
            width: rechteck.width + 16,
            height: rechteck.height + 16,
          }}
        />
      )}
      <div className={`${styles.karte} ${!rechteck ? styles.karteMitte : ""}`} style={rechteck ? kartenStil : undefined}>
        <p className={styles.schritt}>{index + 1} / {SCHRITTE.length}</p>
        <h2 className={styles.titel}>{schritt.titel}</h2>
        <p className={styles.text}>{schritt.text}</p>
        <div className={styles.aktionen}>
          <button type="button" className={styles.leise} onClick={beenden}>Überspringen</button>
          <div className={styles.rechts}>
            {index > 0 && <button type="button" className={styles.leise} onClick={zurueck}>Zurück</button>}
            <button type="button" className={styles.haupt} onClick={weiter}>{letzter ? "Fertig" : "Weiter"}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
