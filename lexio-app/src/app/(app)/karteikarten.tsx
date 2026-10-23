/**
 * Karteikarten – Web: app/(app)/karteikarten/karteikarten-seite.tsx.
 *
 * Die Set-Übersicht mit Fortschritt, Suche und den Aktionen je Set
 * (Duplizieren, Bearbeiten, Löschen). Der Endpunkt ist `/api/karteikarten`.
 *
 * Abweichung zum Web: die Tabelle wird zum Kartenstapel. Das Web macht das
 * unterhalb 700px genauso (`@media (max-width: 700px)`); auf dem Telefon wäre
 * eine Tabelle mit vier Zahlenspalten nicht bedienbar. Jede Zahl trägt ihr
 * eigenes Label, wie dort die `::before`-Pseudo-Elemente.
 *
 * XP gibt es je Sprache, nicht je Set – die Spalte zeigt daher in jeder Zeile
 * den Sprachwert, wie im Web. Ein Fehler in der Sprachabfrage bleibt still:
 * die Zahl wäre dann 0, dieselbe wie bei einem Set ohne XP.
 */

import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { nameVonSprache, type Sprache, type SpracheInfo } from "@lexio/sprachen";
import { kopieName } from "@lexio/kopie-name";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Feld } from "@/components/feld";
import { Karte } from "@/components/karte";
import { Knopf } from "@/components/knopf";
import { Sprachpunkt } from "@/components/sprachpunkt";
import { Skelett } from "@/components/zustand";
import { CAVEAT, MONO, SANS, SERIF } from "@/design/schrift";
import { useDesign } from "@/design/theme";
import { ABSTAND, MASS, RADIUS } from "@/design/tokens";
import { holeJson } from "@/lib/api";
import { listeAusCache, listeCachen } from "@/lib/offline";

type SetZeile = {
  id: string;
  name: string;
  sprache: SpracheInfo;
  kartenGesamt: number;
  kartenGelernt: number;
  kartenFaellig: number;
  /** Karten, die gerade im Minus stehen – für den Quäl-Link je Set. */
  quaelAnzahl?: number;
  fortschrittProzent: number;
  eigenesSet?: boolean;
  eigen?: boolean;
  zuletztGelernt: string | null;
};

type SprachStat = { code: string | null; xp: number };

