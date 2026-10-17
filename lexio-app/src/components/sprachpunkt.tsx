/**
 * Der Sprachpunkt – Web: `.punkt` in Karteikarten, Wortschatz, Statistiken.
 *
 * Ein 10px großer Kreis in der Flächenfarbe der Sprache. Die Farbe kommt aus
 * der Datenbank (public.sprachen), nicht aus dem Theme: eine Sprache hat ihre
 * Farbe in beiden Designs.
 */

import { View } from "react-native";

import { farbeVonSprache, type SpracheInfo } from "@lexio/sprachen";

type Props = {
    sprache?: SpracheInfo | { flaeche?: string; akzent?: string } | null;
    groesse?: number;
};

export function Sprachpunkt({ sprache, groesse = 10 }: Props) {
    const farbe = farbeVonSprache(
        sprache as SpracheInfo | null | undefined,
    ).flaeche;
    return (
        <View
            style={{
                width: groesse,
                height: groesse,
                borderRadius: groesse / 2,
                backgroundColor: farbe,
            }}
        />
    );
}
