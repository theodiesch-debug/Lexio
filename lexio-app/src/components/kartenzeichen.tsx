/**
 * Das Kartenzeichen – Web: components/kartenzeichen.tsx.
 *
 * Dieselbe Geometrie wie im Web, aus `@lexio/kartenzeichen`: die UUID der
 * Karte wird zu einer Form. Kein Zufall, keine Speicherung, dasselbe Zeichen
 * auf jedem Gerät.
 *
 * Zwei Unterschiede zum Web, die bewusst sind:
 *   - Das Web greift für Wörter mit Bild auf einen gepflegten Icon-Satz zu
 *     (`lib/kartenzeichen-semantik.ts` + erzeugte SVGs). In der App zeichnen
 *     wir vorerst immer die erzeugte Form. Der Icon-Satz kann später
 *     nachgezogen werden, ohne diese Datei zu ändern.
 *   - `currentColor` gibt es in React Native nicht; die Tinte kommt als Prop.
 */

import { kartenzeichen, kartenzeichenFormen, ZEICHEN_FELD } from "@lexio/kartenzeichen";
import { Path, Svg } from "react-native-svg";

import { KARTEN_TINTE } from "../design/tokens";

type Props = {
    karteId: string;
    groesse?: number;
    farbe?: string;
};

export function Kartenzeichen({ karteId, groesse = 32, farbe = KARTEN_TINTE.fest }: Props) {
    const zeichen = kartenzeichen(karteId);
    const formen = kartenzeichenFormen(zeichen);
    const staerke = 1.5 * zeichen.strich;

    return (
        <Svg
            width={groesse}
            height={groesse}
            viewBox={`0 0 ${ZEICHEN_FELD} ${ZEICHEN_FELD}`}
            fill="none"
            opacity={zeichen.deckkraft}
            pointerEvents="none"
        >
            {formen.map((form, i) =>
                form.gefuellt ? (
                    <Path key={i} d={form.d} fill={farbe} />
                ) : (
                    <Path
                        key={i}
                        d={form.d}
                        stroke={farbe}
                        strokeWidth={staerke}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                ),
            )}
        </Svg>
    );
}
