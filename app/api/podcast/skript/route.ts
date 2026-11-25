import { NextResponse } from "next/server";
import { mitUserOder401 } from "@/lib/supabase/user";
import { datenbankFehler } from "@/lib/api-fehler";
import {
  MAX_PODCAST_KARTEN,
  bauePodcastPrompt,
  bereinigeSkriptText,
  normalisiereGrundsprache,
  waehlePodcastKarten,
  type PodcastKarte,
} from "@/lib/podcast";

export const maxDuration = 30;

type KartenZeile = {
  frage: string;
  antwort: string;
  beispielsatz: string | null;
  beispiel_uebersetzung: string | null;
};

type SetZeile = {
  id: string;
  name: string;
  sprache: string | null;
  sprache_code: string | null;
};

export async function POST(request: Request) {
  const { supabase, antwort: nichtAngemeldet } = await mitUserOder401();
  if (nichtAngemeldet) return nichtAngemeldet;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { setSlug, grundsprache } = (body ?? {}) as {
    setSlug?: unknown;
    grundsprache?: unknown;
  };

  const slug = typeof setSlug === "string" ? setSlug.trim() : "";
  if (!slug) {
    return NextResponse.json({ error: "Set fehlt" }, { status: 400 });
  }

  const grundspracheText = normalisiereGrundsprache(grundsprache);

  const { data: set, error: setFehler } = await supabase
    .from("karteikarten_sets")
    .select("id, name, sprache, sprache_code")
    .eq("slug", slug)
    .maybeSingle<SetZeile>();

  if (setFehler) return datenbankFehler(setFehler, "podcast-set");
  if (!set) return NextResponse.json({ error: "Set nicht gefunden" }, { status: 404 });

  const { data: kartenData, error: kartenFehler } = await supabase
    .from("karten")
    .select("frage, antwort, beispielsatz, beispiel_uebersetzung")
    .eq("set_id", set.id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(200);

  if (kartenFehler) return datenbankFehler(kartenFehler, "podcast-karten");

  const karten: PodcastKarte[] = ((kartenData ?? []) as KartenZeile[]).map((k) => ({
    frage: k.frage,
    antwort: k.antwort,
    beispielsatz: k.beispielsatz,
    beispielUebersetzung: k.beispiel_uebersetzung,
  }));

  if (karten.length === 0) {
    return NextResponse.json({ error: "Dieses Set hat noch keine Vokabeln." }, { status: 400 });
  }

  const ausgewaehlt = waehlePodcastKarten(karten, MAX_PODCAST_KARTEN);
  const spracheName = set.sprache?.trim() || set.sprache_code || "Zielsprache";
  const prompt = bauePodcastPrompt({
    setName: set.name,
    spracheName,
    grundsprache: grundspracheText,
    karten: ausgewaehlt,
  });

  const schluessel = process.env.GROQ_API_KEY;
  if (!schluessel) {
    return NextResponse.json({ error: "GROQ_API_KEY fehlt auf dem Server." }, { status: 503 });
  }

  const steuerung = new AbortController();
  const timeout = setTimeout(() => steuerung.abort(), 25_000);
  try {
    const antwort = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${schluessel}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        temperature: 0.5,
        max_tokens: 900,
        response_format: { type: "json_object" },
      }),
      signal: steuerung.signal,
    });

    if (!antwort.ok) {
      const detail = (await antwort.text()).slice(0, 300);
      console.error(`[podcast-skript] Groq ${antwort.status}: ${detail}`);
      let nutzerFehler = "Podcast-Skript konnte nicht erzeugt werden.";
      if (antwort.status === 401 || antwort.status === 403) nutzerFehler = "Podcast-Dienst ist nicht richtig konfiguriert (API-Zugriff).";
      if (antwort.status === 429) nutzerFehler = "Podcast-Dienst ist gerade ausgelastet. Bitte kurz warten und erneut versuchen.";
      if (/model_terms_required|terms acceptance/i.test(detail)) nutzerFehler = "Podcast-Dienst muss noch im Groq-Dashboard freigeschaltet werden (Model Terms).";
      return NextResponse.json({ error: nutzerFehler }, { status: 502 });
    }

    const daten = (await antwort.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const inhalt = daten.choices?.[0]?.message?.content ?? "";
    const match = inhalt.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ error: "Podcast-Antwort war unlesbar." }, { status: 502 });
    }
    const objekt = JSON.parse(match[0]) as { titel?: unknown; skript?: unknown };
    const titel = typeof objekt.titel === "string" && objekt.titel.trim()
      ? objekt.titel.trim().slice(0, 120)
      : `Lern-Podcast: ${set.name}`;
    const skript = typeof objekt.skript === "string" ? bereinigeSkriptText(objekt.skript) : "";
    if (!skript) {
      return NextResponse.json({ error: "Podcast-Skript war leer." }, { status: 502 });
    }

    return NextResponse.json({
      titel,
      skript,
      grundsprache: grundspracheText,
      spracheName,
      kartenAnzahl: ausgewaehlt.length,
      audioVerfuegbar: false,
      audioHinweis:
        "Audio ist derzeit nur eingeschränkt verfügbar: Groq TTS unterstützt nativ Englisch/Arabisch und benötigt akzeptierte Model-Terms. Das Skript kannst du herunterladen oder in einer anderen TTS-App verwenden.",
    });
  } catch (fehler) {
    const abgebrochen = fehler instanceof Error && fehler.name === "AbortError";
    console.error(`[podcast-skript] ${fehler instanceof Error ? fehler.message : String(fehler)}`);
    return NextResponse.json(
      { error: abgebrochen ? "Podcast-Erzeugung hat zu lange gedauert." : "Podcast-Skript konnte nicht erzeugt werden." },
      { status: abgebrochen ? 504 : 500 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
