-- ============================================================
-- FERTI FLORA — Migration 013: ingredientes Boro 10 e FTE BR 12
-- ============================================================
-- Duas fórmulas da planilha usam micronutrientes que não existiam
-- na tabela (Boro 10 e FTE BR 12). Sem essas colunas elas fechavam
-- 950 kg/ton e eram bloqueadas no sync. Adicionando-as, passam a
-- fechar 1000 kg/ton e ficam disponíveis no app.

alter table public.formulas
  add column if not exists boro      numeric(7,4) not null default 0 check (boro >= 0 and boro <= 1),
  add column if not exists fte_br_12 numeric(7,4) not null default 0 check (fte_br_12 >= 0 and fte_br_12 <= 1);
