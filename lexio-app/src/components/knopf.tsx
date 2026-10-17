/**
 * Der Knopf – Web: `.knopf`, `.aufdecken`, `.absenden`, `.speichern`.
 *
 * Eine Komponente, vier Varianten. Der Gold-Verlauf ist der Primärknopf
 * (Übersicht, Lernen, Kopfzeilen), Terrakotta ist die warnende bzw. die
 * anlegende Handlung, und die beiden Rand-Varianten sind die ruhigen
 * Nebenhandlungen (Zurück, Abbrechen).
 *
 * Die Web-Vorlage hebt bei Hover an und drückt beim Klick; ohne Zeiger bleibt
 * nur der Druck. Deshalb skaliert der Knopf beim Antippen leicht, statt eine
 * Hover-Bewegung nachzuahmen.
 */

import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import {
    Pressable,
    StyleSheet,
    Text,
    View,
    type StyleProp,
    type ViewStyle,
} from "react-native";

import { SANS } from "../design/schrift";
import { useDesign } from "../design/theme";
import {
    goldVerlauf,
    MASS,
    RADIUS,
    terracottaVerlauf,
    type Verlauf,
} from "../design/tokens";

export type KnopfVariante = "gold" | "terrakotta" | "rand" | "rand-terrakotta";

type Props = {
    titel?: string;
    children?: ReactNode;
    onPress?: () => void;
    variante?: KnopfVariante;
    /** Pillenförmig (Standard) oder mit dem Feldradius. */
    form?: "pille" | "eckig";
    /** Höhe; die Primärknöpfe des Webs sind 50–56px hoch. */
    hoehe?: number;
    disabled?: boolean;
    style?: StyleProp<ViewStyle>;
    testID?: string;
    accessibilityLabel?: string;
};

export function Knopf({
    titel,
    children,
    onPress,
    variante = "gold",
    form = "pille",
    hoehe = MASS.knopf,
    disabled = false,
    style,
    testID,
    accessibilityLabel,
}: Props) {
    const { farben, schatten } = useDesign();
    const radius = form === "pille" ? RADIUS.pille : RADIUS.feld;

    const verlauf: Verlauf | null =
        variante === "gold"
            ? goldVerlauf(farben)
            : variante === "terrakotta"
              ? terracottaVerlauf(farben)
              : null;

    const inhalt = (gestrichen: boolean) =>
        titel ? (
            <Text
                style={[
                    styles.text,
                    {
                        color:
                            variante === "gold"
                                ? "#17110a"
                                : variante === "terrakotta"
                                  ? "#ffffff"
                                  : variante === "rand-terrakotta"
                                    ? farben.terracotta
                                    : farben.textPrimary,
                        textDecorationLine: gestrichen ? "line-through" : "none",
                    },
                ]}
            >
                {titel}
            </Text>
        ) : (
            children
        );

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            testID={testID}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel ?? titel}
            accessibilityState={{ disabled }}
            style={({ pressed }) => [
                styles.aussen,
                { opacity: disabled ? 0.5 : 1 },
                style,
                pressed && !disabled ? { transform: [{ scale: 0.98 }] } : null,
            ]}
        >
            {verlauf ? (
                <LinearGradient
                    colors={verlauf.farben}
                    locations={verlauf.stellen}
                    start={verlauf.start}
                    end={verlauf.ende}
                    style={[
                        styles.innen,
                        {
                            minHeight: hoehe,
                            borderRadius: radius,
                        },
                        variante === "gold" || variante === "terrakotta"
                            ? schatten.weich
                            : null,
                    ]}
                >
                    {inhalt(disabled)}
                </LinearGradient>
            ) : (
                <View
                    style={[
                        styles.innen,
                        {
                            minHeight: hoehe,
                            borderRadius: radius,
                            backgroundColor:
                                variante === "rand" ? farben.bgElevated : "transparent",
                            borderWidth: 1,
                            borderColor:
                                variante === "rand-terrakotta"
                                    ? farben.terracotta
                                    : farben.line,
                        },
                    ]}
                >
                    {inhalt(disabled)}
                </View>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    aussen: {
        alignSelf: "stretch",
    },
    innen: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 20,
        gap: 8,
    },
    text: {
        fontFamily: SANS.bold,
        fontSize: 16,
        textAlign: "center",
    },
});
