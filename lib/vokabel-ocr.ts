/**
 * Aufräumen und Prüfen von Vokabelpaaren aus Foto-OCR.
 *
 * Hier liegt nur reine Logik, ohne Netz, ohne React, ohne Node – damit Web
 * (`@/lib/vokabel-ocr`) und App (`@lexio/vokabel-ocr`) dieselbe Antwort auf
 * dieselbe Modellausgabe bekommen. Zwei Stellen, die unterschiedlich putzen,
 * machen aus einem guten Import zwei verschiedene Ergebnisse.
 *
 * Grundsatz: nichts stillschweigend umdrehen oder „verbessern“. Was verdächtig
 * aussieht, wird markiert und dem Menschen gezeigt. Er sieht das Foto, das
 * Modell nicht mehr.
 */

import { paarSchluessel } from "./karten-duplikat";

/** Die Form, in der OCR-Paare durch die Gegend laufen. */
export type OcrPaar = { frage: string; antwort: string };

/** Ergebnis einer Bereinigung, mit Zählern für die Rückmeldung. */
export type OcrBereinigt = {
    paare: OcrPaar[];
    /** Beide Seiten leer – entfernt. */
    leer: number;
    /** Schon vorhanden (auch gegen `bestehende`) – entfernt. */
    doppelt: number;
    /** Unbrauchbar (keine Buchstaben, Beispielsatz, Kopfzeile …) – entfernt. */
    verworfen: number;
};

/** Ein Hinweis auf eine Zeile, die geprüft werden sollte. */
export type OcrBefund = {
    /** Index in der übergebenen Liste. */
    index: number;
    /** Kurzer deutscher Satz für die Zeile. */
    text: string;
};

const MAX_SEITENLAENGE = 80;
const MAX_WOERTER = 8;

/** Führende Nummerierung, Aufzählungszeichen und Klammern. */
const NUMMER_VORNE = /^\s*(?:\(?\d{1,3}\)?\s*[.)\]]?|[a-zA-Z]\s*[.)]|[-–—•·*])\s+/u;

/** Nullbreite und Steuerzeichen, die aus PDFs gern mitkommen. */
const UNSICHTBAR = /[\u200b-\u200f\u202a-\u202e\ufeff]/gu;

/** Kopfzeilen und Seitengerümpel, das keine Vokabel ist. */
const KOPFZEILE =
    /^(?:vokabeln?|vocabulary|wortschatz|unit|kapitel|lektion|lesson|aufgabe|übung|uebung|exercise|grammatik|grammar|seite|page|lernziel|merkkasten|summary|zusammenfassung|name|datum|klasse)\b/iu;

/** Garbage wie "aaaa", "....", "-----". */
const WIEDERHOLUNG = /^(.)\1{3,}$/u;

const DE_ARTIKEL = new Set([
    "der",
    "die",
    "das",
    "den",
    "dem",
    "des",
    "ein",
    "eine",
    "einen",
    "einem",
    "einer",
    "eines",
]);

const DE_STOPP = new Set([
    "und",
    "oder",
    "nicht",
    "mit",
    "für",
    "fuer",
    "von",
    "zu",
    "im",
    "in",
    "am",
    "an",
    "auf",
    "ist",
    "sind",
    "war",
    "wird",
    "hat",
    "haben",
    "sich",
    "auch",
    "als",
    "wie",
    "bei",
    "nach",
    "über",
    "ueber",
    "unter",
    "vor",
    "durch",
    "dass",
    "wenn",
    "weil",
    "noch",
    "nur",
    "schon",
    "sehr",
    "mehr",
    "man",
    "ich",
    "du",
    "er",
    "sie",
    "es",
    "wir",
    "ihr",
    "mich",
    "dich",
    "uns",
    "euch",
]);

const EN_STOPP = new Set([
    "the",
    "and",
    "or",
    "not",
    "with",
    "for",
    "from",
    "to",
    "of",
    "in",
    "on",
    "at",
    "is",
    "are",
    "was",
    "were",
    "have",
    "has",
    "this",
    "that",
    "you",
    "your",
]);

/**
 * Text für den Vergleich und die Anzeige aufräumen.
 *
 * Idempotent: zweimal anwenden ändert nichts. Das ist wichtig, weil der
 * Import schon vorher Nummern schneidet – doppelt schneiden darf nicht
 * „3D“ zu „D“ machen.
 */
export function normalisiereSeite(roh: unknown): string {
    let text = typeof roh === "string" ? roh : "";
    text = text.normalize("NFKC").replace(UNSICHTBAR, "");
    text = text.replace(/\s+/gu, " ").trim();
    text = text.replace(NUMMER_VORNE, "").trim();
    text = text.replace(/[.,;:!?…]+$/u, "").trim();
    return text;
}

function woerter(text: string): string[] {
    return text.trim() === "" ? [] : text.split(" ");
}

function hatBuchstaben(text: string): boolean {
    return /\p{L}/u.test(text);
}