/** "vor 3 Tagen" statt "2026-09-23" – der Abstand ist die interessantere Zahl. */
function zeitHer(text: string | null): string {
  if (!text) return "–";
  const datum = new Date(text);
  if (Number.isNaN(datum.getTime())) return "–";
  const tage = Math.floor((Date.now() - datum.getTime()) / 86_400_000);
  if (tage <= 0) return "heute";
  if (tage === 1) return "gestern";
  if (tage < 7) return `vor ${tage} Tagen`;
  if (tage < 30) return `vor ${Math.floor(tage / 7)} Wo.`;
  return datum.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export default function Karteikarten() {
  const { farben } = useDesign();

  const [sets, setSets] = useState<SetZeile[]>([]);
  const [xpJeSprache, setXpJeSprache] = useState<SprachStat[]>([]);
  const [suche, setSuche] = useState("");
  const [laden, setLaden] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [dialogZiel, setDialogZiel] = useState<SetZeile | null>(null);

  // Nach Bearbeiten/Löschen lädt die Liste denselben Weg erneut – und zwar den,
  // der `null` von `[]` unterscheidet. `laden` wird bewusst nicht zurückgesetzt:
  // die Liste ist bereits da, ein Ladeblinken verriete nur die Hintergrundarbeit.
  const [ladeNr, setLadeNr] = useState(0);
  const neuLaden = useCallback(() => setLadeNr((n) => n + 1), []);

  useEffect(() => {
    let abgebrochen = false;

    void (async () => {
      const daten = await holeJson<SetZeile[] | null>("/api/karteikarten", null).catch(
        () => null,
      );
      if (abgebrochen) return;

      if (daten !== null) {
        setSets(daten);
        setFehler(null);
        void listeCachen(daten);
      } else {
        /*
         * Ohne Netz (oder mit einem Fehler) zaehlt die letzte bekannte
         * Liste. Sie ist ehrlich als solche gekennzeichnet: wer offline
         * Sets sieht, soll wissen, dass die Zahlen von gestern sein koennen.
         */
        const zwischen = await listeAusCache<SetZeile[]>();
        if (abgebrochen) return;
        if (zwischen) {
          setSets(zwischen);
          setFehler("Offline · die Liste ist vom letzten Laden.");
        } else {
          setFehler("Karteikarten konnten nicht geladen werden.");
          setSets([]);
        }
      }
      setLaden(false);
    })();

    return () => {
      abgebrochen = true;
    };
  }, [ladeNr]);

  useEffect(() => {
    let abgebrochen = false;
    holeJson<SprachStat[] | null>("/api/sprachen-stats", null)
      .then((daten) => {
        if (!abgebrochen) setXpJeSprache(daten ?? []);
      })
      .catch(() => undefined);
    return () => {
      abgebrochen = true;
    };
  }, []);

  const xpNachSprache = useMemo(() => {
    const karte: Record<string, number> = {};
    for (const eintrag of xpJeSprache) {
      if (!eintrag.code) continue;
      karte[eintrag.code] = eintrag.xp ?? 0;
    }
    return karte;
  }, [xpJeSprache]);

  const gefiltert = useMemo(() => {
    const begriff = suche.trim().toLowerCase();
    if (!begriff) return sets;
    return sets.filter(
      (set) =>
        set.name.toLowerCase().includes(begriff) ||
        set.sprache.name.toLowerCase().includes(begriff),
    );
  }, [sets, suche]);

  return (
    <View style={[styles.rahmen, { backgroundColor: farben.background }]}>
      <ScrollView contentContainerStyle={styles.seite} keyboardShouldPersistTaps="handled">
        <View style={styles.kopf}>
          <View style={styles.kopfText}>
            <Text style={[styles.titel, { color: farben.textPrimary }]}>Karteikarten</Text>
            <Text style={[styles.untertitel, { color: farben.textMuted }]}>
              {sets.length} {sets.length === 1 ? "Set" : "Sets"} im Wortschatz
            </Text>
          </View>
          <View style={styles.kopfKnoepfe}>
            <Knopf
              titel="Wortschatz"
              variante="rand"
              form="eckig"
              hoehe={MASS.knopf}
              onPress={() => router.push("/wortschatz")}
            />
            <Knopf
              titel="Vokabeln hinzufügen"
              variante="gold"
              form="eckig"
              hoehe={MASS.knopf}
              onPress={() => router.push("/hinzufuegen")}
            />
          </View>
        </View>

        <View
          style={[
            styles.suchfeld,
            { backgroundColor: farben.bgElevated, borderColor: farben.line },
          ]}
        >
          <FontAwesome6 name="magnifying-glass" size={15} color={farben.textMuted} />
          <Feld
            value={suche}
            onChangeText={setSuche}
            placeholder="Set oder Sprache suchen"
            accessibilityLabel="Karteikarten durchsuchen"
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.suchEingabe}
          />
        </View>

        {laden ? (
          <Skelett style={styles.skelett} />
        ) : fehler ? (
          <Text style={[styles.leer, { color: farben.terracotta }]}>{fehler}</Text>
        ) : gefiltert.length === 0 ? (
          <Text style={[styles.leer, { color: farben.textMuted }]}>
            {sets.length === 0
              ? "Noch keine Sets vorhanden."
              : `Nichts gefunden für „${suche.trim()}“.`}
          </Text>
        ) : (
          gefiltert.map((set) => (
            <SetKarte
              key={set.id}
              set={set}
              xp={set.sprache.code ? (xpNachSprache[set.sprache.code] ?? 0) : 0}
              onAktionen={() => setDialogZiel(set)}
            />
          ))
        )}
      </ScrollView>

      {dialogZiel ? (
        <SetDialog
          set={dialogZiel}
          onSchliessen={() => setDialogZiel(null)}
          onGeaendert={neuLaden}
        />
      ) : null}
    </View>
  );
}

