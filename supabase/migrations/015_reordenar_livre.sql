-- ============================================================
-- FERTI FLORA — Migration 015: reordenação livre (arrastar)
-- ============================================================
-- O Fransua arrasta uma ordem para qualquer posição (ex.: da 7 para a 2).
-- O cliente envia a lista COMPLETA de ids na nova ordem; a função reatribui
-- a `sequencia` (1..N) de forma atômica, usando um range temporário para não
-- violar o UNIQUE(data, sequencia).

drop function if exists public.mover_ordem(uuid, int);

create or replace function public.reordenar_ordens(p_data date, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- desloca todas as ordens do dia para um range temporário (evita colisão)
  update public.ordens_diarias
    set sequencia = sequencia + 10000
    where data = p_data;

  -- aplica a nova ordem: posição no array (1..N) vira a nova sequencia
  update public.ordens_diarias o
    set sequencia = t.ord::smallint
    from unnest(p_ids) with ordinality as t(id, ord)
    where o.id = t.id and o.data = p_data;
end;
$$;

grant execute on function public.reordenar_ordens(date, uuid[]) to authenticated;
