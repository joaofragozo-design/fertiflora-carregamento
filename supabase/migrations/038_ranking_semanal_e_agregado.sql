-- Duas adições ao Ranking Comercial:
--
-- 1) Marca vendedores "agregados" (Fertiflora #90, Outros #215 -- totais/
--    catch-all que não são pessoas de venda de verdade) pra sair da
--    disputa: não recebem colocação e vão pro fim da lista. Coluna
--    editável pelo admin (não hardcoded por código no frontend), pra
--    servir também se um caso parecido aparecer no futuro.
--
-- 2) Funções agregadas pra alimentar os mini-rankings semanais (Top 3
--    vendas faturadas da semana, Top 3 pedidos aprovados da semana).
--    Não dá pra fazer isso com select direto do client: RLS de
--    notas_fiscais_importadas e pedidos só libera o vendedor ver as
--    próprias linhas, mas o Ranking já é uma tela pública pra qualquer
--    autenticado (mesmo padrão de faturamento_comercial). As funções são
--    security definer e só devolvem o agregado por vendedor -- nunca uma
--    linha detalhada (cliente, preço, etc).

alter table public.vendedores_comerciais
  add column if not exists agregado boolean not null default false;

update public.vendedores_comerciais set agregado = true where codigo in (90, 215);

create or replace function public.ranking_vendas_semana(p_inicio date, p_fim date)
returns table (vendedor_codigo integer, toneladas numeric)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select n.vendedor_codigo, sum(n.peso_liquido_kg) / 1000
    from public.notas_fiscais_importadas n
    where n.emissao between p_inicio and p_fim and n.un = 'KG'
    group by n.vendedor_codigo;
end;
$$;

grant execute on function public.ranking_vendas_semana(date, date) to authenticated;

create or replace function public.ranking_pedidos_semana(p_inicio timestamptz, p_fim timestamptz)
returns table (vendedor_id uuid, toneladas numeric)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select p.vendedor_id, sum(p.quantidade_toneladas)
    from public.pedidos p
    where p.status = 'aprovado_credito' and p.decidido_em between p_inicio and p_fim
    group by p.vendedor_id;
end;
$$;

grant execute on function public.ranking_pedidos_semana(timestamptz, timestamptz) to authenticated;
