/**
 * Lernen – Web: app/(app)/lernen/[set]/lernen-seite.tsx.
 *
 * Die Lernkarte im Web-Stil: Verhältnis 4:5, Sprachflächenfarbe, Punktraster,
 * Stufenpunkte, Problemkarten-Pille, Kartenzeichen, Vorlesen. Umdrehen per
 * Transform (ersetzt die 3D-Drehung des Webs). Kopfzeile mit Fortschrittsbalken
 * und XP, vier Bewertungsknöpfe in den Web-Farben, Rückgängig-Leiste, Endschirm.
 *
 * Die gesamte Lernlogik ist unverändert: der Stapel kommt aus /api/lernen,
 * die Rotation aus @lexio/rundenrotation, die Bewertungspunkte aus
 * @lexio/lernlogik. Geändert wurde nur die Darstellung.
 */

import { BEWERTUNGEN } from "@lexio/lernlogik";
import { schwerChance } from "@lexio/reihenfolge";
import { xpFormatieren } from "@lexio/profil";
import type { LernAntwort, LernKarte } from "@lexio/types";
import { FontAwesome6 } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Defs, Pattern, Rect, Circle as SvgCircle, Svg } from "react-native-svg";

import { Fortschrittsbalken } from "../../../components/fortschrittsbalken";
import { Kartenzeichen } from "../../../components/kartenzeichen";
import { Knopf } from "../../../components/knopf";
import { Skelett } from "../../../components/zustand";
import { CAVEAT, MONO, SANS, SERIF } from "../../../design/schrift";
import { useReduzierteBewegung } from "../../../design/bewegung";
import { useDesign } from "../../../design/theme";
import { ABSTAND, KARTEN_TINTE, MASS, RADIUS } from "../../../design/tokens";
import { ApiFehler, holeJson, sendeJson } from "../../../lib/api";
import { rundenFortschritt } from "../../../lib/rundenfortschritt";
import { rotiere } from "../../../lib/rundenrotation";
import { supabase } from "../../../lib/supabase";
import { TON_STANDARD, tonLesen, type TonStand } from "../../../lib/ton";
import { spreche, stoppe } from "../../../lib/vorlesen";

type Bewertung = (typeof BEWERTUNGEN)[number]["id"];

/** Würfel in der Modul-Ebene, damit kein Zufall im Render-Kontext fällt. */
function entscheideSchwer(chance: number): boolean {
  return Math.random() < chance;
}

/** Fortlaufende Nummer für den XP-Pop: jeder Pop bekommt einen neuen `key`. */
let popZaehler = 0;
function naechstePopNummer(): number {
  popZaehler += 1;
  return popZaehler;
}

const TINTE = KARTEN_TINTE.fest;
const TINTE_SOFT = KARTEN_TINTE.weich;

/**
 * Die Farben der Bewertungsknöpfe aus lernen.module.css. Der Text ist auf der
 * eingefärbten Fläche in beiden Designs dunkel bzw. hell – dieselben Werte wie
 * im Web (bewertung_nochmal/schwer/gut/einfach + Hell-Variante).
 */
function bewertungsFarbe(id: Bewertung, hell: boolean): {
  hintergrund: string;
  rand: string;
  text: string;
} {
  switch (id) {
    case "nochmal":
      return {
        hintergrund: "rgba(184, 66, 84, 0.24)",
        rand: "#b84254",
        text: hell ? "#6b0f1d" : "#ffd9de",
      };
    case "schwer":
      return {
        hintergrund: "rgba(231, 177, 74, 0.20)",
        rand: "#e7b14a",
        text: hell ? "#4a3208" : "#ffeec4",
      };
    case "gut":
      return {
        hintergrund: "rgba(101, 168, 141, 0.26)",
        rand: "#65a88d",
        text: hell ? "#10392c" : "#d3f0e4",
      };
    case "einfach":
    default:
      return {
        hintergrund: "rgba(101, 168, 141, 0.42)",
        rand: "#65a88d",
        text: hell ? "#0d2f25" : "#f0fbf6",
      };
  }
}

