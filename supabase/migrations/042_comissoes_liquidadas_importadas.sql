-- Descobrimos que o relatório RFT159 na verdade sai em duas exportações
-- distintas do ERP, com o MESMO layout de colunas mas universos diferentes:
--
-- 1) "Geral" (já importado em comissoes_erp_importadas, migration 041):
--    cobre um intervalo de emissão limitado e quase nunca tem Dt Pagto
--    preenchido (histórico de contratos/vencimentos, não de pagamentos).
--    Usada pra "a pagar" (Dt Vencto) e "projeção" (Dt Emissao).
--
-- 2) "Liquidadas" (nova, esta tabela): sem limite de emissão (cobre anos
--    mais antigos que a "geral" não cobre) e 100% das linhas têm Dt Pagto
--    preenchido -- é a fonte confiável de "já liquidada". Mesmo layout de
--    colunas do RFT159, mesma reconciliação total a cada importação.
--
-- Como as duas fontes se sobrepõem parcialmente (a mesma nota/parcela pode
-- aparecer nas duas, uma vez como "ainda a vencer" e outra já como paga),
-- o cálculo de "a pagar" precisa excluir qualquer linha que já apareça
-- aqui como liquidada -- ver src/lib/comissoes/calculos.ts.

create table public.comissoes_liquidadas_importadas (
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

create index comissoes_liquidadas_vendedor_emissao_idx on public.comissoes_liquidadas_importadas(vendedor_codigo, emissao);
create index comissoes_liquidadas_vendedor_pagamento_idx on public.comissoes_liquidadas_importadas(vendedor_codigo, pagamento);

alter table public.comissoes_liquidadas_importadas enable row level security;

create policy "admin ve todas as comissoes liquidadas" on public.comissoes_liquidadas_importadas
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "vendedor ve suas comissoes liquidadas" on public.comissoes_liquidadas_importadas
  for select using (
    exists (
      select 1 from public.vendedores_comerciais vc
      where vc.profile_id = auth.uid() and vc.codigo = comissoes_liquidadas_importadas.vendedor_codigo
    )
  );

create policy "admin insere comissoes liquidadas" on public.comissoes_liquidadas_importadas
  for insert with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "admin remove comissoes liquidadas" on public.comissoes_liquidadas_importadas
  for delete using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
