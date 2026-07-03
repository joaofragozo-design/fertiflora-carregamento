-- Cadastro de clientes (dados de nota fiscal) e cotações salvas, para o app FertiFloraVendas.
-- Cada vendedor só enxerga seus próprios clientes/cotações (carteira individual).

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references auth.users(id) on delete cascade,
  tipo_pessoa text not null check (tipo_pessoa in ('pf', 'pj')),
  nome text not null,
  nome_fantasia text,
  cpf_cnpj text not null,
  inscricao_estadual text,
  telefone text,
  email text,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  created_at timestamptz not null default now()
);

alter table public.clientes enable row level security;

create policy "vendedor gerencia seus clientes"
  on public.clientes
  for all
  using (vendedor_id = auth.uid())
  with check (vendedor_id = auth.uid());

create index if not exists clientes_vendedor_idx on public.clientes(vendedor_id, nome);

create table if not exists public.cotacoes (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references auth.users(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete set null,
  produto text not null,
  preco_vendido numeric not null,
  aprovado boolean not null default true,
  dados jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.cotacoes enable row level security;

create policy "vendedor gerencia suas cotacoes"
  on public.cotacoes
  for all
  using (vendedor_id = auth.uid())
  with check (vendedor_id = auth.uid());

create index if not exists cotacoes_vendedor_created_idx on public.cotacoes(vendedor_id, created_at desc);
create index if not exists cotacoes_cliente_idx on public.cotacoes(cliente_id, created_at desc);
