-- Continuação de 034 (separada porque um novo valor de enum não pode ser
-- usado na mesma transação em que foi criado).
--
-- Fluxo novo de Pedido:
--   rascunho -> aguardando_conferencia -> [reprovado_conferencia]
--                                       -> aguardando_analise_credito -> [aprovado_credito | reprovado_credito]

alter table public.pedidos drop constraint if exists pedidos_status_check;

-- Migra dados existentes pro vocabulário novo (precisa vir antes da nova
-- constraint, senão o ADD CONSTRAINT valida as linhas antigas e falha).
update public.pedidos set status = 'aguardando_conferencia' where status = 'aguardando_aprovacao';
update public.pedidos set status = 'aprovado_credito' where status = 'aprovado';
update public.pedidos set status = 'reprovado_credito' where status = 'rejeitado';

alter table public.pedidos add constraint pedidos_status_check check (status in (
  'rascunho',
  'aguardando_conferencia',
  'reprovado_conferencia',
  'aguardando_analise_credito',
  'aprovado_credito',
  'reprovado_credito'
));

-- Rastreamento da etapa de conferência (a etapa de crédito reaproveita
-- decidido_em/decidido_por/motivo_rejeicao que já existiam).
alter table public.pedidos add column if not exists conferido_em timestamptz;
alter table public.pedidos add column if not exists conferido_por uuid references auth.users(id);
alter table public.pedidos add column if not exists motivo_reprovacao_conferencia text;

-- Françoa (role conferencia) vê e decide pedidos na etapa dela. Mesma
-- estratégia não-recursiva das outras policies (subquery contra profiles).
create policy "conferencia ve pedidos" on public.pedidos
  for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'conferencia'));

create policy "conferencia decide pedidos" on public.pedidos
  for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'conferencia'));
