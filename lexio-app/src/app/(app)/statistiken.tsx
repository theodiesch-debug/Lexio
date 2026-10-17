/**
 * Statistiken – Web: app/(app)/statistiken/statistiken-seite.tsx.
 *
 * Derselbe Aufbau wie im Web: vier Kennzahlen, das Tagesziel, die sieben
 * Wochenbalken und je eine Zeile pro Sprache. Die Rechnung ist bewusst
 * wörtlich übernommen, damit beide Clients dieselben Zahlen zeigen.
 *
 * Anpassungen an die App: kein eigenes SafeAreaView (das leistet der
 * (app)-Rahmen), die Kacheln stehen als flexibles Raster statt als auto-fit
 * Grid, und die Sprachzeile ist kein Knopf mehr – die App kennt keine
 * Route /karteikarten.
 */

import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { TAGESZIEL_XP } from "@lexio/profil";
import type { SprachStat, TagesXpTyp, WochenXpTyp } from "@lexio/types";

import { Fortschrittsbalken } from "@/components/fortschrittsbalken";
import { Karte } from "@/components/karte";
import { Sprachpunkt } from "@/components/sprachpunkt";
import { Skelett } from "@/components/zustand";
import { MONO, SANS, SERIF } from "@/design/schrift";
import { useDesign } from "@/design/theme";
import { ABSTAND, RADIUS } from "@/design/tokens";
import { holeJson } from "@/lib/api";

const WOCHENTAGE: { key: keyof WochenXpTyp; label: string }[] = [
    { key: "mo", label: "Mo" },
    { key: "di", label: "Di" },
    { key: "mi", label: "Mi" },
    { key: "do", label: "Do" },
    { key: "fr", label: "Fr" },
    { key: "sa", label: "Sa" },
    { key: "so", label: "So" },
];

const LEERE_WOCHE: WochenXpTyp = { mo: 0, di: 0, mi: 0, do: 0, fr: 0, sa: 0, so: 0 };

