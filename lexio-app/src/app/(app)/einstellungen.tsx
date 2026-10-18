/**
 * Einstellungen – Web: app/(app)/einstellungen/page.tsx.
 *
 * Der Design-Schalter ist echt: er haengt am DesignAnbieter (design/theme.tsx)
 * und schreibt in den AsyncStorage, genau wie das `data-design`-Attribut im
 * Web. Die Erinnerung ist es auch: eine echte lokale Benachrichtigung ueber
 * expo-notifications, einmal taeglich auf diesem Geraet. Dass dieser Schalter
 * erst jetzt existiert, haengt an genau dieser Tatsache – in Expo Go fehlen
 * Teile der Darstellung, und vor der eigenstaendigen APK lief ohne Metro
 * nichts, was haelt, was es verspricht.
 *
 * Die uebrigen Web-Regler fehlen weiterhin bewusst: „angemeldet bleiben"
 * haengt am Web-Push und die Sprache/Land-Paare speichern nichts. Ein
 * Schalter, der nichts speichert, ist schlimmer als keiner – er verspricht
 * etwas und haelt es nicht.
 *
 * Es bleibt: Design, Erinnerung, ein Hinweis zu den Toenen, Passwort
 * aendern, Abmelden und die Versionszeile. Der Konto-Bereich funktioniert
 * ueber supabase.auth wie im Web, ohne das alte Passwort: die Sitzung
 * beweist schon, wer hier ist.
 */

import { useEffect, useState, type ReactNode } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { FontAwesome6 } from "@expo/vector-icons";

import { Knopf } from "@/components/knopf";
import { Karte } from "@/components/karte";
import { Feld } from "@/components/feld";
import { SANS, SERIF } from "@/design/schrift";
import { useDesign } from "@/design/theme";
import { ABSTAND, MASS, RADIUS, type DesignName } from "@/design/tokens";
import {
    ERINNERUNG_STANDARD,
    erinnerungLesen,
    erinnerungSpeichern,
    erinnerungStellen,
    testmeldung,
    type Erinnerung,
} from "@/lib/benachrichtigungen";
import { supabase } from "@/lib/supabase";
import { MIN_PASSWORT, PASSWORT_FEHLER } from "@lexio/passwort";

type Meldung = { art: "ok" | "fehler"; text: string } | null;

const DESIGN_OPTIONEN: { wert: DesignName; label: string }[] = [
    { wert: "hell", label: "Hell" },
    { wert: "dunkel", label: "Dunkel" },
];

const AN_AUS: { wert: boolean; label: string }[] = [
    { wert: true, label: "An" },
    { wert: false, label: "Aus" },
];

/**
 * Ganze Stunden statt eines Datums-Pickers: der bringt eine Native-Abhaengigkeit
 * mit, und die Vorauswahl deckt ab, was in der Praxis gebraucht wird.
 */
const ZEIT_OPTIONEN: { stunde: number; label: string }[] = [
    { stunde: 8, label: "08:00" },
    { stunde: 12, label: "12:00" },
    { stunde: 17, label: "17:00" },
    { stunde: 19, label: "19:00" },
    { stunde: 21, label: "21:00" },
];

