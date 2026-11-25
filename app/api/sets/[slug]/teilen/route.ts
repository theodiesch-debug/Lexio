import { NextResponse } from "next/server";
import { mitUserOder401 } from "@/lib/supabase/user";
import { migrationsMeldung } from "@/lib/db-fehler";
import { datenbankFehler } from "@/lib/api-fehler";

type Ctx = { params: Promise<{ slug: string }> };

async function eigenesSetId(
  supabase: Awaited<ReturnType<typeof mitUserOder401>>["supabase"],
  userId: string,
  slug: string,
): Promise<{ id: string } | { antwort: NextResponse }> {
  const { data, error } = await supabase
    .from("karteikarten_sets")
    .select("id, user_id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    const migration = migrationsMeldung(error);
    if (migration) return { antwort: NextResponse.json({ error: migration }, { status: 503 }) };
    return { antwort: datenbankFehler(error, "sets-teilen") };
  }
  if (!data || data.user_id !== userId) {
    return { antwort: NextResponse.json({ error: "Set nicht gefunden" }, { status: 404 }) };
  }
  return { id: data.id };
}

export async function GET(_request: Request, context: Ctx) {
  const { supabase, user, antwort } = await mitUserOder401();
  if (antwort) return antwort;
  const { slug } = await context.params;
  const geprueft = await eigenesSetId(supabase, user.id, slug);
  if ("antwort" in geprueft) return geprueft.antwort;

  const { data, error } = await supabase
    .from("karteikarten_sets")
    .select("share_token, geteilt_am")
    .eq("id", geprueft.id)
    .maybeSingle();

  if (error) {
    const migration = migrationsMeldung(error);
    if (migration) return NextResponse.json({ error: migration }, { status: 503 });
    return datenbankFehler(error, "sets-teilen-get");
  }

  return NextResponse.json({
    teilen: {
      aktiv: Boolean(data?.share_token),
      token: data?.share_token ?? null,
      geteiltAm: data?.geteilt_am ?? null,
    },
  });
}

export async function POST(_request: Request, context: Ctx) {
  const { supabase, user, antwort } = await mitUserOder401();
  if (antwort) return antwort;
  const { slug } = await context.params;
  const geprueft = await eigenesSetId(supabase, user.id, slug);
  if ("antwort" in geprueft) return geprueft.antwort;

  const { data, error } = await supabase.rpc("set_teilen_aktivieren", {
    p_set_id: geprueft.id,
  });

  if (error) {
    const migration = migrationsMeldung(error);
    if (migration) return NextResponse.json({ error: migration }, { status: 503 });
    return datenbankFehler(error, "sets-teilen-post");
  }

  return NextResponse.json({
    teilen: { aktiv: true, token: String(data), geteiltAm: new Date().toISOString() },
  });
}

export async function DELETE(_request: Request, context: Ctx) {
  const { supabase, user, antwort } = await mitUserOder401();
  if (antwort) return antwort;
  const { slug } = await context.params;
  const geprueft = await eigenesSetId(supabase, user.id, slug);
  if ("antwort" in geprueft) return geprueft.antwort;

  const { error } = await supabase.rpc("set_teilen_deaktivieren", {
    p_set_id: geprueft.id,
  });

  if (error) {
    const migration = migrationsMeldung(error);
    if (migration) return NextResponse.json({ error: migration }, { status: 503 });
    return datenbankFehler(error, "sets-teilen-delete");
  }

  return NextResponse.json({ teilen: { aktiv: false, token: null, geteiltAm: null } });
}
