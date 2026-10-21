/**
 * Lernzeitpunkte tracken, um eine sinnvolle Standardzeit für die tägliche
 * Erinnerung vorzuschlagen (statt immer 17:00).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const SCHLUESSEL_LETZTES = "lexio.lern.letztesLernen";
const SCHLUESSEL_LETZTE_STUNDE = "lexio.lern.letzteLernStunde";
const SCHLUESSEL_HISTORIE = "lexio.lern.zeiten";

export async function lernzeitMerken(): Promise<void> {
    const jetzt = Date.now();
    const stunde = new Date().getHours();
    try {
        await AsyncStorage.setItem(SCHLUESSEL_LETZTES, String(jetzt));
        await AsyncStorage.setItem(SCHLUESSEL_LETZTE_STUNDE, String(stunde));
        const roh = await AsyncStorage.getItem(SCHLUESSEL_HISTORIE);
        let arr: number[] = [];
        if (roh) {
            const p = JSON.parse(roh);
            if (Array.isArray(p)) arr = p.filter((v) => typeof v === "number");
        }
        arr.push(stunde);
        if (arr.length > 30) arr = arr.slice(-30);
        await AsyncStorage.setItem(SCHLUESSEL_HISTORIE, JSON.stringify(arr));
    } catch {
        // Ignorieren
    }
}

export async function lernzeitVorschlag(): Promise<{ stunde: number; minute: number } | null> {
    try {
        const roh = await AsyncStorage.getItem(SCHLUESSEL_HISTORIE);
        if (!roh) return null;
        const p = JSON.parse(roh);
        if (!Array.isArray(p) || p.length === 0) return null;
        const zahlen = p.filter((v) => typeof v === "number") as number[];
        if (zahlen.length === 0) return null;
        // Häufigste Stunde
        const zaehler = new Map<number, number>();
        for (const h of zahlen) zaehler.set(h, (zaehler.get(h) || 0) + 1);
        let beste = zahlen[0];
        let max = 0;
        for (const [h, c] of zaehler.entries()) {
            if (c > max) {
                max = c;
                beste = h;
            }
        }
        // Auf sinnvolle Stunde runden (volle Stunde)
        let h = beste;
        if (h < 0) h = 0;
        if (h > 23) h = h % 24;
        return { stunde: h, minute: 0 };
    } catch {
        return null;
    }
}
