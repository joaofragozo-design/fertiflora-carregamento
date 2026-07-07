-- Corrige 2 problemas encontrados em revisão da migration 038:
--
-- 1) O frontend calculava o início/fim da semana em horário local (BRT,
--    UTC-3) e depois convertia pra UTC via toISOString() antes de mandar
--    pro parâmetro `date` da função -- .slice(0,10) de um Date UTC-3
--    convertido pra UTC "vaza" pra segunda-feira da semana seguinte
--    (domingo 23:59:59 BRT = segunda ~03:00 UTC). Resultado: toda nota
--    fiscal emitida na segunda-feira seguinte entrava na soma da semana
--    atual, todo santo dia -- não era um caso raro, era sistemático.
--
-- 2) As funções aceitavam p_inicio/p_fim livres do client -- sem RLS de
--    verdade, quem chamasse a RPC direto (não pela tela) podia pedir um
--    intervalo gigante (reconstruir o histórico linha a linha) ou um
--    intervalo minúsculo (isolar o tonelagem exato de um pedido/nota
--    específico que a RLS de pedidos/notas_fiscais_importadas normalmente
--    esconde de outros vendedores).
--
-- Fix pras duas coisas de uma vez: as funções não recebem mais parâmetro
-- nenhum -- calculam a semana atual (segunda a domingo) inteiramente
-- dentro do Postgres, no fuso de Brasil. Sem parâmetro, não tem intervalo
-- pra manipular.

drop function if exists public.ranking_vendas_semana(date, date);
drop function if exists public.ranking_pedidos_semana(timestamptz, timestamptz);

create or replace function public.ranking_vendas_semana()
returns table (vendedor_codigo integer, toneladas numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inicio date := date_trunc('week', now() at time zone 'America/Sao_Paulo')::date;
  v_fim date := v_inicio + 6;
begin
  return query
    select n.vendedor_codigo, sum(n.peso_liquido_kg) / 1000
    from public.notas_fiscais_importadas n
    where n.emissao between v_inicio and v_fim and n.un = 'KG'
    group by n.vendedor_codigo;
end;
$$;

grant execute on function public.ranking_vendas_semana() to authenticated;

create or replace function public.ranking_pedidos_semana()
returns table (vendedor_id uuid, toneladas numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inicio timestamptz := date_trunc('week', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  v_fim timestamptz := v_inicio + interval '7 days';
begin
  return query
    select p.vendedor_id, sum(p.quantidade_toneladas)
    from public.pedidos p
    where p.status = 'aprovado_credito' and p.decidido_em >= v_inicio and p.decidido_em < v_fim
    group by p.vendedor_id;
end;
$$;

grant execute on function public.ranking_pedidos_semana() to authenticated;