function SetKarte({
  set,
  xp,
  onAktionen,
}: {
  set: SetZeile;
  xp: number;
  onAktionen: () => void;
}) {
  const { farben } = useDesign();

  const meta = [
    nameVonSprache(set.sprache),
    set.eigen ? "eigenes Set" : null,
    set.kartenFaellig > 0 ? `${set.kartenFaellig} fällig` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Karte style={styles.setKarte}>
      <View style={styles.setKopf}>
        <Sprachpunkt sprache={set.sprache} />
        <View style={styles.setText}>
          <Pressable
            onPress={() => router.push(`/lernen/${set.id}`)}
            accessibilityRole="link"
            accessibilityLabel={`${set.name} lernen`}
            style={styles.nameKnopf}
          >
            <Text style={[styles.name, { color: farben.textPrimary }]} numberOfLines={1}>
              {set.name}
            </Text>
          </Pressable>
          <Text style={[styles.meta, { color: farben.textMuted }]} numberOfLines={1}>
            {meta}
          </Text>

          {set.kartenFaellig === 0 && set.kartenGesamt > 0 ? (
            <Pressable
              onPress={() => router.push(`/lernen/${set.id}?modus=ueben`)}
              accessibilityRole="link"
              style={styles.nebenLink}
            >
              <FontAwesome6 name="rotate-right" size={13} color={farben.textSecondary} />
              <Text style={[styles.nebenText, { color: farben.textSecondary }]}>
                Nochmal lernen
              </Text>
            </Pressable>
          ) : null}
          {(set.quaelAnzahl ?? 0) > 0 ? (
            <Pressable
              onPress={() => router.push(`/lernen/${set.id}?modus=quaelen`)}
              accessibilityRole="link"
              style={styles.nebenLink}
            >
              <FontAwesome6 name="fire" size={13} color={farben.terracotta} />
              <Text style={[styles.nebenText, { color: farben.terracotta }]}>
                Quäl-Wörter üben ({set.quaelAnzahl})
              </Text>
            </Pressable>
          ) : null}
          {set.kartenGesamt > 0 ? (
            <Pressable
              onPress={() => router.push("/wortschatz")}
              accessibilityRole="link"
              style={styles.nebenLink}
            >
              <FontAwesome6 name="list-ul" size={13} color={farben.textSecondary} />
              <Text style={[styles.nebenText, { color: farben.textSecondary }]}>
                Vokabeln ansehen
              </Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={onAktionen}
          accessibilityRole="button"
          accessibilityLabel={
            set.eigen
              ? `Set ${set.name} bearbeiten, duplizieren oder löschen`
              : `Set ${set.name} in eine eigene Kopie übernehmen`
          }
          hitSlop={8}
          style={styles.aktionenKnopf}
        >
          <Text style={[styles.aktionenPunkte, { color: farben.textSecondary }]}>⋯</Text>
        </Pressable>
      </View>

      <View style={[styles.zahlen, { borderTopColor: farben.line }]}>
        <Zahl label="Gelernt" wert={String(set.kartenGelernt)} />
        <Zahl label="Total" wert={String(set.kartenGesamt)} />
        <Zahl label="XP" wert={String(xp)} gold />
        <Zahl label="Zuletzt" wert={zeitHer(set.zuletztGelernt)} />
      </View>
    </Karte>
  );
}

function Zahl({ label, wert, gold }: { label: string; wert: string; gold?: boolean }) {
  const { farben } = useDesign();
  return (
    <View style={styles.zahlZeile}>
      <Text style={[styles.zahlLabel, { color: farben.textMuted }]}>{label}</Text>
      <Text
        style={[
          styles.zahlWert,
          { color: gold ? farben.gold : farben.textSecondary },
        ]}
      >
        {wert}
      </Text>
    </View>
  );
}

type Ansicht = "start" | "bearbeiten" | "loeschen" | "duplizieren";

function SetDialog({
  set,
  onSchliessen,
  onGeaendert,
}: {
  set: SetZeile;
  onSchliessen: () => void;
  onGeaendert: () => void;
}) {
  // Bei einem Demo-Set gibt es kein Bearbeiten/Löschen (die Route gibt 403) –
  // der Dialog startet dort direkt beim Duplizieren.
  const { farben, schatten } = useDesign();
  const eigen = set.eigen ?? false;

  const [ansicht, setAnsicht] = useState<Ansicht>(eigen ? "start" : "duplizieren");
  const [nameEntwurf, setNameEntwurf] = useState(set.name);
  const [codeEntwurf, setCodeEntwurf] = useState<string | null>(set.sprache.code);
  const [sprachListe, setSprachListe] = useState<Sprache[]>([]);
  const [sprachFehler, setSprachFehler] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [arbeitet, setArbeitet] = useState(false);

  const brauchtSprachListe = eigen && ansicht === "bearbeiten";

  useEffect(() => {
    if (!brauchtSprachListe) return;
    let abgebrochen = false;
    holeJson<Sprache[]>("/api/sprachen")
      .then((liste) => {
        if (!abgebrochen) setSprachListe(liste);
      })
      .catch(() => {
        if (!abgebrochen) setSprachFehler("Die Sprachliste konnte nicht geladen werden.");
      });
    return () => {
      abgebrochen = true;
    };
  }, [brauchtSprachListe]);

  async function speichern() {
    const neuerName = nameEntwurf.trim();
    if (!neuerName) {
      setFehler("Der Name darf nicht leer sein.");
      return;
    }
    if (!codeEntwurf) {
      setFehler("Bitte eine Sprache wählen.");
      return;
    }
    setArbeitet(true);
    setFehler(null);
    try {
      await holeJson(`/api/sets/${set.id}`, undefined, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Nur schicken, was sich geändert hat.
        body: JSON.stringify({
          ...(neuerName !== set.name ? { name: neuerName } : {}),
          ...(codeEntwurf !== set.sprache.code ? { spracheCode: codeEntwurf } : {}),
        }),
      });
      onSchliessen();
      onGeaendert();
    } catch (f) {
      setFehler(f instanceof Error ? f.message : "Das Set konnte nicht gespeichert werden.");
    } finally {
      setArbeitet(false);
    }
  }

  async function loeschen() {
    setArbeitet(true);
    setFehler(null);
    try {
      await holeJson(`/api/sets/${set.id}`, undefined, { method: "DELETE" });
      onSchliessen();
      onGeaendert();
    } catch (f) {
      setFehler(f instanceof Error ? f.message : "Das Set konnte nicht gelöscht werden.");
    } finally {
      setArbeitet(false);
    }
  }

  async function duplizieren() {
    setArbeitet(true);
    setFehler(null);
    try {
      await holeJson(`/api/sets/${set.id}/duplizieren`, undefined, { method: "POST" });
      onSchliessen();
      onGeaendert();
    } catch (f) {
      setFehler(f instanceof Error ? f.message : "Die Kopie konnte nicht erstellt werden.");
    } finally {
      setArbeitet(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onSchliessen}>
      <Pressable
        style={styles.schleier}
        onPress={arbeitet ? undefined : onSchliessen}
      >
        <Pressable
          onPress={() => undefined}
          style={[
            styles.dialog,
            {
              backgroundColor: farben.bgElevated,
              borderColor: farben.line,
              borderWidth: 1,
            },
            schatten.karte,
          ]}
        >
          <Text style={[styles.dialogTitel, { color: farben.textPrimary }]} numberOfLines={1}>
            {set.name}
          </Text>

          {ansicht === "start" ? (
            <View style={styles.aktionen}>
              <Knopf titel="Bearbeiten" onPress={() => setAnsicht("bearbeiten")} />
              <Knopf
                titel="Duplizieren"
                variante="rand"
                disabled={arbeitet}
                onPress={() => setAnsicht("duplizieren")}
              />
              <Knopf
                titel="Löschen"
                variante="rand-terrakotta"
                disabled={arbeitet}
                onPress={() => setAnsicht("loeschen")}
              />
              <Knopf titel="Abbrechen" variante="rand" onPress={onSchliessen} />
            </View>
          ) : null}

          {ansicht === "bearbeiten" ? (
            <View style={styles.formular}>
              <Text style={[styles.beschriftung, { color: farben.textSecondary }]}>Name</Text>
              <Feld
                value={nameEntwurf}
                onChangeText={setNameEntwurf}
                maxLength={60}
                editable={!arbeitet}
              />

              <Text style={[styles.beschriftung, { color: farben.textSecondary }]}>Sprache</Text>
              {sprachFehler ? (
                <Text style={[styles.fehler, { color: farben.terracotta }]}>{sprachFehler}</Text>
              ) : (
                <View style={styles.sprachChips}>
                  {sprachListe.map((sprache) => {
                    const aktiv = sprache.code === codeEntwurf;
                    return (
                      <Pressable
                        key={sprache.code}
                        onPress={() => setCodeEntwurf(sprache.code)}
                        disabled={arbeitet}
                        accessibilityRole="button"
                        accessibilityState={{ selected: aktiv }}
                        style={[
                          styles.sprachChip,
                          {
                            borderColor: aktiv ? farben.gold : farben.line,
                            backgroundColor: aktiv ? farben.bgElevated2 : "transparent",
                          },
                        ]}
                      >
                        <Sprachpunkt sprache={sprache} groesse={9} />
                        <Text
                          style={[
                            styles.sprachChipText,
                            { color: aktiv ? farben.textPrimary : farben.textSecondary },
                          ]}
                        >
                          {sprache.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {fehler ? <Text style={[styles.fehler, { color: farben.terracotta }]}>{fehler}</Text> : null}

              <View style={styles.knopfZeile}>
                <Knopf
                  titel="Abbrechen"
                  variante="rand"
                  style={styles.knopfBreit}
                  disabled={arbeitet}
                  onPress={onSchliessen}
                />
                <Knopf
                  titel={arbeitet ? "Speichert…" : "Speichern"}
                  style={styles.knopfBreit}
                  disabled={arbeitet}
                  onPress={() => void speichern()}
                />
              </View>
            </View>
          ) : null}

          {ansicht === "duplizieren" ? (
            <View style={styles.formular}>
              <Text style={[styles.warnung, { color: farben.textSecondary }]}>
                {set.kartenGesamt === 0
                  ? `Es entsteht ein leeres eigenes Set mit dem Namen „${kopieName(set.name)}“.`
                  : `Es entsteht eine eigene Kopie mit allen ${set.kartenGesamt} ${
                      set.kartenGesamt === 1 ? "Karte" : "Karten"
                    }. Sie bekommt den Namen „${kopieName(set.name)}“ und ist danach deine.`}
              </Text>
              <Text style={[styles.hinweis, { color: farben.textMuted }]}>
                {eigen
                  ? "Der Lernstand wird nicht mitkopiert. Die Kopie startet bei Stufe 0."
                  : "So kannst du das vorgefertigte Set an deine Wörter und deinen Unterricht anpassen."}
              </Text>

              {fehler ? <Text style={[styles.fehler, { color: farben.terracotta }]}>{fehler}</Text> : null}

              <View style={styles.knopfZeile}>
                <Knopf
                  titel="Abbrechen"
                  variante="rand"
                  style={styles.knopfBreit}
                  disabled={arbeitet}
                  onPress={onSchliessen}
                />
                {eigen ? (
                  <Knopf
                    titel="Zurück"
                    variante="rand"
                    style={styles.knopfBreit}
                    disabled={arbeitet}
                    onPress={() => setAnsicht("start")}
                  />
                ) : null}
                <Knopf
                  titel={arbeitet ? "Kopiert…" : "Kopie erstellen"}
                  style={styles.knopfBreit}
                  disabled={arbeitet}
                  onPress={() => void duplizieren()}
                />
              </View>
            </View>
          ) : null}

          {ansicht === "loeschen" ? (
            <View style={styles.formular}>
              <Text style={[styles.warnung, { color: farben.textSecondary }]}>
                {set.kartenGesamt === 0
                  ? `„${set.name}“ wird gelöscht.`
                  : `„${set.name}“ wird mit ${set.kartenGesamt} ${
                      set.kartenGesamt === 1 ? "Karte" : "Karten"
                    } gelöscht.`}{" "}
                Das lässt sich nicht rückgängig machen.
              </Text>

              {fehler ? <Text style={[styles.fehler, { color: farben.terracotta }]}>{fehler}</Text> : null}

              <View style={styles.knopfZeile}>
                <Knopf
                  titel="Abbrechen"
                  variante="rand"
                  style={styles.knopfBreit}
                  disabled={arbeitet}
                  onPress={onSchliessen}
                />
                <Knopf
                  titel={arbeitet ? "Löscht…" : "Endgültig löschen"}
                  variante="terrakotta"
                  style={styles.knopfBreit}
                  disabled={arbeitet}
                  onPress={() => void loeschen()}
                />
              </View>
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  rahmen: { flex: 1 },
  seite: {
    paddingHorizontal: ABSTAND.lg,
    paddingTop: ABSTAND.md,
    paddingBottom: ABSTAND.xxl,
    gap: ABSTAND.md,
  },
  kopf: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: ABSTAND.md,
    flexWrap: "wrap",
  },
  kopfText: { flexShrink: 1 },
  kopfKnoepfe: { flexDirection: "row", gap: ABSTAND.md, flexWrap: "wrap" },
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
  suchEingabe: { flex: 1, minHeight: MASS.touch, fontSize: 15 },

  setKarte: { padding: ABSTAND.lg, gap: ABSTAND.md },
  setKopf: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  setText: { flex: 1, minWidth: 0 },
  nameKnopf: { minHeight: 30, justifyContent: "center" },
  name: { fontFamily: SANS.semibold, fontSize: 16 },
  meta: { fontFamily: SANS.regular, fontSize: 13, marginTop: 1 },
  nebenLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: MASS.touch,
  },
  nebenText: { fontFamily: SANS.semibold, fontSize: 14 },
  aktionenKnopf: { paddingHorizontal: 6, paddingVertical: 2 },
  aktionenPunkte: { fontSize: 24, fontFamily: SANS.bold, lineHeight: 26 },

  zahlen: {
    borderTopWidth: 1,
    paddingTop: ABSTAND.sm,
    gap: 6,
  },
  zahlZeile: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: ABSTAND.lg,
  },
  zahlLabel: {
    fontFamily: MONO.bold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  zahlWert: { fontFamily: MONO.regular, fontSize: 14 },

  leer: {
    fontFamily: SANS.regular,
    fontSize: 15,
    textAlign: "center",
    paddingVertical: ABSTAND.xxl,
  },
  skelett: { height: 220 },

  schleier: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: ABSTAND.xl,
    backgroundColor: "rgba(5,10,14,0.6)",
  },
  dialog: {
    width: "100%",
    maxWidth: 440,
    borderRadius: RADIUS.dialog,
    padding: ABSTAND.xl,
    gap: ABSTAND.lg,
  },
  dialogTitel: { fontFamily: CAVEAT.bold, fontSize: 28 },
  aktionen: { gap: ABSTAND.md },
  formular: { gap: ABSTAND.sm },
  beschriftung: {
    fontFamily: SANS.semibold,
    fontSize: 14,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: ABSTAND.sm,
  },
  sprachChips: { flexDirection: "row", flexWrap: "wrap", gap: ABSTAND.sm },
  sprachChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: RADIUS.pille,
  },
  sprachChipText: { fontFamily: SANS.medium, fontSize: 13 },
  warnung: { fontFamily: SANS.regular, fontSize: 14, lineHeight: 20 },
  hinweis: { fontFamily: SANS.regular, fontSize: 13, lineHeight: 18 },
  fehler: { fontFamily: SANS.medium, fontSize: 14 },
  knopfZeile: { flexDirection: "row", gap: ABSTAND.md, marginTop: ABSTAND.sm },
  knopfBreit: { flex: 1 },
});
