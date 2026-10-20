/**
 * Die Set-Kachel – Web: `.kachel` in components/uebersicht/uebersicht.module.css.
 *
 * Quadratisch, Fläche in der Sprachfarbe, oben die Sprache in Mono-Versalien,
 * darunter der Name in Serif, die Stufe, der gelernte Anteil und die
 * siebenstufige Leiter. Oben rechts ein Chip mit den fälligen Karten.
 * Löschen nur bei eigenen Sets.
 *
 * Die Web-Vorlage hat Hover für Löschen; hier gibt es keinen Zeiger, deshalb
 * liegt der Löschknopf dauerhaft unten rechts und öffnet den Dialog.
 */

import { FontAwesome6 } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { SpracheInfo } from "@lexio/sprachen";

import { CAVEAT, MONO } from "../design/schrift";
import { KARTEN_TINTE, RADIUS } from "../design/tokens";

export type KachelSet = {
    id: string;
    name: string;
    sprache: SpracheInfo;
    kartenGesamt: number;
    kartenGelernt: number;
    kartenFaellig: number;
    /** Karten, die gerade im Minus stehen (mehr „nochmal" als richtig). */
    quaelAnzahl?: number;
    setLevel: number;
    setLevelAnteil: number;
    eigen?: boolean;
};

type Props = {
    set: KachelSet;
    onLernen: () => void;
    onLoeschen?: () => void;
};

const TINTE = KARTEN_TINTE.fest;
const TINTE_SOFT = "rgba(13, 23, 29, 0.72)";
const SCHIENE = "rgba(13, 23, 29, 0.28)";

export function SetKachel({ set, onLernen, onLoeschen }: Props) {
    const farbe = set.sprache?.flaeche || "#17232B";
    const akzent = set.sprache?.akzent || "#E7B14A";
    const ohneKarten = set.kartenGesamt === 0;
    const anteil = Math.min(1, Math.max(0, set.setLevelAnteil));

    return (
        <View style={[styles.kachel, { backgroundColor: farbe }]}>
            <Pressable
                onPress={onLernen}
                accessibilityRole="button"
                accessibilityLabel={
                    ohneKarten
                        ? `${set.name} lernen, keine Karten`
                        : `${set.name} lernen, Level ${set.setLevel} von 7, ` +
                          `${set.kartenGelernt} von ${set.kartenGesamt} gelernt`
                }
                style={styles.innen}
            >
                <Text numberOfLines={1} style={styles.sprache}>
                    {set.sprache?.name || "Ohne Sprache"}
                </Text>
                <Text numberOfLines={2} style={styles.name}>
                    {set.name}
                </Text>
                <Text style={styles.fortschritt}>
                    {ohneKarten ? "Noch keine Karten" : `Level ${set.setLevel}`}
                </Text>
                {!ohneKarten ? (
                    <Text style={styles.gelernt}>
                        {set.kartenGelernt}/{set.kartenGesamt} gelernt
                    </Text>
                ) : null}

                <View style={styles.stufen}>
                    {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                        <View key={i} style={styles.stufe}>
                            {i < set.setLevel ? (
                                <View style={[styles.stufeVoll, { backgroundColor: akzent }]} />
                            ) : i === set.setLevel ? (
                                <View
                                    style={[
                                        styles.stufeTeil,
                                        {
                                            width: `${Math.round(anteil * 100)}%`,
                                            backgroundColor: akzent,
                                        },
                                    ]}
                                />
                            ) : null}
                        </View>
                    ))}
                </View>
            </Pressable>

            {set.kartenFaellig > 0 ? (
                <View style={styles.faellig}>
                    <Text style={styles.faelligText}>{set.kartenFaellig} fällig</Text>
                </View>
            ) : null}

            {set.eigen && onLoeschen ? (
                <Pressable
                    onPress={onLoeschen}
                    accessibilityRole="button"
                    accessibilityLabel={`Set ${set.name} löschen`}
                    hitSlop={6}
                    style={styles.loeschen}
                >
                    <FontAwesome6 name="trash-can" size={16} color={TINTE} />
                </Pressable>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    kachel: {
        width: "48%",
        aspectRatio: 1,
        borderRadius: RADIUS.kachel,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        overflow: "hidden",
    },
    innen: {
        flex: 1,
        padding: 14,
        justifyContent: "flex-start",
    },
    sprache: {
        fontFamily: MONO.medium,
        fontSize: 12,
        letterSpacing: 1,
        textTransform: "uppercase",
        color: TINTE_SOFT,
    },
    name: {
        fontFamily: CAVEAT.bold,
        fontSize: 26,
        lineHeight: 28,
        color: TINTE,
        marginTop: 2,
    },
    fortschritt: {
        fontFamily: MONO.regular,
        fontSize: 13,
        color: TINTE_SOFT,
        marginTop: 6,
    },
    gelernt: {
        fontFamily: MONO.regular,
        fontSize: 12,
        color: TINTE_SOFT,
        marginTop: 2,
    },
    stufen: {
        flexDirection: "row",
        gap: 3,
        marginTop: 10,
    },
    stufe: {
        flex: 1,
        height: 5,
        borderRadius: RADIUS.pille,
        backgroundColor: SCHIENE,
        overflow: "hidden",
    },
    stufeVoll: { flex: 1, height: "100%", borderRadius: RADIUS.pille },
    stufeTeil: { height: "100%", borderRadius: RADIUS.pille },
    faellig: {
        position: "absolute",
        top: 10,
        right: 10,
        backgroundColor: "rgba(14,12,9,0.82)",
        borderRadius: RADIUS.pille,
        paddingHorizontal: 9,
        paddingVertical: 3,
    },
    faelligText: {
        fontFamily: MONO.medium,
        fontSize: 12,
        color: "#eec76b",
    },
    loeschen: {
        position: "absolute",
        bottom: 6,
        right: 6,
        width: 36,
        height: 36,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 18,
    },
});
