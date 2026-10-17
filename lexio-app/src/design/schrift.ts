/**
 * Die vier Schriften des Web-Auftritts, für die App.
 *
 * Web-Vorbild: app/styles/global.css Z. 27–30 (`--font-sans`, `--font-serif`,
 * `--font-mono`, `--font-caveat`). Das Web lädt sie über `next/font`; die App
 * lädt dieselben Familien über die @expo-google-fonts-Pakete.
 *
 * Warum je Gewicht ein eigener Name und kein `fontWeight`: React Native
 * versteht `fontWeight` nur zuverlässig, wenn die Familie als Variable Font
 * registriert ist. Diese Pakete liefern feste Schnitte, deshalb steht das
 * Gewicht im Namen (`Inter_700Bold`). `fontWeight` würde auf Android sonst
 * den falschen Schnitt wählen oder synthetisch fett zeichnen.
 */

import {
    Caveat_400Regular,
    Caveat_700Bold,
} from "@expo-google-fonts/caveat";
import {
    Fraunces_400Regular,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
} from "@expo-google-fonts/fraunces";
import {
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
    IBMPlexMono_700Bold,
} from "@expo-google-fonts/ibm-plex-mono";
import { useFonts } from "expo-font";

/** Sans (Inter). Fließtext, Bedienelemente, Navigation. */
export const SANS = {
    regular: "Inter_400Regular",
    medium: "Inter_500Medium",
    semibold: "Inter_600SemiBold",
    bold: "Inter_700Bold",
} as const;

/** Serif (Fraunces). Überschriften und Seitentitel. */
export const SERIF = {
    regular: "Fraunces_400Regular",
    semibold: "Fraunces_600SemiBold",
    bold: "Fraunces_700Bold",
} as const;

/** Mono (IBM Plex Mono). Zahlen, XP, Labels, Metazeilen. */
export const MONO = {
    regular: "IBMPlexMono_400Regular",
    medium: "IBMPlexMono_500Medium",
    semibold: "IBMPlexMono_600SemiBold",
    bold: "IBMPlexMono_700Bold",
} as const;

/** Caveat. Handschriftmomente: Logo, Set-Name, Kartenwort, Endtitel. */
export const CAVEAT = {
    regular: "Caveat_400Regular",
    bold: "Caveat_700Bold",
} as const;

/** Der Ladekatalog für `useFonts`. */
export const SCHRIFT_KATALOG = {
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Fraunces_400Regular,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
    IBMPlexMono_700Bold,
    Caveat_400Regular,
    Caveat_700Bold,
} as const;

/**
 * Lädt die Schriften und meldet, ob sie bereit sind.
 *
 * Wirft die Fehlermeldung weiter, statt sie zu verschlucken: eine App, die
 * ohne die Schriften startet, sieht auf jedem Screen anders aus als
 * entworfen, und niemand wüsste warum.
 */
export function useLexioSchriften(): boolean {
    const [geladen, fehler] = useFonts(SCHRIFT_KATALOG);
    if (fehler) {
        throw fehler;
    }
    return geladen;
}
