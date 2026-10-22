/**
 * Übersicht – Web: components/uebersicht/uebersicht.tsx.
 *
 * Begrüßung mit XP- und Streak-Abzeichen, die große Karteikarten-Karte mit
 * „Weiter lernen", darunter das Kachelraster aller Sets. Die Zahlen kommen aus
 * /api/profil und /api/karteikarten, nicht aus einem Mockup.
 */

import { FontAwesome6 } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";

import { xpFormatieren } from "@lexio/profil";

import { Dialog } from "../../components/dialog";
import { Karte } from "../../components/karte";
import { SetKachel, type KachelSet } from "../../components/kachel";
import { Knopf } from "../../components/knopf";
import { Leerzustand, Melde, Skelett } from "../../components/zustand";
import { SERIF, SANS } from "../../design/schrift";
import { useDesign } from "../../design/theme";
import { ABSTAND, heroVerlauf, RADIUS } from "../../design/tokens";
import { ApiFehler, holeJson, sendeJson } from "../../lib/api";
import { useDatenCache } from "../../lib/daten-cache";
import {
    antwortenNachschieben,
    neueKartenUebertragen,
} from "../../lib/offline";

type Meldung = { text: string; fehler: boolean } | null;

export default function Uebersicht() {
    const { farben, schatten, design } = useDesign();
    const cache = useDatenCache();
    const [meldung, setMeldung] = useState<Meldung>(null);
    const [loeschZiel, setLoeschZiel] = useState<KachelSet | null>(null);

    /*
     * Sets, Profil und Ladezustand kommen direkt aus dem gemeinsamen Cache.
     * Der hält den letzten Stand im Speicher und frischt ihn im Hintergrund
     * auf – hier braucht es dafür keinen eigenen Zustand und keinen Effekt.
     */
    const sets = cache.sets;
    const profil = cache.profil;
    const laden = cache.laden;

    const ladeSets = useCallback(async () => {
        await cache.aktualisieren(true);
    }, [cache]);

    useEffect(() => {
        /*
         * Was offline liegen blieb, jetzt nachschieben. Bewusst ohne Warten
         * und ohne Meldung: es ist ein Nachtrag, kein Teil dieser Ansicht.
         * Klappt es nicht, bleibt es in der Queue.
         */
        void antwortenNachschieben(async (kartenId, bewertung) => {
            await sendeJson("/api/lernen/antwort", { kartenId, bewertung });
        }).catch(() => 0);
        // Und was offline angelegt wurde – ebenfalls als Nachtrag.
        void neueKartenUebertragen().catch(() => 0);
    }, []);

    useEffect(() => {
        if (!meldung) return;
        const t = setTimeout(() => setMeldung(null), 4000);
        return () => clearTimeout(t);
    }, [meldung]);

    async function loeschenBestaetigt(set: KachelSet) {
        try {
            await holeJson(`/api/sets/${encodeURIComponent(set.id)}`, null, {
                method: "DELETE",
            });
            setLoeschZiel(null);
            setMeldung({ text: `„${set.name}" gelöscht.`, fehler: false });
            await ladeSets();
        } catch (fehler: unknown) {
            setMeldung({
                text:
                    fehler instanceof ApiFehler
                        ? fehler.message
                        : "Set konnte nicht gelöscht werden.",
                fehler: true,
            });
        }
    }

    const naechstes = [...sets]
        .filter((s) => s.kartenFaellig > 0)
        .sort((a, b) => b.kartenFaellig - a.kartenFaellig)[0];

    const faelligGesamt = sets.reduce((sum, s) => sum + (s.kartenFaellig || 0), 0);

    /*
     * Der Quäl-Einstieg erscheint nur, wenn es überhaupt Quäl-Wörter gibt.
     * Führen soll das Set mit den meisten: dort gibt es am meisten zu holen.
     * Dieselbe Regel wie im Web (components/uebersicht/uebersicht.tsx).
     */
    const quaelGesamt = sets.reduce((sum, s) => sum + (s.quaelAnzahl ?? 0), 0);
    const quaelSet = [...sets]
        .filter((s) => (s.quaelAnzahl ?? 0) > 0)
        .sort((a, b) => (b.quaelAnzahl ?? 0) - (a.quaelAnzahl ?? 0))[0];

    const lernText = faelligGesamt
        ? `Lerne heute ${faelligGesamt} ${faelligGesamt === 1 ? "Wort" : "Wörter"}.`
        : naechstes
          ? `Du bist auf dem neuesten Stand. ${naechstes.kartenGelernt} von ${naechstes.kartenGesamt} Karten gelernt.`
          : "Lege dein erstes Set an und lerne sofort los.";

    const hero = heroVerlauf(design);

    return (
        <View style={styles.rahmen}>
            <ScrollView
                style={{ backgroundColor: farben.background }}
                contentContainerStyle={styles.seite}
                showsVerticalScrollIndicator={false}
            >
                <Animated.View entering={FadeInDown.delay(0).duration(280)}>
                <View style={styles.begruessung}>
                    <View style={styles.begruessungText}>
                        <Text style={[styles.hallo, { color: farben.textPrimary }]}>
                            {profil ? `Hallo ${profil.vorname},` : "Hallo,"}
                        </Text>
                        <Text style={[styles.unter, { color: farben.textSecondary }]}>
                            Schön, dass du wieder da bist!
                        </Text>
                    </View>
                    {profil ? (
                        <View style={styles.abzeichen}>
                            <View
                                style={[
                                    styles.abzeichenEintrag,
                                    { backgroundColor: farben.bgElevated, borderColor: farben.line },
                                ]}
                            >
                                <FontAwesome6 name="bolt" size={12} color={farben.gold} />
                                <Text style={[styles.abzeichenText, { color: farben.textPrimary }]}>
                                    <Text style={[styles.abzeichenZahl, { color: farben.gold }]}>
                                        {xpFormatieren(profil.xp)}
                                    </Text>{" "}
                                    XP
                                </Text>
                            </View>
                            <View
                                style={[
                                    styles.abzeichenEintrag,
                                    { backgroundColor: farben.bgElevated, borderColor: farben.line },
                                ]}
                            >
                                <FontAwesome6 name="fire" size={12} color={farben.terracotta} />
                                <Text style={[styles.abzeichenText, { color: farben.textPrimary }]}>
                                    {profil.streak} {profil.streak === 1 ? "Tag" : "Tage"} Streak
                                </Text>
                            </View>
                        </View>
                    ) : null}
                </View>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(60).duration(280)}>
                <View style={[styles.hero, schatten.karte]}>
                    <LinearGradient
                        colors={hero.farben}
                        locations={hero.stellen}
                        start={hero.start}
                        end={hero.ende}
                        style={styles.heroInnen}
                    >
                        <Text style={[styles.heroTitel, { color: farben.textPrimary }]}>
                            Karteikarten
                        </Text>
                        <Text style={[styles.heroText, { color: farben.textSecondary }]}>
                            {lernText}
                        </Text>
                        <Knopf
                            titel="Weiter lernen"
                            onPress={() =>
                                naechstes && router.push(`/lernen/${encodeURIComponent(naechstes.id)}`)
                            }
                            disabled={!naechstes}
                            style={styles.heroKnopf}
                        />
                    </LinearGradient>
                </View>
                </Animated.View>

                {quaelSet ? (
                    <Animated.View entering={FadeInDown.delay(120).duration(280)}>
                    <Karte style={[styles.banner, { borderColor: farben.terracotta }]}>
                        <View style={styles.bannerKopf}>
                            <FontAwesome6 name="fire" size={18} color={farben.terracotta} />
                            <Text style={[styles.bannerTitel, { color: farben.textPrimary }]}>
                                Quäl-Wörter
                            </Text>
                        </View>
                        <Text style={[styles.bannerText, { color: farben.textSecondary }]}>
                            {quaelGesamt === 1 ? "Ein Wort" : `${quaelGesamt} Wörter`} hast du dir
                            noch nicht gemerkt. Eine kurze Runde nur mit diesen Wörtern holt sie
                            zurück.
                        </Text>
                        <Knopf
                            titel="Quäl-Wörter üben"
                            variante="terrakotta"
                            onPress={() =>
                                router.push(
                                    `/lernen/${encodeURIComponent(quaelSet.id)}?modus=quaelen`,
                                )
                            }
                            style={styles.bannerKnopf}
                        />
                    </Karte>
                    </Animated.View>
                ) : null}

                {/*
                 * Der Wortschatz-Test lag bisher außerhalb der App und war über
                 * keinen Weg von innen erreichbar. Er steht jetzt dauerhaft hier –
                 * mit derselben Mechanik wie im Web, nur ohne Anmeldungswerbung
                 * und mit einem Set aus den Wörtern, die man nicht kannte.
                 */}
                <Animated.View entering={FadeInDown.delay(quaelSet ? 180 : 120).duration(280)}>
                <Karte style={styles.banner}>
                    <View style={styles.bannerKopf}>
                        <FontAwesome6
                            name="clipboard-question"
                            size={18}
                            color={farben.gold}
                        />
                        <Text style={[styles.bannerTitel, { color: farben.textPrimary }]}>
                            Wortschatz-Test
                        </Text>
                    </View>
                    <Text style={[styles.bannerText, { color: farben.textSecondary }]}>
                        Wie viele Wörter kennst du schon? In wenigen Minuten schätzt du deinen
                        Wortschatz – und die Wörter, die du nicht kanntest, werden direkt ein Set.
                    </Text>
                    <Knopf
                        titel="Test starten"
                        variante="rand"
                        onPress={() => router.push("/wortschatz-test")}
                        style={styles.bannerKnopf}
                    />
                </Karte>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(240).duration(280)}>
                <View style={styles.abschnitt}>
                    <View style={styles.abschnittKopf}>
                        <Text style={[styles.abschnittTitel, { color: farben.textPrimary }]}>
                            Deine Sprachen
                        </Text>
                        <Text style={[styles.abschnittHinweis, { color: farben.textMuted }]}>
                            {sets.length} {sets.length === 1 ? "Set" : "Sets"}
                        </Text>
                    </View>

                    {laden ? (
                        <View style={styles.raster}>
                            {Array.from({ length: 4 }).map((_, i) => (
                                <Skelett key={i} style={styles.skelett} radius={RADIUS.kachel} />
                            ))}
                        </View>
                    ) : sets.length === 0 ? (
                        <Leerzustand
                            text="Noch keine Vokabel-Sets. Lege dein erstes Set an und lerne sofort los."
                            knopfTitel="Set anlegen"
                            onKnopf={() => router.push("/hinzufuegen")}
                        />
                    ) : (
                        <View style={styles.raster}>
                            <Animated.View entering={FadeInDown.delay(0).duration(240)}>
                    <Pressable
                        onPress={() => router.push("/hinzufuegen")}
                        accessibilityRole="button"
                        accessibilityLabel="Neues Set anlegen"
                        style={[styles.neuKachel, { borderColor: farben.line, width: "48%" }]}
                    >
                                    <FontAwesome6 name="plus" size={20} color={farben.textSecondary} />
                                    <Text style={[styles.neuText, { color: farben.textSecondary }]}>
                                        Neues Set
                                    </Text>
                                </Pressable>
                            </Animated.View>

                            {sets.map((set, idx) => (
                                <Animated.View
                                    key={set.id}
                                    entering={FadeInDown.delay(40 + Math.min(idx, 8) * 40).duration(260)}
                                    style={{ width: "48%", flexBasis: "48%" }}
                                >
                                    <SetKachel
                                        set={set}
                                        onLernen={() => router.push(`/lernen/${encodeURIComponent(set.id)}`)}
                                        onLoeschen={
                                            set.eigen ? () => setLoeschZiel(set) : undefined
                                        }
                                    />
                                </Animated.View>
                            ))}
                        </View>
                    )}
                </View>
                </Animated.View>
            </ScrollView>

            <Melde text={meldung?.text ?? null} />

            <Dialog
                sichtbar={loeschZiel !== null}
                titel="Set wirklich löschen?"
                bestaetigenLabel="Wirklich löschen"
                onBestaetigen={() => loeschZiel && void loeschenBestaetigt(loeschZiel)}
                onAbbrechen={() => setLoeschZiel(null)}
                gefahr
            >
                <Text style={{ color: farben.textSecondary, fontFamily: SANS.regular, fontSize: 15 }}>
                    {loeschZiel
                        ? `„${loeschZiel.name}"${
                              loeschZiel.kartenGesamt === 0
                                  ? " wird gelöscht."
                                  : ` wird mit ${loeschZiel.kartenGesamt} ${
                                        loeschZiel.kartenGesamt === 1 ? "Vokabel" : "Vokabeln"
                                    } gelöscht.`
                          } Das lässt sich nicht rückgängig machen.`
                        : ""}
                </Text>
            </Dialog>
        </View>
    );
}

