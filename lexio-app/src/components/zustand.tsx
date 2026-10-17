/**
 * Zustände – Web: `.skelett`, `.leer`, `.meldung`.
 *
 * Drei Bausteine für die Momente, in denen noch keine Inhalte da sind:
 * das Skelett (es wird geladen), der Leerzustand (es gibt nichts) und die
 * Meldung (es ist gerade etwas passiert). Alle drei tragen dieselbe Optik wie
 * im Web, statt einen Spinner zu zeigen.
 */

import { useEffect, useMemo } from "react";
import {
    Animated,
    Easing,
    Text,
    View,
    type StyleProp,
    type ViewStyle,
} from "react-native";

import { SANS } from "../design/schrift";
import { useDesign } from "../design/theme";
import { RADIUS } from "../design/tokens";
import { Knopf } from "./knopf";

/** Ein pulsierender Platzhalter für eine Fläche, die noch lädt. */
export function Skelett({
    style,
    radius = RADIUS.standard,
}: {
    style?: StyleProp<ViewStyle>;
    radius?: number;
}) {
    const { farben } = useDesign();
    const puls = useMemo(() => new Animated.Value(1), []);

    useEffect(() => {
        const schleife = Animated.loop(
            Animated.sequence([
                Animated.timing(puls, {
                    toValue: 0.45,
                    duration: 600,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(puls, {
                    toValue: 1,
                    duration: 600,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ]),
        );
        schleife.start();
        return () => schleife.stop();
    }, [puls]);

    return (
        <Animated.View
            style={[
                {
                    backgroundColor: farben.skeletonBase,
                    borderRadius: radius,
                    opacity: puls,
                },
                style,
            ]}
        />
    );
}

/** Ein leerer Zustand: gestrichelter Rahmen, Text, optionale Handlung. */
export function Leerzustand({
    text,
    knopfTitel,
    onKnopf,
}: {
    text: string;
    knopfTitel?: string;
    onKnopf?: () => void;
}) {
    const { farben } = useDesign();
    return (
        <View
            style={{
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: farben.line,
                borderRadius: RADIUS.karte,
                padding: 28,
                alignItems: "center",
                gap: 16,
            }}
        >
            <Text
                style={{
                    fontFamily: SANS.regular,
                    fontSize: 16,
                    textAlign: "center",
                    color: farben.textSecondary,
                }}
            >
                {text}
            </Text>
            {knopfTitel && onKnopf ? (
                <Knopf titel={knopfTitel} onPress={onKnopf} variante="rand" />
            ) : null}
        </View>
    );
}

/** Eine kurze Rückmeldung unten in der Mitte, wie der Web-Toast. */
export function Melde({ text }: { text: string | null }) {
    const { farben, schatten } = useDesign();
    if (!text) {
        return null;
    }
    return (
        <View
            pointerEvents="none"
            style={[
                {
                    position: "absolute",
                    left: 24,
                    right: 24,
                    bottom: 90,
                    alignItems: "center",
                },
            ]}
        >
            <View
                style={[
                    {
                        backgroundColor: farben.bgElevated2,
                        borderColor: farben.line,
                        borderWidth: 1,
                        borderRadius: RADIUS.standard,
                        paddingHorizontal: 18,
                        paddingVertical: 12,
                    },
                    schatten.weich,
                ]}
            >
                <Text
                    style={{
                        fontFamily: SANS.medium,
                        fontSize: 14,
                        color: farben.textPrimary,
                    }}
                >
                    {text}
                </Text>
            </View>
        </View>
    );
}
