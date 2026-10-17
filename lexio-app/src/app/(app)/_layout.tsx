/**
 * Der Rahmen des angemeldeten Bereichs.
 *
 * Zwei Aufgaben, die vorher dreimal in jedem Screen standen:
 *   1. Anmelde-Schutz. Ohne Sitzung geht es zur Anmeldung – einmal hier
 *      statt in jedem Screen.
 *   2. Die Navigationsleiste unten, damit sie beim Wechsel stehen bleibt.
 *
 * Der API-Zugriff ist ohnehin durch RLS und 401 geschützt; diese Prüfung ist
 * die freundliche Führung, nicht die Sicherheitsgrenze.
 */

import { Slot, router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Navigation } from "../../components/navigation";
import { Skelett } from "../../components/zustand";
import { useDesign } from "../../design/theme";
import { supabase } from "../../lib/supabase";

export default function AppLayout() {
    const { farben } = useDesign();
    const [gepruefte, setGepruefte] = useState<"offen" | "angemeldet" | "gast">("offen");

    useEffect(() => {
        let gestoppt = false;
        supabase.auth.getSession().then(({ data }) => {
            if (gestoppt) return;
            if (data.session) {
                setGepruefte("angemeldet");
            } else {
                setGepruefte("gast");
                router.replace("/anmelden");
            }
        });
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_ereignis, sitzung) => {
            if (!sitzung) {
                setGepruefte("gast");
                router.replace("/anmelden");
            } else {
                setGepruefte("angemeldet");
            }
        });
        return () => {
            gestoppt = true;
            subscription.unsubscribe();
        };
    }, []);

    if (gepruefte !== "angemeldet") {
        return (
            <SafeAreaView
                style={[styles.schirm, { backgroundColor: farben.background }]}
                edges={["top"]}
            >
                <View style={styles.lade}>
                    <Skelett style={styles.ladeBlock} />
                    <Skelett style={styles.ladeBlock} />
                    <Skelett style={styles.ladeBlock} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView
            style={[styles.schirm, { backgroundColor: farben.background }]}
            edges={["top"]}
        >
            <View style={styles.inhalt}>
                <Slot />
            </View>
            <Navigation />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    schirm: { flex: 1 },
    inhalt: { flex: 1 },
    lade: {
        flex: 1,
        padding: 24,
        gap: 12,
    },
    ladeBlock: { height: 88 },
});
