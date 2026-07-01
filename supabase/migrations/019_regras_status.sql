-- ============================================================
-- FERTI FLORA — Migration 019: regras de status de carga
-- ============================================================
-- (1) Não pode FINALIZAR uma carga que não foi iniciada.
-- (2) Não pode haver DUAS cargas em andamento no mesmo dia.
-- Checagens só disparam na TRANSIÇÃO (evita travar edições de linhas já ativas).

create or replace function public.valida_status_ordem_diaria()
returns trigger
language plpgsql
as $$
begin
  -- (1) finalizar exige ter iniciado
  if new.finalizado and not old.finalizado and not new.iniciado then
    raise exception 'Não é possível finalizar uma carga que não foi iniciada.';
  end if;

  -- (2) só uma carga em andamento por dia (verifica na transição para "em andamento")
  if new.iniciado and not new.finalizado
     and not (old.iniciado and not old.finalizado) then
    if exists (
      select 1 from public.ordens_diarias
      where data = new.data and id <> new.id
        and iniciado = true and finalizado = false
    ) then
      raise exception 'Já existe uma carga em andamento. Finalize-a antes de iniciar outra.';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_valida_status_ordem_diaria
  before update on public.ordens_diarias
  for each row execute function public.valida_status_ordem_diaria();