export default function Lernen() {
  const { farben, hell } = useDesign();
  const { set, modus, runde } = useLocalSearchParams<{
    set: string;
    modus?: string;
    runde?: string;
  }>();

  const slug = typeof set === "string" ? set : "";
  const istUeben = modus === "ueben";
  const istLeech = modus === "leech";
  /*
   * `modus=quaelen` ist der breitere Bruder von leech: nicht nur die versteckten
   * Problemskarten, sondern jedes Wort, das gerade im Minus steht (mehr
   * „nochmal" als richtig). Der Stapel kommt wie im Web aus derselben Route.
   */
  const istQuael = modus === "quaelen";
  const naechsteRunde = (parseInt(String(runde ?? "1"), 10) || 1) + 1;

  const [antwort, setAntwort] = useState<LernAntwort | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laden, setLaden] = useState(true);
  const [neustart, setNeustart] = useState(0);
  const [schwerZaehler, setSchwerZaehler] = useState<Record<string, number>>({});

  const [stapel, setStapel] = useState<LernKarte[]>([]);
  const [index, setIndex] = useState(0);
  const [fertig, setFertig] = useState(false);
  const [aufgedeckt, setAufgedeckt] = useState(false);
  const [bewertend, setBewertend] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  /*
   * Töne aus den Einstellungen. Der Startwert ist die Vorgabe (an, aber
   * nicht automatisch), damit die Karte sofort bedienbar ist; der
   * gespeicherte Stand kommt einen Tick später nach. Das ist derselbe
   * Kompromiss wie beim Design – kurze Zeit die Vorgabe, dann die Wahl.
   */
  const [tonStand, setTonStand] = useState<TonStand>(TON_STANDARD);

  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState<number | null>(null);
  const [letzteAntwort, setLetzteAntwort] = useState<{
    kartenId: string;
    xp: number;
  } | null>(null);
  const [pop, setPop] = useState<{ key: number; xp: number } | null>(null);

  /*
   * Die Tonwahl einmal beim Öffnen lesen. Sie ändert sich während einer
   * Runde nicht – wer sie umstellt, geht in die Einstellungen und kommt
   * über den Zurück-Weg wieder hierher, also neu gemountet.
   */
  useEffect(() => {
    let laeuft = true;
    void tonLesen().then((wert) => {
      if (laeuft) setTonStand(wert);
    });
    return () => {
      laeuft = false;
    };
  }, []);

  const urlRunde = useCallback(() => {
    const pruef = [encodeURIComponent(slug)];
    if (modus === "ueben" || modus === "leech" || modus === "quaelen") {
      pruef.push(`modus=${encodeURIComponent(modus)}`);
    }
    if (modus === "ueben" && runde) pruef.push(`runde=${encodeURIComponent(String(runde))}`);
    return `/api/lernen?set=${pruef.join("&")}`;
  }, [slug, modus, runde]);

  /*
   * Eine Runde laden. `neustart` ist das Signal fürs Neuladen (Erneut
   * versuchen, Rücknahme): ein Inkrement lässt den Effekt noch einmal laufen.
   */
  useEffect(() => {
    let gestoppt = false;
    supabase.auth.getSession().then(({ data }) => {
      if (gestoppt) return;
      if (!data.session) {
        router.replace("/anmelden");
        return;
      }
      holeJson<LernAntwort>(urlRunde())
        .then((daten) => {
          if (gestoppt) return;
          setAntwort(daten);
          setStapel(daten.karten);
          setFertig(false);
          setAufgedeckt(false);
          setIndex(0);
          setSchwerZaehler({});
          setFehler(null);
          setMeldung(null);
          setLaden(false);
        })
        .catch((grund: unknown) => {
          if (gestoppt) return;
          setFehler(grund instanceof ApiFehler ? grund.message : "Unerwarteter Fehler.");
          setLaden(false);
        });
    });
    return () => {
      gestoppt = true;
    };
  }, [urlRunde, neustart]);

  useEffect(() => () => stoppe(), []);

  const karte = stapel[index];

  /*
   * Aufdecken: die eine Stelle, an der die Karte ihre Rückseite zeigt.
   *
   * Bis hierher sprach das Aufdecken die Antwort immer – auch für alle, die
   * nur den Lautsprecher auf der Karte benutzen wollten. Jetzt spricht es
   * nur, wenn „Alle Karten vorlesen" in den Einstellungen steht (Vorgabe
   * aus). Der Lautsprecher auf der Karte bleibt der Weg für alle anderen.
   */
  const aufdecken = useCallback(() => {
    setAufgedeckt(true);
    if (tonStand.vorlesenAlle) {
      spreche([karte?.antwort ?? "", karte?.beispielsatz], antwort?.set.sprache.code ?? null);
    }
  }, [karte, antwort, tonStand.vorlesenAlle]);
  const fortschritt = rundenFortschritt(antwort?.karten.length ?? 0, stapel.length);
  /*
   * Der Balken zeigt die erledigten Karten. `position` ist 1-basiert (erste
   * Karte = 1), also ist `position - 1` die Zahl der schon bewerteten Karten.
   */
  const anteil =
    fortschritt.gesamt === 0 ? 0 : Math.min(1, (fortschritt.position - 1) / fortschritt.gesamt);

  const neuladen = () => {
    setLaden(true);
    setNeustart((n) => n + 1);
  };

  const bewerten = async (karteId: string, bewertung: Bewertung) => {
    if (!karte || bewertend) return;
    setBewertend(true);
    setMeldung(null);
    try {
      const ergebnis = await sendeJson<{ xp?: number; streak?: number | null }>(
        "/api/lernen/antwort",
        { kartenId: karteId, bewertung },
      );
      const xpErhalten = ergebnis.xp ?? 0;
      setXp((vorher) => vorher + xpErhalten);
      if (xpErhalten > 0) setPop({ key: naechstePopNummer(), xp: xpErhalten });
      if (ergebnis.streak !== undefined && ergebnis.streak !== null) {
        setStreak(ergebnis.streak);
      }
      setLetzteAntwort({ kartenId: karteId, xp: xpErhalten });

      const schwerBleibt =
        bewertung === "schwer" &&
        entscheideSchwer(schwerChance(karte.schwierigkeit, schwerZaehler[karteId] ?? 0));
      if (bewertung === "schwer") {
        setSchwerZaehler((zaehler) => ({
          ...zaehler,
          [karteId]: (zaehler[karteId] ?? 0) + 1,
        }));
      }

      const { stapel: neuerStapel, fertig: rundeFertig } = rotiere(
        stapel,
        index,
        karte,
        bewertung,
        schwerBleibt,
      );
      setStapel(neuerStapel);
      if (rundeFertig) {
        setFertig(true);
      }

      setAufgedeckt(false);
      stoppe();
    } catch (grund) {
      setMeldung(grund instanceof ApiFehler ? grund.message : "Unerwarteter Fehler.");
    }
    setBewertend(false);
  };

  const rueckgaengig = async () => {
    if (!letzteAntwort) return;
    setBewertend(true);
    setMeldung(null);
    try {
      const ergebnis = await sendeJson<{ streak?: number | null }>(
        "/api/lernen/antwort/rueckgaengig",
        { kartenId: letzteAntwort.kartenId },
      );
      setXp((vorher) => Math.max(0, vorher - letzteAntwort.xp));
      if (ergebnis.streak !== undefined && ergebnis.streak !== null) {
        setStreak(ergebnis.streak);
      }
      setLetzteAntwort(null);
      neuladen();
    } catch (grund) {
      setMeldung(grund instanceof ApiFehler ? grund.message : "Unerwarteter Fehler.");
    }
    setBewertend(false);
  };

  if (laden && !fehler) {
    return (
      <View style={[styles.schirm, { backgroundColor: farben.background }]}>
        <View style={styles.ladeFach}>
          <Skelett style={styles.ladeKarte} radius={RADIUS.karte} />
          <View style={styles.ladeKnoepfe}>
            {[0, 1, 2, 3].map((i) => (
              <Skelett key={i} style={styles.ladeKnopf} radius={14} />
            ))}
          </View>
        </View>
      </View>
    );
  }

  if (fehler) {
    return (
      <View style={[styles.schirm, { backgroundColor: farben.background }]}>
        <View style={styles.mitte}>
          <Text style={[styles.fehlerText, { color: farben.terracotta }]}>{fehler}</Text>
          <Knopf titel="Erneut versuchen" onPress={neuladen} style={styles.breit} />
          <Knopf
            titel="Zur Übersicht"
            variante="rand"
            onPress={() => router.replace("/")}
            style={styles.breit}
          />
        </View>
      </View>
    );
  }

  if (fertig && !karte) {
    return (
      <Endschirm
        antwort={antwort}
        xp={xp}
        streak={streak}
        istUeben={istUeben}
        istLeech={istLeech}
        istQuael={istQuael}
        aufNeueRunde={() => {
          if (istUeben) {
            router.replace(`/lernen/${encodeURIComponent(slug)}?modus=ueben&runde=${naechsteRunde}`);
          } else if (istQuael) {
            router.replace(
              `/lernen/${encodeURIComponent(slug)}?modus=quaelen&runde=${naechsteRunde}`,
            );
          } else {
            router.replace(`/lernen/${encodeURIComponent(slug)}?modus=ueben`);
          }
        }}
        aufZurueck={() => router.replace("/")}
        aufZuruecknehmen={rueckgaengig}
        kannRueckgaengig={letzteAntwort !== null}
      />
    );
  }

  if (!karte) {
    const leer0 = antwort?.kartenGesamt === 0;
    return (
      <View style={[styles.schirm, { backgroundColor: farben.background }]}>
        <View style={styles.mitte}>
          <Text style={[styles.ankuendigung, { color: farben.textPrimary }]}>
            {leer0
              ? "Noch keine Vokabeln in diesem Set."
              : istQuael
                ? "Gerade kein Quäl-Wort in diesem Set."
                : `Nichts fällig in „${antwort?.set.name ?? ""}“.`}
          </Text>
          {istQuael ? (
            <Text style={[styles.endHinweis, { color: farben.textMuted }]}>
              Quäl-Wörter sind Karten, die du öfter falsch als richtig hattest. Sobald eine
              dazukommt, steht sie hier.
            </Text>
          ) : null}
          {!leer0 && !istQuael && (
            <Knopf
              titel="Nochmal lernen"
              onPress={() => router.replace(`/lernen/${encodeURIComponent(slug)}?modus=ueben`)}
              style={styles.breit}
            />
          )}
          <Knopf
            titel="Zur Übersicht"
            variante="rand"
            onPress={() => router.replace("/")}
            style={styles.breit}
          />
        </View>
      </View>
    );
  }

  const flaeche = antwort?.set.sprache.flaeche || farben.bgElevated2;
  const akzent = antwort?.set.sprache.akzent || farben.gold;

  return (
    <View style={[styles.schirm, { backgroundColor: farben.background }]}>
      {/* Kopfzeile: Zurück, Fortschritt, XP/Serie */}
      <View style={styles.kopf}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Zurück"
          hitSlop={8}
          style={[styles.zurueckKnopf, { backgroundColor: farben.bgElevated2 }]}
        >
          <FontAwesome6 name="arrow-left" size={16} color={farben.textPrimary} />
        </Pressable>

        <View style={styles.fortschritt}>
          <Fortschrittsbalken anteil={anteil} farbe={farben.gold} />
          <Text style={[styles.fortschrittText, { color: farben.textSecondary }]}>
            {fortschritt.position} / {fortschritt.gesamt}
          </Text>
        </View>

        <View style={styles.punkte}>
          <Text style={[styles.xp, { color: farben.gold }]}>{xpFormatieren(xp)}</Text>
          {streak !== null ? (
            <Text style={[styles.streak, { color: farben.textSecondary }]}>
              {streak} {streak === 1 ? "Tag" : "Tage"}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Bühne mit drehbarer Karte */}
      <View style={styles.buehne}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={aufgedeckt ? "Antwort aufgedeckt" : "Karte aufdecken"}
          style={styles.karte}
          onPress={() => {
            if (aufgedeckt) return;
            aufdecken();
          }}
        >
          <Lernkarte
            karte={karte}
            aufgedeckt={aufgedeckt}
            flaeche={flaeche}
            akzent={akzent}
            set={antwort}
            onVorlesen={() => {
              // Wie im Web: der Lautsprecher gehorcht dem Schalter "Töne".
              if (!tonStand.an) return;
              spreche([karte.antwort, karte.beispielsatz], antwort?.set.sprache.code ?? null);
            }}
          />
        </Pressable>
        {aufgedeckt ? (
          <Text style={[styles.modeHinweis, { color: farben.textMuted }]}>
            {istUeben
              ? "Übungsrunde"
              : istLeech
                ? "Reparaturrunde · nur Problemskarten"
                : istQuael
                  ? "Quäl-Wörter · nur diese Wörter"
                  : karte.leech
                  ? "Diese Karte erscheint nicht mehr in der normalen Runde."
                  : `Noch ${antwort?.faelligGesamt ?? stapel.length - 1} ${
                      (antwort?.faelligGesamt ?? 2) === 1 ? "Karte" : "Karten"
                    } fällig`}
          </Text>
        ) : null}
      </View>

      {pop ? <XpPop key={pop.key} xp={pop.xp} onFertig={() => setPop(null)} /> : null}

      {meldung ? (
        <Text style={[styles.meldung, { color: farben.terracotta }]}>{meldung}</Text>
      ) : null}

      {/* Fuß: Aufdecken (solange verdeckt), Rückgängig + vier Bewertungen */}
      <View style={styles.fuss}>
        {letzteAntwort ? (
          <Pressable
            style={styles.rueckgaengig}
            accessibilityRole="button"
            onPress={rueckgaengig}
            disabled={bewertend}
          >
            <Text style={[styles.rueckgaengigText, { color: farben.textSecondary }]}>
              Letzte Antwort zurücknehmen
            </Text>
          </Pressable>
        ) : (
          <View style={styles.rueckgaengigPlatz} />
        )}

        {/*
         * Solange verdeckt ist, steht hier der Knopf aus dem Web und nicht
         * die vier Bewertungen. Der Grund ist Platz, nicht Geschmack: der
         * Fuß ist die letzte Zeile auf einem Screen ohne Scrollen, und die
         * Bewertungen sind vor dem Aufdecken ohnehin gesperrt (das Web zeigt
         * sie blass). So wächst der Fuß nicht, und der nächste Schritt ist
         * ein Knopf statt eines grauen Feldes.
         */}
        {!aufgedeckt ? (
          <Knopf
            titel="Antwort aufdecken"
            hoehe={MASS.aufdecken}
            onPress={aufdecken}
            style={styles.aufdecken}
          />
        ) : (
          <View style={styles.bewertungen}>
            {BEWERTUNGEN.map((bewertung) => {
              const aktiv = aufgedeckt && !bewertend;
              const farbe = bewertungsFarbe(bewertung.id, hell);
              return (
                <Pressable
                  key={bewertung.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${bewertung.label}, plus ${bewertung.xp} XP`}
                  style={[
                    styles.bewertung,
                    {
                      backgroundColor: farbe.hintergrund,
                      borderColor: aktiv ? farbe.rand : "transparent",
                      opacity: aktiv ? 1 : 0.55,
                    },
                  ]}
                  disabled={!aktiv}
                  onPress={() => bewerten(karte.id, bewertung.id)}
                >
                  <Text style={[styles.bewertungLabel, { color: farbe.text }]}>
                    {bewertung.label}
                  </Text>
                  <Text style={[styles.bewertungMeta, { color: farbe.text }]}>
                    +{bewertung.xp} XP
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * Die Karte selbst, mit Umdrehen per Transform.
 *
 * Zwei Ebenen übereinander; die hintere steht vorab auf 180 Grad, damit ihr
 * Text nach dem Drehen wieder richtig herum steht. `backfaceVisibility` blendet
 * jeweils die abgewandte Seite aus – die RN-Entsprechung der Web-3D-Drehung.
 */
function Lernkarte({
  karte,
  aufgedeckt,
  flaeche,
  akzent,
  set,
  onVorlesen,
}: {
  karte: LernKarte;
  aufgedeckt: boolean;
  flaeche: string;
  akzent: string;
  set: LernAntwort | null;
  onVorlesen: () => void;
}) {
  const dreh = useMemo(() => new Animated.Value(0), []);
  const reduziert = useReduzierteBewegung();

  useEffect(() => {
    Animated.timing(dreh, {
      toValue: aufgedeckt ? 1 : 0,
      // Bei reduzierter Bewegung wird ohne Drehung gewechselt.
      duration: reduziert ? 0 : 460,
      easing: Easing.bezier(0.4, 0.14, 0.3, 1),
      useNativeDriver: true,
    }).start();
  }, [aufgedeckt, dreh, reduziert]);

  const vorneDreh = dreh.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const hintenDreh = dreh.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] });

  return (
    <View style={styles.karteInnen}>
      {/* Vorderseite */}
      <Animated.View
        style={[
          styles.kartenSeite,
          { backgroundColor: flaeche, transform: [{ perspective: 1200 }, { rotateY: vorneDreh }] },
        ]}
      >
        <Kartenraster />
        <StufenPunkte stufe={karte.stufe} />
        {karte.leech ? <ProblemPille /> : null}
        <Text style={[styles.karteLabel, { color: TINTE_SOFT }]}>Frage</Text>
        <Text style={[styles.karteText, { color: TINTE }]}>{karte.frage}</Text>
        <Text style={[styles.karteTipp, { color: TINTE_SOFT }]}>Tippen zum Aufdecken</Text>
        <KartenMarke karteId={karte.id} />
        <SprachPille set={set} />
      </Animated.View>

      {/* Rückseite */}
      <Animated.View
        style={[
          styles.kartenSeite,
          { backgroundColor: flaeche, transform: [{ perspective: 1200 }, { rotateY: hintenDreh }] },
        ]}
      >
        <Kartenraster />
        <Text style={[styles.karteText, { color: TINTE }]}>{karte.antwort}</Text>
        {karte.beispielsatz ? (
          <View style={styles.karteBeispielBox}>
            <Text style={[styles.karteBeispiel, { color: TINTE_SOFT }]}>
              {karte.beispielsatz}
            </Text>
            {karte.beispielUebersetzung ? (
              <Text style={[styles.karteBeispielUebersetzung, { color: TINTE_SOFT }]}>
                {karte.beispielUebersetzung}
              </Text>
            ) : null}
          </View>
        ) : null}
        <KartenMarke karteId={karte.id} />
        <SprachPille set={set} />
        {akzent ? <View style={[styles.kartenAkzent, { backgroundColor: akzent }]} /> : null}
        <Pressable
          style={styles.karteTon}
          accessibilityRole="button"
          accessibilityLabel="Antwort vorlesen"
          hitSlop={8}
          onPress={onVorlesen}
        >
          <FontAwesome6 name="volume-high" size={16} color="#f0e8d5" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** Das Punktraster wie ein Notizblockblatt (Web: radial-gradient 16px). */
function Kartenraster() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id="lexioRaster" width="16" height="16" patternUnits="userSpaceOnUse">
          <SvgCircle cx="1" cy="1" r="1" fill={KARTEN_TINTE.raste} />
        </Pattern>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#lexioRaster)" />
    </Svg>
  );
}

/** Die sieben Stufenpunkte oben rechts (nur Vorderseite). */
function StufenPunkte({ stufe }: { stufe: number }) {
  return (
    <View style={styles.stufePunkte} pointerEvents="none">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <View
          key={i}
          style={[
            styles.stufePunkt,
            { backgroundColor: i < stufe ? "rgba(13,23,29,0.85)" : "rgba(13,23,29,0.28)" },
          ]}
        />
      ))}
    </View>
  );
}

/** Die Problemkarten-Pille oben links (nur Rückseite, wenn leech). */
function ProblemPille() {
  return (
    <View style={styles.problemPille} pointerEvents="none">
      <Text style={styles.problemText}>Problemskarte</Text>
    </View>
  );
}

/** Das Kartenzeichen unten rechts – deterministisch aus der Karten-ID. */
function KartenMarke({ karteId }: { karteId: string }) {
  return (
    <View style={styles.karteMarke} pointerEvents="none">
      <Kartenzeichen karteId={karteId} groesse={30} farbe={TINTE} />
    </View>
  );
}

/** Die Sprachpille unten links: Zeichen + Sprachname. */
function SprachPille({ set }: { set: LernAntwort | null }) {
  const name = set?.set.sprache.name ?? "";
  if (!name) return null;
  return (
    <View style={styles.sprachPille} pointerEvents="none">
      <View style={[styles.sprachPunkt, { backgroundColor: set?.set.sprache.akzent || "#e7b14a" }]} />
      <Text numberOfLines={1} style={styles.sprachPilleText}>
        {name}
      </Text>
    </View>
  );
}

/** Der XP-Pop beim Bewerten (Web: .xpPop, Animation `pop`). */
function XpPop({ xp, onFertig }: { xp: number; onFertig: () => void }) {
  const wert = useMemo(() => new Animated.Value(0), []);
  const { farben } = useDesign();
  const reduziert = useReduzierteBewegung();

  useEffect(() => {
    Animated.timing(wert, {
      toValue: 1,
      // Bei reduzierter Bewegung erscheint der Pop ohne Flug (Dauer 0).
      duration: reduziert ? 0 : 900,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => onFertig());
  }, [wert, onFertig, reduziert]);

  const opacity = wert.interpolate({ inputRange: [0, 0.25, 0.7, 1], outputRange: [0, 1, 1, 0] });
  const scale = wert.interpolate({
    inputRange: [0, 0.25, 0.7, 1],
    outputRange: [0.6, 1.12, 1, 0.95],
  });
  const translateY = wert.interpolate({ inputRange: [0, 1], outputRange: [0, -28] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.xpPop,
        { opacity, transform: [{ translateY }, { scale }] },
      ]}
    >
      <Text style={[styles.xpPopText, { color: farben.gold }]}>+{xp}</Text>
    </Animated.View>
  );
}

function Endschirm({
  antwort,
  xp,
  streak,
  istUeben,
  istLeech,
  istQuael,
  aufNeueRunde,
  aufZurueck,
  aufZuruecknehmen,
  kannRueckgaengig,
}: {
  antwort: LernAntwort | null;
  xp: number;
  streak: number | null;
  istUeben: boolean;
  istLeech: boolean;
  istQuael: boolean;
  aufNeueRunde: () => void;
  aufZurueck: () => void;
  aufZuruecknehmen: () => void;
  kannRueckgaengig: boolean;
}) {
  const { farben } = useDesign();
  const gesamt = antwort?.faelligGesamt ?? 0;
  const zusatz = antwort?.setZuGross
    ? "Teile dieses Set lieber auf – es hat mehr als 1001 Karten."
    : "";

  return (
    <View style={[styles.schirm, { backgroundColor: farben.background }]}>
      <ScrollView contentContainerStyle={styles.endschirm}>
        <Text style={[styles.endTitel, { color: farben.textPrimary }]}>
          {istQuael
            ? "Quäl-Wörter geübt"
            : istLeech
              ? "Reparaturrunde geschafft"
              : istUeben
                ? "Übungsrunde geschafft"
                : "Runde geschafft"}
        </Text>
        <Text style={[styles.endAktion, { color: farben.textSecondary }]}>
          „{antwort?.set.name ?? ""}“ · {gesamt} {gesamt === 1 ? "Karte" : "Karten"} ·{" "}
          {xpFormatieren(xp)}
        </Text>
        {streak !== null ? (
          <Text style={[styles.endSerie, { color: farben.gold }]}>{streak} Tage Serie</Text>
        ) : null}
        {zusatz ? (
          <Text style={[styles.endHinweis, { color: farben.textMuted }]}>{zusatz}</Text>
        ) : null}

        <Knopf
          titel={
            istUeben || istQuael
              ? "Weitere Runde"
              : istLeech
                ? "Nochmal als Übung"
                : "Nochmal lernen"
          }
          onPress={aufNeueRunde}
          style={styles.endKnopf}
        />
        {kannRueckgaengig ? (
          <Knopf
            titel="Letzte Antwort zurücknehmen"
            variante="rand"
            onPress={aufZuruecknehmen}
            style={styles.endKnopf}
          />
        ) : null}
        <Knopf
          titel="Zur Übersicht"
          variante="rand"
          onPress={aufZurueck}
          style={styles.endKnopf}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  schirm: { flex: 1 },
  kopf: {
    flexDirection: "row",
    alignItems: "center",
    gap: ABSTAND.md,
    paddingHorizontal: ABSTAND.lg,
    paddingTop: ABSTAND.md,
    paddingBottom: ABSTAND.sm,
  },
  zurueckKnopf: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.pille,
    alignItems: "center",
    justifyContent: "center",
  },
  fortschritt: { flex: 1, flexDirection: "row", alignItems: "center", gap: ABSTAND.sm },
  fortschrittText: { fontFamily: MONO.regular, fontSize: 14 },
  punkte: { alignItems: "flex-end", minWidth: 56 },
  xp: { fontFamily: MONO.bold, fontSize: 14 },
  streak: { fontFamily: MONO.regular, fontSize: 12 },

  buehne: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: ABSTAND.lg },
  karte: { width: "100%", maxWidth: 460, aspectRatio: 4 / 5, maxHeight: 520 },
  karteInnen: { flex: 1 },
  kartenSeite: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: RADIUS.karte,
    alignItems: "center",
    justifyContent: "center",
    gap: ABSTAND.md,
    paddingHorizontal: ABSTAND.xl,
    paddingTop: ABSTAND.xl,
    paddingBottom: 44,
    overflow: "hidden",
    backfaceVisibility: "hidden",
  },
  kartenAkzent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  karteLabel: {
    fontFamily: MONO.bold,
    fontSize: 14,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  karteText: {
    fontFamily: CAVEAT.bold,
    fontSize: 40,
    lineHeight: 44,
    textAlign: "center",
  },
  karteBeispielBox: { alignItems: "center", gap: 4, marginTop: 4 },
  karteBeispiel: { fontFamily: SANS.regular, fontSize: 16, lineHeight: 22, textAlign: "center" },
  karteBeispielUebersetzung: {
    fontFamily: SANS.regular,
    fontSize: 14,
    textAlign: "center",
  },
  karteTipp: {
    position: "absolute",
    bottom: 14,
    fontFamily: CAVEAT.bold,
    fontSize: 16,
  },
  karteTon: {
    position: "absolute",
    top: 14,
    left: 14,
    width: 38,
    height: 38,
    borderRadius: RADIUS.pille,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(13, 23, 29, 0.82)",
  },
  stufePunkte: {
    position: "absolute",
    top: 14,
    right: 14,
    flexDirection: "row",
    gap: 3,
  },
  stufePunkt: { width: 6, height: 6, borderRadius: 3 },
  problemPille: {
    position: "absolute",
    top: 14,
    left: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pille,
    backgroundColor: "rgba(184, 66, 84, 0.16)",
    borderWidth: 1,
    borderColor: "#b84254",
  },
  problemText: {
    fontFamily: SANS.bold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#ffd9de",
  },
  karteMarke: { position: "absolute", right: 14, bottom: 14 },
  sprachPille: {
    position: "absolute",
    left: 14,
    bottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: 140,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pille,
    backgroundColor: "rgba(13, 23, 29, 0.82)",
  },
  sprachPunkt: { width: 8, height: 8, borderRadius: 4 },
  sprachPilleText: {
    fontFamily: SANS.semibold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#f0e8d5",
  },

  modeHinweis: { marginTop: ABSTAND.md, fontFamily: SANS.regular, fontSize: 13, textAlign: "center" },
  meldung: { fontFamily: SANS.regular, fontSize: 13, textAlign: "center", paddingHorizontal: ABSTAND.xl },

  xpPop: { position: "absolute", top: "22%", left: 0, right: 0, alignItems: "center" },
  xpPopText: { fontFamily: MONO.bold, fontSize: 38 },

  fuss: { paddingHorizontal: ABSTAND.lg, paddingBottom: ABSTAND.md, gap: ABSTAND.sm },
  /* Dieselbe Breite wie die Karte (460 im Web) und mittig. */
  aufdecken: { alignSelf: "center", width: "100%", maxWidth: 460 },
  rueckgaengig: { alignItems: "center", paddingVertical: 2 },
  rueckgaengigPlatz: { height: 22 },
  rueckgaengigText: {
    fontFamily: SANS.medium,
    fontSize: 14,
    textDecorationLine: "underline",
  },
  bewertungen: { flexDirection: "row", gap: 7 },
  bewertung: {
    flex: 1,
    minHeight: 74,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  bewertungLabel: { fontFamily: SANS.bold, fontSize: 15 },
  bewertungMeta: { fontFamily: MONO.regular, fontSize: 11 },

  mitte: { flex: 1, alignItems: "center", justifyContent: "center", padding: ABSTAND.xl, gap: ABSTAND.md },
  ankuendigung: { fontFamily: SANS.regular, fontSize: 16, textAlign: "center" },
  fehlerText: { fontFamily: SANS.regular, fontSize: 15, textAlign: "center" },
  breit: { alignSelf: "stretch" },

  ladeFach: { flex: 1, padding: ABSTAND.xl, justifyContent: "center", gap: ABSTAND.xl },
  ladeKarte: { width: "100%", aspectRatio: 4 / 5 },
  ladeKnoepfe: { flexDirection: "row", gap: 7 },
  ladeKnopf: { flex: 1, height: 74 },

  endschirm: { flexGrow: 1, justifyContent: "center", padding: ABSTAND.xl, gap: ABSTAND.md },
  endTitel: { fontFamily: SERIF.bold, fontSize: 28, textAlign: "center" },
  endAktion: { fontFamily: SANS.regular, fontSize: 15, textAlign: "center" },
  endSerie: { fontFamily: MONO.bold, fontSize: 15, textAlign: "center" },
  endHinweis: { fontFamily: SANS.regular, fontSize: 13, textAlign: "center" },
  endKnopf: { alignSelf: "stretch" },
});
