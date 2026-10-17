import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";

import { useLexioSchriften } from "../design/schrift";
import { DesignAnbieter, useDesign } from "../design/theme";

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

  if (!schriftenBereit) {
    return <View style={{ flex: 1, backgroundColor: "#0e0c09" }} />;
  }

  return (
    <DesignAnbieter>
      <Inhalt />
    </DesignAnbieter>
  );
}
