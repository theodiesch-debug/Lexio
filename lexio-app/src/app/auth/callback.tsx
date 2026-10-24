/**
 * Landeplatz des Google-Rundlaufs.
 *
 * `openAuthSessionAsync` in `lexio-app/src/app/anmelden.tsx` wartet auf die
 * Rueckkehr-URL und tauscht den Code; der Deep Link `lexio://auth/callback`
 * kommt aber zusaetzlich beim Router an. Ohne diese Datei stuende dort
 * "Unmatched Route" – die Anmeldung waere technisch fertig, der Bildschirm
 * saehe aus wie ein Fehler.
 *
 * Die Seite zeigt deshalb nur den Wartezustand. Wer zuerst fertig ist, ist
 * gleichgueltig: entweder `anmelden.tsx` wechselt nach dem Tausch auf die
 * Uebersicht, oder dieser Bildschirm merkt nach dem Nachsehen, dass eine
 * Sitzung da ist. Der Zeitnehmer deckt den dritten Fall ab – kein Code,
 * kein Tausch, niemand wechselt – und schickt zurueck zur Anmeldung, statt
 * hier stehen zu bleiben.
 */

import { router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { SANS } from "@/design/schrift";
import { useDesign } from "@/design/theme";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const { farben } = useDesign();

  useEffect(() => {
    let aktiv = true;
    let nachsehen: ReturnType<typeof setInterval> | null = null;
    let aufgeben: ReturnType<typeof setTimeout> | null = null;

    const beenden = () => {
      if (nachsehen) clearInterval(nachsehen);
      if (aufgeben) clearTimeout(aufgeben);
      nachsehen = null;
      aufgeben = null;
    };

    /*
     * Kurz warten, dann nachsehen. Der Tausch laeuft in `anmelden.tsx` und
     * braucht einen Moment; sofort zu pruefen hiesse, regelmaessig „keine
     * Sitzung" zu lesen, obwohl sie zwei Millisekunden spaeter da ist.
     */
    nachsehen = setInterval(async () => {
      const { data } = await supabase.auth.getSession();
      if (!aktiv || !nachsehen) return;
      if (data.session) {
        beenden();
        router.replace("/");
      }
    }, 300);

    aufgeben = setTimeout(() => {
      beenden();
      if (aktiv) router.replace("/anmelden");
    }, 8000);

    return () => {
      aktiv = false;
      beenden();
    };
  }, []);

  return (
    <View style={[styles.seite, { backgroundColor: farben.background }]}>
      <ActivityIndicator color={farben.gold} />
      <Text style={[styles.text, { color: farben.textSecondary }]}>
        Anmeldung wird abgeschlossen …
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  seite: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 24,
  },
  text: { fontFamily: SANS.regular, fontSize: 15, textAlign: "center" },
});
