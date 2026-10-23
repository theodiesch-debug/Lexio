import { NextResponse } from "next/server";
import { mitUserOder401 } from "@/lib/supabase/user";
import { datenbankFehler } from "@/lib/api-fehler";

/**
 * Push-Abonnement des angemeldeten Kontos verwalten.
 *
 * POST speichert ein Gerät-Abo (Web-Push), DELETE entfernt es. Beides nur
 * für das eigene Konto: die RLS-Policies der Tabelle push_abonnements
 * koppeln jede Zeile an user_id, und der Server reicht die Session aus dem
 * Cookie weiter. Ein Abo, das über dieses API angelegt wird, gehört also zur
 * Person, die das Cookie hat – nicht zu irgendwem.
 *
 * Wofür die Schlüssel da sind: der Browser bekommt vom Push-Dienst einen
 * endpoint plus zwei Schlüssel (p256dh für die Nachricht, auth für die
 * Berechtigung). Der Server speichert sie, und scripts/erinnerung-senden.mjs
 * liest sie beim täglichen Versand.
 */

/*
 * Grenzen fuer die Felder. Der Browser liefert kurze Werte; alles, was
 * deutlich darueber liegt, ist kein echtes Abo, sondern ein Versuch, die
 * Datenbank mit Muell zu fuellen oder eine spaetere Server-Anfrage
 * umzuleiten.
 */
const MAX_ENDPOINT = 2048;
const MAX_SCHLUESSEL = 512;

/**
 * Ist die Adresse ein Ziel, das ein Server wirklich ansprechen darf?
 *
 * Der gespeicherte `endpoint` wird nicht vom Browser angesprochen, sondern
 * spaeter vom Versand-Skript (`scripts/erinnerung-senden.mjs`) per
 * `web-push` – also von SERVER-Seite. Damit ist er eine moegliche
 * SSRF-Quelle: wer ein Abo mit `https://169.254.169.254/…` (Cloud-Metadaten)
 * oder `https://10.0.0.5/…` (internes Netz) anlegt, koennte den Server
 * spaeter dazu bringen, eine interne Adresse aufzurufen.
 *
 * Geprueft wird deshalb nicht nur "https", sondern auch der Host:
 *   – keine IP-Literale in privaten, Loopback- oder Link-Local-Bereichen,
 *   – kein `localhost`,
 *   – kein URL-Benutzername/Passwort (koennte eine falsche Adresse
 *     vortaeuschen).
 * Echte Push-Dienste (FCM, Mozilla, Apple, Windows) sind oeffentliche
 * Hostnamen und bestehen diese Pruefung.
 */
function zulaessigerEndpoint(wert: string): boolean {
  if (wert.length === 0 || wert.length > MAX_ENDPOINT) return false;
  let url: URL;
  try {
    url = new URL(wert);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) return false;

  // IPv4-Literal?
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 10) return false; // 10.0.0.0/8
    if (a === 127) return false; // Loopback
    if (a === 0) return false;
    if (a === 169 && b === 254) return false; // Link-Local / Cloud-Metadaten
    if (a === 172 && b >= 16 && b <= 31) return false; // 172.16.0.0/12
    if (a === 192 && b === 168) return false; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT 100.64/10
    return true;
  }

  // IPv6: Loopback, Link-Local, Unique-Local.
  if (host.includes(":")) {
    if (host === "::1" || host === "::") return false;
    if (/^f[cd]/.test(host)) return false; // fc00::/7 unique-local
    if (/^fe[89ab]/.test(host)) return false; // fe80::/10 link-local
    return true;
  }

  return true;
}

export async function POST(request: Request) {
  const { supabase, user, antwort } = await mitUserOder401();
  if (!user) return antwort ?? NextResponse.json({ error: "Bitte zuerst anmelden." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const abo = (body ?? {}) as {
    endpoint?: unknown;
    keys?: unknown;
  };

  if (typeof abo.endpoint !== "string" || !zulaessigerEndpoint(abo.endpoint)) {
    return NextResponse.json({ error: "endpoint fehlt oder ist keine zulässige URL" }, { status: 400 });
  }
  const schluessel = (abo.keys ?? {}) as { p256dh?: unknown; auth?: unknown };
  if (
    typeof schluessel.p256dh !== "string" ||
    schluessel.p256dh.length === 0 ||
    schluessel.p256dh.length > MAX_SCHLUESSEL ||
    typeof schluessel.auth !== "string" ||
    schluessel.auth.length === 0 ||
    schluessel.auth.length > MAX_SCHLUESSEL
  ) {
    return NextResponse.json({ error: "Verschlüsselungsschlüssel fehlen" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("push_abonnements")
    .upsert(
      {
        user_id: user.id,
        endpoint: abo.endpoint,
        keys_p256dh: schluessel.p256dh,
        keys_auth: schluessel.auth,
        zeit_aktuallisiert: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" },
    )
    .select("id")
    .single();

  if (error) {
    return datenbankFehler(error, "push-abonnement");
  }
  return NextResponse.json({ id: data.id }, { status: 200 });
}

export async function DELETE(request: Request) {
  const { supabase, user, antwort } = await mitUserOder401();
  if (!user) return antwort ?? NextResponse.json({ error: "Bitte zuerst anmelden." }, { status: 401 });

  let body: { endpoint?: unknown } = {};
  try {
    const roh: unknown = await request.json();
    if (roh && typeof roh === "object") {
      body = roh as { endpoint?: unknown };
    }
  } catch {
    /* Default: ohne endpoint wird trotzdem gelöscht (alle eigenen Abos). */
  }

  let query = supabase.from("push_abonnements").delete().eq("user_id", user.id);
  if (typeof body.endpoint === "string" && body.endpoint.length > 0) {
    query = query.eq("endpoint", body.endpoint);
  }

  const { error } = await query;
  if (error) {
    return datenbankFehler(error, "push-abonnement");
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}