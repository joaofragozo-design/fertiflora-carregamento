-- ============================================================
-- FERTI FLORA — Migration 005: Username-based auth
--
-- Adiciona coluna `username` à tabela profiles.
-- Login passa a usar email fake: username@fertiflora.local
-- ============================================================

-- ─── Adiciona coluna username (nullable primeiro para backfill) ──

alter table public.profiles
  add column if not exists username text;

-- Backfill: extrai username do email fake (antes do @fertiflora.local)
-- Para emails reais legados, usa a parte local do email como fallback
update public.profiles
set username = split_part(email, '@', 1)
where username is null;

-- Agora torna não-nulo e único
alter table public.profiles
  alter column username set not null,
  add constraint profiles_username_unique unique (username);

-- ─── Recria trigger handle_new_user com suporte a username ──────

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
  v_name     text;
  v_role     user_role;
begin
  -- Username: tenta metadata, depois extrai do email fake
  v_username := coalesce(
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    split_part(new.email, '@', 1)
  );

  -- Nome: tenta metadata, fallback = username capitalizado
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'name'),       ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'),  ''),
    initcap(replace(v_username, '_', ' '))
  );

  -- Role: tenta metadata, default = operador_carregamento
  begin
    v_role := coalesce(
      (new.raw_user_meta_data->>'role')::user_role,
      'operador_carregamento'::user_role
    );
  exception when invalid_text_representation then
    v_role := 'operador_carregamento'::user_role;
  end;

  insert into public.profiles (id, username, email, name, role)
  values (new.id, v_username, new.email, v_name, v_role)
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ─── Recria upsert_profile com parâmetro p_username ─────────────

drop function if exists public.upsert_profile(uuid, text, text, user_role);

create or replace function public.upsert_profile(
  p_id       uuid,
  p_username text,
  p_email    text,
  p_name     text,
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
  insert into public.profiles (id, username, email, name, role)
  values (p_id, p_username, p_email, p_name, p_role)
  on conflict (id) do update
    set
      username   = excluded.username,
      email      = excluded.email,
      updated_at = now()
  returning * into v_profile;

  return v_profile;
end;
$$;

grant execute on function public.upsert_profile(uuid, text, text, text, user_role)
  to authenticated;

comment on column public.profiles.username is
  'Username de login. O email no Supabase Auth é username@fertiflora.local';