export default function Statistiken() {
    const { farben } = useDesign();

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
            // Wie im Web: leere Diagramme sind kein Grund, die Seite zu leeren.
            .catch(() => undefined)
            .finally(() => {
                if (!abgebrochen) setLaden(false);
            });

        return () => {
            abgebrochen = true;
        };
    }, []);

    const kennzahlen = useMemo(() => {
        const xpGesamt = sprachen.reduce((summe, s) => summe + (s.xp ?? 0), 0);
        const gelernt = sprachen.reduce((summe, s) => summe + (s.gelernt ?? 0), 0);
        const total = sprachen.reduce((summe, s) => summe + (s.total ?? 0), 0);
        const xpWoche = WOCHENTAGE.reduce((summe, t) => summe + (woche[t.key] ?? 0), 0);
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

    const kacheln = [
        { zahl: String(kennzahlen.xpGesamt), label: "XP gesamt", farbe: farben.gold },
        { zahl: String(kennzahlen.gelernt), label: "Karten gelernt", farbe: farben.sage },
        { zahl: `${kennzahlen.quote}%`, label: "Quote", farbe: farben.textPrimary },
        { zahl: String(kennzahlen.xpWoche), label: "XP diese Woche", farbe: farben.gold },
    ];

    return (
        <View style={styles.rahmen}>
            <ScrollView
                style={{ backgroundColor: farben.background }}
                contentContainerStyle={styles.seite}
            >
                <View style={styles.kopf}>
                    <Text style={[styles.titel, { color: farben.textPrimary }]}>Statistiken</Text>
                    <Text style={[styles.untertitel, { color: farben.textMuted }]}>
                        Dein Fortschritt im Überblick.
                    </Text>
                </View>

                {laden ? (
                    <View style={styles.skelettGruppe}>
                        <View style={styles.skelettKacheln}>
                            {Array.from({ length: 4 }).map((_, i) => (
                                <Skelett key={i} style={styles.skelettKachel} />
                            ))}
                        </View>
                        <Skelett style={styles.skelettBlock} radius={RADIUS.standard} />
                    </View>
                ) : (
                    <>
                        {/* -------------------------------------------- Kennzahlen */}
                        <View style={styles.kacheln}>
                            {kacheln.map((k) => (
                                <Karte key={k.label} style={styles.kachel}>
                                    <Text style={[styles.kachelZahl, { color: k.farbe }]}>
                                        {k.zahl}
                                    </Text>
                                    <Text style={[styles.kachelLabel, { color: farben.textMuted }]}>
                                        {k.label}
                                    </Text>
                                </Karte>
                            ))}
                        </View>

                        {/* ------------------------------------------------ Heute */}
                        <View style={styles.block}>
                            <Text style={[styles.blockTitel, { color: farben.textMuted }]}>
                                Heute
                            </Text>
                            <Karte style={styles.heute}>
                                <View style={styles.heuteKopf}>
                                    <Text style={[styles.heuteZahl, { color: farben.gold }]}>
                                        {tages.erreicht ?? 0} XP
                                    </Text>
                                    <Text style={[styles.heuteZiel, { color: farben.textMuted }]}>
                                        von {tagesZiel} XP
                                    </Text>
                                </View>
                                <Fortschrittsbalken
                                    anteil={tagesProzent / 100}
                                    farbe={farben.gold}
                                    hoehe={10}
                                />
                                <Text style={[styles.heuteText, { color: farben.textSecondary }]}>
                                    {tagesProzent >= 100
                                        ? "Tagesziel erreicht. Alles Weitere ist Bonus."
                                        : `Noch ${tagesZiel - (tages.erreicht ?? 0)} XP bis zum Tagesziel.`}
                                </Text>
                            </Karte>
                        </View>

                        {/* ------------------------------------------ Wochenbalken */}
                        <View style={styles.block}>
                            <Text style={[styles.blockTitel, { color: farben.textMuted }]}>
                                Diese Woche
                            </Text>
                            <Karte style={styles.woche}>
                                {WOCHENTAGE.map((tag) => {
                                    const xp = woche[tag.key] ?? 0;
                                    const anteil = Math.max(
                                        3,
                                        Math.round((xp / kennzahlen.hoechsterTag) * 100),
                                    );
                                    return (
                                        <View style={styles.tag} key={tag.key}>
                                            <View
                                                style={[
                                                    styles.tagBalkenHuelle,
                                                    { backgroundColor: farben.bgElevated2 },
                                                ]}
                                            >
                                                <View
                                                    style={[
                                                        styles.tagBalken,
                                                        {
                                                            height: `${anteil}%`,
                                                            backgroundColor: farben.gold,
                                                        },
                                                    ]}
                                                />
                                            </View>
                                            <Text
                                                style={[styles.tagLabel, { color: farben.textMuted }]}
                                            >
                                                {tag.label}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.tagXp,
                                                    { color: farben.textSecondary },
                                                ]}
                                            >
                                                {xp > 0 ? xp : ""}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </Karte>
                            <Text style={[styles.fussnote, { color: farben.textMuted }]}>
                                Bester Tag: {kennzahlen.besterTag.label} mit{" "}
                                {woche[kennzahlen.besterTag.key] ?? 0} XP
                            </Text>
                        </View>

                        {/* ------------------------------------------ Pro Sprache */}
                        <View style={styles.block}>
                            <Text style={[styles.blockTitel, { color: farben.textMuted }]}>
                                Pro Sprache
                            </Text>
                            {sprachen.length === 0 ? (
                                <Text style={[styles.leer, { color: farben.textMuted }]}>
                                    Noch keine Daten vorhanden.
                                </Text>
                            ) : (
                                <View style={styles.sprachen}>
                                    {sprachen.map((s) => {
                                        const quote =
                                            s.total > 0
                                                ? Math.round(((s.gelernt ?? 0) / s.total) * 100)
                                                : 0;
                                        return (
                                            <Karte
                                                key={s.code ?? s.sprache}
                                                style={styles.sprache}
                                            >
                                                <View style={styles.spracheKopf}>
                                                    <Sprachpunkt
                                                        sprache={{
                                                            flaeche: s.flaeche,
                                                            akzent: s.akzent,
                                                        }}
                                                    />
                                                    <Text
                                                        numberOfLines={1}
                                                        style={[
                                                            styles.spracheName,
                                                            { color: farben.textPrimary },
                                                        ]}
                                                    >
                                                        {s.sprache}
                                                    </Text>
                                                    <Text
                                                        style={[
                                                            styles.spracheXp,
                                                            { color: farben.gold },
                                                        ]}
                                                    >
                                                        {s.xp ?? 0} XP
                                                    </Text>
                                                </View>
                                                <Fortschrittsbalken
                                                    anteil={quote / 100}
                                                    farbe={farben.sage}
                                                    hoehe={8}
                                                />
                                                <Text
                                                    style={[
                                                        styles.spracheMeta,
                                                        { color: farben.textMuted },
                                                    ]}
                                                >
                                                    {s.gelernt ?? 0} / {s.total ?? 0} gelernt ·{" "}
                                                    {quote}%
                                                </Text>
                                            </Karte>
                                        );
                                    })}
                                </View>
                            )}
                        </View>
                    </>
                )}
            </ScrollView>
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
    kopf: { gap: 2 },
    titel: { fontFamily: SERIF.bold, fontSize: 30 },
    untertitel: { fontFamily: SANS.regular, fontSize: 14 },

    /* Kennzahlen */
    kacheln: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        rowGap: ABSTAND.sm,
    },
    kachel: {
        width: "48%",
        alignItems: "center",
        gap: 2,
        paddingVertical: 18,
        paddingHorizontal: 12,
    },
    kachelZahl: { fontFamily: MONO.bold, fontSize: 26 },
    kachelLabel: {
        fontFamily: SANS.regular,
        fontSize: 14,
        letterSpacing: 1,
        textTransform: "uppercase",
        textAlign: "center",
    },

    /* Blöcke */
    block: { gap: ABSTAND.md },
    blockTitel: {
        fontFamily: SANS.bold,
        fontSize: 14,
        letterSpacing: 2,
        textTransform: "uppercase",
    },

    /* Heute */
    heute: { gap: ABSTAND.sm, padding: ABSTAND.lg },
    heuteKopf: { flexDirection: "row", alignItems: "baseline", gap: ABSTAND.sm },
    heuteZahl: { fontFamily: MONO.bold, fontSize: 24 },
    heuteZiel: { fontFamily: SANS.regular, fontSize: 14 },
    heuteText: { fontFamily: SANS.regular, fontSize: 14 },

    /* Wochenbalken */
    woche: {
        flexDirection: "row",
        gap: ABSTAND.xs,
        paddingTop: ABSTAND.lg,
        paddingHorizontal: 12,
        paddingBottom: 12,
    },
    tag: { flex: 1, alignItems: "center", gap: 4, minWidth: 0 },
    tagBalkenHuelle: {
        width: "100%",
        maxWidth: 34,
        height: 96,
        borderRadius: 6,
        overflow: "hidden",
        justifyContent: "flex-end",
    },
    tagBalken: { width: "100%", borderRadius: 6 },
    tagLabel: { fontFamily: MONO.regular, fontSize: 14 },
    tagXp: { fontFamily: MONO.regular, fontSize: 14, minHeight: 16 },
    fussnote: { fontFamily: SANS.regular, fontSize: 14 },

    /* Pro Sprache */
    sprachen: { gap: ABSTAND.sm },
    sprache: { gap: 6, paddingVertical: 13, paddingHorizontal: 14 },
    spracheKopf: { flexDirection: "row", alignItems: "center", gap: 10 },
    spracheName: { flex: 1, minWidth: 0, fontFamily: SANS.semibold, fontSize: 14 },
    spracheXp: { fontFamily: MONO.bold, fontSize: 14 },
    spracheMeta: { fontFamily: SANS.regular, fontSize: 14 },
    leer: {
        fontFamily: SANS.regular,
        fontSize: 14,
        textAlign: "center",
        paddingVertical: ABSTAND.xl,
    },

    /* Zustände */
    skelettGruppe: { gap: ABSTAND.xl },
    skelettKacheln: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        rowGap: ABSTAND.sm,
    },
    skelettKachel: { width: "48%", height: 88 },
    skelettBlock: { height: 260 },
});
