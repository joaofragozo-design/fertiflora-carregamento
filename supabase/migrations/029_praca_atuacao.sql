-- Praça de atuação é um campo fixo definido pelo próprio vendedor (cada um
-- atua numa região específica), não algo calculado a partir do histórico de
-- cotações.

alter table public.profiles
  add column if not exists praca_atuacao text;
