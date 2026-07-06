-- Contrato de venda (Pedido): vendedor escolhe uma cotação válida, define
-- quantidade e embalagem, gera o PDF do contrato e solicita aprovação do
-- Admin. Precisa de nome completo/telefone do vendedor para preencher o
-- cabeçalho do contrato (hoje só existe username/apelido).

alter table public.profiles
  add column if not exists nome_completo text,
  add column if not exists telefone text;

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references auth.users(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  cotacao_id uuid not null references public.cotacoes(id) on delete restrict,
  numero_contrato text,
  quantidade_toneladas numeric not null,
  embalagem text not null check (embalagem in ('saco_50kg', 'bag_750kg', 'bag_1000kg')),
  status text not null default 'rascunho' check (status in ('rascunho', 'aguardando_aprovacao', 'aprovado', 'rejeitado')),
  dados jsonb not null,
  created_at timestamptz not null default now(),
  solicitado_em timestamptz,
  decidido_em timestamptz,
  decidido_por uuid references auth.users(id),
  motivo_rejeicao text
);

alter table public.pedidos enable row level security;

-- Vendedor gerencia só os próprios pedidos.
create policy "vendedor gerencia seus pedidos"
  on public.pedidos
  for all
  using (vendedor_id = auth.uid())
  with check (vendedor_id = auth.uid());

-- Admin enxerga e decide (aprova/rejeita) qualquer pedido. Subquery contra
-- `profiles` (tabela diferente de `pedidos`) -- não é recursivo.
create policy "admin ve todos os pedidos"
  on public.pedidos
  for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "admin decide todos os pedidos"
  on public.pedidos
  for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create index if not exists pedidos_vendedor_idx on public.pedidos(vendedor_id, created_at desc);
create index if not exists pedidos_status_idx on public.pedidos(status, created_at desc);
