/**
 * Die Navigationsleiste – Web: components/navbar/side-bar.css (mobil) bzw.
 * navbar.tsx NAVBAR_ELEMENTE.
 *
 * Das Web zeigt auf schmalen Bildschirmen eine untere Leiste mit sechs
 * Einträgen und derselben Reihenfolge: Start, Wortschatz, Statistiken, Mehr,
 * Hinzufügen, Profil. Die Leiste bleibt immer Papier (PAPIER-Tokens), auch im
 * dunklen Design – das ist die eine Fläche, die sich nicht mit umstellt.
 *
 * Die Symbole kommen aus FontAwesome, wie im Web (`fa-solid fa-house` usw.),
 * über @expo/vector-icons.
 */

import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { router, usePathname } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SANS } from "../design/schrift";
import { PAPIER } from "../design/tokens";

type Eintrag = {
    name: string;
    icon: keyof typeof FontAwesome6.glyphMap;
    href: string;
};

/** Reihenfolge und Beschriftung wie die Tableiste des Webs. */
const EINTRAEGE: Eintrag[] = [
    { name: "Start", icon: "house", href: "/" },
    { name: "Wortschatz", icon: "layer-group", href: "/wortschatz" },
    { name: "Statistiken", icon: "chart-simple", href: "/statistiken" },
    { name: "Mehr", icon: "gear", href: "/einstellungen" },
    { name: "Hinzufügen", icon: "plus", href: "/hinzufuegen" },
    { name: "Profil", icon: "user", href: "/profil" },
];

export const LEISTE_HOEHE = 58;
const AKTIV = "#20252a";
const RUHIG = "#766F62";
const MARKER = "#b84254";

export function Navigation() {
    const pfad = usePathname();
    const ränder = useSafeAreaInsets();

    return (
        <View
            style={[
                styles.leiste,
                { paddingBottom: Math.max(ränder.bottom, 6) },
            ]}
        >
            {EINTRAEGE.map((eintrag) => {
                const aktiv =
                    eintrag.href === "/"
                        ? pfad === "/"
                        : pfad === eintrag.href || pfad.startsWith(`${eintrag.href}/`);
                return (
                    <Pressable
                        key={eintrag.href}
                        onPress={() => router.push(eintrag.href as never)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: aktiv }}
                        accessibilityLabel={eintrag.name}
                        style={styles.eintrag}
                    >
                        {aktiv ? <View style={styles.marker} /> : null}
                        <FontAwesome6
                            name={eintrag.icon}
                            size={18}
                            color={aktiv ? AKTIV : RUHIG}
                        />
                        <Text
                            numberOfLines={1}
                            style={[
                                styles.label,
                                { color: aktiv ? AKTIV : RUHIG, fontWeight: aktiv ? "600" : "400" },
                            ]}
                        >
                            {eintrag.name}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    leiste: {
        flexDirection: "row",
        backgroundColor: PAPIER.paperTextSoft,
        borderTopWidth: 1,
        borderTopColor: PAPIER.paperTextSoftBorder,
        paddingTop: 6,
    },
    eintrag: {
        flex: 1,
        minHeight: LEISTE_HOEHE,
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        paddingHorizontal: 2,
    },
    marker: {
        position: "absolute",
        top: 0,
        left: "20%",
        right: "20%",
        height: 3,
        borderRadius: 3,
        backgroundColor: MARKER,
    },
    label: {
        fontFamily: SANS.regular,
        fontSize: 11,
        textAlign: "center",
    },
});
