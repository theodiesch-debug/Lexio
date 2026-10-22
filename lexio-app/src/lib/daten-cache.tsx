/**
 * Gemeinsamer Daten-Cache für die App.
 *
 * Erst aus AsyncStorage laden, dann im Hintergrund aktualisieren.
 * So fühlt sich jeder Tab-Wechsel sofort an statt "leer -> laden".
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { holeJson } from "../lib/api";
import { listeAusCache, listeCachen } from "../lib/offline";
import type { ProfilDaten } from "../lib/profil-daten";
import type { KachelSet } from "../components/kachel";

const KEY_SETS = "lexio_cache_sets_v1";
const KEY_PROFIL = "lexio_cache_profil_v1";

type CacheKontext = {
    sets: KachelSet[];
    profil: ProfilDaten | null;
    laden: boolean;
    zuletzt: number | null;
    aktualisieren: (erzwingen?: boolean) => Promise<void>;
    setsSetzen: (sets: KachelSet[]) => void;
};

const Ctx = createContext<CacheKontext | null>(null);

export function DatenCacheAnbieter({ children }: { children: ReactNode }) {
    const [sets, setSets] = useState<KachelSet[]>([]);
    const [profil, setProfil] = useState<ProfilDaten | null>(null);
    const [laden, setLaden] = useState(true);
    const [zuletzt, setZuletzt] = useState<number | null>(null);
    const laeuft = useRef(false);

    const ladenAusSpeicher = useCallback(async () => {
        try {
            const [s, p] = await Promise.all([
                AsyncStorage.getItem(KEY_SETS),
                AsyncStorage.getItem(KEY_PROFIL),
            ]);
            if (s) {
                const parsed = JSON.parse(s) as KachelSet[];
                if (Array.isArray(parsed)) setSets(parsed);
            }
            if (p) {
                const parsed = JSON.parse(p) as ProfilDaten | null;
                if (parsed) setProfil(parsed);
            }
        } catch {
            // Ignorieren
        }
    }, []);

    const aktualisieren = useCallback(async (erzwingen = false) => {
        if (laeuft.current && !erzwingen) return;
        laeuft.current = true;
        try {
            const [setDaten, profilDaten] = await Promise.all([
                holeJson<KachelSet[]>("/api/karteikarten", []),
                holeJson<ProfilDaten | null>("/api/profil", null).catch(() => null),
            ]);
            const arr = Array.isArray(setDaten) ? setDaten : [];
            setSets(arr);
            setProfil(profilDaten);
            const ts = Date.now();
            setZuletzt(ts);
            void AsyncStorage.setItem(KEY_SETS, JSON.stringify(arr));
            if (profilDaten) {
                void AsyncStorage.setItem(KEY_PROFIL, JSON.stringify(profilDaten));
            }
            void listeCachen(arr);
        } catch {
            try {
                const zwischen = await listeAusCache<KachelSet[]>();
                if (zwischen && Array.isArray(zwischen) && sets.length === 0) {
                    setSets(zwischen);
                }
            } catch {
                // Ignorieren
            }
        } finally {
            laeuft.current = false;
            setLaden(false);
        }
    }, [sets.length]);

    const setsSetzen = useCallback((neue: KachelSet[]) => {
        setSets(neue);
        void AsyncStorage.setItem(KEY_SETS, JSON.stringify(neue));
        void listeCachen(neue);
    }, []);

    useEffect(() => {
        void (async () => {
            await ladenAusSpeicher();
            await aktualisieren(true);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <Ctx.Provider value={{ sets, profil, laden, zuletzt, aktualisieren, setsSetzen }}>
            {children}
        </Ctx.Provider>
    );
}

export function useDatenCache() {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error("useDatenCache außerhalb von DatenCacheAnbieter");
    return ctx;
}
