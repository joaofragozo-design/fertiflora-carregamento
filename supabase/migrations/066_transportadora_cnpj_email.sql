-- ============================================================
-- FERTI FLORA — Migration 066: CNPJ e e-mail no cadastro de transportadora
-- ============================================================
-- Campos apenas informativos por enquanto (sem validação de formato nem
-- obrigatoriedade) — preparação pra uso futuro, como vincular o envio de
-- nota fiscal à transportadora.

alter table public.transportadoras
  add column if not exists cnpj  text,
  add column if not exists email text;
