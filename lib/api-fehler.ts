import { NextResponse } from "next/server";

/**
 * Eine Datenbank-Meldung bleibt auf dem Server.
 *
 * Vorher gaben rund ein Dutzend API-Routen `error.message` unveraendert an
 * den Browser weiter. Das ist kein riesiges Loch, aber ein unnoetiges: eine
 * Supabase-Meldung nennt im Klartext Tabellen- und Spaltennamen, verraet
 * etwas ueber die RLS-Policies ("permission denied for table karten") und
 * zeigt bei einem fehlgeschlagenen Insert das ganze fehlerhafte Feld. Wer
 * die Oberflaeche kennt, weiss danach mehr ueber den Aufbau der Datenbank,
 * als er wissen muesste.
 *
 * Der Client bekommt deshalb eine feste, ehrliche deutsche Meldung. Die
 * technische Ursache landet im Server-Log, wo sie fuer die Fehlersuche
 * gebraucht wird – nur eben nicht in der Antwort.
 *
 * Status 500 ist bewusst: es ist ein Serverfehler, und die Oberflaeche
 * behandelt ihn wie bisher (Fehlertext, nochmal versuchen).
 */
const STANDARD = "Datenbankfehler. Bitte kurz warten und es erneut versuchen.";

export function datenbankFehler(
  error: { message?: string; code?: string } | null | undefined,
  kontext: string,
): NextResponse {
  if (error?.message) {
    const code = error.code ? ` (${error.code})` : "";
    console.error(`[api] ${kontext}${code}: ${error.message}`);
  } else {
    console.error(`[api] ${kontext}: unbekannter Fehler`);
  }
  return NextResponse.json({ error: STANDARD }, { status: 500 });
}
