import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";

import { useLexioSchriften } from "../design/schrift";
import { DesignAnbieter, useDesign } from "../design/theme";
import { erinnerungWiederherstellen, meldungenAktivieren } from "../lib/benachrichtigungen";

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

  if (!schriftenBereit) {
    return <View style={{ flex: 1, backgroundColor: "#0e0c09" }} />;
  }

  return (
    <DesignAnbieter>
      <Inhalt />
    </DesignAnbieter>
  );
}
