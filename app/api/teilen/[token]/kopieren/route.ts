import { NextResponse } from "next/server";
import { mitUserOder401 } from "@/lib/supabase/user";
import { slugifySetzName } from "@/lib/set-slug";
import { migrationsMeldung } from "@/lib/db-fehler";
import { datenbankFehler } from "@/lib/api-fehler";

type Ctx = { params: Promise<{ token: string }> };

type Geteilt = {
  name: string;
  sprache: { code?: string; name?: string };
  karten: Array<{ frage: string; antwort: string; beispielsatz?: string | null; beispielUebersetzung?: string | null }>;
};

export async function POST(_request: Request, context: Ctx) {
  const { supabase, user, antwort } = await mitUserOder401();
  if (antwort) return antwort;
  const { token } = await context.params;

  const { data, error } = await supabase.rpc("geteiltes_set_abrufen", { p_token: token });
  if (error) {
    const migration = migrationsMeldung(error);
    if (migration) return NextResponse.json({ error: migration }, { status: 503 });
    return datenbankFehler(error, "teilen-kopieren-get");
  }
  if (!data) return NextResponse.json({ error: "Geteiltes Set nicht gefunden" }, { status: 404 });

  const geteilt = data as Geteilt;
  const basisName = `${geteilt.name || "Geteiltes Set"} (Kopie)`.slice(0, 60);
  const basis = slugifySetzName(basisName) || "geteiltes-set";
  const spracheCode = typeof geteilt.sprache?.code === "string" ? geteilt.sprache.code : null;
  const spracheName = typeof geteilt.sprache?.name === "string" ? geteilt.sprache.name : "Unbekannt";

  for (let versuch = 1; versuch <= 20; versuch++) {
    const slug = versuch === 1 ? basis : `${basis}-${versuch}`;
    const { data: vorhanden } = await supabase.from("karteikarten_sets").select("id").eq("slug", slug).maybeSingle();
    if (vorhanden) continue;

    const { data: set, error: setFehler } = await supabase
      .from("karteikarten_sets")
      .insert({
        slug,
        name: basisName,
        sprache: spracheName,
        sprache_code: spracheCode,
        anzahl_karten: 0,
        eigenes_set: true,
        user_id: user.id,
      })
      .select("id, slug, name")
      .single();

    if (setFehler) {
      if (setFehler.code === "23505") continue;
      const migration = migrationsMeldung(setFehler);
      if (migration) return NextResponse.json({ error: migration }, { status: 503 });
      return datenbankFehler(setFehler, "teilen-kopieren-set");
    }

    const karten = Array.isArray(geteilt.karten) ? geteilt.karten : [];
    if (karten.length > 0) {
      const payload = karten.slice(0, 200).map((k) => ({
        set_id: set.id,
        frage: String(k.frage ?? "").slice(0, 200),
        antwort: String(k.antwort ?? "").slice(0, 200),
        beispielsatz: k.beispielsatz ? String(k.beispielsatz).slice(0, 300) : null,
        beispiel_uebersetzung: k.beispielUebersetzung ? String(k.beispielUebersetzung).slice(0, 300) : null,
      })).filter((k) => k.frage && k.antwort);

      if (payload.length > 0) {
        const { error: kartenFehler } = await supabase.from("karten").insert(payload);
        if (kartenFehler) {
          await supabase.from("karteikarten_sets").delete().eq("id", set.id).eq("user_id", user.id);
          const migration = migrationsMeldung(kartenFehler);
          if (migration) return NextResponse.json({ error: migration }, { status: 503 });
          return datenbankFehler(kartenFehler, "teilen-kopieren-karten");
        }
        await supabase.from("karteikarten_sets").update({ anzahl_karten: payload.length }).eq("id", set.id);
      }
    }

    return NextResponse.json({ set: { id: set.id, slug: set.slug, name: set.name } }, { status: 201 });
  }

  return NextResponse.json({ error: "Konnte keinen freien Namen finden." }, { status: 409 });
}
