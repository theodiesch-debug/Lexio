/**
 * Einstellungen – Web: app/(app)/einstellungen/page.tsx.
 *
 * Der Design-Schalter ist echt: er haengt am DesignAnbieter (design/theme.tsx)
 * und schreibt in den AsyncStorage, genau wie das `data-design`-Attribut im
 * Web. Die uebrigen Web-Regler fehlen hier bewusst: Push und „angemeldet
 * bleiben" brauchen Geraete-Module, die es in der App noch nicht gibt, und die
 * Sprache/Land-Attrappen speichern nichts. Ein Schalter, der nichts speichert,
 * ist schlimmer als keiner – er verspricht etwas und haelt es nicht.
 *
 * Es bleibt: Design, ein Hinweis zu den Toenen, Passwort aendern, Abmelden und
 * die Versionszeile. Der Konto-Bereich funktioniert ueber supabase.auth wie im
 * Web, ohne das alte Passwort: die Sitzung beweist schon, wer hier ist.
 */

import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { Knopf } from "@/components/knopf";
import { Karte } from "@/components/karte";
import { Feld } from "@/components/feld";
import { SANS, SERIF } from "@/design/schrift";
import { useDesign } from "@/design/theme";
import { ABSTAND, RADIUS, type DesignName } from "@/design/tokens";
import { supabase } from "@/lib/supabase";
import { MIN_PASSWORT, PASSWORT_FEHLER } from "@lexio/passwort";

type Meldung = { art: "ok" | "fehler"; text: string } | null;

const DESIGN_OPTIONEN: { wert: DesignName; label: string }[] = [
    { wert: "hell", label: "Hell" },
    { wert: "dunkel", label: "Dunkel" },
];

