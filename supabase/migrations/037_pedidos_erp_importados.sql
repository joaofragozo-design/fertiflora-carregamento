-- BI do Cliente: guarda o detalhe linha-a-linha do relatório de Pedidos de
-- Vendas do ERP (VPE — "pedidos em aberto", um pedido/item por linha) para
-- mostrar, dentro do BI do cliente, o que já foi contratado mas ainda não
-- foi totalmente carregado.
--
-- PS PEDIDO = peso do pedido original; PS SALDO = peso que ainda falta
-- carregar; "carregado" = PS PEDIDO - PS SALDO (não é armazenado, é
-- calculado na hora). Mesma estratégia de reconciliação total das outras
-- tabelas importadas do ERP: o CSV exportado sempre traz o snapshot
-- completo dos pedidos em aberto no momento da exportação, então cada
-- importação substitui o conteúdo inteiro.

create table public.pedidos_erp_importados (
  id               uuid primary key default gen_random_uuid(),
  vendedor_codigo  integer not null,
  vendedor_nome    text not null,
  cliente_codigo   integer not null,
  cliente_nome     text not null,
  numero_pedido    text not null,
  emissao          date not null,
  entrega          date,
  produto          text not null,
  status           text,
  un               text not null,
  quantidade_pedida numeric not null default 0,
  quantidade_saldo  numeric not null default 0,
  peso_pedido_kg    numeric not null default 0,
  peso_saldo_kg     numeric not null default 0,
  valor_total       numeric not null default 0,
  valor_saldo       numeric not null default 0,
  importado_em      timestamptz not null default now()
);

create index pedidos_erp_vendedor_cliente_idx on public.pedidos_erp_importados(vendedor_codigo, cliente_codigo, emissao);
create index pedidos_erp_cliente_idx on public.pedidos_erp_importados(cliente_codigo, emissao);

alter table public.pedidos_erp_importados enable row level security;

create policy "admin ve todos os pedidos erp importados" on public.pedidos_erp_importados
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "vendedor ve seus pedidos erp importados" on public.pedidos_erp_importados
  for select using (
    exists (
      select 1 from public.vendedores_comerciais vc
      where vc.profile_id = auth.uid() and vc.codigo = pedidos_erp_importados.vendedor_codigo
    )
  );

create policy "admin insere pedidos erp importados" on public.pedidos_erp_importados
  for insert with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "admin remove pedidos erp importados" on public.pedidos_erp_importados
  for delete using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
