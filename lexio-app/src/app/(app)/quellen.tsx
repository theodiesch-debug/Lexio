/**
 * Quellen – Web: app/quellen/page.tsx.
 *
 * Die englischen Wortlisten stammen aus fremden, Creative-Commons-lizenzierten
 * Quellen (NGSL, Kaikki/Wiktionary, Tatoeba). Die Quellenangabe muss dort
 * stehen, wo jemand sie lesen kann – im Web auf der öffentlichen Landing, in
 * der App von den Einstellungen aus erreichbar, weil die App keine Landing hat.
 *
 * Eine Textseite, kein Raster: der Rhythmus entsteht über Zeilenlänge und
 * Abschnittsabstand, wie im Web.
 */

import { router } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { SANS, SERIF } from "@/design/schrift";
import { useDesign } from "@/design/theme";
import { ABSTAND, MASS, RADIUS } from "@/design/tokens";

const QUELLEN = [
  {
    name: "NGSL – New General Service List",
    bereich: "Auswahl der englischen Wörter und ihre Reihenfolge",
    lizenz: "CC BY-SA 4.0",
    url: "https://github.com/FabriceBoyer/word_lists",
    hinweis:
      "Die Auswahl folgt der Worthäufigkeit, keinem Lernniveau. Aus diesem Grund heißen die Sets „Alltag“ und „Ausbau“ und nicht etwa „A1“ oder „B1“.",
  },
  {
    name: "Kaikki – Wiktionary-Dump (Englisch, Deutsch)",
    bereich: "Deutsche Übersetzungen und Wortarten",
    lizenz: "CC BY-SA 4.0",
    url: "https://kaikki.org/dictionary/English/",
    hinweis:
      "Zu einem Wort nennt Wiktionary oft mehrere Bedeutungen. Lexio wählt die zur deutschen Übersetzung passende Bedeutung und legt Karten mit unpassender Bedeutung nicht an.",
  },
  {
    name: "Tatoeba – Beispielsatzpaare (Englisch/Deutsch)",
    bereich: "Beispielsatz und deutsche Übersetzung",
    lizenz: "je Satz verschieden, überwiegend CC BY 2.0 FR",
    url: "https://tatoeba.org/de",
    hinweis:
      "Die Beispielsätze wurden nach den Kriterien der Quellen ausgewählt: kurze, vollständige Sätze, die zur Karte passen.",
  },
];

