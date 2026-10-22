import { NextResponse } from "next/server";

import { mitUserOder401 } from "@/lib/supabase/user";
import { bereinigeOcrPaare } from "@/lib/vokabel-ocr";

/*
 * Vokabeln aus einem Foto (Plan 2.4).
 *
 * Der eigentliche Extraktor ist ein Vision-Modell bei Groq. Diese Route hält
 * drei Dinge davon getrennt, weil sie unterschiedlich oft kaputtgehen:
 *
 *   1. Modellwahl und Fehler – Modelle werden abgeschaltet, Limits ändern sich.
 *   2. Der Prompt – er entscheidet, was als Vokabel gilt.
 *   3. Das Aufräumen und Prüfen – passiert hier im Code, nicht im Modell.
 *
 * Punkt 3 liegt in lib/vokabel-ocr.ts, damit App und Web dieselbe Antwort
 * bekommen. Das Modell bekommt nur das Foto; Nummerierung, Dubletten und
 * Müll wegzuräumen ist Sisyphos-Arbeit und keine Modellaufgabe.
 */

/** Groq nennt für Vision-Bilder rund 4 MB Base64; darunter bleiben wir. */
const MAX_BASE64 = 4 * 1024 * 1024;

/** Ein Bild, bis zu 150 Paare – 4096 Ausgabe-Token reichen dafür bequem. */
const MAX_AUSGABE = 4096;

export const maxDuration = 60;

/**
 * Das Vision-Modell. Über die Umgebung austauschbar, weil die Groq-Modelle
 * schnell wechseln: llama-4-scout und -maverick wurden 2026 abgeschaltet,
 * aktuell trägt qwen3.8-27b die Bilderkennung.
 */
function modell(): string {
    return process.env.GROQ_VISION_MODEL ?? "qwen/qwen3.8-27b";
}

function prompt(): string {
    return `Du bist ein präziser OCR-Extraktor für gedruckte Vokabelbücher. Du bekommst ein Foto einer Seite. Extrahiere ausschließlich Vokabelpaare. Antworte nur mit JSON nach dem vorgegebenen Schema, ohne Erklärungen und ohne Markdown.

So liest du die Seite:
- Lies von oben nach unten. In Tabellen Zeile für Zeile, innerhalb einer Zeile von links nach rechts.
- Eine Seite kann mehrere Spaltenpaare enthalten (z. B. Deutsch | Englisch | Deutsch | Englisch). Entscheide die Zusammengehörigkeit über die Zeile und die Sprache, nicht über eine feste Spaltenzahl.
- Umgebrochene Tabellenzellen gehören zu einem Eintrag. Führe sie zusammen.
- Überschriften, Spaltenüberschriften, Einheiten, Seitenzahlen, Grammatiktabellen, Merkkästen, Aufgaben und Beispielsätze sind keine Vokabeln. Nutze Überschriften nur, um die Sprache einer Spalte zu erkennen.
- Nummerierungen (1., 2), a), -, •) und Aufzählungszeichen gehören nicht zum Wort.
- Beispielsätze sind nur Kontext. Übernimm nie den ganzen Beispielsatz. Steht in einer Zeile „word – example“, nimm nur „word“. Ist das Stichwort fett gedruckt, nimm das fette Wort. Wenn du Stichwort und Beispielsatz nicht sicher trennen kannst, überspringe die Zeile.
- Deutsch gehört immer in „frage“, die Fremdsprache in „antwort“. Steht die Fremdsprache links, drehe das Paar.
- Erkenne Deutsch an Umlauten (ä ö ü ß), typischen Funktionswörtern (der, die, das, ein, und, ist, nicht, mit, für, auf, von, zu) und der Großschreibung von Nomen. Verlasse dich nicht auf die Spaltenposition.
- Wenn auf der Seite keine deutsche Seite erkennbar ist, nimm die linke Spalte als „frage“ und die rechte als „antwort“. Erfinde keine deutsche Übersetzung.
- Mehrwortausdrücke, reflexive Verben und Phrasen bleiben vollständig („sich freuen auf“, „to look forward to“). Entferne keine Leerzeichen innerhalb eines Begriffs.
- Übernimm Umlaute, Akzente und Sonderzeichen exakt. Korrigiere nur offensichtliche OCR-Fehler, wenn das Wort sonst keinen Sinn ergibt; im Zweifel exakt übernehmen.
- Erfinde nichts, übersetze nichts und ergänze keine Wörter, die nicht auf dem Bild stehen.
- Keine Duplikate.
- Wenn keine Vokabel erkennbar ist, gib eine leere Liste zurück.`;
}

