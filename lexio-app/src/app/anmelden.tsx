/**
 * Anmelden und Registrieren – Web: app/anmelden/anmelden-seite.tsx.
 *
 * Dieselbe Seite in einer Datei: links die Markenfläche (auf dem Telefon nur
 * die Kopfzeile mit Logo und Caveat-Namen, wie im Web unter 900px), rechts das
 * Formular mit Reiterleiste, Feldern und Gold-Knopf. Nach einer Registrierung
 * ohne sofortige Sitzung folgt die „Fast geschafft"-Karte.
 *
 * Abweichungen zum Web, bewusst:
 *   - Keine OAuth-Anbieterknöpfe. Die brauchen in Expo einen eigenen
 *     AuthSession- und Deep-Link-Aufbau; die Anmeldung mit E-Mail und Passwort
 *     funktioniert ohne ihn vollständig.
 *   - Kein „Passwort vergessen?": der Web-Link führt auf eine eigene Seite, die
 *     es hier nicht gibt. Ein toter Verweis wäre schlimmer als keiner.
 *   - Kein SetupHinweis: das ist eine Web-Komponente (Mail-/Dashboard-Sonde am
 *     Browser). Die App prüft die Datenbank ohnehin über die API.
 */

import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { MIN_PASSWORT, PASSWORT_FEHLER } from "@lexio/passwort";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { Feld } from "@/components/feld";
import { Knopf } from "@/components/knopf";
import { CAVEAT, SANS, SERIF } from "@/design/schrift";
import { useDesign } from "@/design/theme";
import { ABSTAND, RADIUS } from "@/design/tokens";
import { supabase } from "@/lib/supabase";

const LOGO = require("../../assets/images/lexio-logo.png");

/** Der Web-Bruchpunkt fuer die zweispaltige Ansicht: `@media (max-width: 900px)`. */
const BREIT_AB = 900;

const MARKEN_VERLAUF = ["#3a2325", "#1a1418", "#131a1f"] as const;

type Modus = "anmelden" | "registrieren";

/**
 * Fehlermeldungen von Supabase auf Deutsch – wortgleich mit dem Web. Der Text
 * sagt absichtlich nicht, ob ein Konto existiert.
 */
function uebersetzeFehler(text: string, beimAnmelden: boolean): string {
  if (!beimAnmelden && /invalid login credentials/i.test(text)) {
    return "Die Registrierung ist fehlgeschlagen. Bitte versuche es erneut.";
  }
  if (/invalid login credentials/i.test(text)) return "E-Mail oder Passwort stimmt nicht.";
  if (/email not confirmed/i.test(text)) {
    return "Bitte bestätige zuerst die E-Mail, die wir dir geschickt haben.";
  }
  if (/user already registered/i.test(text)) {
    return "Zu dieser E-Mail gibt es schon ein Konto. Melde dich stattdessen an.";
  }
  if (/password should be at least/i.test(text)) return PASSWORT_FEHLER;
  if (/rate limit|too many/i.test(text)) {
    return "Zu viele Versuche. Warte einen Moment und probiere es erneut.";
  }
  if (/email address .* invalid|unable to validate email/i.test(text)) {
    return "Diese E-Mail-Adresse sieht nicht gültig aus.";
  }
  return text;
}

