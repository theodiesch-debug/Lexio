/**
 * Mein Profil – Web: app/(app)/profil/page.tsx.
 *
 * Identitätskarte mit Level-Balken, vier Kennzahlen und die Konto-Zeilen.
 * Anders als im Web ist das ein Client-Fetch auf /api/profil: die App hat
 * keine Server-Komponenten.
 *
 * Zwei Unterschiede zum Web bewusst: „Dabei seit" fehlt, weil /api/profil
 * kein created_at liefert – ein erfundenes Datum wäre schlechter als keines.
 * Und „Passwort ändern" fehlt, weil die App keine Route dafür hat.
 */

import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";

import { xpFormatieren } from "@lexio/profil";

import { Karte } from "@/components/karte";
import { Knopf } from "@/components/knopf";
import { Skelett } from "@/components/zustand";
import { MONO, SANS, SERIF } from "@/design/schrift";
import { useDesign } from "@/design/theme";
import { ABSTAND, RADIUS } from "@/design/tokens";
import { ApiFehler, holeJson } from "@/lib/api";
import type { ProfilDaten } from "@/lib/profil-daten";

/** Erster Buchstabe, wenn es kein Profilbild gibt. */
function initial(name: string): string {
    const zeichen = name.trim().charAt(0);
    return zeichen ? zeichen.toLocaleUpperCase("de-DE") : "?";
}