/** Klingt der Text wie ein Satz statt wie ein Stichwort? */
function istSatz(text: string): boolean {
    return woerter(text).length >= 6;
}

/** Offensichtlicher Müll, der nie eine Vokabel ist. */
function istMuell(text: string): boolean {
    if (text === "") return false;
    if (!hatBuchstaben(text)) return true;
    if (WIEDERHOLUNG.test(text)) return true;
    if (/https?:\/\/|www\.|@[^\s]+\./iu.test(text)) return true;
    if (KOPFZEILE.test(text) && woerter(text).length <= 2) return true;
    return false;
}

/** Nimmt ein beliebiges Modellobjekt und macht daraus ein Paar. */
function paarAus(eintrag: unknown): OcrPaar | null {
    if (!eintrag || typeof eintrag !== "object") return null;
    const o = eintrag as Record<string, unknown>;
    const lies = (...schluessel: string[]): string => {
        for (const s of schluessel) {
            const wert = o[s];
            if (typeof wert === "string" && wert.trim() !== "") return wert;
        }
        return "";
    };
    const frage = lies("frage", "deutsch", "source", "word", "begriff");
    const antwort = lies("antwort", "fremdsprache", "englisch", "translation", "target", "uebersetzung");
    if (frage === "" && antwort === "") return null;
    return { frage, antwort };
}

/**
 * Paare bereinigen: Nummerierung weg, leere und doppelte raus, Müll raus.
 *
 * Unvollständige Paare (eine Seite fehlt) bleiben absichtlich stehen – die
 * Oberfläche markiert sie bereits als „Übersetzung fehlt“. Nur komplett leere
 * Zeilen fliegen raus.
 */
export function bereinigeOcrPaare(
    roh: unknown,
    optionen: { maxPaare?: number; bestehende?: readonly OcrPaar[] } = {},
): OcrBereinigt {
    const max = optionen.maxPaare ?? 150;
    const liste = Array.isArray(roh)
        ? roh
        : roh && typeof roh === "object"
          ? ((roh as Record<string, unknown>).paare ??
            (roh as Record<string, unknown>).vokabeln ??
            (roh as Record<string, unknown>).pairs ??
            [])
          : [];

    const gesehen = new Set((optionen.bestehende ?? []).map((p) => paarSchluessel(p.frage, p.antwort)));
    const paare: OcrPaar[] = [];
    let leer = 0;
    let doppelt = 0;
    let verworfen = 0;

    if (!Array.isArray(liste)) {
        return { paare, leer, doppelt, verworfen };
    }

    for (const eintrag of liste) {
        const rohPaar = paarAus(eintrag);
        if (!rohPaar) {
            leer += 1;
            continue;
        }

        const frage = normalisiereSeite(rohPaar.frage);
        const antwort = normalisiereSeite(rohPaar.antwort);

        if (frage === "" && antwort === "") {
            leer += 1;
            continue;
        }
        if (istMuell(frage) || istMuell(antwort)) {
            verworfen += 1;
            continue;
        }
        if (frage !== "" && antwort !== "" && frage.toLowerCase() === antwort.toLowerCase()) {
            verworfen += 1;
            continue;
        }
        if (istSatz(frage) || istSatz(antwort)) {
            verworfen += 1;
            continue;
        }
        if (
            frage.length > MAX_SEITENLAENGE * 2 ||
            antwort.length > MAX_SEITENLAENGE * 2 ||
            woerter(frage).length > MAX_WOERTER * 2 ||
            woerter(antwort).length > MAX_WOERTER * 2
        ) {
            verworfen += 1;
            continue;
        }

        const schluessel = paarSchluessel(frage, antwort);
        if (frage !== "" && antwort !== "" && gesehen.has(schluessel)) {
            doppelt += 1;
            continue;
        }
        if (frage !== "" && antwort !== "") gesehen.add(schluessel);

        if (frage === "" || antwort === "") {
            // Einseitige Paare werden gezeigt, aber nicht als Dublette geführt.
            paare.push({ frage, antwort });
            continue;
        }

        paare.push({ frage, antwort });
        if (paare.length >= max) break;
    }

    return { paare, leer, doppelt, verworfen };
}

/**
 * Paare aus Textblock- oder Dateiimport normalisieren.
 *
 * Anders als bei OCR bleibt hier alles stehen, was nicht leer oder doppelt
 * ist: der Nutzer hat den Text selbst geschrieben, da wird nicht aussortiert.
 */
