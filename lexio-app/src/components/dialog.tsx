/**
 * Der Bestätigungsdialog – Web: `.schleier` + `.loeschDialog` / `.dialog`.
 *
 * Vollbildschleier in `rgba(5,10,14,.6)`, die Karte darauf höchstens 440px
 * breit mit Radius 20px, der Titel in Caveat. Das Web benutzt denselben
 * Schleier an mehreren Stellen; damit auch die App nicht drei ähnliche
 * Dialoge hat, gibt es hier einen.
 */

import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { CAVEAT } from "../design/schrift";
import { useDesign } from "../design/theme";
import { ABSTAND, RADIUS } from "../design/tokens";
import { Knopf } from "./knopf";

type Props = {
    sichtbar: boolean;
    titel: string;
    children?: ReactNode;
    bestaetigenLabel: string;
    onBestaetigen: () => void;
    abbrechenLabel?: string;
    onAbbrechen?: () => void;
    /** Bestätigen in Terrakotta (Löschen) statt Gold. */
    gefahr?: boolean;
};

export function Dialog({
    sichtbar,
    titel,
    children,
    bestaetigenLabel,
    onBestaetigen,
    abbrechenLabel = "Abbrechen",
    onAbbrechen,
    gefahr = false,
}: Props) {
    const { farben, schatten } = useDesign();

    return (
        <Modal
            visible={sichtbar}
            transparent
            animationType="fade"
            onRequestClose={onAbbrechen ?? onBestaetigen}
        >
            <Pressable
                style={[styles.schleier, { backgroundColor: "rgba(5,10,14,0.6)" }]}
                onPress={onAbbrechen}
            >
                <Pressable
                    style={[
                        styles.dialog,
                        {
                            backgroundColor: farben.bgElevated,
                            borderColor: farben.line,
                            borderWidth: 1,
                        },
                        schatten.karte,
                    ]}
                    onPress={() => {}}
                >
                    <Text style={[styles.titel, { color: farben.textPrimary }]}>{titel}</Text>
                    {children}
                    <View style={styles.knoepfe}>
                        {onAbbrechen ? (
                            <Knopf
                                titel={abbrechenLabel}
                                onPress={onAbbrechen}
                                variante="rand"
                                style={styles.knopf}
                            />
                        ) : null}
                        <Knopf
                            titel={bestaetigenLabel}
                            onPress={onBestaetigen}
                            variante={gefahr ? "terrakotta" : "gold"}
                            style={styles.knopf}
                        />
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    schleier: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
    },
    dialog: {
        width: "100%",
        maxWidth: 440,
        borderRadius: RADIUS.dialog,
        padding: ABSTAND.xl,
        gap: ABSTAND.lg,
    },
    titel: {
        fontFamily: CAVEAT.bold,
        fontSize: 28,
    },
    knoepfe: {
        flexDirection: "row",
        gap: ABSTAND.md,
    },
    knopf: {
        flex: 1,
    },
});
