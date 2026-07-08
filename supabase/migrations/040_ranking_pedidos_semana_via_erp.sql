-- "Top pedidos da semana" passa a vir do relatório de Pedidos de Vendas do
-- ERP (pedidos_erp_importados, o mesmo CSV do BI de cliente) em vez do
-- fluxo interno de aprovação de crédito do app -- reflete pedido novo
-- contratado na semana (peso_pedido_kg, por emissão), não a data em que o
-- admin decidiu a análise de crédito, que pode atrasar dias/semanas em
-- relação à data real do pedido. Mesmo padrão de ranking_vendas_semana:
-- sem parâmetro, semana calculada dentro do Postgres.

drop function if exists public.ranking_pedidos_semana();

create or replace function public.ranking_pedidos_semana()
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
    select p.vendedor_codigo, sum(p.peso_pedido_kg) / 1000
    from public.pedidos_erp_importados p
    where p.emissao between v_inicio and v_fim
    group by p.vendedor_codigo;
end;
$$;

grant execute on function public.ranking_pedidos_semana() to authenticated;