export function normalisiereImport<T extends OcrPaar>(
    paare: readonly T[],
    optionen: { bestehende?: readonly OcrPaar[] } = {},
): { paare: T[]; leer: number; doppelt: number } {
    const gesehen = new Set((optionen.bestehende ?? []).map((p) => paarSchluessel(p.frage, p.antwort)));
    const ergebnis: T[] = [];
    let leer = 0;
    let doppelt = 0;

    for (const paar of paare) {
        const frage = normalisiereSeite(paar.frage);
        const antwort = normalisiereSeite(paar.antwort);

        if (frage === "" && antwort === "") {
            leer += 1;
            continue;
        }
        if (frage !== "" && antwort !== "") {
            const schluessel = paarSchluessel(frage, antwort);
            if (gesehen.has(schluessel)) {
                doppelt += 1;
                continue;
            }
            gesehen.add(schluessel);
        }
        ergebnis.push({ ...paar, frage, antwort });
    }

    return { paare: ergebnis, leer, doppelt };
}

/**
 * Wie deutsch klingt der Text? 0 = gar nicht, ab etwa 2,5 deutlich.
 *
 * Bewusst grob: Umlaute, Artikel, Funktionswörter. Das ist kein
 * Sprachdetektor, sondern ein Hinweis, ob eine Seite im falschen Feld steht.
 * Kurze Wörter wie „in“ sind mehrdeutig und zählen deshalb wenig.
 */
export function siehtDeutschAus(text: string): number {
    const tokens = text.toLowerCase().match(/[\p{L}]+/gu) ?? [];
    let wert = 0;
    for (const token of tokens) {
        if (DE_ARTIKEL.has(token)) wert += 2.5;
        else if (DE_STOPP.has(token)) wert += 1.25;
        else if (/[äöüß]/u.test(token)) wert += 1.5;
        else if (/(?:sch|ung|keit|heit|chen|lein|lich|isch)$/u.test(token)) wert += 0.6;
    }
    return Math.min(wert, 8);
}

function siehtEnglischAus(text: string): number {
    const tokens = text.toLowerCase().match(/[\p{L}]+/gu) ?? [];
    let wert = 0;
    for (const token of tokens) {
        if (EN_STOPP.has(token)) wert += 1.5;
    }
    return Math.min(wert, 6);
}

/**
 * Verdächtige Zeilen finden. Es wird nichts geändert und nichts gelöscht –
 * nur markiert, damit der Mensch hinschaut.
 */
export function pruefePaare(
    paare: readonly OcrPaar[],
    optionen: { sprache?: string | null } = {},
): OcrBefund[] {
    const lerntDeutsch = optionen.sprache === "de";
    const befunde: OcrBefund[] = [];
    const antwortZaehler = new Map<string, number>();

    for (const paar of paare) {
        const antwortSchluessel = normalisiereSeite(paar.antwort).toLowerCase();
        if (antwortSchluessel) {
            antwortZaehler.set(antwortSchluessel, (antwortZaehler.get(antwortSchluessel) ?? 0) + 1);
        }
    }

    const gefuellt = paare.filter((p) => p.frage !== "" || p.antwort !== "").length;

    paare.forEach((paar, index) => {
        const gruende: string[] = [];
        const frage = paar.frage.trim();
        const antwort = paar.antwort.trim();
        const deutschFrage = siehtDeutschAus(frage);
        const deutschAntwort = siehtDeutschAus(antwort);

        if (!lerntDeutsch && /^(?:der|die|das|den|dem|des|ein|eine|einen|einem|einer)\b/iu.test(antwort) &&
            !/^(?:der|die|das|den|dem|des|ein|eine|einen|einem|einer)\b/iu.test(frage)) {
            gruende.push("Antwort sieht deutsch aus – Seiten vertauscht?");
        }

        if (
            !lerntDeutsch &&
            deutschFrage >= 2.5 &&
            deutschAntwort >= 2.5 &&
            siehtEnglischAus(frage) < 1.5 &&
            siehtEnglischAus(antwort) < 1.5
        ) {
            gruende.push("Beide Seiten sehen deutsch aus.");
        }

        if (frage !== "" && antwort !== "" && frage.toLowerCase() === antwort.toLowerCase()) {
            gruende.push("Beide Seiten sind gleich.");
        }

        if (/\d/u.test(frage) || /\d/u.test(antwort)) {
            gruende.push("Enthält Zahlen.");
        }

        if (woerter(frage).length > MAX_WOERTER || woerter(antwort).length > MAX_WOERTER) {
            gruende.push("Sehr viele Wörter – Beispielsatz statt Vokabel?");
        }

        if (antwort.length > MAX_SEITENLAENGE) {
            gruende.push("Antwort ist ungewöhnlich lang.");
        }

        if ((frage !== "" && !hatBuchstaben(frage)) || (antwort !== "" && !hatBuchstaben(antwort))) {
            gruende.push("Enthält keinen Text.");
        }

        const anzahl = antwortZaehler.get(antwort.toLowerCase()) ?? 0;
        if (gefuellt >= 4 && anzahl >= 3 && anzahl >= Math.ceil(gefuellt * 0.2)) {
            gruende.push("Diese Antwort steht mehrfach in der Liste – Spalten verrutscht?");
        }

        if (gruende.length > 0) befunde.push({ index, text: gruende.join(" ") });
    });

    return befunde;
}
