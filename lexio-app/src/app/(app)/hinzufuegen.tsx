/**
 * Vokabeln hinzufügen – Web:
 * app/(app)/karteikarten-hinzufuegen/vokabeln-hinzufuegen/vokabeln-hinzufuegen-seite.tsx.
 *
 * Derselbe Drei-Schritt-Wizard (Set wählen, Wörter eingeben, Name vergeben),
 * aber für die App von Hand gebaut: statt `<details>`, `<select>` und
 * Datei-Import gibt es Pillen, eine aufklappbare Demo-Liste und einen
 * Textblock-Parser. Gespeichert wird gegen dieselben Routen wie im Web
 * (/api/sprachen, /api/karteikarten, /api/sets, /api/karten, /api/beispielsatz).
 *
 * Der Namensschritt kommt ans Ende: wer zehn Wörter getippt hat, hat die
 * Arbeit getan; ein geänderter Name legt ein neues Set an, ein unveränderter
 * füllt das gewählte Set weiter. Leere Beispielsätze gehen als null raus.
 */

import { FontAwesome6 } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
    ActivityIndicator,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    type TextStyle,
    type ViewStyle,
} from "react-native";

import { Feld } from "@/components/feld";
import { Karte } from "@/components/karte";
import { Knopf } from "@/components/knopf";
import { Skelett } from "@/components/zustand";
import { SANS, SERIF } from "@/design/schrift";
import { useDesign } from "@/design/theme";
import { ABSTAND, KARTEN_TINTE, RADIUS } from "@/design/tokens";
import { ApiFehler, holeJson, sendeJson } from "@/lib/api";
import {
    listeAusCache,
    listeCachen,
    neueKartenMerken,
    neueKartenUebertragen,
    sprachenAusCache,
    sprachenCachen,
    type NeuesPaar,
} from "@/lib/offline";
import { kopieName, MAX_SET_NAME } from "@lexio/kopie-name";
import { farbeVonSprache, type Sprache, type SpracheInfo } from "@lexio/sprachen";
import { textblockZuPaaren } from "@lexio/textblock-import";
import { bereinigeOcrPaare, pruefePaare, type OcrBefund } from "@lexio/vokabel-ocr";

type Status = "idle" | "speichert" | "fehler";

/** Ein Set, so wie GET /api/karteikarten es liefert (die Felder, die wir brauchen). */
type SetZeile = {
    id: string;
    name: string;
    sprache: SpracheInfo;
    kartenGesamt: number;
    eigen: boolean;
};

/** Ein Wortpaar im Formular. `beispiel*` heissen in der API anders (snake_case). */
type Paar = { frage: string; antwort: string; beispiel: string; beispielUebersetzung: string };

/** Fehlerschluessel: Feldname -> Meldung, wie /api/karten sie liefert. */
type Fehler = Record<string, string>;

const LEER: Paar = { frage: "", antwort: "", beispiel: "", beispielUebersetzung: "" };

/** Kennung für „neues Set" in der Auswahl. Kein Slug, also keine Kollision. */
const NEUES_SET = "__neu__";

const MAX_NAME = MAX_SET_NAME;

const SCHRITT_TITEL = {
    1: "Wort hinzufügen",
    2: "Wörter eingeben",
    3: "Name vergeben",
} as const;

type Schritt = 1 | 2 | 3;

/*
 * `Feld` verengt `style` auf `StyleProp<ViewStyle>`, während TextInputProps
 * `StyleProp<TextStyle>` verlangt – die Schnittmenge nimmt nur einen Typ an,
 * der beide Seiten erfüllt. `textAlignVertical` steht dabei im TextStyle.
 */
const TEXTBLOCK_STIL: ViewStyle & TextStyle = {
    minHeight: 120,
    paddingTop: 12,
    textAlignVertical: "top",
};

