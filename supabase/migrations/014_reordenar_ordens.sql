-- ============================================================
-- FERTI FLORA — Migration 014: reordenar ordens (prioridade)
-- ============================================================
-- O Fransua define a ordem de carregamento. Trocar a posição de
-- duas ordens exige trocar a `sequencia` — mas há UNIQUE(data, sequencia),
-- então a troca direta colide. Esta função faz o swap de forma ATÔMICA
-- usando um valor temporário (-1), tudo numa transação.
--
-- p_dir < 0  → sobe a prioridade (carrega antes)
-- p_dir > 0  → desce a prioridade (carrega depois)

create or replace function public.mover_ordem(p_id uuid, p_dir int)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_data      date;
  v_seq       smallint;
  v_other_id  uuid;
  v_other_seq smallint;
begin
  select data, sequencia into v_data, v_seq
    from public.ordens_diarias where id = p_id;
  if not found then return; end if;

  -- vizinho imediato na direção desejada
  if p_dir < 0 then
    select id, sequencia into v_other_id, v_other_seq
      from public.ordens_diarias
      where data = v_data and sequencia < v_seq
      order by sequencia desc limit 1;
  else
    select id, sequencia into v_other_id, v_other_seq
      from public.ordens_diarias
      where data = v_data and sequencia > v_seq
      order by sequencia asc limit 1;
  end if;

  if v_other_id is null then return; end if;  -- já está no topo / fim

  -- swap com valor temporário para não violar o UNIQUE(data, sequencia)
  update public.ordens_diarias set sequencia = -1          where id = p_id;
  update public.ordens_diarias set sequencia = v_seq       where id = v_other_id;
  update public.ordens_diarias set sequencia = v_other_seq where id = p_id;
end;
$$;

grant execute on function public.mover_ordem(uuid, int) to authenticated;
