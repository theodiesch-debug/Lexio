/**
 * Wortschatz-Test – Web: components/wortschatz-test/wortschatz-test.tsx
 * (Variante „konto") und app/(app)/mein-wortschatz/page.tsx.
 *
 * 25 Wörter aus fünf Häufigkeitsbändern: erst nachdenken, dann die englische
 * Antwort aufdecken, dann ehrlich einschätzen. Am Ende entsteht aus den
 * Wörtern, die man nicht kannte, ein Set.
 *
 * Die Wortliste liegt als Asset im Bündel
 * (`lexio-app/assets/wortschatz-test.json`, geschrieben von
 * `scripts/wortschatz-test-erzeugen.mjs`). Deshalb braucht der Test kein Netz:
 * alles außer „Set anlegen" läuft ohne Verbindung. Die Stichprobe und die
 * Hochrechnung kommen aus `@lexio/wortschatz-test` – dieselbe reine Logik wie
 * im Web, nicht eine zweite Fassung davon.
 */

import { baueTestreihe, schaetzeWortschatz, zahl, type Testaufgabe, type WortschatzDaten } from "@lexio/wortschatz-test";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Fortschrittsbalken } from "../../components/fortschrittsbalken";
import { Karte } from "../../components/karte";
import { Knopf } from "../../components/knopf";
import { SERIF, SANS, MONO } from "../../design/schrift";
import { useDesign } from "../../design/theme";
import { ABSTAND } from "../../design/tokens";
import { ApiFehler, sendeJson } from "../../lib/api";

const DATEN = require("@/assets/wortschatz-test.json") as WortschatzDaten;

/** Wörter je Frequenzband. 5 mal 5 Bänder – in gut zwei Minuten zu schaffen. */
const PRO_BAND = 5;

/** Der Test ist englisch; die Karte zeigt deutsch, die Antwort ist englisch. */
const SPRACHE_CODE = "en";

type Phase = "start" | "test" | "ende";

