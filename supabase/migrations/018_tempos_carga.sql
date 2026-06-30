-- ============================================================
-- FERTI FLORA — Migration 018: tempos de carga (cronômetro)
-- ============================================================
-- Registra quando cada ordem foi iniciada/finalizada para medir o tempo
-- de carregamento e o ritmo (ton/h). Os timestamps são preenchidos
-- automaticamente por trigger — o app só alterna iniciado/finalizado.

alter table public.ordens_diarias add column if not exists iniciado_em   timestamptz;
alter table public.ordens_diarias add column if not exists finalizado_em timestamptz;

create or replace function public.set_tempos_ordem_diaria()
returns trigger
language plpgsql
as $$
begin
  -- Início
  if new.iniciado and not old.iniciado then
    new.iniciado_em := coalesce(new.iniciado_em, now());
  elsif not new.iniciado then
    new.iniciado_em := null;
  end if;

  -- Finalização
  if new.finalizado and not old.finalizado then
    new.finalizado_em := now();
    new.iniciado_em   := coalesce(new.iniciado_em, now());
  elsif not new.finalizado then
    new.finalizado_em := null;
  end if;

  return new;
end;
$$;

create trigger trg_tempos_ordem_diaria
  before update on public.ordens_diarias
  for each row execute function public.set_tempos_ordem_diaria();
