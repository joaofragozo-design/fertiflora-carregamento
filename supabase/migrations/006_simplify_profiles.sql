-- ============================================================
-- FERTI FLORA — Migration 006: Simplifica tabela profiles
--
-- Estrutura final: id, username, role, created_at
-- Remove: email, name, active, updated_at
-- ============================================================

-- ─── Remove colunas não necessárias ─────────────────────────

alter table public.profiles
  drop column if exists email,
  drop column if exists name,
  drop column if exists active,
  drop column if exists updated_at;

-- ─── Remove trigger de updated_at em profiles (já não existe a coluna) ──

drop trigger  if exists trg_profiles_updated_at on public.profiles;
drop function if exists public.update_updated_at() cascade;

-- ─── Recria trigger handle_new_user (sem email/name) ────────

drop trigger  if exists trg_on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_role     user_role;
begin
  v_username := coalesce(
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    split_part(new.email, '@', 1)
  );

  begin
    v_role := coalesce(
      (new.raw_user_meta_data->>'role')::user_role,
      'operador_carregamento'::user_role
    );
  exception when invalid_text_representation then
    v_role := 'operador_carregamento'::user_role;
  end;

  insert into public.profiles (id, username, role)
  values (new.id, v_username, v_role)
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ─── Recria upsert_profile sem email/name ───────────────────

drop function if exists public.upsert_profile(uuid, text, text, text, user_role);
drop function if exists public.upsert_profile(uuid, text, text, user_role);

create or replace function public.upsert_profile(
  p_id       uuid,
  p_username text,
  p_role     user_role default 'operador_carregamento'
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  insert into public.profiles (id, username, role)
  values (p_id, p_username, p_role)
  on conflict (id) do update
    set username = excluded.username
  returning * into v_profile;

  return v_profile;
end;
$$;

grant execute on function public.upsert_profile(uuid, text, user_role)
  to authenticated;