export default function Profil() {
    const { farben } = useDesign();
    const [profil, setProfil] = useState<ProfilDaten | null>(null);
    const [laden, setLaden] = useState(true);
    const [fehler, setFehler] = useState<string | null>(null);

    useEffect(() => {
        let abgebrochen = false;

        // Ohne Rückfallwert: ein Fehler soll sichtbar werden, statt als leeres
        // Profil zu erscheinen (das Web zeigt an dieser Stelle ebenfalls einen
        // Hinweis).
        holeJson<ProfilDaten>("/api/profil")
            .then((daten) => {
                if (!abgebrochen) setProfil(daten);
            })
            .catch((grund: unknown) => {
                if (abgebrochen) return;
                setFehler(grund instanceof ApiFehler ? grund.message : "Profil konnte nicht geladen werden.");
            })
            .finally(() => {
                if (!abgebrochen) setLaden(false);
            });

        return () => {
            abgebrochen = true;
        };
    }, []);

    const prozent = profil
        ? Math.min(100, Math.max(0, Math.round(profil.levelProzent)))
        : 0;

    const kacheln: {
        zahl: number;
        label: string;
        icon: keyof typeof FontAwesome6.glyphMap | null;
    }[] = profil
        ? [
              { zahl: profil.level, label: "Level", icon: null },
              {
                  zahl: profil.streak,
                  label: profil.streak === 1 ? "Tag Serie" : "Tage Serie",
                  icon: "fire",
              },
              {
                  zahl: profil.lerntage,
                  label: profil.lerntage === 1 ? "Lerntag" : "Lerntage",
                  icon: "bolt",
              },
              {
                  zahl: profil.setsGelernt,
                  label: profil.setsGelernt === 1 ? "Set gelernt" : "Sets gelernt",
                  icon: "layer-group",
              },
          ]
        : [];

    return (
        <View style={styles.rahmen}>
            <ScrollView
                style={{ backgroundColor: farben.background }}
                contentContainerStyle={styles.seite}
            >
                <View style={styles.kopf}>
                    <Text style={[styles.titel, { color: farben.textPrimary }]}>Mein Profil</Text>
                    <Text style={[styles.untertitel, { color: farben.textMuted }]}>
                        Dein Konto und dein Fortschritt.
                    </Text>
                </View>

                {laden ? (
                    <View style={styles.skelettGruppe}>
                        <Skelett style={styles.skelettKarte} />
                        <Skelett style={styles.skelettKacheln} />
                        <Skelett style={styles.skelettKarte} />
                    </View>
                ) : fehler ? (
                    <Karte style={styles.fehlerKarte}>
                        <FontAwesome6
                            name="circle-exclamation"
                            size={22}
                            color={farben.terracotta}
                        />
                        <Text style={[styles.fehlerText, { color: farben.textMuted }]}>
                            {fehler}
                        </Text>
                    </Karte>
                ) : profil ? (
                    <>
                        {/* Identität: groß, weil das der Grund für die Seite ist. */}
                        <Karte style={styles.karte}>
                            <View style={styles.kopfzeile}>
                                <View
                                    style={[
                                        styles.bildRahmen,
                                        { backgroundColor: farben.sageDark },
                                    ]}
                                >
                                    {profil.avatarUrl ? (
                                        <Image
                                            source={{ uri: profil.avatarUrl }}
                                            style={styles.bild}
                                        />
                                    ) : (
                                        <Text
                                            style={[
                                                styles.initialen,
                                                { color: farben.offWhite },
                                            ]}
                                        >
                                            {initial(profil.vorname)}
                                        </Text>
                                    )}
                                </View>

                                <View style={styles.identitaet}>
                                    <Text
                                        numberOfLines={1}
                                        style={[styles.name, { color: farben.textPrimary }]}
                                    >
                                        {profil.vorname}
                                    </Text>
                                    {profil.email ? (
                                        <Text style={[styles.email, { color: farben.textMuted }]}>
                                            {profil.email}
                                        </Text>
                                    ) : null}
                                </View>
                            </View>

                            {/* Balken mit den Meilensteinen 50 % und 80 % aus Phase 3.2. */}
                            <View style={[styles.balken, { backgroundColor: farben.bgElevated2 }]}>
                                <View
                                    style={[
                                        styles.fuellung,
                                        { width: `${prozent}%`, backgroundColor: farben.terracotta },
                                    ]}
                                />
                                <View
                                    style={[
                                        styles.kerbe,
                                        { left: "50%", backgroundColor: farben.bgElevated2 },
                                    ]}
                                />
                                <View
                                    style={[
                                        styles.kerbe,
                                        { left: "80%", backgroundColor: farben.bgElevated2 },
                                    ]}
                                />
                            </View>
                            <View style={styles.fuss}>
                                <Text style={[styles.levelText, { color: farben.textPrimary }]}>
                                    Level {profil.level} · {xpFormatieren(profil.xp)} XP
                                </Text>
                                <Text style={[styles.rest, { color: farben.textMuted }]}>
                                    noch {xpFormatieren(profil.bisNaechstes)} XP bis Level{" "}
                                    {profil.level + 1}
                                </Text>
                            </View>
                        </Karte>

                        <View style={styles.kacheln}>
                            {kacheln.map((k) => (
                                <Karte key={k.label} style={styles.kachel}>
                                    {k.icon ? (
                                        <FontAwesome6
                                            name={k.icon}
                                            size={16}
                                            color={farben.terracotta}
                                        />
                                    ) : null}
                                    <Text
                                        style={[styles.kachelZahl, { color: farben.textPrimary }]}
                                    >
                                        {k.zahl}
                                    </Text>
                                    <Text style={[styles.kachelLabel, { color: farben.textMuted }]}>
                                        {k.label}
                                    </Text>
                                </Karte>
                            ))}
                        </View>

                        <Karte style={styles.karte}>
                            <Text style={[styles.abschnittTitel, { color: farben.textPrimary }]}>
                                Konto
                            </Text>

                            <View style={styles.liste}>
                                <View
                                    style={[
                                        styles.zeile,
                                        profil.email
                                            ? { borderBottomWidth: 1, borderBottomColor: farben.line }
                                            : null,
                                    ]}
                                >
                                    <Text style={[styles.begriff, { color: farben.textMuted }]}>
                                        Angemeldet über
                                    </Text>
                                    <Text style={[styles.wert, { color: farben.textPrimary }]}>
                                        {profil.email ?? "E-Mail"}
                                    </Text>
                                </View>
                                {profil.email ? (
                                    <View style={styles.zeile}>
                                        <Text style={[styles.begriff, { color: farben.textMuted }]}>
                                            E-Mail
                                        </Text>
                                        <Text style={[styles.wert, { color: farben.textPrimary }]}>
                                            {profil.email}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>

                            <Knopf
                                titel="Einstellungen"
                                variante="rand"
                                onPress={() => router.push("/einstellungen")}
                            />
                        </Karte>
                    </>
                ) : null}
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

    /* Karten */
    karte: { gap: 14, padding: ABSTAND.lg },

    /* Identität */
    kopfzeile: { flexDirection: "row", alignItems: "center", gap: 12 },
    bildRahmen: {
        width: 72,
        height: 72,
        borderRadius: 36,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
    },
    bild: { width: 72, height: 72, borderRadius: 36 },
    initialen: { fontFamily: SANS.bold, fontSize: 28 },
    identitaet: { flex: 1, minWidth: 0, gap: 2 },
    name: { fontFamily: SANS.semibold, fontSize: 20 },
    email: { fontFamily: SANS.regular, fontSize: 14 },

    /* Level-Balken */
    balken: {
        height: 10,
        borderRadius: RADIUS.pille,
        overflow: "hidden",
        justifyContent: "center",
    },
    fuellung: { height: "100%", borderRadius: RADIUS.pille },
    kerbe: {
        position: "absolute",
        top: 0,
        bottom: 0,
        width: 3,
        marginLeft: -1.5,
        borderRadius: RADIUS.pille,
    },
    fuss: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        gap: 2,
    },
    levelText: { fontFamily: SANS.semibold, fontSize: 14 },
    rest: { fontFamily: SANS.regular, fontSize: 14 },

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
    kachelLabel: { fontFamily: SANS.regular, fontSize: 14, textAlign: "center" },

    /* Konto */
    abschnittTitel: { fontFamily: SANS.semibold, fontSize: 16 },
    liste: { marginVertical: 2 },
    zeile: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        gap: 2,
        paddingVertical: 10,
    },
    begriff: { fontFamily: SANS.regular, fontSize: 14 },
    wert: {
        fontFamily: SANS.medium,
        fontSize: 14,
        textAlign: "right",
        flexShrink: 1,
    },

    /* Zustände */
    fehlerKarte: {
        alignItems: "center",
        gap: 10,
        paddingVertical: 40,
        paddingHorizontal: 20,
    },
    fehlerText: { fontFamily: SANS.regular, fontSize: 14, textAlign: "center" },
    skelettGruppe: { gap: ABSTAND.xl },
    skelettKarte: { height: 180 },
    skelettKacheln: { height: 96 },
});