export default function Einstellungen() {
    const { farben, design, setDesign } = useDesign();

    const [passwort, setPasswort] = useState("");
    const [wiederholung, setWiederholung] = useState("");
    const [passwortLaeuft, setPasswortLaeuft] = useState(false);
    const [passwortMeldung, setPasswortMeldung] = useState<Meldung>(null);
    const [abmeldenLaeuft, setAbmeldenLaeuft] = useState(false);

    const [erinnerung, setErinnerung] = useState<Erinnerung>(ERINNERUNG_STANDARD);
    const [erinnerungLaeuft, setErinnerungLaeuft] = useState(false);
    const [erinnerungMeldung, setErinnerungMeldung] = useState<Meldung>(null);

    // Wie das Design steht die Erinnerung im AsyncStorage, nicht in React –
    // sonst zeigen wir beim ersten Mal „Aus", obwohl Android noch meldet.
    useEffect(() => {
        let laeuft = true;
        void erinnerungLesen().then((wert) => {
            if (laeuft) setErinnerung(wert);
        });
        return () => {
            laeuft = false;
        };
    }, []);

    const zeitText = `${String(erinnerung.stunde).padStart(2, "0")}:${String(
        erinnerung.minute,
    ).padStart(2, "0")}`;

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

    async function erinnerungAendern(neu: Erinnerung) {
        if (erinnerungLaeuft) return;
        setErinnerungLaeuft(true);
        setErinnerungMeldung(null);
        // Zuerst zeigen, dann speichern, dann planen: die Oberfläche bleibt
        // bedienbar, auch wenn Android bei der Berechtigung nicht mitspielt.
        setErinnerung(neu);
        await erinnerungSpeichern(neu);
        const ergebnis = await erinnerungStellen(neu);
        if (ergebnis === "abgelehnt") {
            setErinnerungMeldung({
                art: "fehler",
                text:
                    "Benachrichtigungen sind gesperrt. Erlaube sie in den Geräteeinstellungen " +
                    "und tippe danach noch einmal auf „An“.",
            });
        }
        setErinnerungLaeuft(false);
    }

    async function testSchicken() {
        if (erinnerungLaeuft) return;
        setErinnerungLaeuft(true);
        setErinnerungMeldung(null);
        const ok = await testmeldung();
        setErinnerungMeldung(
            ok
                ? { art: "ok", text: "Kommt in drei Sekunden – dann siehst du das Aussehen." }
                : { art: "fehler", text: "Benachrichtigungen sind nicht erlaubt." },
        );
        setErinnerungLaeuft(false);
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

            <Abschnitt titel="Erinnerung">
                <Text style={[styles.label, { color: farben.textSecondary }]}>
                    Täglich erinnern
                </Text>
                <View
                    style={[
                        styles.segment,
                        { backgroundColor: farben.bgElevated2, borderColor: farben.line },
                    ]}
                >
                    {AN_AUS.map((option) => {
                        const aktiv = erinnerung.aktiv === option.wert;
                        return (
                            <Pressable
                                key={String(option.wert)}
                                onPress={() =>
                                    void erinnerungAendern({ ...erinnerung, aktiv: option.wert })
                                }
                                disabled={erinnerungLaeuft}
                                accessibilityRole="button"
                                accessibilityState={{
                                    selected: aktiv,
                                    disabled: erinnerungLaeuft,
                                }}
                                accessibilityLabel={`Erinnerung ${option.label}`}
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

                {erinnerung.aktiv ? (
                    <>
                        <Text style={[styles.label, { color: farben.textSecondary }]}>Uhrzeit</Text>
                        <View
                            style={[
                                styles.zeitSegment,
                                { backgroundColor: farben.bgElevated2, borderColor: farben.line },
                            ]}
                        >
                            {ZEIT_OPTIONEN.map((option) => {
                                const aktiv = erinnerung.stunde === option.stunde;
                                return (
                                    <Pressable
                                        key={option.stunde}
                                        onPress={() =>
                                            void erinnerungAendern({
                                                ...erinnerung,
                                                stunde: option.stunde,
                                                minute: 0,
                                            })
                                        }
                                        disabled={erinnerungLaeuft}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: aktiv }}
                                        accessibilityLabel={`Erinnerung um ${option.label} Uhr`}
                                        style={[
                                            styles.zeitKnopf,
                                            aktiv ? { backgroundColor: farben.gold } : null,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.segmentText,
                                                {
                                                    color: aktiv
                                                        ? farben.ink
                                                        : farben.textSecondary,
                                                    fontFamily: aktiv
                                                        ? SANS.semibold
                                                        : SANS.medium,
                                                },
                                            ]}
                                        >
                                            {option.label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </>
                ) : null}

                {erinnerungMeldung ? (
                    <Text
                        style={[
                            styles.meldung,
                            {
                                color:
                                    erinnerungMeldung.art === "ok"
                                        ? farben.sage
                                        : farben.terracotta,
                            },
                        ]}
                    >
                        {erinnerungMeldung.text}
                    </Text>
                ) : null}

                {erinnerungMeldung?.art === "fehler" ? (
                    <Knopf
                        titel="Einstellungen öffnen"
                        variante="rand-terrakotta"
                        hoehe={MASS.touch}
                        onPress={() => void Linking.openSettings()}
                    />
                ) : null}

                <Text style={[styles.hinweis, { color: farben.textMuted }]}>
                    {erinnerung.aktiv
                        ? `Täglich um ${zeitText} – bleibt auf diesem Gerät, kein Konto nötig.`
                        : "Aus – du bekommst in dieser Zeit keine Meldung."}
                </Text>

                <Knopf
                    titel="Test-Benachrichtigung"
                    variante="rand"
                    hoehe={MASS.touch}
                    onPress={() => void testSchicken()}
                    disabled={erinnerungLaeuft}
                />
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

                <View style={[styles.trenner, { backgroundColor: farben.line }]} />

                {/*
                 * Die Quellenangabe der Wortlisten. Im Web steht sie auf der
                 * oeffentlichen Landing; die App hat keine, also ist dies der
                 * Ort, an dem sie erreichbar ist.
                 */}
                <Pressable
                    onPress={() => router.push("/quellen")}
                    accessibilityRole="link"
                    accessibilityLabel="Quellen der Wortlisten"
                    style={styles.zeile}
                >
                    <Text style={[styles.aboutTitel, { color: farben.textPrimary }]}>
                        Quellen der Wortlisten
                    </Text>
                    <FontAwesome6
                        name="chevron-right"
                        size={14}
                        color={farben.textMuted}
                    />
                </Pressable>
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
    zeitSegment: {
        flexDirection: "row",
        flexWrap: "wrap",
        borderWidth: 1,
        borderRadius: RADIUS.feld,
        padding: 3,
        gap: 3,
    },
    zeitKnopf: {
        minHeight: 40,
        minWidth: 76,
        paddingHorizontal: 16,
        borderRadius: RADIUS.klein,
        alignItems: "center",
        justifyContent: "center",
    },
    meldung: { fontFamily: SANS.medium, fontSize: 14 },
    trenner: { height: 1, marginVertical: ABSTAND.xs },
    about: { gap: 2 },
    aboutTitel: { fontFamily: SANS.semibold, fontSize: 16 },
    zeile: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: MASS.touch,
        gap: ABSTAND.md,
    },
});
