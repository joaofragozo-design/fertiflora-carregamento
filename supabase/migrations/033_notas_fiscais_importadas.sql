-- BI do Cliente: guarda o detalhe linha-a-linha do relatório RFT6 do ERP
-- (Faturamento por Cliente/Produto) para alimentar a tela de BI dentro da
-- Carteira de Clientes -- KPIs, série mensal, comparativo por ano, top
-- produtos e sazonalidade por cliente.
--
-- Cada importação SUBSTITUI o conteúdo inteiro (o CSV exportado do ERP
-- sempre traz o histórico completo desde o início) -- mesma estratégia de
-- reconciliação usada em /api/formulas/sync. Não tem FK pra
-- vendedores_comerciais de propósito: o ERP tem ~26 códigos de vendedor,
-- mais que os 12 hoje rastreados no Ranking, e a tela de BI deve funcionar
-- pra qualquer um deles.

create table public.notas_fiscais_importadas (
  id              uuid primary key default gen_random_uuid(),
  vendedor_codigo integer not null,
  vendedor_nome   text not null,
  cliente_codigo  integer not null,
  cliente_nome    text not null,
  nota            text,
  emissao         date not null,
  produto         text not null,
  municipio       text,
  un              text not null,
  quantidade      numeric not null default 0,
  peso_liquido_kg numeric not null default 0,
  valor_liquido   numeric not null default 0,
  importado_em    timestamptz not null default now()
);

create index notas_fiscais_vendedor_cliente_idx on public.notas_fiscais_importadas(vendedor_codigo, cliente_codigo, emissao);
create index notas_fiscais_cliente_idx on public.notas_fiscais_importadas(cliente_codigo, emissao);

alter table public.notas_fiscais_importadas enable row level security;

-- Admin vê tudo. Vendedor só vê linhas do próprio código, via o vínculo
-- vendedores_comerciais.profile_id (mesmo padrão do Ranking Comercial).
create policy "admin ve todas as notas importadas" on public.notas_fiscais_importadas
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "vendedor ve suas notas importadas" on public.notas_fiscais_importadas
  for select using (
    exists (
      select 1 from public.vendedores_comerciais vc
      where vc.profile_id = auth.uid() and vc.codigo = notas_fiscais_importadas.vendedor_codigo
    )
  );

create policy "admin insere notas importadas" on public.notas_fiscais_importadas
  for insert with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "admin remove notas importadas" on public.notas_fiscais_importadas
  for delete using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