type GroqAntwort = {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    error?: { message?: string };
};

/** Klammern zählen, dabei Strings und Escapes übergehen. */
function erstesJson(text: string): string | null {
    const start = text.search(/[[{]/u);
    if (start < 0) return null;
    const oeffner = text[start];
    const schliesser = oeffner === "{" ? "}" : "]";
    let tiefe = 0;
    let imString = false;
    let escape = false;

    for (let i = start; i < text.length; i++) {
        const zeichen = text[i];
        if (escape) {
            escape = false;
            continue;
        }
        if (zeichen === "\\") {
            escape = true;
            continue;
        }
        if (zeichen === '"') {
            imString = !imString;
            continue;
        }
        if (imString) continue;
        if (zeichen === oeffner) tiefe++;
        else if (zeichen === schliesser) {
            tiefe--;
            if (tiefe === 0) return text.slice(start, i + 1);
        }
    }
    return null;
}

/** Modellantwort zu einem Objekt machen, so gut es ohne Modell geht. */
function parseAntwort(inhalt: string): unknown {
    const sauber = inhalt.replace(/```(?:json)?/giu, "").replace(/[„“”]/gu, '"').trim();
    const kandidaten = [sauber, erstesJson(sauber)].filter((t): t is string => Boolean(t));
    for (const kandidat of kandidaten) {
        try {
            return JSON.parse(kandidat);
        } catch {
            try {
                return JSON.parse(kandidat.replace(/,\s*([}\]])/gu, "$1"));
            } catch {
                // nächster Versuch
            }
        }
    }
    return null;
}

/** Warten, ohne den Event-Loop zu blockieren. */
function warte(ms: number): Promise<void> {
    return new Promise((fertig) => setTimeout(fertig, ms));
}

/** Aus `x-ratelimit-reset-tokens` („7.66s“, „1m26.4s“) Sekunden machen. */
function resetSekunden(wert: string | null): number | null {
    if (!wert) return null;
    const treffer = wert.trim().match(/^(?:(\d+)m)?([\d.]+)s$/u);
    if (!treffer) return null;
    return Number(treffer[1] ?? 0) * 60 + Number(treffer[2]);
}

function groqFehler(status: number, text: string): { meldung: string; status: number } {
    if (status === 429) {
        return {
            meldung: "Gerade sind zu viele Fotos unterwegs. Versuch es in einer Minute noch einmal.",
            status: 429,
        };
    }
    if (status === 413) {
        return { meldung: "Das Foto ist zu groß. Bitte ein kleineres wählen.", status: 413 };
    }
    if (status === 401 || status === 403) {
        return { meldung: "OCR ist nicht konfiguriert.", status: 503 };
    }
    if (status >= 500) {
        return { meldung: "Die Bilderkennung antwortet gerade nicht.", status: 502 };
    }
    const kurz = text.slice(0, 160).replace(/\s+/gu, " ");
    console.error(`[ocr] Groq ${status}: ${kurz}`);
    return { meldung: "Das Foto konnte nicht gelesen werden.", status: 502 };
}

export async function POST(req: Request) {
    const { user } = await mitUserOder401();
    if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

    let rumpf: unknown;
    try {
        rumpf = await req.json();
    } catch {
        return NextResponse.json({ error: "Ungültiges JSON." }, { status: 400 });
    }

    const bild = (rumpf as { bild?: unknown })?.bild;
    if (typeof bild !== "string" || !/^data:image\/(?:jpeg|jpg|png|webp);base64,/u.test(bild)) {
        return NextResponse.json(
            { error: "Kein gültiges Bild. Erlaubt sind JPEG, PNG und WebP." },
            { status: 400 },
        );
    }

    const base64 = bild.slice(bild.indexOf(",") + 1);
    if (base64.length > MAX_BASE64) {
        return NextResponse.json(
            { error: "Das Foto ist zu groß. Bitte ein kleineres wählen." },
            { status: 413 },
        );
    }

    const schluessel = process.env.GROQ_API_KEY;
    if (!schluessel) {
        return NextResponse.json({ error: "OCR ist nicht konfiguriert." }, { status: 503 });
    }

    const koerper = {
        model: modell(),
        messages: [
            { role: "system", content: prompt() },
            {
                role: "user",
                content: [
                    { type: "text", text: "Extrahiere alle Vokabelpaare aus diesem Bild." },
                    { type: "image_url", image_url: { url: bild } },
                ],
            },
        ],
        temperature: 0,
        top_p: 0.8,
        max_completion_tokens: MAX_AUSGABE,
        reasoning_effort: "none",
        response_format: { type: "json_object" },
    };

    /*
     * Zwei Versuche, nicht mehr. Ein 429 ohne kurzes Warten wird nicht
     * ausgesessen: Serverless-Funktionen haben ein Zeitlimit, und die
     * Anfragequote gehört der ganzen Organisation. Lieber ehrlich melden.
     */
    let letzterFehler: { meldung: string; status: number } | null = null;
    for (let versuch = 0; versuch < 2; versuch++) {
        const abbruch = new AbortController();
        const wecker = setTimeout(() => abbruch.abort(), 28_000);
        try {
            const antwort = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${schluessel}`,
                },
                body: JSON.stringify(koerper),
                signal: abbruch.signal,
            });

            if (!antwort.ok) {
                const text = await antwort.text();
                const fehler = groqFehler(antwort.status, text);
                letzterFehler = fehler;

                if (antwort.status === 429 && versuch === 0) {
                    const nach =
                        Number(antwort.headers.get("retry-after")) ||
                        resetSekunden(antwort.headers.get("x-ratelimit-reset-tokens")) ||
                        0;
                    if (nach > 0 && nach <= 5) {
                        await warte(nach * 1000);
                        continue;
                    }
                }
                if (antwort.status >= 500 && versuch === 0) {
                    await warte(400 + Math.random() * 400);
                    continue;
                }
                return NextResponse.json({ error: fehler.meldung }, { status: fehler.status });
            }

            const daten = (await antwort.json()) as GroqAntwort;
            const inhalt = daten.choices?.[0]?.message?.content ?? "";
            const fertig = daten.choices?.[0]?.finish_reason;

            const geparst = parseAntwort(inhalt);
            const bereinigt = bereinigeOcrPaare(geparst);

            if (bereinigt.paare.length === 0) {
                /*
                 * Leer kann heißen: kein Text im Bild, oder die Ausgabe wurde
                 * abgeschnitten. Bei „length“ lohnt ein zweiter Versuch.
                 */
                if (fertig === "length" && versuch === 0) {
                    koerper.messages[0] = {
                        role: "system",
                        content:
                            prompt() +
                            "\n- Die Antwort war zu lang. Übernimm höchstens 80 Paare und lass den Rest weg.",
                    };
                    continue;
                }
                return NextResponse.json({
                    paare: [],
                    leer: bereinigt.leer,
                    doppelt: bereinigt.doppelt,
                    verworfen: bereinigt.verworfen,
                });
            }

            return NextResponse.json({
                paare: bereinigt.paare,
                leer: bereinigt.leer,
                doppelt: bereinigt.doppelt,
                verworfen: bereinigt.verworfen,
                abgeschnitten: fertig === "length",
            });
        } catch (fehler: unknown) {
            const abgebrochen = fehler instanceof Error && fehler.name === "AbortError";
            letzterFehler = {
                meldung: abgebrochen
                    ? "Die Bilderkennung hat zu lange gebraucht. Bitte noch einmal versuchen."
                    : "Die Bilderkennung ist nicht erreichbar.",
                status: abgebrochen ? 504 : 502,
            };
            if (!abgebrochen && versuch === 0) {
                await warte(500);
                continue;
            }
            return NextResponse.json({ error: letzterFehler.meldung }, { status: letzterFehler.status });
        } finally {
            clearTimeout(wecker);
        }
    }

    return NextResponse.json(
        { error: letzterFehler?.meldung ?? "Das Foto konnte nicht gelesen werden." },
        { status: letzterFehler?.status ?? 502 },
    );
}
