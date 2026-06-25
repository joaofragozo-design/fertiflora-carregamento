-- Migration 008: Adiciona coluna insumo_prefs a profiles
--
-- Armazena preferências de insumos por usuário:
--   pinned  — insumos fixados no topo
--   hidden  — insumos ocultos da lista principal
--   custom  — insumos criados manualmente e salvos como atalho

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS insumo_prefs jsonb
  NOT NULL
  DEFAULT '{"pinned":[],"hidden":[],"custom":[]}'::jsonb;

-- A policy profiles_update_own (auth.uid() = id) já cobre esta coluna.
-- Nenhuma alteração de RLS necessária.
