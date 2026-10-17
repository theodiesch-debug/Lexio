/**
 * Der Fortschrittsbalken – Web: `.fortschrittBalken`, `.balken`,
 * `.set-fortschritt`, `.spracheBalken`.
 *
 * Schiene `--bg-elevated-2`, Füllung je Kontext (Gold im Lernen und in der
 * Statistik, Sage in der Sprachzeile). Die Füllung ist nie breiter als die
 * Schiene; ein Wert über 1 oder unter 0 wird gekappt, statt auszubrechen.
 */

import { View, type StyleProp, type ViewStyle } from "react-native";

import { useDesign } from "../design/theme";
import { RADIUS } from "../design/tokens";

type Props = {
    /** Anteil zwischen 0 und 1. */
    anteil: number;
    /** Füllfarbe; Standard ist das Gold des Themas. */
    farbe?: string;
    hoehe?: number;
    /** Radius der Füllung; Standard ist die volle Pille. */
    radius?: number;
    style?: StyleProp<ViewStyle>;
};

export function Fortschrittsbalken({ anteil, farbe, hoehe = 7, radius = RADIUS.pille, style }: Props) {
    const { farben } = useDesign();
    const sicher = Number.isFinite(anteil) ? Math.min(1, Math.max(0, anteil)) : 0;
    return (
        <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(sicher * 100) }}
            style={[
                {
                    height: hoehe,
                    borderRadius: radius,
                    backgroundColor: farben.bgElevated2,
                    overflow: "hidden",
                },
                style,
            ]}
        >
            <View
                style={{
                    width: `${sicher * 100}%`,
                    height: "100%",
                    borderRadius: radius,
                    backgroundColor: farbe ?? farben.gold,
                }}
            />
        </View>
    );
}
