-- Preços de venda (100% à vista, USD/tonelada) usados pela calculadora de
-- cotação do FertiFlora Vendas. Tabela separada de `formulas` (que guarda
-- composição/ingredientes) porque a lista de nomes da "TABELA DE VENDAS
-- NOVA" não bate 1:1 com a de `formulas` (tem entradas extras, duplicadas
-- por nome de propósito na planilha de origem etc.).
create table if not exists public.formula_precos (
  id                bigint generated always as identity primary key,
  nome              text not null unique,
  preco_usd_avista  numeric(10,2) not null,
  created_at        timestamptz not null default now()
);

alter table public.formula_precos enable row level security;

create policy "formula_precos_select_authenticated"
  on public.formula_precos for select
  to authenticated
  using (true);