const styles = StyleSheet.create({
    rahmen: { flex: 1 },
    seite: {
        padding: ABSTAND.xl,
        gap: ABSTAND.xl,
        paddingBottom: ABSTAND.xxl,
    },
    begruessung: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: ABSTAND.md,
        flexWrap: "wrap",
    },
    begruessungText: { gap: 4, flexShrink: 1 },
    hallo: {
        fontFamily: SERIF.bold,
        fontSize: 30,
    },
    unter: {
        fontFamily: SANS.regular,
        fontSize: 16,
    },
    abzeichen: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    abzeichenEintrag: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderWidth: 1,
        borderRadius: RADIUS.pille,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    abzeichenText: { fontFamily: SANS.semibold, fontSize: 14 },
    abzeichenZahl: { fontFamily: "Inter_600SemiBold" },
    hero: { borderRadius: RADIUS.karte, overflow: "hidden" },
    heroInnen: { padding: ABSTAND.xl, gap: ABSTAND.md },
    heroTitel: { fontFamily: SERIF.bold, fontSize: 26 },
    heroText: { fontFamily: SANS.regular, fontSize: 16 },
    heroKnopf: { alignSelf: "flex-start", minWidth: 180, marginTop: 4 },
    banner: { padding: ABSTAND.lg, gap: ABSTAND.sm },
    bannerKopf: { flexDirection: "row", alignItems: "center", gap: 10 },
    bannerTitel: { fontFamily: SERIF.bold, fontSize: 20 },
    bannerText: { fontFamily: SANS.regular, fontSize: 15, lineHeight: 22 },
    bannerKnopf: { alignSelf: "flex-start", marginTop: 4, minWidth: 160 },
    abschnitt: { gap: ABSTAND.lg },
    abschnittKopf: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "baseline",
    },
    abschnittTitel: { fontFamily: SERIF.bold, fontSize: 24 },
    abschnittHinweis: { fontFamily: SANS.regular, fontSize: 14 },
                raster: {
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: ABSTAND.md,
                    justifyContent: "flex-start",
                },
    skelett: { width: "48%", aspectRatio: 1 },
    neuKachel: {
        width: "48%",
        aspectRatio: 1,
        borderWidth: 2,
        borderStyle: "dashed",
        borderRadius: RADIUS.standard,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    neuText: { fontFamily: SANS.semibold, fontSize: 15 },
});