export default function WortschatzTest() {
  const { farben } = useDesign();
  const [phase, setPhase] = useState<Phase>("start");
  const [reihe, setReihe] = useState<Testaufgabe[]>([]);
  const [index, setIndex] = useState(0);
  const [antworten, setAntworten] = useState<boolean[]>([]);
  const [aufgedeckt, setAufgedeckt] = useState(false);

  const starten = useCallback(() => {
    setReihe(baueTestreihe(DATEN, PRO_BAND));
    setIndex(0);
    setAntworten([]);
    setAufgedeckt(false);
    setPhase("test");
  }, []);

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

  const ergebnis = useMemo(() => {
    if (phase !== "ende") return null;
    const proBand = new Map<string, { getestet: number; gekannt: number }>();
    reihe.forEach((aufgabe, i) => {
      const stand = proBand.get(aufgabe.bandName) ?? { getestet: 0, gekannt: 0 };
      stand.getestet += 1;
      if (antworten[i]) stand.gekannt += 1;
      proBand.set(aufgabe.bandName, stand);
    });
    return schaetzeWortschatz(
      DATEN.baender.map((band) => {
        const stand = proBand.get(band.name) ?? { getestet: 0, gekannt: 0 };
        return {
          name: band.name,
          titel: band.titel,
          groesse: band.groesse,
          getestet: stand.getestet,
          gekannt: stand.gekannt,
        };
      }),
    );
  }, [phase, reihe, antworten]);

  // Die nicht gekannten Wörter in der Reihenfolge des Tests.
  const unbekannt = useMemo(
    () =>
      reihe.filter((_, i) => antworten[i] === false).map((aufgabe) => aufgabe.wort),
    [reihe, antworten],
  );

  if (phase === "start") {
    return (
      <ScrollView
        style={{ backgroundColor: farben.background }}
        contentContainerStyle={styles.seite}
      >
        <Text style={[styles.titel, { color: farben.textPrimary }]}>Wortschatz-Test</Text>
        <Text style={[styles.untertitel, { color: farben.textMuted }]}>
          25 Wörter, etwa zwei Minuten. Am Ende weißt du ungefähr, wie groß dein englischer
          Wortschatz ist – und kannst die Wörter, die du nicht kanntest, als Set anlegen.
        </Text>

        <Karte style={styles.kasten}>
          <Text style={[styles.hinweisKlein, { color: farben.textMuted }]}>Wortschatz-Check</Text>
          <Text style={[styles.kastenTitel, { color: farben.textPrimary }]}>
            25 Wörter, etwa zwei Minuten
          </Text>
          <Text style={[styles.kastenText, { color: farben.textSecondary }]}>
            Du siehst nacheinander 25 deutsche Wörter aus fünf Häufigkeitsstufen. Überleg kurz, wie
            sie auf Englisch heißen, deck die Antwort auf und entscheid dann ehrlich, ob du sie
            kanntest.
          </Text>
          <Text style={[styles.kastenText, { color: farben.textSecondary }]}>
            Hinterher kannst du dir die Wörter, die du nicht kanntest, als eigenes Set anlegen –
            dann lernst du genau diese.
          </Text>
          <Knopf titel="Test starten" onPress={starten} style={styles.startKnopf} />
        </Karte>
      </ScrollView>
    );
  }

  if (phase === "test") {
    const aufgabe = reihe[index];
    return (
      <ScrollView
        style={{ backgroundColor: farben.background }}
        contentContainerStyle={styles.seite}
      >
        <View style={styles.fortschritt}>
          <Fortschrittsbalken anteil={index / reihe.length} style={styles.fortschrittBalken} />
          <Text style={[styles.fortschrittText, { color: farben.textSecondary }]}>
            {index + 1} / {reihe.length}
          </Text>
        </View>

        <Karte inset style={styles.kartenFlaeche}>
          <Text style={[styles.karteFrage, { color: farben.textPrimary }]}>
            {aufgabe.wort.frage}
          </Text>
          {aufgedeckt ? (
            <Text style={[styles.karteAntwort, { color: farben.gold }]}>
              {aufgabe.wort.antwort}
            </Text>
          ) : (
            <Text style={[styles.karteAuftrag, { color: farben.textMuted }]}>
              Wie heißt das auf Englisch?
            </Text>
          )}
        </Karte>

        {aufgedeckt ? (
          <View style={styles.antworten}>
            <Knopf
              titel="Wusste ich"
              onPress={() => antworten_(true)}
              style={styles.antwortKnopf}
            />
            <Knopf
              titel="Wusste ich nicht"
              variante="rand"
              onPress={() => antworten_(false)}
              style={styles.antwortKnopf}
            />
          </View>
        ) : (
          <Knopf titel="Antwort aufdecken" onPress={() => setAufgedeckt(true)} />
        )}
      </ScrollView>
    );
  }

  if (!ergebnis) return null;
  const prozent = ergebnis.gesamtGroesse > 0 ? ergebnis.geschaetzt / ergebnis.gesamtGroesse : 0;

  return (
    <ScrollView
      style={{ backgroundColor: farben.background }}
      contentContainerStyle={styles.seite}
    >
      <Text style={[styles.ergebnisTitel, { color: farben.textPrimary }]}>
        Etwa{" "}
        <Text style={{ color: farben.gold }}>{zahl(ergebnis.geschaetzt)}</Text> Wörter
      </Text>
      <Text style={[styles.untertitel, { color: farben.textSecondary }]}>
        von {zahl(ergebnis.gesamtGroesse)} Wörtern dieser Liste – geschätzt aus {ergebnis.getestet}{" "}
        Stichproben, {ergebnis.gekannt} davon bekannt.
      </Text>

      <Fortschrittsbalken anteil={prozent} hoehe={12} style={styles.gesamtbalken} />

      <View style={styles.baender}>
        {ergebnis.baender.map((band) => (
          <View key={band.name} style={styles.band}>
            <View style={styles.bandKopf}>
              <Text style={[styles.bandTitel, { color: farben.textPrimary }]}>{band.titel}</Text>
              <Text style={[styles.bandWert, { color: farben.textSecondary }]}>
                {band.gekannt} / {band.getestet}
              </Text>
            </View>
            <Fortschrittsbalken
              anteil={band.anteil}
              farbe={farben.sage}
              hoehe={8}
              style={styles.bandBalken}
            />
            <Text style={[styles.bandSchaetzung, { color: farben.textMuted }]}>
              {band.geschaetzt === null
                ? "nicht getestet"
                : `geschätzt ${zahl(band.geschaetzt)} von ${zahl(band.groesse)}`}
            </Text>
          </View>
        ))}
      </View>

      <Text style={[styles.ehrlich, { color: farben.textSecondary, borderLeftColor: farben.terracotta }]}>
        Das ist eine Selbsteinschätzung aus je {PRO_BAND} Wörtern pro Stufe – ein Anhaltspunkt,
        keine Messung. Wer mag, wiederholt den Test: es kommen andere Wörter.
      </Text>

      <SetAusTest woerter={unbekannt} />

      <Knopf titel="Nochmal" onPress={starten} style={styles.nochmal} />
    </ScrollView>
  );
}

/**
 * „Set aus diesen Wörtern anlegen".
 *
 * Erst das Set, dann die Karten – umgekehrt ginge es nicht, weil `/api/karten`
 * den Slug eines bestehenden Sets braucht. Nur dieser Schritt braucht Netz.
 */
