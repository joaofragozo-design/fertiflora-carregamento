-- ============================================================
-- FERTI FLORA — Ordem de Carregamento
-- Migration 003: Auto-criação de profiles
--
-- Garante que todo usuário criado no Supabase Auth tenha
-- automaticamente um registro em public.profiles.
--
-- Duas camadas:
--   1. Trigger em auth.users → cria profile no INSERT
--   2. Função auxiliar para upsert manual (fallback do frontend)
-- ============================================================

-- ─── LIMPEZA (idempotente) ───────────────────────────────────
drop trigger if exists trg_on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.upsert_profile(uuid, text, text, user_role);

-- ─── FUNÇÃO: criada com SECURITY DEFINER ─────────────────────
-- SECURITY DEFINER executa como o owner da função (postgres),
-- ignorando a RLS de profiles. Necessário porque o trigger
-- dispara no contexto do auth schema, fora do authenticated role.
--
-- search_path fixado em 'public' por segurança (evita hijack via
-- search_path poisoning em schemas maliciosos).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name  text;
  v_role  user_role;
begin
  -- Nome: tenta raw_user_meta_data, fallback = parte local do email
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'name'),       ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'),  ''),
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    split_part(new.email, '@', 1)
  );

  -- Role: tenta raw_user_meta_data, default = operador_carregamento
  -- Cast defensivo: se o valor não existir no enum, usa o default
  begin
    v_role := coalesce(
      (new.raw_user_meta_data->>'role')::user_role,
      'operador_carregamento'::user_role
    );
  exception when invalid_text_representation then
    v_role := 'operador_carregamento'::user_role;
  end;

  insert into public.profiles (id, email, name, role)
  values (new.id, new.email, v_name, v_role)
  on conflict (id) do nothing;  -- Idempotente: não sobrescreve profile existente

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Trigger: cria automaticamente um profile em public.profiles quando '
  'um usuário é inserido em auth.users.';

-- ─── TRIGGER: dispara após INSERT em auth.users ──────────────
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ─── FUNÇÃO DE UPSERT: usada pelo frontend como fallback ─────
-- Chamada pelo AuthService quando getProfile() retorna null.
-- Também usada no provisionamento manual de usuários.
-- Não sobrescreve name/role se o profile já existir.

create or replace function public.upsert_profile(
  p_id    uuid,
  p_email text,
  p_name  text,
  p_role  user_role default 'operador_carregamento'
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  insert into public.profiles (id, email, name, role)
  values (p_id, p_email, p_name, p_role)
  on conflict (id) do update
    set
      -- Só atualiza email se mudou (rename de conta)
      email      = excluded.email,
      -- NÃO sobrescreve name/role — preserva edições manuais do admin
      updated_at = now()
  returning * into v_profile;

  return v_profile;
end;
$$;

comment on function public.upsert_profile(uuid, text, text, user_role) is
  'Fallback: garante que o profile existe sem sobrescrever dados editados pelo admin.';

-- ─── BACKFILL: cria profiles para usuários auth já existentes ─
-- Executado uma vez durante a migration.
-- Usa split_part(email, '@', 1) como nome para usuários sem metadata.

insert into public.profiles (id, email, name, role)
select
  u.id,
  u.email,
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'name'),       ''),
    nullif(trim(u.raw_user_meta_data->>'full_name'),  ''),
    split_part(u.email, '@', 1)
  ),
  coalesce(
    (
      case
        when u.raw_user_meta_data->>'role' in ('operador_carregamento', 'operador_pa', 'admin')
        then (u.raw_user_meta_data->>'role')::user_role
        else null
      end
    ),
    'operador_carregamento'::user_role
  )
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
);

-- ─── GRANT: permite que authenticated role chame a função ────
-- Necessário para o fallback do frontend funcionar sem service role key.
grant execute on function public.upsert_profile(uuid, text, text, user_role)
  to authenticated;
