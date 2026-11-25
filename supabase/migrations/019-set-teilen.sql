-- =============================================================================
-- 019: Set teilen – öffentlicher Read-only-Link per Token
--
-- Ziel: Ein Set-Besitzer kann ein Set explizit freigeben. Wer den Link kennt,
-- sieht eine öffentliche Vorschau/Lernseite und kann das Set ins eigene Konto
-- kopieren. Kein öffentliches Verzeichnis, keine durchsuchbaren IDs.
--
-- Sicherheit:
--   - share_token ist zufällig (md5(random()+clock)), nicht erratbar.
--   - Nur Besitzer darf teilen/entteilen (über normale RLS + API).
--   - Öffentlicher Zugriff läuft über SECURITY DEFINER RPC mit festem
--     search_path; sie gibt nur freigegebene Felder zurück.
--   - Karten anderer, nicht geteilter Sets bleiben durch RLS geschützt.
-- =============================================================================

alter table public.karteikarten_sets
  add column if not exists share_token text,
  add column if not exists geteilt_am timestamptz;

create unique index if not exists karteikarten_sets_share_token_idx
  on public.karteikarten_sets (share_token)
  where share_token is not null;

-- Token erzeugen/rotieren. Nur Besitzer; gibt den neuen Token zurück.
create or replace function public.set_teilen_aktivieren(p_set_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_token text;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  v_token := encode(gen_random_bytes(18), 'base64url');

  update public.karteikarten_sets
     set share_token = v_token,
         geteilt_am = now()
   where id = p_set_id
     and user_id = v_user
  returning share_token into v_token;

  if v_token is null then
    raise exception 'Set nicht gefunden.' using errcode = 'P0002';
  end if;

  return v_token;
end;
$$;

revoke execute on function public.set_teilen_aktivieren(uuid) from public;
grant execute on function public.set_teilen_aktivieren(uuid) to authenticated;

-- Teilen deaktivieren. Token wird entfernt, alte Links werden ungültig.
create or replace function public.set_teilen_deaktivieren(p_set_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_rows int;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;

  update public.karteikarten_sets
     set share_token = null,
         geteilt_am = null
   where id = p_set_id
     and user_id = v_user;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'Set nicht gefunden.' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.set_teilen_deaktivieren(uuid) from public;
grant execute on function public.set_teilen_deaktivieren(uuid) to authenticated;

-- Öffentliche Read-only-Ansicht eines geteilten Sets. Gibt keine user_id,
-- keine E-Mail, keine Fortschrittsdaten anderer Nutzer zurück.
create or replace function public.geteiltes_set_abrufen(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_set record;
  v_karten jsonb;
begin
  if p_token is null or btrim(p_token) = '' then
    return null;
  end if;

  select s.id, s.slug, s.name, s.sprache_code,
         coalesce(sp.name, s.sprache) as sprache_name,
         coalesce(sp.flaeche, '#17232B') as sprache_flaeche,
         coalesce(sp.akzent, '#E7B14A') as sprache_akzent,
         s.geteilt_am
    into v_set
    from public.karteikarten_sets s
    left join public.sprachen sp on sp.code = s.sprache_code
   where s.share_token = btrim(p_token)
   limit 1;

  if v_set.id is null then
    return null;
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'frage', k.frage,
             'antwort', k.antwort,
             'beispielsatz', k.beispielsatz,
             'beispielUebersetzung', k.beispiel_uebersetzung
           )
           order by k.created_at asc, k.id asc
         ), '[]'::jsonb)
    into v_karten
    from (
      select frage, antwort, beispielsatz, beispiel_uebersetzung, created_at, id
        from public.karten
       where set_id = v_set.id
       order by created_at asc, id asc
       limit 200
    ) k;

  return jsonb_build_object(
    'name', v_set.name,
    'slug', v_set.slug,
    'sprache', jsonb_build_object(
      'code', coalesce(v_set.sprache_code, 'unbekannt'),
      'name', v_set.sprache_name,
      'flaeche', v_set.sprache_flaeche,
      'akzent', v_set.sprache_akzent
    ),
    'geteiltAm', v_set.geteilt_am,
    'kartenAnzahl', (select count(*)::int from public.karten where set_id = v_set.id),
    'karten', v_karten
  );
end;
$$;

revoke execute on function public.geteiltes_set_abrufen(text) from public;
grant execute on function public.geteiltes_set_abrufen(text) to anon, authenticated;