function SetAusTest({
  woerter,
}: {
  woerter: { frage: string; antwort: string }[];
}) {
  const { farben } = useDesign();
  const [zustand, setZustand] = useState<"ruhe" | "laeuft" | "fertig" | "fehler">("ruhe");
  const [meldung, setMeldung] = useState("");
  const [slug, setSlug] = useState("");

  const anlegen = useCallback(async () => {
    setZustand("laeuft");
    setMeldung("");
    try {
      const datum = new Date().toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const setAntwort = await sendeJson<{ set: { id: string; slug: string } }>(
        "/api/sets",
        { name: `Wortschatz-Test ${datum}`, spracheCode: SPRACHE_CODE },
      );
      await sendeJson("/api/karten", {
        setSlug: setAntwort.set.slug,
        paare: woerter.map((wort) => ({ frage: wort.frage, antwort: wort.antwort })),
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
      <Karte style={styles.setBlock}>
        <Text style={[styles.setErfolg, { color: farben.sage }]}>
          Du kanntest alle 25 Wörter. Nichts, das übrig bliebe.
        </Text>
      </Karte>
    );
  }

  if (zustand === "fertig") {
    return (
      <Karte style={styles.setBlock}>
        <Text style={[styles.setErfolg, { color: farben.sage }]}>
          {woerter.length} {woerter.length === 1 ? "Wort" : "Wörter"} liegen jetzt in einem Set
          unter diesem Namen.
        </Text>
        <View style={styles.setAktionen}>
          <Knopf
            titel="Jetzt lernen"
            onPress={() => router.replace(`/lernen/${encodeURIComponent(slug)}`)}
            style={styles.antwortKnopf}
          />
          <Knopf
            titel="Fertig"
            variante="rand"
            onPress={() => router.replace("/")}
            style={styles.antwortKnopf}
          />
        </View>
      </Karte>
    );
  }

  return (
    <Karte style={styles.setBlock}>
      <Text style={[styles.setTitel, { color: farben.textPrimary }]}>
        Diese {woerter.length} kanntest du nicht:
      </Text>
      <Text style={[styles.setText, { color: farben.textSecondary }]}>
        {woerter.map((wort) => wort.frage).join(", ")}
      </Text>
      <Knopf
        titel={zustand === "laeuft" ? "Set wird angelegt …" : "Daraus ein Set anlegen"}
        onPress={anlegen}
        disabled={zustand === "laeuft"}
        style={styles.setKnopf}
      />
      {zustand === "fehler" ? (
        <Text style={[styles.setFehler, { color: farben.terracotta }]}>{meldung}</Text>
      ) : null}
    </Karte>
  );
}

const styles = StyleSheet.create({
  seite: {
    padding: ABSTAND.xl,
    gap: ABSTAND.lg,
    paddingBottom: ABSTAND.xxl,
  },
  titel: { fontFamily: SERIF.bold, fontSize: 30 },
  untertitel: { fontFamily: SANS.regular, fontSize: 16, lineHeight: 24 },
  kasten: { padding: ABSTAND.lg, gap: ABSTAND.sm },
  hinweisKlein: {
    fontFamily: SANS.semibold,
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  kastenTitel: { fontFamily: SERIF.bold, fontSize: 22 },
  kastenText: { fontFamily: SANS.regular, fontSize: 15, lineHeight: 23 },
  startKnopf: { alignSelf: "flex-start", marginTop: ABSTAND.sm, minWidth: 180 },
  fortschritt: { flexDirection: "row", alignItems: "center", gap: ABSTAND.sm },
  fortschrittBalken: { flex: 1 },
  fortschrittText: { fontFamily: MONO.regular, fontSize: 14 },
  kartenFlaeche: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: ABSTAND.sm,
    padding: ABSTAND.lg,
  },
  karteFrage: { fontFamily: SERIF.bold, fontSize: 34, textAlign: "center" },
  karteAuftrag: { fontFamily: SANS.regular, fontSize: 15, textAlign: "center" },
  karteAntwort: { fontFamily: SERIF.bold, fontSize: 26, textAlign: "center" },
  antworten: { flexDirection: "row", gap: ABSTAND.sm },
  antwortKnopf: { flex: 1 },
  ergebnisTitel: { fontFamily: SERIF.bold, fontSize: 28 },
  gesamtbalken: { marginTop: ABSTAND.xs },
  baender: { gap: ABSTAND.md },
  band: { gap: 4 },
  bandKopf: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  bandTitel: { fontFamily: SANS.semibold, fontSize: 15, flexShrink: 1 },
  bandWert: { fontFamily: MONO.regular, fontSize: 14 },
  bandBalken: { marginTop: 2 },
  bandSchaetzung: { fontFamily: SANS.regular, fontSize: 14 },
  ehrlich: {
    fontFamily: SANS.regular,
    fontSize: 15,
    lineHeight: 23,
    borderLeftWidth: 3,
    paddingLeft: ABSTAND.sm,
  },
  setBlock: { padding: ABSTAND.lg, gap: ABSTAND.sm },
  setTitel: { fontFamily: SANS.semibold, fontSize: 15 },
  setText: { fontFamily: SANS.regular, fontSize: 15, lineHeight: 23 },
  setErfolg: { fontFamily: SANS.semibold, fontSize: 16, lineHeight: 23 },
  setAktionen: { flexDirection: "row", gap: ABSTAND.sm, marginTop: ABSTAND.xs },
  setKnopf: { alignSelf: "flex-start", marginTop: ABSTAND.xs },
  setFehler: { fontFamily: SANS.regular, fontSize: 15 },
  nochmal: { alignSelf: "flex-start", minWidth: 160 },
});
