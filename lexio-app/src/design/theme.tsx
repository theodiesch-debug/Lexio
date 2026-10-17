/**
 * Hell/Dunkel für die App – das Gegenstück zu
 * components/design/design-anbieter.tsx im Web.
 *
 * Das Web setzt ein `data-design`-Attribut am <html>-Element und liest die
 * Wahl aus localStorage. In der App gibt es kein <html>; die Wahl lebt im
 * Kontext, wird über AsyncStorage gehalten und beim Aufruf an alle Kinder
 * gereicht. Der Speicherschlüssel ist derselbe (`DESIGN_SPEICHER`), damit ein
 * späterer Web-/App-Abgleich nicht zwei Begriffe für dasselbe braucht.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { DESIGN_SPEICHER } from "@lexio/design";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { useColorScheme } from "react-native";

import {
    farbenFuer,
    schattenFuer,
    type DesignName,
    type Farben,
    type SchattenSatz,
} from "./tokens";

export interface DesignWert {
    design: DesignName;
    hell: boolean;
    farben: Farben;
    schatten: SchattenSatz;
    setDesign: (design: DesignName) => void;
    umschalten: () => void;
}

const DesignKontext = createContext<DesignWert | null>(null);

export function DesignAnbieter({ children }: { children: ReactNode }) {
    const systemSchema = useColorScheme();
    const [design, setDesignZustand] = useState<DesignName>("dunkel");

    useEffect(() => {
        let abgebrochen = false;
        void (async () => {
            try {
                const gespeichert = await AsyncStorage.getItem(DESIGN_SPEICHER);
                if (!abgebrochen && (gespeichert === "hell" || gespeichert === "dunkel")) {
                    setDesignZustand(gespeichert);
                    return;
                }
            } catch {
                // Speicher nicht lesbar: Systemvorgabe entscheidet weiter.
            }
            if (!abgebrochen && systemSchema === "light") {
                setDesignZustand("hell");
            }
        })();
        return () => {
            abgebrochen = true;
        };
    }, [systemSchema]);

    const setDesign = useCallback((neu: DesignName) => {
        setDesignZustand(neu);
        void AsyncStorage.setItem(DESIGN_SPEICHER, neu).catch(() => {
            // Ein nicht speicherbarer Wert ist kein Grund, die Umschaltung
            // zu blockieren.
        });
    }, []);

    const wert = useMemo<DesignWert>(() => {
        const farben = farbenFuer(design);
        return {
            design,
            hell: design === "hell",
            farben,
            schatten: schattenFuer(design),
            setDesign,
            umschalten: () => setDesign(design === "hell" ? "dunkel" : "hell"),
        };
    }, [design, setDesign]);

    return <DesignKontext.Provider value={wert}>{children}</DesignKontext.Provider>;
}

/**
 * Liefert die aktuelle Design-Wahl. Außerhalb des Anbieters ein fester
 * Dunkelwert statt eines Absturzes (wie im Web, design-anbieter.tsx 84–96).
 */
export function useDesign(): DesignWert {
    const wert = useContext(DesignKontext);
    if (wert) {
        return wert;
    }
    return {
        design: "dunkel",
        hell: false,
        farben: farbenFuer("dunkel"),
        schatten: schattenFuer("dunkel"),
        setDesign: () => {},
        umschalten: () => {},
    };
}
