-- "Minhas Comissões" (tela estilo fatura): guarda o detalhe linha-a-linha do
-- relatório RFT159 (Relatório de Comissionados) do ERP -- uma linha por
-- nota/parcela comissionável.
--
-- Dt Pagto = data que o CLIENTE pagou aquele título (não é a data que o
-- vendedor recebeu a comissão em mãos) -- é o que libera/"liquida" a
-- comissão daquela linha. Quando vazio, o título ainda não foi pago pelo
-- cliente, então a comissão ainda não foi liquidada.
--
-- Ciclo de pagamento da empresa: dia 21 do mês anterior a dia 20 do mês
-- atual. "Comissão já liquidada este mês" = soma onde Dt Pagto cai no
-- ciclo. "Comissão a pagar este mês" = Dt Pagto vazio e Dt Vencto cai no
-- ciclo. "Projeção dos próximos meses" = soma por Dt Emissao (nota já
-- lançada, ainda não venceu).
--
-- Mesma estratégia de reconciliação total das outras tabelas importadas do
-- ERP: cada importação substitui o conteúdo inteiro.

create table public.comissoes_erp_importadas (
  id                    uuid primary key default gen_random_uuid(),
  vendedor_codigo       integer not null,
  vendedor_nome         text not null,
  nota                  text,
  pedido                text,
  cliente_codigo        integer,
  cliente_nome          text not null,
  emissao               date not null,
  vencimento            date,
  pagamento             date,
  parcela               integer not null default 0,
  valor_pago            numeric not null default 0,
  valor_frete           numeric not null default 0,
  despesa_adicional     numeric not null default 0,
  valor_desconto        numeric not null default 0,
  liquido               numeric not null default 0,
  percentual_comissao   numeric not null default 0,
  valor_comissao        numeric not null default 0,
  importado_em          timestamptz not null default now()
);

create index comissoes_erp_vendedor_emissao_idx on public.comissoes_erp_importadas(vendedor_codigo, emissao);
create index comissoes_erp_vendedor_vencimento_idx on public.comissoes_erp_importadas(vendedor_codigo, vencimento);
create index comissoes_erp_vendedor_pagamento_idx on public.comissoes_erp_importadas(vendedor_codigo, pagamento);

alter table public.comissoes_erp_importadas enable row level security;

create policy "admin ve todas as comissoes importadas" on public.comissoes_erp_importadas
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "vendedor ve suas comissoes importadas" on public.comissoes_erp_importadas
  for select using (
    exists (
      select 1 from public.vendedores_comerciais vc
      where vc.profile_id = auth.uid() and vc.codigo = comissoes_erp_importadas.vendedor_codigo
    )
  );

create policy "admin insere comissoes importadas" on public.comissoes_erp_importadas
  for insert with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "admin remove comissoes importadas" on public.comissoes_erp_importadas
  for delete using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
