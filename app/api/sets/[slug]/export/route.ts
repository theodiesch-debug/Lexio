import { NextResponse } from "next/server";
import { mitUserOder401 } from "@/lib/supabase/user";
import {
  exportDateiname,
  exportMimeType,
  exportText,
  type ExportFormat,
  type ExportPaar,
} from "@/lib/export";

/**
 * Wie viele Karten ein Export maximal enthält.
 *
 * Ein Wortpaar mit Satz sind rund 150 Bytes – 5000 sind damit etwa 750 KB,
 * also eine Datei, die sich noch mühelos öffnen und verschicken lässt. Das
 * ist keine echte Grenze, die jemand trifft: das größte Set im Betrieb hat
 * 1000 Karten (die Lernroute hält dieselbe Zahl). Sie steht hier, damit ein
 * fehlerhafter Aufruf nicht eine Antwort über mehrere Megabyte baut.
 */
const MAX_EXPORT = 5000;

/**
 * Vokabeln eines Sets als Datei – CSV oder TSV.
 *
 * Warum eine eigene Route und kein Download im Client: der Client hat die
 * Karten zwar schon geladen, aber nur bis zu 500 (`MAX_LISTE` in
 * /api/karten, die Antwort sagt `gekuerzt`). Ein Export, der still
 * abschneidet, wäre genau die Sorte Fehler, die man erst beim Import
 * bemerkt. Hier wird der ganze Bestand gelesen, und wenn je doch mehr da
 * wäre als die Grenze, sagt der Antwort-Header `X-Lexio-Gekuerzt` etwas –
 * statt es zu verschweigen.
 *
 * Gelesen wird über RLS: fremde private Sets ergeben `null` und damit 404,
 * Demosets sind für alle da und dürfen exportiert werden (der Export ist
 * eine Leseoperation und zerstört nichts). Ein zusätzlicher Besitzcheck
 * würde hier nur eine zweite Stelle schaffen, an der dieselbe Regel steht –
 * und die würde irgendwann auseinanderfallen.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { supabase, antwort: nichtAngemeldet } = await mitUserOder401();
  if (nichtAngemeldet) return nichtAngemeldet;

  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: "Parameter 'slug' fehlt" }, { status: 400 });
  }

  /*
   * Format aus der Adresse. Der Fallback ist CSV und kein Fehler: „der
   * Export" ohne Zusatz ist in der deutschsprachigen Welt Excel, und ein
   * 400 für eine vergessene Angabe wäre für etwas, das vorne ein
   * Standard hat, ärgerlich als hilfreich.
   */
  const formatRoh = new URL(request.url).searchParams.get("format");
  const format: ExportFormat = formatRoh === "tsv" ? "tsv" : "csv";

  const { data: set, error: setFehler } = await supabase
    .from("karteikarten_sets")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (setFehler) {
    return NextResponse.json({ error: setFehler.message }, { status: 500 });
  }
  if (!set) {
    return NextResponse.json({ error: "Set nicht gefunden" }, { status: 404 });
  }

  /*
   * Zwei Sortierschlüssel, aus demselben Grund wie in GET /api/karten:
   * ein Bulk-Import gibt allen Karten denselben Zeitstempel, und ohne den
   * zweiten Schlüssel könnte die Datei bei jedem Abruf eine andere
   * Reihenfolge haben. Wer exportiert und später importiert, soll dieselbe
   * Reihenfolge wiederfinden.
   */
  const { data, error } = await supabase
    .from("karten")
    .select("frage, antwort, beispielsatz, beispiel_uebersetzung")
    .eq("set_id", set.id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(MAX_EXPORT + 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const roh = (data ?? []) as unknown as ExportPaar[];
  const gekuerzt = roh.length > MAX_EXPORT;
  const karten = gekuerzt ? roh.slice(0, MAX_EXPORT) : roh;

  const text = exportText(karten, format);

  return new NextResponse(text, {
    status: 200,
    headers: {
      "Content-Type": exportMimeType(format),
      // `attachment` und nicht `inline`: der Browser soll speichern, nicht
      // anzeigen. Ein CSV im Browserfenster ist eine Zeile Text, die
      // niemand zuordnen kann.
      "Content-Disposition": `attachment; filename="${exportDateiname(set.slug, format)}"`,
      // Kein Cache: das sind die Vokabeln dieser Person, und ein
      // Proxy-Cache mit Cookie-Fehler wäre ein Datenleck.
      "Cache-Control": "no-store",
      ...(gekuerzt ? { "X-Lexio-Gekuerzt": "ja" } : {}),
    },
  });
}
