/**
 * Die erhöhte Fläche – Web: `.karte`, `.allgemein`, `.tabellenRahmen`.
 *
 * Drei Ebenen hat das Web: `--background` (Grund), `--bg-elevated` (Karte),
 * `--bg-elevated-2` (Inset, Chip, Schiene). Diese Komponente ist die zweite
 * Ebene, immer mit einer feinen Linie und weichem Schatten.
 */

import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { useDesign } from "../design/theme";
import { RADIUS } from "../design/tokens";

type Props = {
    children: ReactNode;
    /** Standardrade 16px; große Karten (Lernen, Dialog) dürfen mehr. */
    radius?: number;
    /** Ebene 3 statt 2 (`--bg-elevated-2`). */
    inset?: boolean;
    randlos?: boolean;
    schatten?: boolean;
    style?: StyleProp<ViewStyle>;
};

export function Karte({
    children,
    radius = RADIUS.standard,
    inset = false,
    randlos = false,
    schatten = false,
    style,
}: Props) {
    const { farben, schatten: schattenSatz } = useDesign();
    return (
        <View
            style={[
                {
                    backgroundColor: inset ? farben.bgElevated2 : farben.bgElevated,
                    borderRadius: radius,
                    borderWidth: randlos ? 0 : 1,
                    borderColor: farben.line,
                },
                schatten ? schattenSatz.weich : null,
                style,
            ]}
        >
            {children}
        </View>
    );
}
