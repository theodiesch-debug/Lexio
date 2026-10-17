/**
 * Wortschatz – Web: app/(app)/wortschatz/wortschatz-seite.tsx.
 *
 * Alle Vokabeln quer durch alle sichtbaren Sets, mit clientseitiger Suche. Die
 * Suche filtert im Gerät statt bei jedem Tastendruck die API zu fragen – bei
 * einigen tausend Einträgen ist das der schnellere Weg, und die Daten kommen
 * einmal statt je Zeichen. Sichtbarkeit regelt die RLS auf `karten`; der Client
 * darf sie als gegeben annehmen.
 *
 * Abweichung zum Web: die Set-Spalte steht unter dem Text statt daneben. Auf
 * Telefonbreite macht das Web dasselbe (`@media (max-width: 560px)`); breite
 * Geräte bekommen hier dieselbe gestapelte Form statt eines zweiten Layouts.
 */

import { FontAwesome6 } from "@expo/vector-icons";
import { nameVonSprache, type SpracheInfo } from "@lexio/sprachen";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Knopf } from "@/components/knopf";
import { Sprachpunkt } from "@/components/sprachpunkt";
import { Skelett } from "@/components/zustand";
import { SANS, SERIF } from "@/design/schrift";
import { useDesign } from "@/design/theme";
import { ABSTAND, MASS, RADIUS } from "@/design/tokens";
import { holeJson } from "@/lib/api";

type WortEintrag = {
  id: string;
  frage: string;
  antwort: string;
  beispielsatz: string | null;
  beispielUebersetzung: string | null;
  set: {
    id: string;
    name: string;
    sprache: SpracheInfo;
    eigen: boolean;
  } | null;
};

export default function Wortschatz() {
  const { farben } = useDesign();

  const [woerter, setWoerter] = useState<WortEintrag[]>([]);
  const [suche, setSuche] = useState("");
  const [laden, setLaden] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    let abgebrochen = false;
    holeJson<WortEintrag[] | null>("/api/wortschatz", null)
      .then((daten) => {
        if (abgebrochen) return;
        if (daten === null) {
          setFehler("Wortschatz konnte nicht geladen werden.");
          setWoerter([]);
          return;
        }
        setWoerter(daten);
        setFehler(null);
      })
      .catch(() => {
        if (abgebrochen) return;
        setFehler("Wortschatz konnte nicht geladen werden.");
      })
      .finally(() => {
        if (!abgebrochen) setLaden(false);
      });
    return () => {
      abgebrochen = true;
    };
  }, []);

  const gefiltert = useMemo(() => {
    const begriff = suche.trim().toLowerCase();
    if (!begriff) return woerter;
    return woerter.filter(
      (w) =>
        w.frage.toLowerCase().includes(begriff) ||
        w.antwort.toLowerCase().includes(begriff) ||
        (w.beispielsatz ?? "").toLowerCase().includes(begriff),
    );
  }, [woerter, suche]);

  const kopf = (
    <View style={styles.kopfBereich}>
      <View style={styles.kopf}>
        <View style={styles.kopfText}>
          <Text style={[styles.titel, { color: farben.textPrimary }]}>Wortschatz</Text>
          <Text style={[styles.untertitel, { color: farben.textMuted }]}>
            {woerter.length} {woerter.length === 1 ? "Vokabel" : "Vokabeln"}
            {woerter.length > 0 ? " in allen Sets" : ""}
          </Text>
        </View>
        <Knopf
          titel="Set-Übersicht"
          variante="rand"
          form="eckig"
          hoehe={MASS.knopf}
          onPress={() => router.push("/karteikarten")}
        />
      </View>

      <View
        style={[
          styles.suchfeld,
          { backgroundColor: farben.bgElevated, borderColor: farben.line },
        ]}
      >
        <FontAwesome6 name="magnifying-glass" size={15} color={farben.textMuted} />
        <TextInput
          value={suche}
          onChangeText={setSuche}
          placeholder="Wort, Übersetzung oder Beispielsatz suchen"
          placeholderTextColor={farben.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Wortschatz durchsuchen"
          style={[styles.suchEingabe, { color: farben.textPrimary }]}
        />
      </View>
    </View>
  );

  return (
    <FlatList
      data={laden || fehler ? [] : gefiltert}
      keyExtractor={(w) => w.id}
      ListHeaderComponent={kopf}
      contentContainerStyle={styles.inhalt}
      keyboardShouldPersistTaps="handled"
      style={[styles.listeRahmen, { backgroundColor: farben.bgElevated, borderColor: farben.line }]}
      renderItem={({ item, index }) => (
        <WortZeile eintrag={item} erster={index === 0} />
      )}
      ListEmptyComponent={
        laden ? (
          <View style={styles.ladeRahmen}>
            <Skelett style={styles.skelett} />
          </View>
        ) : fehler ? (
          <Text style={[styles.leer, { color: farben.terracotta }]}>{fehler}</Text>
        ) : (
          <Text style={[styles.leer, { color: farben.textMuted }]}>
            {woerter.length === 0
              ? "Noch keine Vokabeln vorhanden."
              : `Nichts gefunden für „${suche.trim()}“.`}
          </Text>
        )
      }
    />
  );
}

