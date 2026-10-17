/**
 * Reduzierte Bewegung – das App-Pendant zum Web-Block
 * `@media (prefers-reduced-motion: reduce)` in `app/styles/global.css`.
 *
 * Das Web schaltet dort jede Animation auf 0,01ms herunter. In der App liest
 * dieser Hook die Systemeinstellung ("Bewegung reduzieren") und meldet sie den
 * animierenden Bausteinen. Sie lassen dann die Bewegung weg: das Skelett pulsiert
 * nicht, der Kartenwechsel dreht nicht, der XP-Pop erscheint ohne Flug.
 *
 * Die Einstellung ist nicht statisch – sie lässt sich im System umstellen,
 * während die App läuft. Deshalb wird der Wert beobachtet und nicht nur einmal
 * gelesen.
 */

import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export function useReduzierteBewegung(): boolean {
  const [reduziert, setReduziert] = useState(false);

  useEffect(() => {
    let aktiv = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((wert) => {
        if (aktiv) setReduziert(wert);
      })
      .catch(() => undefined);

    const abo = AccessibilityInfo.addEventListener("reduceMotionChanged", (wert) => {
      setReduziert(wert);
    });

    return () => {
      aktiv = false;
      abo.remove();
    };
  }, []);

  return reduziert;
}
