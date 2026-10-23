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

/*
 * Importiert wird je Schrift aus dem Gewichts-Unterordner, nicht aus dem
 * Paket-Index. Der Index eines @expo-google-fonts-Pakets `require`t ALLE
 * Schnitte (Inter allein 18 Dateien, inklusive Kursiv). Metro kann solche
 * `require`-Aufrufe nicht wegoptimieren – so lagen im fertigen APK 14,9 MB
 * Schriften, von denen die App neun braucht. Ueber den Unterordner landet
 * nur die eine .ttf im Bundle.
 */
import { Caveat_700Bold } from "@expo-google-fonts/caveat/700Bold";
import { Fraunces_700Bold } from "@expo-google-fonts/fraunces/700Bold";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { IBMPlexMono_400Regular } from "@expo-google-fonts/ibm-plex-mono/400Regular";
import { IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono/500Medium";
import { IBMPlexMono_700Bold } from "@expo-google-fonts/ibm-plex-mono/700Bold";
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
    bold: "Fraunces_700Bold",
} as const;

/** Mono (IBM Plex Mono). Zahlen, XP, Labels, Metazeilen. */
export const MONO = {
    regular: "IBMPlexMono_400Regular",
    medium: "IBMPlexMono_500Medium",
    bold: "IBMPlexMono_700Bold",
} as const;

/** Caveat. Handschriftmomente: Logo, Set-Name, Kartenwort, Endtitel. */
export const CAVEAT = {
    bold: "Caveat_700Bold",
} as const;

/** Der Ladekatalog für `useFonts`. */
export const SCHRIFT_KATALOG = {
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Fraunces_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_700Bold,
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
