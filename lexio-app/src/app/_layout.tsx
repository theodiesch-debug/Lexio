import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";

import { DatenCacheAnbieter } from "../lib/daten-cache";
import { useLexioSchriften } from "../design/schrift";
import { DesignAnbieter, useDesign } from "../design/theme";
import { erinnerungWiederherstellen, meldungenAktivieren } from "../lib/benachrichtigungen";

/*
 * Die native Splash bleibt stehen, bis die Schriften geladen sind.
 *
 * Ohne das blendet Expo sie aus, sobald der JS-Bundle laeuft – also bevor
 * `useLexioSchriften` fertig ist. In dieser Luecke stand eine leere dunkle
 * Flaeche: der erste sichtbare Eindruck der App war ein schwarzer Kasten,
 * kein Logo. `preventAutoHideAsync` gehoert in den Modulumfang, nicht in
 * einen Effekt, sonst ist das Ausblenden schon passiert.
 */
void SplashScreen.preventAutoHideAsync().catch(() => {
    // Auf Web und in Tests gibt es keine native Splash – kein Grund zu werfen.
});
SplashScreen.setOptions({ duration: 240, fade: true });

function Inhalt() {
  const { farben, hell } = useDesign();
  return (
    <>
      <StatusBar style={hell ? "dark" : "light"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: farben.background },
        }}
      />
    </>
  );
}

export default function RootLayout() {
  const schriftenBereit = useLexioSchriften();

  // Fehlt der Handler oder der Eintrag nach dem Neuaufbau, verpufft die
  // Erinnerung leise – deshalb direkt beim Start, nicht erst in den Einstellungen.
  useEffect(() => {
    meldungenAktivieren();
    void erinnerungWiederherstellen();
  }, []);

  useEffect(() => {
    if (schriftenBereit) {
      void SplashScreen.hideAsync().catch(() => {
        // Schon ausgeblendet oder kein natives Splash – ignorieren.
      });
    }
  }, [schriftenBereit]);

  if (!schriftenBereit) {
    /*
     * Hinter der Splash, nicht statt ihrer. Der Ton entspricht dem
     * Splash-Hintergrund aus app.json (#4C3220), damit ein spaeter
     * einsetzendes Ausblenden keine Farbkante zeigt.
     */
    return <View style={{ flex: 1, backgroundColor: "#4C3220" }} />;
  }

  return (
    <DesignAnbieter>
      <DatenCacheAnbieter>
        <Inhalt />
      </DatenCacheAnbieter>
    </DesignAnbieter>
  );
}