export default function Hinzufuegen() {
    const { farben } = useDesign();

    const [sets, setSets] = useState<SetZeile[]>([]);
    const [setsGeladen, setSetsGeladen] = useState(false);
    /** Die feste Sprachliste. Ohne sie lässt sich kein neues Set anlegen. */
    const [sprachListe, setSprachListe] = useState<Sprache[]>([]);
    const [sprachFehler, setSprachFehler] = useState<string | null>(null);

    const [schritt, setSchritt] = useState<Schritt>(1);
    /** null = nichts gewählt, NEUES_SET = neues Set, sonst der Slug. */
    const [auswahl, setAuswahl] = useState<string | null>(null);
    const [paare, setPaare] = useState<Paar[]>([{ ...LEER }]);
    const [eingabeArt, setEingabeArt] = useState<"zeilen" | "textblock" | "foto">("zeilen");
    const [textblock, setTextblock] = useState("");
    /** Grüne Rückmeldung nach dem Übernehmen eines Textblocks. */
    const [textblockMeldung, setTextblockMeldung] = useState<string | null>(null);
    const [setName, setSetName] = useState("");
    /** Sprache als Code aus public.sprachen. null = noch keine gewählt. */
    const [spracheCode, setSpracheCode] = useState<string | null>(null);
    const [demosOffen, setDemosOffen] = useState(false);

    const [bildUri, setBildUri] = useState<string | null>(null);
    const [ocrLaedt, setOcrLaedt] = useState(false);
    const [ocrFehler, setOcrFehler] = useState<string | null>(null);
    /** Nach einem Import werden verdächtige Zeilen markiert. */
    const [pruefungAktiv, setPruefungAktiv] = useState(false);

    const [status, setStatus] = useState<Status>("idle");
    const [fehler, setFehler] = useState<Fehler>({});
    const [zaehler, setZaehler] = useState(0);
    // `slug: null` heisst: offline angelegt, der Server kennt das Set noch
    // nicht. "Jetzt lernen" gibt es dann nicht – es gibt noch nichts zu lernen.
    const [fertig, setFertig] = useState<{
        name: string;
        slug: string | null;
        anzahl: number;
        offline?: boolean;
    } | null>(null);

    /** Laufender Beispielsatz-Füllvorgang bzw. dessen Zusammenfassung. */
    const [beispielStatus, setBeispielStatus] = useState<{
        ziele: number;
        fertig: number;
        sätze: number;
    } | null>(null);
    const [beispielMeldung, setBeispielMeldung] = useState<string | null>(null);

    // Spiegel der Paare für die Auto-Ergänzung: die Anfragen laufen asynchron,
    // und ohne den Ref arbeiteten sie auf einem veralteten Stand.
    const paareRef = useRef(paare);
    useEffect(() => {
        paareRef.current = paare;
    }, [paare]);

    /*
     * Sprachliste und Sets kommen getrennt: die Sprachen sind ein fester
     * Katalog und werden auch dann gebraucht, wenn es noch kein eigenes Set
     * gibt – das ist genau der Fall, in dem jemand sein erstes Set anlegt.
     */
    useEffect(() => {
        let abgebrochen = false;
        holeJson<Sprache[] | null>("/api/sprachen", null)
            .then(async (daten) => {
                if (abgebrochen) return;
                if (daten !== null) {
                    setSprachListe(daten);
                    void sprachenCachen(daten);
                    return;
                }
                // Ohne Netz: der Katalog ist fast unveraendert – ohne ihn
                // koennte man offline gar kein neues Set anlegen.
                const zwischen = await sprachenAusCache<Sprache[]>();
                if (!abgebrochen) setSprachListe(zwischen ?? []);
            })
            .catch(async (f: unknown) => {
                const zwischen = await sprachenAusCache<Sprache[]>();
                if (abgebrochen) return;
                if (zwischen) {
                    setSprachListe(zwischen);
                    return;
                }
                setSprachFehler(
                    f instanceof ApiFehler
                        ? f.message
                        : "Die Sprachliste konnte nicht geladen werden.",
                );
            });
        return () => {
            abgebrochen = true;
        };
    }, []);

    useEffect(() => {
        let abgebrochen = false;

        /*
         * Was offline angelegt wurde, jetzt nachschieben – vor dem Laden der
         * Liste, damit ein gerade angelegtes Set gleich darin auftaucht.
         */
        void neueKartenUebertragen().catch(() => 0);

        holeJson<SetZeile[] | null>("/api/karteikarten", null)
            .then(async (daten) => {
                if (abgebrochen) return;
                if (daten !== null) {
                    setSets(daten);
                    void listeCachen(daten);
                    return;
                }
                // Ohne Netz: die letzte bekannte Liste, damit ein bestehendes
                // Set auch offline waehlbar bleibt.
                const zwischen = await listeAusCache<SetZeile[]>();
                if (!abgebrochen) setSets(zwischen ?? []);
            })
            .catch(async () => {
                const zwischen = await listeAusCache<SetZeile[]>();
                if (!abgebrochen) setSets(zwischen ?? []);
            })
            .finally(() => {
                if (!abgebrochen) setSetsGeladen(true);
            });
        return () => {
            abgebrochen = true;
        };
    }, []);

    // Getrennt nach „darf ich" und „darf ich nicht": Demosets sind nicht
    // beschreibbar, ein Speichern dort endete im 403 des Servers.
    const eigeneSets = useMemo(() => sets.filter((s) => s.eigen), [sets]);
    const demoSets = useMemo(() => sets.filter((s) => !s.eigen), [sets]);

    const gewaehltesSet = useMemo(
        () => eigeneSets.find((s) => s.id === auswahl) ?? null,
        [eigeneSets, auswahl],
    );

    const gefuelltePaare = useMemo(
        () => paare.filter((p) => p.frage.trim() !== "" || p.antwort.trim() !== ""),
        [paare],
    );

    /** Index der ersten unvollständigen Zeile, für die Fehlermeldung. */
    const unvollstaendigIndex = useMemo(
        () => gefuelltePaare.findIndex((p) => !p.frage.trim() || !p.antwort.trim()),
        [gefuelltePaare],
    );

    /*
     * Verdächtige Zeilen bei jedem Rendern neu bestimmen, nicht beim Import
     * einfrieren: korrigiert der Nutzer ein Paar, verschwindet die Markierung
     * sofort.
     */
    const befunde = useMemo(
        () => (pruefungAktiv ? pruefePaare(paare, { sprache: spracheCode }) : []),
        [paare, spracheCode, pruefungAktiv],
    );
    const befundNachIndex = useMemo(
        () => new Map<number, OcrBefund>(befunde.map((b) => [b.index, b])),
        [befunde],
    );

    const legtNeuesSetAn = !gewaehltesSet || setName.trim() !== gewaehltesSet.name.trim();

    /** Übersetzt den Formularnamen in den Spaltennamen der API. */
    function serverSchluessel(feld: keyof Paar): string {
        if (feld === "beispiel") return "beispielsatz";
        if (feld === "beispielUebersetzung") return "beispiel_uebersetzung";
        return feld;
    }

    /** Fehler eines Feldes – lokal (camelCase) oder vom Server (snake_case). */
    function feldFehler(index: number, feld: keyof Paar): string | undefined {
        const schluessel = serverSchluessel(feld);
        return (
            fehler[`${feld}.${index}`] ??
            fehler[`${schluessel}.${index}`] ??
            (index === 0 ? fehler[feld] ?? fehler[schluessel] : undefined)
        );
    }

    /*
     * Beim Bearbeiten die alten Feldmarkierungen verwerfen. Die API nummeriert
     * nur die gefüllten Zeilen, die Anzeige zählt alle – sobald eine leere
     * Zeile dazwischensteht, zeigen beide Nummern auf verschiedene Felder.
     * Deshalb pauschal wegwerfen statt umrechnen.
     */
    const ohneFeldfehler = (alt: Fehler): Fehler =>
        Object.fromEntries(
            Object.entries(alt).filter(
                ([schluessel]) =>
                    !/^(frage|antwort|beispiel|beispielUebersetzung|beispielsatz|beispiel_uebersetzung)(\.|$)/.test(
                        schluessel,
                    ),
            ),
        );

    function waehlen(wert: string | null) {
        setAuswahl(wert);
        setFehler({});
        setStatus("idle");

        // Sprache vorbelegen, sobald ein eigenes Set gewählt ist. Für ein ganz
        // neues Set ohne jedes eigene Set belegen wir sichtbar Englisch – erste
        // Sprache der App, im Namensschritt änderbar.
        const ziel = eigeneSets.find((s) => s.id === wert);
        if (ziel) setSpracheCode(ziel.sprache.code);
        else if (wert === NEUES_SET && eigeneSets.length > 0) {
            setSpracheCode(eigeneSets[0].sprache.code);
        } else if (wert === NEUES_SET && eigeneSets.length === 0) {
            setSpracheCode("en");
        }
    }

    function demoKopieren(set: SetZeile) {
        setAuswahl(NEUES_SET);
        setSetName(kopieName(set.name));
        setSpracheCode(set.sprache.code);
        setFehler({});
        setStatus("idle");
        setSchritt(2);
    }

    function paarAendern(index: number, feld: keyof Paar, wert: string) {
        setPaare((alt) => alt.map((p, i) => (i === index ? { ...p, [feld]: wert } : p)));
        setFehler(ohneFeldfehler);
    }

    function paarEntfernen(index: number) {
        setPaare((alt) => {
            const neu = alt.filter((_, i) => i !== index);
            // Die letzte Zeile bleibt immer stehen, sonst steht man vor einer
            // leeren Seite und weiß nicht, wohin tippen soll.
            return neu.length > 0 ? neu : [{ ...LEER }];
        });
        setFehler(ohneFeldfehler);
    }

    function paarHinzufuegen() {
        setPaare((alt) => [...alt, { ...LEER }]);
    }

    /*
     * Textblock (Plan 2.3): den eingefügten Text parsen und als eigene
     * Wortpaare übernehmen. Nicht sofort speichern – die Zeilen landen in der
     * normalen Liste, wo jede noch korrigiert werden kann.
     */
    function textblockUebernehmen() {
        const ergebnis = textblockZuPaaren(textblock);
        if (ergebnis.paare.length === 0) {
            setFehler({
                textblock:
                    "Daraus wurde keine Vokabel erkannt. Eine Vokabel je Zeile, " +
                    "Begriff und Übersetzung getrennt (Tabulator, ; | -> = : oder ein Strich).",
            });
            return;
        }

        // Die erste, noch leere Zeile ersetzen, sonst stünde eine leere Zeile
        // vor der importierten Liste.
        const nurLeereStartzeile =
            paare.length === 1 && !paare[0].frage.trim() && !paare[0].antwort.trim();
        const neueListe = nurLeereStartzeile ? ergebnis.paare : [...paare, ...ergebnis.paare];
        setPaare(neueListe);
        setTextblock("");
        setFehler({});
        setEingabeArt("zeilen");

        const teile = [`${ergebnis.paare.length} Vokabel${ergebnis.paare.length === 1 ? "" : "n"} übernommen.`];
        if (ergebnis.ohneTrenner > 0) {
            teile.push(`Bei ${ergebnis.ohneTrenner} fehlt die Übersetzung – bitte ergänzen.`);
        }
        if (ergebnis.uebersprungen > 0) {
            teile.push(
                `${ergebnis.uebersprungen} Zeile${ergebnis.uebersprungen === 1 ? "" : "n"} nicht übernommen (mehr als vier Spalten).`,
            );
        }
        setTextblockMeldung(teile.join(" "));

        // Was der Nutzer mitgegeben hat, gleich mit Beispielsätzen auffüllen.
        void beispielSaetzeErgaenzen(neueListe);
    }

    /*
     * Foto (Plan 2.4): Bild aufnehmen oder aus der Galerie wählen, auf eine
     * vertretbare Größe schrumpfen und von der KI auslesen lassen. Das
     * Ergebnis landet in derselben bearbeitbaren Liste wie ein Textblock –
     * niemand muss der Erkennung blind vertrauen.
     */
    async function fotoWaehlen(quelle: "kamera" | "galerie") {
        if (ocrLaedt) return;
        setOcrFehler(null);

        try {
            const erlaubnis =
                quelle === "kamera"
                    ? await ImagePicker.requestCameraPermissionsAsync()
                    : await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!erlaubnis.granted) {
                setOcrFehler(
                    quelle === "kamera"
                        ? "Ohne Kamerazugriff geht kein Foto. Die Erlaubnis lässt sich in den Android-Einstellungen geben."
                        : "Ohne Zugriff auf die Fotos geht kein Bild. Die Erlaubnis lässt sich in den Android-Einstellungen geben.",
                );
                return;
            }

            const optionen: ImagePicker.ImagePickerOptions = {
                mediaTypes: ["images"],
                quality: 0.8,
            };
            const ergebnis =
                quelle === "kamera"
                    ? await ImagePicker.launchCameraAsync(optionen)
                    : await ImagePicker.launchImageLibraryAsync(optionen);
            if (ergebnis.canceled || !ergebnis.assets?.[0]) return;

            const bild = ergebnis.assets[0];
            setBildUri(bild.uri);
            await ocrLesen(bild.uri);
        } catch {
            setOcrFehler("Das Bild konnte nicht geöffnet werden.");
        }
    }

    async function ocrLesen(uri: string) {
        setOcrLaedt(true);
        setOcrFehler(null);

        try {
            /*
             * Handyfotos sind viel zu groß für die Anfrage. Der Server kürzt
             * zwar auch, aber je kleiner das Bild hier rausgeht, desto
             * schneller die Übertragung. 1800 px lange Kante lässt Text noch
             * scharf genug und bleibt weit unter dem Limit.
             */
            const klein = await manipulateAsync(uri, [{ resize: { width: 1800 } }], {
                compress: 0.85,
                format: SaveFormat.JPEG,
                base64: true,
            });
            if (!klein.base64) {
                setOcrFehler("Das Bild konnte nicht verarbeitet werden.");
                return;
            }

            const daten = await sendeJson<{
                paare?: { frage: string; antwort: string }[];
                verworfen?: number;
                doppelt?: number;
                abgeschnitten?: boolean;
            }>("/api/ocr/vokabeln", { bild: `data:image/jpeg;base64,${klein.base64}` });

            /*
             * Dieselbe Bereinigung wie im Web: Nummerierung weg, Dubletten
             * weg, Müll weg. Das Modell liefert roh, aufgeräumt wird im Code.
             */
            const bereinigt = bereinigeOcrPaare(daten.paare ?? [], {
                bestehende: paareRef.current,
            });
            if (bereinigt.paare.length === 0) {
                setOcrFehler(
                    "Auf dem Foto war keine Vokabel zu erkennen. Versuch es näher am Text und ohne Schatten.",
                );
                return;
            }

            const neueListe: Paar[] = bereinigt.paare.map((p) => ({
                ...LEER,
                frage: p.frage,
                antwort: p.antwort,
            }));
            const bisher = paareRef.current;
            const nurLeereStartzeile =
                bisher.length === 1 && !bisher[0].frage.trim() && !bisher[0].antwort.trim();
            const gesamt = nurLeereStartzeile ? neueListe : [...bisher, ...neueListe];
            setPaare(gesamt);
            setPruefungAktiv(true);
            setBildUri(null);
            setEingabeArt("zeilen");
            setFehler({});

            const meldung = [
                `${neueListe.length} Vokabel${neueListe.length === 1 ? "" : "n"} aus dem Foto übernommen`,
            ];
            if (bereinigt.verworfen > 0) {
                meldung.push(`${bereinigt.verworfen} unbrauchbare aussortiert`);
            }
            if (bereinigt.doppelt > 0) {
                meldung.push(`${bereinigt.doppelt} doppelt`);
            }
            setTextblockMeldung(meldung.join(". ") + ". Bitte kurz prüfen.");

            /*
             * Beispielsätze bewusst NICHT automatisch: ein Foto ist die
             * unsicherste Quelle, und ein Satz zu einem falsch erkannten Wort
             * wäre nach der Korrektur falsch. Der Nutzer kann sie über den
             * vorhandenen Knopf nachziehen.
             */
        } catch (f) {
            setOcrFehler(
                f instanceof ApiFehler
                    ? f.message
                    : "Das Foto konnte nicht gelesen werden. Prüf die Verbindung und versuch es noch einmal.",
            );
        } finally {
            setOcrLaedt(false);
        }
    }

    /*
     * Beispielsätze für alle ausgefüllten Zeilen holen, die noch keinen haben.
     * Bewusst nacheinander, nicht alle auf einmal: die KI-Quote hinter
     * /api/beispielsatz ist kostenlos und begrenzt; eine Warteschlange hält
     * das Ratelimit frei.
     */
    async function beispielSaetzeErgaenzen(quelle?: Paar[]) {
        const basis = quelle ?? paareRef.current;
        const ziele = basis
            .map((p, index) => ({ p, index }))
            .filter(({ p }) => (p.frage.trim() !== "" || p.antwort.trim() !== "") && !p.beispiel.trim());
        if (ziele.length === 0) return;

        setBeispielMeldung(null);
        setBeispielStatus({ ziele: ziele.length, fertig: 0, sätze: 0 });
        let gefunden = 0;

        for (let i = 0; i < ziele.length; i++) {
            const { p, index } = ziele[i];
            try {
                const daten = await sendeJson<{ satz: string | null; uebersetzung: string | null }>(
                    "/api/beispielsatz",
                    {
                        frage: p.frage.trim(),
                        antwort: p.antwort.trim(),
                        sprache: spracheCode ?? null,
                    },
                );
                if (daten.satz && daten.uebersetzung) {
                    gefunden += 1;
                    setPaare((alt) =>
                        alt.map((zeile, idx) =>
                            idx === index
                                ? {
                                      ...zeile,
                                      beispiel: daten.satz as string,
                                      beispielUebersetzung: daten.uebersetzung as string,
                                  }
                                : zeile,
                        ),
                    );
                }
            } catch {
                // Einzelfehler (Netz, kein Satz) dürfen den Rest nicht kosten.
            }
            setBeispielStatus((alt) =>
                alt ? { ...alt, fertig: i + 1, sätze: gefunden } : alt,
            );
        }

        setBeispielStatus(null);
        if (gefunden > 0) {
            setBeispielMeldung(
                `${gefunden} ${gefunden === 1 ? "Beispielsatz" : "Beispielsätze"} automatisch ergänzt.` +
                    (gefunden < ziele.length
                        ? ` Für ${ziele.length - gefunden} wurde nichts gefunden – die kannst du selbst eintragen.`
                        : ""),
            );
        } else {
            setBeispielMeldung(
                `Zu ${ziele.length === 1 ? "diesem Wort" : `diesen ${ziele.length} Wörtern`} ` +
                    "gibt es noch keinen Beispielsatz. Du kannst sie selbst eintragen – das Feld ist optional.",
            );
        }
        setFehler({});
    }

    function zurueck() {
        setFehler({});
        setStatus("idle");
        setSchritt((s) => (s === 1 ? 1 : ((s - 1) as Schritt)));
    }

    /*
     * Schrittwechsel erst im naechsten Task. react-native-web feuert nach dem
     * pointerup noch ein click-Event an dieselbe Stelle; wechselt die Ansicht
     * schon waehrend des pointerup, landet dieses click auf dem Knopf des
     * naechsten Schritts – und speichert ungefragt ein Wort, das niemand
     * speichern wollte.
     */
    function naechsterSchritt(ziel: Schritt) {
        setTimeout(() => setSchritt(ziel), 0);
    }

    function weiter() {
        setFehler({});

        if (schritt === 1) {
            if (!auswahl) {
                setFehler({ auswahl: "Wähle ein Set oder lege ein neues an." });
                return;
            }
            naechsterSchritt(2);
            return;
        }

        if (schritt === 2) {
            if (gefuelltePaare.length === 0) {
                setFehler({ paare: "Trage mindestens ein Wortpaar ein." });
                return;
            }
            // Halb ausgefüllte Zeilen abfangen, bevor gespeichert wird – die
            // Meldung nennt das fehlende Feld, nicht „Paar 3".
            if (unvollstaendigIndex >= 0) {
                const zeile = gefuelltePaare[unvollstaendigIndex];
                setFehler({
                    [`${!zeile.frage.trim() ? "frage" : "antwort"}.${unvollstaendigIndex}`]: !zeile.frage
                        .trim()
                        ? "Der Begriff fehlt."
                        : "Die Übersetzung fehlt.",
                });
                return;
            }
            setSetName(gewaehltesSet ? gewaehltesSet.name : "");
            naechsterSchritt(3);
        }
    }

    async function speichern() {
        if (status === "speichert" || gefuelltePaare.length === 0) return;

        const name = setName.trim();
        const neu: Fehler = {};

        if (!name) neu.name = "Das Set braucht einen Namen.";
        else if (name.length > MAX_NAME) neu.name = `Maximal ${MAX_NAME} Zeichen`;

        // Die Sprache wird nur abgefragt, wenn tatsächlich ein neues Set
        // entsteht. In ein bestehendes Set wäre sie eine widersprüchliche
        // zweite Angabe.
        const anlegen = !gewaehltesSet || name !== gewaehltesSet.name.trim();
        if (anlegen && !spracheCode) neu.sprache = "Welche Sprache?";

        if (Object.keys(neu).length > 0) {
            setFehler(neu);
            return;
        }

        setStatus("speichert");
        setFehler({});

        const paareApi: NeuesPaar[] = gefuelltePaare.map((p) => ({
            frage: p.frage.trim(),
            antwort: p.antwort.trim(),
            // Leere Beispielsätze als null, nicht als "" – sonst stünde
            // später ein leerer String in der Datenbank.
            beispielsatz: p.beispiel.trim() || null,
            beispiel_uebersetzung: p.beispielUebersetzung.trim() || null,
        }));

        /*
         * Aussen deklariert, weil der Offline-Zweig im catch wissen muss, ob
         * das Set schon einen Slug hat: dann hängen nur die Karten in der
         * Queue, sonst das ganze Set.
         */
        let slug = anlegen ? null : gewaehltesSet!.id;

        try {
            // Name unverändert + bestehendes Set -> direkt hineinspeichern.
            // Sonst ein neues Set anlegen und dorthin speichern.
            if (!slug) {
                const daten = await sendeJson<{ set: { slug: string } }>("/api/sets", {
                    name,
                    spracheCode,
                });
                slug = daten.set.slug;
            }

            await sendeJson("/api/karten", { setSlug: slug, paare: paareApi });

            /*
             * Liste neu laden, damit „Noch mehr Wörter" den gerade angelegten
             * Namen kennt. Eigenes try/catch: die Wörter SIND gespeichert, ein
             * Fehler hier darf keinen Wiederholungsversuch auslösen, der ein
             * zweites Set mit denselben Wörtern anlegt.
             */
            try {
                setSets(await holeJson<SetZeile[]>("/api/karteikarten"));
            } catch {
                setSetsGeladen(true);
            }
            setZaehler((z) => z + gefuelltePaare.length);
            setFertig({ name, slug, anzahl: gefuelltePaare.length });
            setAuswahl(slug);
            setStatus("idle");
        } catch (grund) {
            if (grund instanceof ApiFehler && grund.status === 0) {
                /*
                 * Ohne Netz: vormerken statt verlieren. Hat das Set schon
                 * einen Slug (bestand vorher, oder es wurde eben online
                 * angelegt), hängen nur die Karten in der Queue – sonst geht
                 * beides zusammen, weil der Slug erst beim Anlegen entsteht.
                 */
                if (slug) {
                    await neueKartenMerken({ art: "karten", setSlug: slug, paare: paareApi });
                } else if (spracheCode) {
                    await neueKartenMerken({
                        art: "set",
                        name,
                        spracheCode,
                        paare: paareApi,
                    });
                } else {
                    setFehler({ sprache: "Welche Sprache?" });
                    setStatus("fehler");
                    return;
                }

                setZaehler((z) => z + paareApi.length);
                setFertig({ name, slug, anzahl: paareApi.length, offline: true });
                setAuswahl(slug);
                setStatus("idle");
                return;
            }

            // Feldfehler (unvollständiges Paar) -> zurück in Schritt 2 und das
            // betroffene Feld markieren; sonst bliebe die Meldung in Schritt 3
            // an einem Feld stehen, das gar nicht sichtbar ist.
            if (grund instanceof ApiFehler && Object.keys(grund.felder).length > 0) {
                setFehler(grund.felder);
                setStatus("idle");
                setSchritt(2);
                return;
            }
            setFehler({
                form:
                    grund instanceof ApiFehler
                        ? grund.message
                        : "Keine Verbindung zum Server. Bitte erneut versuchen.",
            });
            setStatus("fehler");
        }
    }

    const zurueckZiel = () => (schritt === 1 ? router.push("/") : zurueck());

    // ------------------------------------------------------------- Erfolg

    if (fertig) {
        const zielSlug = fertig.slug;
        return (
            <View style={[styles.rahmen, { backgroundColor: farben.background }]}>
                <ScrollView contentContainerStyle={styles.seite}>
                    <View style={styles.erfolgKopf}>
                        <Text style={[styles.erfolgTitel, { color: farben.textPrimary }]}>
                            {fertig.offline ? "Offline gespeichert" : "Gespeichert"}
                        </Text>
                        <Text style={[styles.erfolgUnter, { color: farben.textSecondary }]}>
                            {fertig.anzahl} {fertig.anzahl === 1 ? "Wort" : "Wörter"} in {fertig.name}
                        </Text>
                    </View>

                    <Karte style={styles.form}>
                        <View style={styles.erfolgZeile}>
                            <View style={[styles.punkt, { backgroundColor: farben.sage }]} />
                            <Text style={[styles.erfolgZeileText, { color: farben.textPrimary }]}>
                                {fertig.name} ist bereit
                            </Text>
                        </View>
                        <Text style={[styles.hinweis, { color: farben.textSecondary }]}>
                            {fertig.offline
                                ? "Ohne Verbindung gespeichert. Die Wörter gehen raus, sobald du wieder Netz hast – dann stehen sie auch im Web."
                                : "Das Set landet auf deiner Übersicht. Von dort kannst du lernen oder es wieder löschen."}
                        </Text>
                        {zielSlug ? (
                            <Knopf
                                titel="Jetzt lernen"
                                onPress={() => router.push(`/lernen/${encodeURIComponent(zielSlug)}`)}
                            />
                        ) : null}
                        <Knopf titel="Zur Übersicht" variante="rand" onPress={() => router.push("/")} />
                        <Knopf
                            titel="Noch mehr Wörter"
                            variante="rand"
                            onPress={() => {
                                setFertig(null);
                                setPaare([{ ...LEER }]);
                                setSchritt(2);
                            }}
                        />
                    </Karte>
                </ScrollView>
            </View>
        );
    }

    // -------------------------------------------------------------- Schritt 1

    if (schritt === 1) {
        return (
            <View style={[styles.rahmen, { backgroundColor: farben.background }]}>
                <ScrollView contentContainerStyle={styles.seite}>
                    <Kopf
                        titel={SCHRITT_TITEL[1]}
                        untertitel={
                            zaehler > 0
                                ? `${zaehler} ${zaehler === 1 ? "Wort gespeichert" : "Wörter gespeichert"}`
                                : "Wähle ein Set oder lege ein neues an."
                        }
                        onZurueck={zurueckZiel}
                    />

                    {!setsGeladen ? (
                        <View style={styles.skelettReihe}>
                            <Skelett style={styles.skelettPille} radius={RADIUS.feld} />
                            <Skelett style={styles.skelettPille} radius={RADIUS.feld} />
                            <Skelett style={styles.skelettPille} radius={RADIUS.feld} />
                        </View>
                    ) : (
                        <View style={styles.pillen}>
                            {/* Neues Set zuerst: für die meisten das Ziel und der
                                einzige Weg, wenn noch kein eigenes Set existiert. */}
                            <Pressable
                                onPress={() => waehlen(auswahl === NEUES_SET ? null : NEUES_SET)}
                                accessibilityRole="button"
                                accessibilityState={{ selected: auswahl === NEUES_SET }}
                                style={[
                                    styles.pille,
                                    styles.pilleNeu,
                                    { borderColor: farben.line },
                                    auswahl === NEUES_SET
                                        ? { backgroundColor: farben.bgElevated2, borderColor: farben.gold }
                                        : null,
                                ]}
                            >
                                <Text style={[styles.pilleText, { color: farben.textPrimary }]}>
                                    ＋ Neues Set
                                </Text>
                            </Pressable>

                            {eigeneSets.map((set) => {
                                const aktiv = auswahl === set.id;
                                return (
                                    <Pressable
                                        key={set.id}
                                        onPress={() => waehlen(aktiv ? null : set.id)}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: aktiv }}
                                        style={[
                                            styles.pille,
                                            {
                                                backgroundColor: farbeVonSprache(set.sprache).flaeche,
                                                borderColor: aktiv ? farben.gold : "transparent",
                                            },
                                        ]}
                                    >
                                        <Text
                                            numberOfLines={1}
                                            style={[styles.pilleText, { color: KARTEN_TINTE.fest }]}
                                        >
                                            {set.name}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    )}

                    {fehler.auswahl ? (
                        <Text style={[styles.fehlerText, { color: farben.terracotta }]}>
                            {fehler.auswahl}
                        </Text>
                    ) : null}

                    {setsGeladen && eigeneSets.length === 0 && demoSets.length === 0 ? (
                        <Text style={[styles.hinweis, { color: farben.textSecondary }]}>
                            Noch keine Sets vorhanden – lege oben ein neues an.
                        </Text>
                    ) : null}

                    {demoSets.length > 0 ? (
                        <Karte style={styles.demoKarte}>
                            <Pressable
                                onPress={() => setDemosOffen((offen) => !offen)}
                                accessibilityRole="button"
                                accessibilityState={{ expanded: demosOffen }}
                                style={styles.demoKopf}
                            >
                                <Text style={[styles.demoTitel, { color: farben.textPrimary }]}>
                                    Vorgefertigte Sets ({demoSets.length})
                                </Text>
                                <FontAwesome6
                                    name={demosOffen ? "chevron-up" : "chevron-down"}
                                    size={16}
                                    color={farben.textSecondary}
                                />
                            </Pressable>

                            {demosOffen ? (
                                <>
                                    <Text style={[styles.hinweis, { color: farben.textSecondary }]}>
                                        Diese Sets gehören allen und lassen sich nicht verändern.
                                        Nimm ein Wort daraus mit „Kopie anlegen“ in ein eigenes Set.
                                    </Text>
                                    {demoSets.map((set) => (
                                        <Pressable
                                            key={set.id}
                                            onPress={() => demoKopieren(set)}
                                            accessibilityRole="button"
                                            accessibilityLabel={`${set.name} als Kopie anlegen`}
                                            style={styles.demoZeile}
                                        >
                                            <View
                                                style={[
                                                    styles.punkt,
                                                    {
                                                        backgroundColor: farbeVonSprache(set.sprache)
                                                            .flaeche,
                                                    },
                                                ]}
                                            />
                                            <Text
                                                numberOfLines={1}
                                                style={[styles.demoName, { color: farben.textPrimary }]}
                                            >
                                                {set.name}
                                            </Text>
                                            <Text
                                                style={[styles.demoAktion, { color: farben.gold }]}
                                            >
                                                Kopie anlegen
                                            </Text>
                                        </Pressable>
                                    ))}
                                </>
                            ) : null}
                        </Karte>
                    ) : null}

                    <Knopf titel="Weiter" onPress={weiter} />
                </ScrollView>
            </View>
        );
    }

    // -------------------------------------------------------------- Schritt 2

    if (schritt === 2) {
        const zielName = gewaehltesSet
            ? gewaehltesSet.name
            : setName.trim() || "dein neues Set";

        return (
            <View style={[styles.rahmen, { backgroundColor: farben.background }]}>
                <ScrollView contentContainerStyle={styles.seite} keyboardShouldPersistTaps="handled">
                    <Kopf
                        titel={SCHRITT_TITEL[2]}
                        untertitel={`Neue Wörter für ${zielName}`}
                        onZurueck={zurueckZiel}
                    />

                    <Karte style={styles.form}>
                        {/* Drei Wege, Wörter einzutragen: Zeile für Zeile, ein
                            ganzer Textblock oder ein Foto. Alle münden in
                            dieselbe Liste. */}
                        <View style={[styles.modus, { borderColor: farben.line }]}>
                            {(
                                [
                                    ["zeilen", "Zeilen"],
                                    ["textblock", "Textblock"],
                                    ["foto", "Foto"],
                                ] as const
                            ).map(([art, label]) => {
                                const aktiv = eingabeArt === art;
                                return (
                                    <Pressable
                                        key={art}
                                        onPress={() => {
                                            setEingabeArt(art);
                                            setFehler({});
                                        }}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: aktiv }}
                                        style={[
                                            styles.modusKnopf,
                                            aktiv ? { backgroundColor: farben.bgElevated2 } : null,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.modusText,
                                                {
                                                    color: aktiv
                                                        ? farben.textPrimary
                                                        : farben.textSecondary,
                                                    fontFamily: aktiv ? SANS.semibold : SANS.medium,
                                                },
                                            ]}
                                        >
                                            {label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        {eingabeArt === "textblock" ? (
                            <View style={styles.textblock}>
                                <Text style={[styles.label, { color: farben.textSecondary }]}>
                                    Mehrere Wörter auf einmal
                                </Text>
                                <Feld
                                    value={textblock}
                                    onChangeText={(text) => {
                                        setTextblock(text);
                                        if (fehler.textblock) setFehler({});
                                    }}
                                    multiline
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    style={TEXTBLOCK_STIL}
                                    placeholder={
                                        "Eine Vokabel je Zeile, z. B.:\n\napple\tApfel\ncat ; Katze\nto learn -> lernen\nbook = Buch"
                                    }
                                    accessibilityLabel="Mehrere Wörter auf einmal"
                                />
                                <Text style={[styles.hinweis, { color: farben.textMuted }]}>
                                    Trennzeichen: Tabulator, ; | -&gt; = : oder ein Strich. Optional
                                    auch Beispielsatz als dritte Spalte.
                                </Text>
                                {fehler.textblock ? (
                                    <Text style={[styles.fehlerText, { color: farben.terracotta }]}>
                                        {fehler.textblock}
                                    </Text>
                                ) : null}
                                <Knopf titel="Wörter übernehmen" onPress={textblockUebernehmen} />
                            </View>
                        ) : eingabeArt === "foto" ? (
                            <View style={styles.foto}>
                                <Text style={[styles.label, { color: farben.textSecondary }]}>
                                    Vokabeln aus einem Foto
                                </Text>
                                <Text style={[styles.hinweis, { color: farben.textMuted }]}>
                                    Fotografiere dein Vokabelheft oder wähle ein Bild aus der
                                    Galerie. Die Wörter werden erkannt und landen danach in der
                                    normalen Liste – dort kannst du alles korrigieren.
                                </Text>

                                {bildUri ? (
                                    <Image
                                        source={{ uri: bildUri }}
                                        style={[styles.vorschau, { borderColor: farben.line }]}
                                        resizeMode="cover"
                                        accessibilityLabel="Gewähltes Foto"
                                    />
                                ) : null}

                                <View style={styles.fotoKnoepfe}>
                                    <Knopf
                                        titel="Kamera"
                                        onPress={() => void fotoWaehlen("kamera")}
                                        disabled={ocrLaedt}
                                        style={styles.fotoKnopf}
                                    />
                                    <Knopf
                                        titel="Galerie"
                                        variante="rand"
                                        onPress={() => void fotoWaehlen("galerie")}
                                        disabled={ocrLaedt}
                                        style={styles.fotoKnopf}
                                    />
                                </View>

                                {ocrLaedt ? (
                                    <View
                                        style={styles.ocrLaedt}
                                        accessibilityLiveRegion="polite"
                                        accessibilityLabel="Foto wird gelesen"
                                    >
                                        <ActivityIndicator color={farben.textSecondary} />
                                        <Text style={[styles.hinweis, { color: farben.textMuted }]}>
                                            Foto wird gelesen…
                                        </Text>
                                    </View>
                                ) : null}

                                {ocrFehler ? (
                                    <Text style={[styles.fehlerText, { color: farben.terracotta }]}>
                                        {ocrFehler}
                                    </Text>
                                ) : null}
                            </View>
                        ) : (
                            <>
                                {befunde.length > 0 ? (
                                    <View
                                        style={[
                                            styles.pruefBanner,
                                            {
                                                borderColor: farben.gold,
                                                backgroundColor: farben.champagnerSchein,
                                                borderRadius: RADIUS.standard,
                                            },
                                        ]}
                                        accessibilityLiveRegion="polite"
                                    >
                                        <Text style={[styles.pruefBannerText, { color: farben.gold }]}>
                                            {befunde.length}{" "}
                                            {befunde.length === 1 ? "Eintrag" : "Einträge"} bitte
                                            prüfen – die Zeilen sind markiert.
                                        </Text>
                                    </View>
                                ) : null}
                                {paare.map((paar, index) => {
                                    // Serverindex (nur gefüllte Zeilen) vs.
                                    // Anzeigeindex (alle Zeilen).
                                    const gefIndex = paare
                                        .slice(0, index)
                                        .filter(
                                            (p) => p.frage.trim() !== "" || p.antwort.trim() !== "",
                                        ).length;
                                    return (
                                        <PaarZeile
                                            key={index}
                                            paar={paar}
                                            nummer={index + 1}
                                            frageFehler={feldFehler(gefIndex, "frage")}
                                            antwortFehler={feldFehler(gefIndex, "antwort")}
                                            beispielFehler={feldFehler(gefIndex, "beispiel")}
                                            beispielUebFehler={feldFehler(
                                                gefIndex,
                                                "beispielUebersetzung",
                                            )}
                                            kannEntfernen={paare.length > 1}
                                            befund={befundNachIndex.get(index)}
                                            onAendern={paarAendern}
                                            onEntfernen={paarEntfernen}
                                        />
                                    );
                                })}

                                {fehler.paare ? (
                                    <Text style={[styles.fehlerText, { color: farben.terracotta }]}>
                                        {fehler.paare}
                                    </Text>
                                ) : null}

                                <Knopf
                                    titel="＋ Feld hinzufügen"
                                    variante="rand"
                                    onPress={paarHinzufuegen}
                                />

                                {beispielStatus ? (
                                    <Text style={[styles.okText, { color: farben.sage }]}>
                                        {beispielStatus.fertig < beispielStatus.ziele
                                            ? `Beispielsätze werden gesucht… ${beispielStatus.fertig} von ${beispielStatus.ziele}`
                                            : `${beispielStatus.sätze} von ${beispielStatus.ziele} ${
                                                  beispielStatus.sätze === 1 ? "Satz" : "Sätzen"
                                              } ergänzt.`}
                                    </Text>
                                ) : null}

                                {beispielMeldung ? (
                                    <Text style={[styles.okText, { color: farben.sage }]}>
                                        {beispielMeldung}
                                    </Text>
                                ) : null}

                                {!beispielStatus &&
                                paare.some(
                                    (p) =>
                                        (p.frage.trim() !== "" || p.antwort.trim() !== "") &&
                                        !p.beispiel.trim(),
                                ) ? (
                                    <Knopf
                                        variante="rand"
                                        accessibilityLabel="Beispielsätze ergänzen"
                                        onPress={() => {
                                            setBeispielMeldung(null);
                                            void beispielSaetzeErgaenzen();
                                        }}
                                    >
                                        <FontAwesome6 name="bolt" size={15} color={farben.textPrimary} />
                                        <Text
                                            style={[
                                                styles.knopfInhalt,
                                                { color: farben.textPrimary },
                                            ]}
                                        >
                                            Beispielsätze ergänzen
                                        </Text>
                                    </Knopf>
                                ) : null}

                                <Knopf titel="Fertig" onPress={weiter} />
                            </>
                        )}

                        {textblockMeldung && eingabeArt === "zeilen" ? (
                            <Text style={[styles.okText, { color: farben.sage }]}>
                                {textblockMeldung}
                            </Text>
                        ) : null}
                    </Karte>
                </ScrollView>
            </View>
        );
    }

    // -------------------------------------------------------------- Schritt 3

    return (
        <View style={[styles.rahmen, { backgroundColor: farben.background }]}>
            <ScrollView contentContainerStyle={styles.seite}>
                <Kopf
                    titel={SCHRITT_TITEL[3]}
                    untertitel={`${gefuelltePaare.length} ${
                        gefuelltePaare.length === 1 ? "Wort" : "Wörter"
                    } bereit`}
                    onZurueck={zurueckZiel}
                />

                <Karte style={styles.form}>
                    <Text style={[styles.label, { color: farben.textSecondary }]}>
                        Name des Sets
                    </Text>
                    <Feld
                        value={setName}
                        onChangeText={setSetName}
                        placeholder="z. B. Italienisch Alltag"
                        maxLength={MAX_NAME}
                        autoCapitalize="sentences"
                        accessibilityLabel="Name des Sets"
                    />
                    {fehler.name ? (
                        <Text style={[styles.fehlerText, { color: farben.terracotta }]}>
                            {fehler.name}
                        </Text>
                    ) : null}

                    {/* Die Sprache ist eine feste Liste, kein Freitext. Nur nötig,
                        wenn ein neues Set entsteht; in ein bestehendes Set wäre
                        sie eine widersprüchliche zweite Angabe. */}
                    {legtNeuesSetAn ? (
                        <>
                            <Text style={[styles.label, { color: farben.textSecondary }]}>
                                Sprache
                            </Text>
                            {sprachListe.length === 0 ? (
                                <Text style={[styles.hinweis, { color: farben.textMuted }]}>
                                    Keine Sprachen geladen.
                                </Text>
                            ) : (
                                <View style={styles.pillen}>
                                    {sprachListe.map((sprache) => {
                                        const aktiv = spracheCode === sprache.code;
                                        return (
                                            <Pressable
                                                key={sprache.code}
                                                onPress={() => setSpracheCode(sprache.code)}
                                                accessibilityRole="button"
                                                accessibilityState={{ selected: aktiv }}
                                                style={[
                                                    styles.pille,
                                                    {
                                                        backgroundColor: aktiv
                                                            ? sprache.flaeche
                                                            : farben.bgElevated2,
                                                        borderColor: aktiv
                                                            ? farben.gold
                                                            : farben.line,
                                                    },
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.pilleText,
                                                        {
                                                            color: aktiv
                                                                ? KARTEN_TINTE.fest
                                                                : farben.textPrimary,
                                                        },
                                                    ]}
                                                >
                                                    {sprache.name}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            )}
                            {fehler.sprache ? (
                                <Text style={[styles.fehlerText, { color: farben.terracotta }]}>
                                    {fehler.sprache}
                                </Text>
                            ) : null}
                        </>
                    ) : null}

                    {sprachFehler && legtNeuesSetAn ? (
                        <Text style={[styles.fehlerText, { color: farben.terracotta }]}>
                            {sprachFehler}
                        </Text>
                    ) : null}

                    {gewaehltesSet && legtNeuesSetAn ? (
                        <Text style={[styles.hinweis, { color: farben.textSecondary }]}>
                            Mit einem anderen Namen entsteht ein neues Set. {gewaehltesSet.name}{" "}
                            bleibt unverändert.
                        </Text>
                    ) : null}

                    {fehler.form ? (
                        <Text style={[styles.fehlerText, { color: farben.terracotta }]}>
                            {fehler.form}
                        </Text>
                    ) : null}

                    <Knopf
                        titel={
                            status === "speichert"
                                ? "Speichert…"
                                : `${gefuelltePaare.length} ${
                                      gefuelltePaare.length === 1 ? "Wort" : "Wörter"
                                  } speichern`
                        }
                        onPress={() => void speichern()}
                        disabled={status === "speichert"}
                    />
                </Karte>
            </ScrollView>
        </View>
    );
}

/** Kopfzeile mit Zurück-Pfeil, Titel und Untertitel. */
function Kopf({
    titel,
    untertitel,
    onZurueck,
}: {
    titel: string;
    untertitel: string;
    onZurueck: () => void;
}) {
    const { farben } = useDesign();
    return (
        <View style={styles.kopf}>
            <Pressable
                onPress={onZurueck}
                accessibilityRole="button"
                accessibilityLabel="Zurück"
                hitSlop={8}
                style={[styles.zurueck, { borderColor: farben.line }]}
            >
                <FontAwesome6 name="arrow-left" size={18} color={farben.textPrimary} />
            </Pressable>
            <View style={styles.kopfText}>
                <Text style={[styles.kopfTitel, { color: farben.textPrimary }]}>{titel}</Text>
                <Text style={[styles.kopfUnter, { color: farben.textSecondary }]}>{untertitel}</Text>
            </View>
        </View>
    );
}

/** Eine Wortpaar-Zeile: Begriff, Übersetzung und die optionalen Beispielsätze. */
function PaarZeile({
    paar,
    nummer,
    frageFehler,
    antwortFehler,
    beispielFehler,
    beispielUebFehler,
    kannEntfernen,
    befund,
    onAendern,
    onEntfernen,
}: {
    paar: Paar;
    nummer: number;
    frageFehler?: string;
    antwortFehler?: string;
    beispielFehler?: string;
    beispielUebFehler?: string;
    kannEntfernen: boolean;
    befund?: OcrBefund;
    onAendern: (index: number, feld: keyof Paar, wert: string) => void;
    onEntfernen: (index: number) => void;
}) {
    const { farben } = useDesign();
    const index = nummer - 1;

    const beschriftet = (text: string, optional = false): ReactNode => (
        <Text style={[styles.label, { color: farben.textSecondary }]}>
            {text}
            {optional ? <Text style={{ color: farben.textMuted }}> (optional)</Text> : null}
        </Text>
    );

    return (
        <Karte
            style={[
                styles.paarZeile,
                befund ? { borderColor: farben.gold, borderWidth: 2 } : null,
            ]}
        >
            {befund ? (
                <Text style={[styles.pruefGrund, { color: farben.gold }]}>
                    Prüfen: {befund.text}
                </Text>
            ) : null}
            {beschriftet("Begriff")}
            <Feld
                value={paar.frage}
                onChangeText={(wert) => onAendern(index, "frage", wert)}
                placeholder="z. B. ciao"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Begriff"
            />
            {frageFehler ? (
                <Text style={[styles.fehlerText, { color: farben.terracotta }]}>{frageFehler}</Text>
            ) : null}

            {beschriftet("Übersetzung")}
            <Feld
                value={paar.antwort}
                onChangeText={(wert) => onAendern(index, "antwort", wert)}
                placeholder="z. B. hallo"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Übersetzung"
            />
            {antwortFehler ? (
                <Text style={[styles.fehlerText, { color: farben.terracotta }]}>
                    {antwortFehler}
                </Text>
            ) : null}

            {/* Bewusst unter Begriff und Übersetzung: wer zehn Wörter eintippt,
                soll nicht vier Felder je Zeile bedienen müssen. */}
            {beschriftet("Beispielsatz", true)}
            <Feld
                value={paar.beispiel}
                onChangeText={(wert) => onAendern(index, "beispiel", wert)}
                placeholder="z. B. Ci vediamo domani?"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Beispielsatz"
            />
            {beispielFehler ? (
                <Text style={[styles.fehlerText, { color: farben.terracotta }]}>
                    {beispielFehler}
                </Text>
            ) : null}

            {beschriftet("Satz auf Deutsch", true)}
            <Feld
                value={paar.beispielUebersetzung}
                onChangeText={(wert) => onAendern(index, "beispielUebersetzung", wert)}
                placeholder="z. B. Wir sehen uns morgen?"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Satz auf Deutsch"
            />
            {beispielUebFehler ? (
                <Text style={[styles.fehlerText, { color: farben.terracotta }]}>
                    {beispielUebFehler}
                </Text>
            ) : null}

            {kannEntfernen ? (
                <Pressable
                    onPress={() => onEntfernen(index)}
                    accessibilityRole="button"
                    accessibilityLabel={`Wortpaar ${nummer} entfernen`}
                    hitSlop={6}
                    style={styles.entfernen}
                >
                    <FontAwesome6 name="xmark" size={15} color={farben.terracotta} />
                    <Text style={[styles.entfernenText, { color: farben.terracotta }]}>
                        Entfernen
                    </Text>
                </Pressable>
            ) : null}
        </Karte>
    );
}

const styles = StyleSheet.create({
    rahmen: { flex: 1 },
    seite: {
        padding: ABSTAND.xl,
        gap: ABSTAND.lg,
        paddingBottom: ABSTAND.xxl,
    },
    kopf: {
        flexDirection: "row",
        alignItems: "center",
        gap: ABSTAND.md,
    },
    zurueck: {
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderRadius: RADIUS.feld,
    },
    kopfText: { flex: 1, gap: 2 },
    kopfTitel: { fontFamily: SERIF.bold, fontSize: 26 },
    kopfUnter: { fontFamily: SANS.regular, fontSize: 15 },
    form: { padding: ABSTAND.lg, gap: ABSTAND.md },
    label: { fontFamily: SANS.semibold, fontSize: 15 },
    hinweis: { fontFamily: SANS.regular, fontSize: 14, lineHeight: 20 },
    fehlerText: { fontFamily: SANS.medium, fontSize: 14 },
    okText: { fontFamily: SANS.medium, fontSize: 14, lineHeight: 20 },
    knopfInhalt: { fontFamily: SANS.semibold, fontSize: 16 },
    skelettReihe: { flexDirection: "row", gap: ABSTAND.md, flexWrap: "wrap" },
    skelettPille: { width: 140, height: 46 },
    pillen: { flexDirection: "row", flexWrap: "wrap", gap: ABSTAND.sm },
    pille: {
        minHeight: 46,
        paddingHorizontal: 16,
        borderRadius: RADIUS.feld,
        borderWidth: 2,
        alignItems: "center",
        justifyContent: "center",
        maxWidth: "100%",
    },
    pilleNeu: { borderStyle: "dashed", backgroundColor: "transparent" },
    pilleText: { fontFamily: SANS.semibold, fontSize: 15 },
    demoKarte: { padding: ABSTAND.lg, gap: ABSTAND.md },
    demoKopf: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    demoTitel: { fontFamily: SANS.semibold, fontSize: 16 },
    demoZeile: {
        flexDirection: "row",
        alignItems: "center",
        gap: ABSTAND.md,
        paddingVertical: ABSTAND.sm,
    },
    demoName: { flex: 1, fontFamily: SANS.medium, fontSize: 15 },
    demoAktion: { fontFamily: SANS.semibold, fontSize: 14 },
    punkt: { width: 10, height: 10, borderRadius: 5 },
    modus: {
        flexDirection: "row",
        borderWidth: 1,
        borderRadius: RADIUS.feld,
        padding: 3,
        gap: 3,
    },
    modusKnopf: {
        flex: 1,
        minHeight: 38,
        borderRadius: RADIUS.klein,
        alignItems: "center",
        justifyContent: "center",
    },
    modusText: { fontSize: 14 },
    textblock: { gap: ABSTAND.md },
    foto: { gap: ABSTAND.md },
    vorschau: {
        width: "100%",
        height: 180,
        borderRadius: RADIUS.feld,
        borderWidth: 1,
    },
    fotoKnoepfe: { flexDirection: "row", gap: ABSTAND.sm },
    fotoKnopf: { flex: 1 },
    ocrLaedt: {
        flexDirection: "row",
        alignItems: "center",
        gap: ABSTAND.sm,
    },
    pruefBanner: { padding: ABSTAND.md, borderWidth: 1 },
    pruefBannerText: { fontFamily: SANS.medium, fontSize: 14, lineHeight: 20 },
    pruefGrund: { fontFamily: SANS.medium, fontSize: 13, lineHeight: 18 },
    paarZeile: { padding: ABSTAND.lg, gap: ABSTAND.sm },
    entfernen: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        alignSelf: "flex-start",
        marginTop: ABSTAND.xs,
    },
    entfernenText: { fontFamily: SANS.semibold, fontSize: 14 },
    erfolgKopf: { gap: 4 },
    erfolgTitel: { fontFamily: SERIF.bold, fontSize: 30 },
    erfolgUnter: { fontFamily: SANS.regular, fontSize: 16 },
    erfolgZeile: { flexDirection: "row", alignItems: "center", gap: ABSTAND.sm },
    erfolgZeileText: { fontFamily: SANS.semibold, fontSize: 16 },
});
