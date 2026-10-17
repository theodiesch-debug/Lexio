/**
 * Das Eingabefeld – Web: `.eingabe`, `.input`.
 *
 * Innenfläche `--input-bg`, Radius 12px, mindestens 48px hoch, und im Fokus
 * ein Rand in Sage mit einem weichen Ring (`0 0 0 3px rgba(101,168,141,.22)`
 * im Web; hier als `shadow` mit derselben Farbe nachgebildet).
 */

import { useState } from "react";
import {
    TextInput,
    type StyleProp,
    type TextInputProps,
    type ViewStyle,
} from "react-native";

import { SANS } from "../design/schrift";
import { useDesign } from "../design/theme";
import { MASS, RADIUS } from "../design/tokens";

type Props = TextInputProps & {
    /** Ring und Rahmen im Fokus an- oder abschalten (Standard an). */
    fokusRing?: boolean;
    style?: StyleProp<ViewStyle>;
};

const SAGE_RING = "rgba(101, 168, 141, 0.22)";

export function Feld({ fokusRing = true, style, onFocus, onBlur, ...rest }: Props) {
    const { farben } = useDesign();
    const [fokussiert, setFokussiert] = useState(false);

    return (
        <TextInput
            {...rest}
            onFocus={(e) => {
                setFokussiert(true);
                onFocus?.(e);
            }}
            onBlur={(e) => {
                setFokussiert(false);
                onBlur?.(e);
            }}
            placeholderTextColor={farben.placeholder}
            style={[
                {
                    minHeight: MASS.feld,
                    borderRadius: RADIUS.feld,
                    borderWidth: 1,
                    borderColor: fokussiert && fokusRing ? farben.sage : farben.line,
                    backgroundColor: farben.inputBg,
                    color: farben.textPrimary,
                    fontFamily: SANS.regular,
                    fontSize: 16,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                },
                fokussiert && fokusRing
                    ? {
                          shadowColor: SAGE_RING,
                          shadowOpacity: 1,
                          shadowRadius: 3,
                          shadowOffset: { width: 0, height: 0 },
                          elevation: 0,
                      }
                    : null,
                style,
            ]}
        />
    );
}