export default function Anmelden() {
  const { farben, schatten } = useDesign();
  const { width } = useWindowDimensions();
  const breit = width >= BREIT_AB;

  const [modus, setModus] = useState<Modus>("anmelden");
  const [vorname, setVorname] = useState("");
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [zeigePasswort, setZeigePasswort] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [gesendet, setGesendet] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, []);

  const wechseln = (neu: Modus) => {
    setModus(neu);
    setFehler(null);
    setPasswort("");
  };

  async function absenden() {
    const mail = email.trim();
    if (!mail || !passwort) {
      setFehler("E-Mail und Passwort eintragen.");
      return;
    }
    if (modus === "registrieren" && passwort.length < MIN_PASSWORT) {
      setFehler(PASSWORT_FEHLER);
      return;
    }
    setBusy(true);
    setFehler(null);

    const { error } =
      modus === "registrieren"
        ? await supabase.auth.signUp({
            email: mail,
            password: passwort,
            options: {
              // Landet im raw_user_meta_data und wird vom Trigger in public.profil
              // übernommen. Ohne das hiesse jeder neue Nutzer erstmal "Nutzer".
              data: { full_name: vorname.trim() },
            },
          })
        : await supabase.auth.signInWithPassword({ email: mail, password: passwort });

    setBusy(false);
    if (error) {
      setFehler(uebersetzeFehler(error.message, modus === "anmelden"));
      return;
    }

    // Registrierung ohne sofortige Sitzung: die Mail-Bestätigung steht aus.
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setGesendet(true);
      return;
    }
    router.replace("/");
  }

  return (
    <KeyboardAvoidingView
      style={[styles.seite, { backgroundColor: farben.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.gitter,
            {
              backgroundColor: farben.bgElevated,
              borderColor: farben.line,
              maxWidth: breit ? 992 : 480,
              flexDirection: breit ? "row" : "column",
            },
            schatten.karte,
          ]}
        >
          {/* ------------------------------------------------------ Marke */}
          <LinearGradient
            colors={MARKEN_VERLAUF}
            start={{ x: 0.08, y: 0 }}
            end={{ x: 0.92, y: 1 }}
            style={[
              styles.marke,
              breit ? styles.markeBreit : styles.markeSchmal,
            ]}
          >
            <View style={styles.markeKopf}>
              <Image
                source={LOGO}
                style={[styles.logo, { width: breit ? 52 : 30, height: breit ? 52 : 30 }]}
              />
              <Text style={[styles.markeName, { fontSize: breit ? 34 : 26 }]}>Lexio</Text>
            </View>

            {breit ? (
              <>
                <View style={styles.markeText}>
                  <Text style={styles.markeUeberschrift}>
                    Vokabeln, die{"\n"}hängen bleiben.
                  </Text>
                  <Text style={styles.markeZeile}>
                    Verteiltes Lernen nach der Karteikarten-Methode. Jedes Set hat seinen eigenen
                    Rhythmus – angepasst an das, was du wirklich kannst.
                  </Text>
                </View>
                <View style={styles.markeListe}>
                  <Markenpunkt ikone="layer-group" text="Sets statt Kapitel. Was du brauchst, kommt zuerst." />
                  <Markenpunkt ikone="bolt" text="XP für jede richtige Antwort, Streak für jeden Tag." />
                  <Markenpunkt ikone="chart-simple" text="Statistiken, die zeigen, wo es hakt." />
                </View>
              </>
            ) : null}
          </LinearGradient>

          {/* --------------------------------------------------- Formular */}
          <View style={styles.formular}>
            {gesendet ? (
              <FastGeschafft email={email.trim().toLowerCase()} aufZurueck={() => setGesendet(false)} />
            ) : (
              <>
                <View
                  style={[
                    styles.reiterLeiste,
                    { backgroundColor: farben.background, borderColor: farben.line },
                  ]}
                >
                  <Reiter
                    titel="Anmelden"
                    aktiv={modus === "anmelden"}
                    onPress={() => wechseln("anmelden")}
                  />
                  <Reiter
                    titel="Konto erstellen"
                    aktiv={modus === "registrieren"}
                    onPress={() => wechseln("registrieren")}
                  />
                </View>

                <Text style={[styles.titel, { color: farben.textPrimary }]}>
                  {modus === "anmelden" ? "Willkommen zurück" : "Lern mit Lexio"}
                </Text>
                <Text style={[styles.untertitel, { color: farben.textSecondary }]}>
                  {modus === "anmelden"
                    ? "Melde dich an, um weiterzulernen."
                    : "Dauert eine Minute. Dein Fortschritt gehört dir."}
                </Text>

                {fehler ? (
                  <View style={[styles.fehler, { backgroundColor: "rgba(184, 66, 84, 0.14)", borderColor: "rgba(184, 66, 84, 0.4)" }]}>
                    <FontAwesome6 name="circle-exclamation" size={14} color={farben.terracotta} />
                    <Text style={[styles.fehlerText, { color: farben.terracotta }]}>{fehler}</Text>
                  </View>
                ) : null}

                <View style={styles.form}>
                  {modus === "registrieren" ? (
                    <View style={styles.feld}>
                      <Text style={[styles.label, { color: farben.textSecondary }]}>Name</Text>
                      <Feld
                        value={vorname}
                        onChangeText={setVorname}
                        placeholder="Wie sollen wir dich nennen?"
                        autoCapitalize="words"
                        autoComplete="name"
                        textContentType="name"
                      />
                    </View>
                  ) : null}

                  <View style={styles.feld}>
                    <Text style={[styles.label, { color: farben.textSecondary }]}>E-Mail</Text>
                    <Feld
                      value={email}
                      onChangeText={setEmail}
                      placeholder="du@beispiel.de"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      autoComplete="email"
                      textContentType="emailAddress"
                    />
                  </View>

                  <View style={styles.feld}>
                    <Text style={[styles.label, { color: farben.textSecondary }]}>Passwort</Text>
                    <View style={styles.passwortZeile}>
                      <Feld
                        value={passwort}
                        onChangeText={setPasswort}
                        placeholder={modus === "registrieren" ? `Mindestens ${MIN_PASSWORT} Zeichen` : ""}
                        secureTextEntry={!zeigePasswort}
                        autoCapitalize="none"
                        autoComplete={modus === "registrieren" ? "new-password" : "current-password"}
                        textContentType={modus === "registrieren" ? "newPassword" : "password"}
                        style={styles.passwortFeld}
                        onSubmitEditing={() => void absenden()}
                      />
                      <Pressable
                        onPress={() => setZeigePasswort((z) => !z)}
                        accessibilityRole="button"
                        accessibilityLabel={zeigePasswort ? "Passwort verbergen" : "Passwort anzeigen"}
                        hitSlop={8}
                        style={styles.auge}
                      >
                        <FontAwesome6
                          name={zeigePasswort ? "eye-slash" : "eye"}
                          size={16}
                          color={farben.textSecondary}
                        />
                      </Pressable>
                    </View>
                  </View>

                  <Knopf
                    variante="gold"
                    form="eckig"
                    hoehe={50}
                    disabled={busy}
                    onPress={() => void absenden()}
                    accessibilityLabel={modus === "anmelden" ? "Anmelden" : "Konto erstellen"}
                    style={styles.absenden}
                  >
                    {busy ? (
                      <ActivityIndicator color="#17110a" />
                    ) : (
                      <>
                        <FontAwesome6
                          name={modus === "anmelden" ? "arrow-right-to-bracket" : "user-plus"}
                          size={15}
                          color="#17110a"
                        />
                        <Text style={styles.absendenText}>
                          {modus === "anmelden" ? "Anmelden" : "Konto erstellen"}
                        </Text>
                      </>
                    )}
                  </Knopf>
                </View>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Reiter({
  titel,
  aktiv,
  onPress,
}: {
  titel: string;
  aktiv: boolean;
  onPress: () => void;
}) {
  const { farben, schatten } = useDesign();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: aktiv }}
      style={[
        styles.reiter,
        aktiv ? [{ backgroundColor: farben.bgElevated2 }, schatten.weich] : null,
      ]}
    >
      <Text
        style={[
          styles.reiterText,
          { color: aktiv ? farben.textPrimary : farben.textSecondary },
        ]}
      >
        {titel}
      </Text>
    </Pressable>
  );
}

function Markenpunkt({
  ikone,
  text,
}: {
  ikone: keyof typeof FontAwesome6.glyphMap;
  text: string;
}) {
  return (
    <View style={styles.markenPunkt}>
      <FontAwesome6 name={ikone} size={14} color="#e7b14a" />
      <Text style={styles.markenPunktText}>{text}</Text>
    </View>
  );
}

/** Die „Fast geschafft"-Karte nach einer Registrierung mit Mail-Bestätigung. */
function FastGeschafft({ email, aufZurueck }: { email: string; aufZurueck: () => void }) {
  const { farben, schatten } = useDesign();
  return (
    <View style={styles.fastFertig}>
      <FontAwesome6 name="envelope" size={30} color={farben.gold} />
      <Text style={[styles.fastTitel, { color: farben.textPrimary }]}>Fast geschafft</Text>
      <Text style={[styles.fastText, { color: farben.textSecondary }]}>
        Wir haben eine E-Mail an <Text style={styles.fett}>{email}</Text> geschickt. Klick auf den
        Link darin, dann bist du angemeldet. Der Link ist eine Stunde gültig.
      </Text>
      <Text style={[styles.fussnote, { color: farben.textMuted }]}>
        Nichts angekommen? Sieh im Spam-Ordner nach – bei Gmail landet Supabase gelegentlich dort.
      </Text>
      <Knopf
        titel="Zurück zur Anmeldung"
        variante="rand"
        form="eckig"
        onPress={aufZurueck}
        style={[styles.zurueck, schatten.weich]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  seite: { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: ABSTAND.xl,
  },
  gitter: {
    width: "100%",
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
  },

  marke: { padding: ABSTAND.xl, gap: ABSTAND.xl },
  markeBreit: { flex: 1, justifyContent: "space-between" },
  markeSchmal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: ABSTAND.lg,
  },
  markeKopf: { flexDirection: "row", alignItems: "center", gap: ABSTAND.md },
  logo: { resizeMode: "contain" },
  markeName: { fontFamily: CAVEAT.bold, color: "#f0e8d5" },
  markeText: { gap: ABSTAND.md },
  markeUeberschrift: {
    fontFamily: SERIF.bold,
    fontSize: 30,
    lineHeight: 34,
    color: "#f7f1e4",
  },
  markeZeile: {
    fontFamily: SANS.regular,
    fontSize: 15,
    lineHeight: 24,
    color: "#d7cbb2",
    maxWidth: 360,
  },
  markeListe: { gap: ABSTAND.md },
  markenPunkt: { flexDirection: "row", alignItems: "center", gap: ABSTAND.sm },
  markenPunktText: { fontFamily: SANS.regular, fontSize: 14, color: "#d7cbb2", flexShrink: 1 },

  formular: { padding: ABSTAND.xl, gap: ABSTAND.sm },

  reiterLeiste: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    marginBottom: ABSTAND.lg,
    borderRadius: RADIUS.feld,
    borderWidth: 1,
  },
  reiter: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 9,
  },
  reiterText: { fontFamily: SANS.semibold, fontSize: 14 },

  titel: { fontFamily: SERIF.bold, fontSize: 24, lineHeight: 29 },
  untertitel: {
    fontFamily: SANS.regular,
    fontSize: 14,
    marginTop: 4,
    marginBottom: ABSTAND.lg,
  },

  fehler: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: ABSTAND.sm,
    marginBottom: ABSTAND.md,
    padding: 12,
    borderRadius: RADIUS.feld,
    borderWidth: 1,
  },
  fehlerText: { fontFamily: SANS.regular, fontSize: 13, lineHeight: 19, flexShrink: 1 },

  form: { gap: ABSTAND.lg },
  feld: { gap: 6 },
  label: {
    fontFamily: SANS.semibold,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  passwortZeile: { position: "relative", justifyContent: "center" },
  passwortFeld: { paddingRight: 48 },
  auge: {
    position: "absolute",
    right: 4,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  absenden: { marginTop: 4 },
  absendenText: { fontFamily: SANS.bold, fontSize: 16, color: "#17110a" },

  fastFertig: { alignItems: "center", gap: ABSTAND.md, paddingVertical: ABSTAND.lg },
  fastTitel: { fontFamily: SERIF.bold, fontSize: 28 },
  fastText: {
    fontFamily: SANS.regular,
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
    maxWidth: 400,
  },
  fett: { fontFamily: SANS.semibold },
  fussnote: { fontFamily: SANS.regular, fontSize: 13, textAlign: "center", maxWidth: 400 },
  zurueck: { alignSelf: "stretch", marginTop: ABSTAND.md },
});
