-- ============================================================
-- FERTI FLORA — Migration 044: limite de crédito dos clientes
-- ============================================================
-- Espelha a planilha "Limites de crédito" (controlada pelo financeiro) pro
-- vendedor conseguir ver, dentro do próprio app, quanto o cliente dele
-- ainda pode comprar. Mesmo padrão de sync já usado pelas fórmulas:
-- Apps Script -> POST /api/creditos/sync -> esta tabela.
--
-- cliente_codigo é resolvido por NOME (a planilha de crédito não tem
-- código de cliente nem CNPJ) contra notas_fiscais_importadas/
-- pedidos_erp_importados -- fica null quando não há correspondência
-- confiável (nome não bate com nenhum código, ou bate com mais de um
-- código diferente). Nesses casos o sync devolve o nome em
-- `sem_correspondencia` pro financeiro corrigir a grafia na planilha.
--
-- Escrita só pelo sync (service role, bypassa RLS) -- não existe tela de
-- edição manual desses dados dentro do app. Leitura liberada a qualquer
-- autenticado (mesmo padrão de vendedores_comerciais/formulas): o vendedor
-- só busca pelo cliente_codigo do próprio cliente, então não enxerga nada
-- que não seja seu por essa via.

create table public.clientes_limite_credito (
  id                uuid primary key default gen_random_uuid(),
  cliente_nome_raw  text not null,
  cliente_nome_norm text not null unique,
  cliente_codigo    integer,
  vendedor_nome_raw text,
  status_credito    text not null default '',
  limite_liberado   numeric not null default 0,
  atualizado_em     timestamptz not null default now()
);

create index idx_clientes_limite_credito_codigo on public.clientes_limite_credito(cliente_codigo);

alter table public.clientes_limite_credito enable row level security;

create policy "autenticado ve limites de credito" on public.clientes_limite_credito
  for select using (auth.role() = 'authenticated');
