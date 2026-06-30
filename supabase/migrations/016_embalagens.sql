-- ============================================================
-- FERTI FLORA — Migration 016: embalagens (SACOS, BAG 750kg, BAG 1000kg)
-- ============================================================
-- Antes: SACOS (50kg) e BAGS (750kg).
-- Agora: SACOS (50kg), BAG_750 (750kg) e BAG_1000 (1000kg).
-- A coluna `tons` é GERADA, então precisa ser recriada com a nova regra
-- (Postgres não permite alterar a expressão de uma coluna gerada).

-- 1. remove o CHECK e a coluna gerada
alter table public.ordens_diarias drop constraint if exists ordens_diarias_embalagem_check;
alter table public.ordens_diarias drop column if exists tons;

-- 2. migra os BAGS existentes para o novo código (mesmo peso: 750kg)
update public.ordens_diarias set embalagem = 'BAG_750' where embalagem = 'BAGS';

-- 3. novo CHECK com as 3 embalagens
alter table public.ordens_diarias
  add constraint ordens_diarias_embalagem_check
  check (embalagem in ('SACOS', 'BAG_750', 'BAG_1000'));

-- 4. recria `tons`: saco 50kg, bag 750kg, bag 1000kg
alter table public.ordens_diarias
  add column tons numeric(10,4) generated always as (
    case embalagem
      when 'SACOS'    then quantidade * 0.05
      when 'BAG_750'  then quantidade * 0.75
      when 'BAG_1000' then quantidade * 1.0
      else 0
    end
  ) stored;
