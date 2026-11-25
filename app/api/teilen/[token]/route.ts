import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { migrationsMeldung } from "@/lib/db-fehler";
import { datenbankFehler } from "@/lib/api-fehler";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: Ctx) {
  const { token } = await context.params;
  if (!token) return NextResponse.json({ error: "Token fehlt" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("geteiltes_set_abrufen", { p_token: token });

  if (error) {
    const migration = migrationsMeldung(error);
    if (migration) return NextResponse.json({ error: migration }, { status: 503 });
    return datenbankFehler(error, "teilen-get");
  }

  if (!data) return NextResponse.json({ error: "Geteiltes Set nicht gefunden" }, { status: 404 });

  return NextResponse.json({ set: data });
}