export default function Einstellungen() {
    const { farben, design, setDesign } = useDesign();

    const [passwort, setPasswort] = useState("");
    const [wiederholung, setWiederholung] = useState("");
    const [passwortLaeuft, setPasswortLaeuft] = useState(false);
    const [passwortMeldung, setPasswortMeldung] = useState<Meldung>(null);
    const [abmeldenLaeuft, setAbmeldenLaeuft] = useState(false);

    async function passwortSpeichern() {
        if (passwortLaeuft) return;
        setPasswortMeldung(null);

        if (passwort.length < MIN_PASSWORT) {
            setPasswortMeldung({ art: "fehler", text: PASSWORT_FEHLER });
            return;
        }
        if (passwort !== wiederholung) {
            setPasswortMeldung({
                art: "fehler",
                text: "Die beiden Passwörter stimmen nicht überein.",
            });
            return;
        }

        setPasswortLaeuft(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: passwort });
            if (error) {
                setPasswortMeldung({ art: "fehler", text: error.message });
                return;
            }
            setPasswort("");
            setWiederholung("");
            setPasswortMeldung({ art: "ok", text: "Das Passwort ist gespeichert." });
        } catch {
            setPasswortMeldung({ art: "fehler", text: "Keine Verbindung zum Server." });
        } finally {
            setPasswortLaeuft(false);
        }
    }

    async function abmelden() {
        if (abmeldenLaeuft) return;
        setAbmeldenLaeuft(true);
        // Fehler werden geschluckt: was folgt, ist ohnehin /anmelden; eine
        // Meldung wuerde nur stehen bleiben, bis der Screen ohnehin wechselt.
        await supabase.auth.signOut().catch(() => undefined);
        router.replace("/anmelden");
    }

    return (
        <ScrollView
            style={{ backgroundColor: farben.background }}
            contentContainerStyle={styles.seite}
        >
            <View style={styles.kopf}>
                <Text style={[styles.h1, { color: farben.textPrimary }]}>Einstellungen</Text>
                <Text style={[styles.h1Unter, { color: farben.textSecondary }]}>
                    Passe Lexio an deine Bedürfnisse an
                </Text>
            </View>

            <Abschnitt titel="Allgemein">
                <Text style={[styles.label, { color: farben.textSecondary }]}>Design</Text>
                <View
                    style={[
                        styles.segment,
                        { backgroundColor: farben.bgElevated2, borderColor: farben.line },
                    ]}
                >
                    {DESIGN_OPTIONEN.map((option) => {
                        const aktiv = design === option.wert;
                        return (
                            <Pressable
                                key={option.wert}
                                onPress={() => setDesign(option.wert)}
                                accessibilityRole="button"
                                accessibilityState={{ selected: aktiv }}
                                accessibilityLabel={`Design ${option.label}`}
                                style={[
                                    styles.segmentKnopf,
                                    aktiv ? { backgroundColor: farben.gold } : null,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.segmentText,
                                        {
                                            color: aktiv ? farben.ink : farben.textSecondary,
                                            fontFamily: aktiv ? SANS.semibold : SANS.medium,
                                        },
                                    ]}
                                >
                                    {option.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
                <Text style={[styles.hinweis, { color: farben.textMuted }]}>
                    Gilt sofort und bleibt auch nach dem Neuladen erhalten.
                </Text>
            </Abschnitt>

            <Abschnitt titel="Töne">
                {/*
                 * Kein Schalter: das Vorlesen ist eine Geraete-Einstellung und
                 * wird im Lernmodus ausgeloest. Eine App-eigene Ton-Vorliebe
                 * existiert noch nicht – also steht hier der ehrliche Hinweis
                 * statt eines Reglers, der nichts speichert.
                 */}
                <Text style={[styles.hinweis, { color: farben.textSecondary }]}>
                    Das Vorlesen der Karten im Lernmodus spricht und ist laut. Ton und
                    Lautstärke stellst du auf diesem Gerät ein – im Lernmodus über die
                    Vorlesen-Taste.
                </Text>
            </Abschnitt>

            <Abschnitt titel="Konto">
                <Text style={[styles.label, { color: farben.textSecondary }]}>Passwort ändern</Text>
                <Feld
                    value={passwort}
                    onChangeText={setPasswort}
                    placeholder="Neues Passwort"
                    secureTextEntry
                    autoCapitalize="none"
                    accessibilityLabel="Neues Passwort"
                />
                <Feld
                    value={wiederholung}
                    onChangeText={setWiederholung}
                    placeholder="Wiederholen"
                    secureTextEntry
                    autoCapitalize="none"
                    accessibilityLabel="Neues Passwort wiederholen"
                />
                <Knopf
                    titel={passwortLaeuft ? "Speichert…" : "Speichern"}
                    onPress={() => void passwortSpeichern()}
                    disabled={passwortLaeuft}
                />
                {passwortMeldung ? (
                    <Text
                        style={[
                            styles.meldung,
                            {
                                color:
                                    passwortMeldung.art === "ok"
                                        ? farben.sage
                                        : farben.terracotta,
                            },
                        ]}
                    >
                        {passwortMeldung.text}
                    </Text>
                ) : null}

                <View style={[styles.trenner, { backgroundColor: farben.line }]} />

                <Knopf
                    titel={abmeldenLaeuft ? "Abmelden…" : "Abmelden"}
                    variante="terrakotta"
                    onPress={() => void abmelden()}
                    disabled={abmeldenLaeuft}
                />
            </Abschnitt>

            <Abschnitt titel="Sonstiges">
                <View style={styles.about}>
                    <Text style={[styles.aboutTitel, { color: farben.textPrimary }]}>
                        Über Lexio
                    </Text>
                    <Text style={[styles.hinweis, { color: farben.textSecondary }]}>
                        Version 1.0.0
                    </Text>
                </View>
            </Abschnitt>
        </ScrollView>
    );
}

/** Eine Karte mit Abschnittsueberschrift – das `.allgemein`/`.daten` des Webs. */
function Abschnitt({ titel, children }: { titel: string; children: ReactNode }) {
    const { farben } = useDesign();
    return (
        <Karte style={styles.abschnitt}>
            <Text style={[styles.abschnittTitel, { color: farben.textPrimary }]}>{titel}</Text>
            {children}
        </Karte>
    );
}

const styles = StyleSheet.create({
    seite: {
        padding: ABSTAND.xl,
        gap: ABSTAND.lg,
        paddingBottom: ABSTAND.xxl,
    },
    kopf: { gap: 4 },
    h1: { fontFamily: SERIF.bold, fontSize: 30 },
    h1Unter: { fontFamily: SANS.regular, fontSize: 16 },
    abschnitt: { padding: ABSTAND.lg, gap: ABSTAND.md },
    abschnittTitel: { fontFamily: SERIF.bold, fontSize: 22 },
    label: { fontFamily: SANS.semibold, fontSize: 15 },
    hinweis: { fontFamily: SANS.regular, fontSize: 14, lineHeight: 20 },
    segment: {
        flexDirection: "row",
        borderWidth: 1,
        borderRadius: RADIUS.feld,
        padding: 3,
        gap: 3,
    },
    segmentKnopf: {
        flex: 1,
        minHeight: 40,
        borderRadius: RADIUS.klein,
        alignItems: "center",
        justifyContent: "center",
    },
    segmentText: { fontSize: 15 },
    meldung: { fontFamily: SANS.medium, fontSize: 14 },
    trenner: { height: 1, marginVertical: ABSTAND.xs },
    about: { gap: 2 },
    aboutTitel: { fontFamily: SANS.semibold, fontSize: 16 },
});
