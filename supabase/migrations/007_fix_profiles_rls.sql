-- FERTI FLORA — Migration 007: Corrige recursão infinita nas policies de profiles
--
-- PROBLEMA:
--   A policy "profiles_select_admin" consultava a própria tabela profiles para
--   verificar se o usuário é admin, causando recursão infinita:
--
--     SELECT em profiles
--       → avalia policy "profiles_select_admin"
--         → SELECT em profiles (para checar role = 'admin')
--           → avalia policy "profiles_select_admin"
--             → loop infinito
--
-- SOLUÇÃO:
--   Remover todas as policies existentes de profiles e recriar com duas regras
--   simples que NÃO consultam a própria tabela:
--
--   1. Usuário lê apenas o próprio profile    →  auth.uid() = id
--   2. Admin lê todos os profiles             →  auth.jwt() ->> 'role' = 'admin'
--      (lê a role do JWT, não da tabela)
--
-- NOTA SOBRE ADMIN VIA JWT:
--   Para a regra do admin funcionar, a role precisa estar no JWT do usuário.
--   Isso é feito via custom claim no Supabase (hook ou função SQL).
--   Enquanto não houver claim, o admin usa a regra do próprio profile (auth.uid() = id)
--   e consegue ler o seu próprio profile normalmente.
--   Para o sistema atual (cada usuário lê o próprio profile), apenas a regra 1 já resolve.

-- ─── Remove todas as policies antigas de profiles ─────────────────────────────
drop policy if exists "profiles_select_own"   on public.profiles;
drop policy if exists "profiles_select_admin" on public.profiles;
drop policy if exists "profiles_insert_own"   on public.profiles;
drop policy if exists "profiles_update_own"   on public.profiles;
drop policy if exists "profiles_delete_own"   on public.profiles;

-- Remove quaisquer outras policies que possam existir em profiles
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
  loop
    execute format('drop policy if exists %I on public.profiles', pol.policyname);
  end loop;
end $$;

-- ─── Recria policies sem recursão ─────────────────────────────────────────────

-- Regra 1: qualquer usuário autenticado lê apenas o seu próprio profile
-- Sem subquery → sem recursão
create policy "profiles_select_own"
  on public.profiles
  for select
  using (auth.uid() = id);

-- Regra 2: usuário autenticado pode inserir/atualizar apenas o seu próprio profile
-- (usado pelo trigger de auto-criação via service_role, mas protege também requests diretos)
create policy "profiles_insert_own"
  on public.profiles
  for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles
  for update
  using  (auth.uid() = id)
  with check (auth.uid() = id);