function WortZeile({ eintrag, erster }: { eintrag: WortEintrag; erster: boolean }) {
  const { farben } = useDesign();
  const w = eintrag;
  return (
    <View
      style={[
        styles.zeile,
        !erster && { borderTopWidth: 1, borderTopColor: farben.line },
      ]}
    >
      <View style={styles.text}>
        <Text style={[styles.begriff, { color: farben.textPrimary }]}>{w.frage}</Text>
        <Text style={[styles.uebersetzung, { color: farben.textSecondary }]}>{w.antwort}</Text>
        {w.beispielsatz ? (
          <Text style={[styles.beispiel, { color: farben.textMuted }]}>„{w.beispielsatz}“</Text>
        ) : null}
        {w.beispielUebersetzung ? (
          <Text style={[styles.beispielUebersetzung, { color: farben.textMuted }]}>
            {w.beispielUebersetzung}
          </Text>
        ) : null}
      </View>

      {w.set ? (
        <View style={styles.setSeite}>
          <View style={styles.setBild}>
            <Sprachpunkt sprache={w.set.sprache} />
            <Text style={[styles.setSprache, { color: farben.textMuted }]}>
              {nameVonSprache(w.set.sprache)}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push(`/lernen/${w.set?.id ?? ""}`)}
            accessibilityRole="link"
            accessibilityLabel={`Set ${w.set.name} lernen`}
            style={styles.setNameKnopf}
          >
            <Text style={[styles.setName, { color: farben.textSecondary }]} numberOfLines={1}>
              {w.set.name}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inhalt: {
    paddingHorizontal: ABSTAND.lg,
    paddingTop: ABSTAND.md,
    paddingBottom: ABSTAND.xxl,
    gap: ABSTAND.md,
  },
  kopfBereich: { gap: ABSTAND.md },
  kopf: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: ABSTAND.md,
  },
  kopfText: { flexShrink: 1 },
  titel: { fontFamily: SERIF.bold, fontSize: 30, lineHeight: 34 },
  untertitel: { fontFamily: SANS.regular, fontSize: 14, marginTop: 2 },

  suchfeld: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: RADIUS.standard,
  },
  suchEingabe: {
    flex: 1,
    minHeight: MASS.touch,
    fontFamily: SANS.regular,
    fontSize: 15,
    padding: 0,
  },

  listeRahmen: {
    marginHorizontal: ABSTAND.lg,
    borderWidth: 1,
    borderRadius: RADIUS.standard,
    overflow: "hidden",
  },

  zeile: { paddingHorizontal: 14, paddingVertical: 12, gap: ABSTAND.sm },
  text: { gap: 2 },
  begriff: { fontFamily: SANS.bold, fontSize: 15 },
  uebersetzung: { fontFamily: SANS.regular, fontSize: 14 },
  beispiel: { fontFamily: SANS.regular, fontSize: 14, fontStyle: "italic", marginTop: 3 },
  beispielUebersetzung: { fontFamily: SANS.regular, fontSize: 14, marginTop: 1 },

  setSeite: { gap: ABSTAND.xs },
  setBild: { flexDirection: "row", alignItems: "center", gap: 6 },
  setSprache: { fontFamily: SANS.regular, fontSize: 14 },
  setNameKnopf: { minHeight: MASS.touch, justifyContent: "center" },
  setName: { fontFamily: SANS.semibold, fontSize: 14 },

  leer: {
    fontFamily: SANS.regular,
    fontSize: 15,
    textAlign: "center",
    paddingVertical: ABSTAND.xxl,
    paddingHorizontal: ABSTAND.lg,
  },
  ladeRahmen: { padding: ABSTAND.lg },
  skelett: { height: 220 },
});