export default function Quellen() {
  const { farben } = useDesign();

  return (
    <View style={[styles.rahmen, { backgroundColor: farben.background }]}>
      <ScrollView contentContainerStyle={styles.seite}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          style={styles.zurueck}
        >
          <Text style={[styles.zurueckText, { color: farben.textSecondary }]}>← Zurück</Text>
        </Pressable>

        <Text style={[styles.h1, { color: farben.textPrimary }]}>Quellen der Wortlisten</Text>

        <Text style={[styles.einleitung, { color: farben.textSecondary }]}>
          Die englischen Wortlisten sind der Teil von Lexio, der nicht von mir erfunden wurde.
          Die englischen Sets in allen Sprachversionen gehen auf die Wortlisten und Wörterbücher
          zurück, aus denen sie erzeugt wurden. Diese Listen sind Creative-Commons-lizenziert –
          deshalb steht hier, woher sie kommen, und unter welcher Lizenz sie stehen.
        </Text>

        <Text style={[styles.h2, { color: farben.textPrimary }]}>Drei Quellen</Text>

        <View style={[styles.liste, { borderTopColor: farben.line }]}>
          {QUELLEN.map((q) => (
            <View key={q.name} style={[styles.eintrag, { borderBottomColor: farben.line }]}>
              <View style={styles.eintragKopf}>
                <Text style={[styles.quellenName, { color: farben.textPrimary }]}>{q.name}</Text>
                <Text style={[styles.lizenz, { backgroundColor: farben.gold, color: farben.ink }]}>
                  {q.lizenz}
                </Text>
              </View>
              <Text style={[styles.absatz, { color: farben.textSecondary }]}>{q.bereich}</Text>
              <Text style={[styles.hinweis, { color: farben.textSecondary }]}>{q.hinweis}</Text>
              <Pressable
                onPress={() => void Linking.openURL(q.url)}
                accessibilityRole="link"
                style={styles.link}
              >
                <Text style={[styles.linkText, { color: farben.textPrimary }]}>
                  {q.url.replace(/^https?:\/\//, "")}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>

        <Text style={[styles.h2, { color: farben.textPrimary }]}>Was daraus wurde</Text>
        <Text style={[styles.absatz, { color: farben.textSecondary }]}>
          Diese Karten sind Bearbeitungen der genannten Quellen: ausgewählte Wörter, geprüfte
          Übersetzungen, dazu ein passender Beispielsatz. Nach der Share-Alike-Klausel von CC BY-SA
          müssen solche Bearbeitungen unter derselben Lizenz weitergegeben werden. Die englische
          Originalwortliste von NGSL steht deshalb unter CC BY-SA 4.0, und Lexio gibt sie unter
          dieser Lizenz weiter.
        </Text>

        <Text style={[styles.h2, { color: farben.textPrimary }]}>Was das für den Gebrauch heißt</Text>
        {[
          "Die Sets folgen der Worthäufigkeit, keinem Lernniveau. Es gibt keine CEFR-Einstufung, und die Namen der Sets sagen nichts darüber aus, ob ein Wort für einen Anfänger geeignet ist.",
          "Für die Grundlagen aus dem Alltag genügt ein Wörterbuch daneben. Wer ohne Hilfsmittel lernen will, fängt bei „Alltag“ an und lässt die späteren Sets liegen.",
          "Beispielsätze stammen von Muttersprachlern und klingen nicht immer wie Lehrbuch-Deutsch. Sie sind echte Sätze, kein Stilideal.",
          "Eigene Karten und eigene Wortlisten sind davon nicht betroffen – das bleibt bei dir im Konto.",
        ].map((punkt) => (
          <View key={punkt} style={styles.punkt}>
            <Text style={[styles.punktZeichen, { color: farben.textMuted }]}>•</Text>
            <Text style={[styles.punktText, { color: farben.textSecondary }]}>{punkt}</Text>
          </View>
        ))}

        <Text style={[styles.h2, { color: farben.textPrimary }]}>Eigene Karten</Text>
        <Text style={[styles.absatz, { color: farben.textSecondary }]}>
          Selbst angelegte Karten, Wortlisten und Texte gehören dir. Sie werden nicht an Dritte
          weitergegeben und nicht in die vorinstallierten Listen aufgenommen. Wenn du eine Wortliste
          selbst veröffentlichen willst, ist das eine andere Frage – dann gelten die Rechte, die du
          selbst hast.
        </Text>

        <Text style={[styles.klein, { color: farben.textMuted, borderTopColor: farben.line }]}>
          Quellenangabe nach der Namensnennungspflicht von CC BY-SA 4.0. Die Bearbeitungen stehen
          unter derselben Lizenz wie die Quellen.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  rahmen: { flex: 1 },
  seite: {
    paddingHorizontal: ABSTAND.lg,
    paddingTop: ABSTAND.md,
    paddingBottom: ABSTAND.riesig,
    gap: ABSTAND.sm,
  },
  zurueck: { minHeight: MASS.touch, justifyContent: "center", alignSelf: "flex-start" },
  zurueckText: { fontFamily: SANS.medium, fontSize: 15 },

  h1: {
    fontFamily: SERIF.bold,
    fontSize: 32,
    lineHeight: 38,
    marginTop: ABSTAND.sm,
    marginBottom: ABSTAND.sm,
  },
  h2: {
    fontFamily: SERIF.bold,
    fontSize: 22,
    lineHeight: 26,
    marginTop: ABSTAND.xl,
    marginBottom: ABSTAND.sm,
  },
  einleitung: { fontFamily: SANS.regular, fontSize: 17, lineHeight: 27 },
  absatz: { fontFamily: SANS.regular, fontSize: 16, lineHeight: 26, marginBottom: ABSTAND.sm },

  liste: { borderTopWidth: 1 },
  eintrag: { paddingVertical: ABSTAND.lg, borderBottomWidth: 1, gap: ABSTAND.xs },
  eintragKopf: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    gap: ABSTAND.sm,
    marginBottom: 4,
  },
  quellenName: { fontFamily: SANS.semibold, fontSize: 16, lineHeight: 22, flexShrink: 1 },
  lizenz: {
    fontFamily: SANS.medium,
    fontSize: 14,
    letterSpacing: 0.2,
    textTransform: "uppercase",
    borderRadius: RADIUS.pille,
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: "hidden",
  },
  hinweis: { fontFamily: SANS.regular, fontSize: 15, lineHeight: 23 },
  link: { minHeight: MASS.touch, justifyContent: "center" },
  linkText: {
    fontFamily: SANS.regular,
    fontSize: 16,
    textDecorationLine: "underline",
  },

  punkt: { flexDirection: "row", gap: ABSTAND.sm, marginBottom: ABSTAND.sm },
  punktZeichen: { fontFamily: SANS.bold, fontSize: 16, lineHeight: 26 },
  punktText: { flex: 1, fontFamily: SANS.regular, fontSize: 16, lineHeight: 26 },

  klein: {
    fontFamily: SANS.regular,
    fontSize: 14,
    lineHeight: 22,
    marginTop: ABSTAND.lg,
    paddingTop: ABSTAND.lg,
    borderTopWidth: 1,
  },
});
