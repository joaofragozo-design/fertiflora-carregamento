-- ============================================================
-- FERTI FLORA — Ordem de Carregamento
-- Migration 001: Schema inicial
-- ============================================================

-- Extensões
create extension if not exists "uuid-ossp";

-- ─── ENUM TYPES ─────────────────────────────────────────────
create type user_role as enum (
  'operador_carregamento',
  'operador_pa',
  'admin'
);

create type order_status as enum (
  'pendente',
  'em_carregamento',
  'aguardando_pa',
  'carregando',
  'pausado',
  'concluido',
  'cancelado'
);

create type order_priority as enum (
  'normal',
  'urgente',
  'critico'
);

create type product_type as enum (
  'fertilizante_solido',
  'fertilizante_liquido',
  'calcario',
  'outro'
);

-- ─── PROFILES ───────────────────────────────────────────────
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null unique,
  name       text not null,
  role       user_role not null default 'operador_carregamento',
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── LOADING ORDERS ─────────────────────────────────────────
create table public.loading_orders (
  id                         uuid primary key default uuid_generate_v4(),
  numero_ordem               text not null unique,
  status                     order_status not null default 'pendente',
  prioridade                 order_priority not null default 'normal',
  produto                    product_type not null,
  descricao_produto          text not null,
  quantidade_kg              numeric(10,2) not null check (quantidade_kg > 0),
  quantidade_carregada_kg    numeric(10,2) not null default 0 check (quantidade_carregada_kg >= 0),
  placa_veiculo              text not null,
  nome_motorista             text not null,
  cliente                    text not null,
  local_carregamento         text not null,
  operador_carregamento_id   uuid references public.profiles(id) on delete set null,
  operador_pa_id             uuid references public.profiles(id) on delete set null,
  observacoes                text,
  iniciado_em                timestamptz,
  concluido_em               timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

-- ─── ORDER EVENTS ───────────────────────────────────────────
create table public.order_events (
  id          uuid primary key default uuid_generate_v4(),
  order_id    uuid not null references public.loading_orders(id) on delete cascade,
  tipo_evento text not null,
  descricao   text not null,
  usuario_id  uuid not null references public.profiles(id) on delete cascade,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

-- ─── ÍNDICES ────────────────────────────────────────────────
create index idx_loading_orders_status   on public.loading_orders(status);
create index idx_loading_orders_priority on public.loading_orders(prioridade);
create index idx_loading_orders_created  on public.loading_orders(created_at desc);
create index idx_order_events_order_id   on public.order_events(order_id);
create index idx_order_events_created    on public.order_events(created_at desc);

-- ─── FUNÇÃO: numero_ordem automático ────────────────────────
create or replace function generate_numero_ordem()
returns trigger language plpgsql as $$
begin
  new.numero_ordem := 'OC-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(
    (select count(*) + 1 from public.loading_orders
     where created_at::date = now()::date)::text,
    4, '0'
  );
  return new;
end;
$$;

create trigger trg_numero_ordem
  before insert on public.loading_orders
  for each row
  when (new.numero_ordem is null or new.numero_ordem = '')
  execute function generate_numero_ordem();

-- ─── FUNÇÃO: updated_at automático ──────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function update_updated_at();

create trigger trg_orders_updated_at
  before update on public.loading_orders
  for each row execute function update_updated_at();

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────
alter table public.profiles      enable row level security;
alter table public.loading_orders enable row level security;
alter table public.order_events  enable row level security;

-- profiles: usuário lê o próprio perfil; admin lê todos
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_select_admin" on public.profiles
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- loading_orders: qualquer usuário autenticado pode ler
create policy "orders_select_authenticated" on public.loading_orders
  for select using (auth.role() = 'authenticated');

-- loading_orders: operador_carregamento e admin podem inserir
create policy "orders_insert_allowed" on public.loading_orders
  for insert with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('operador_carregamento', 'admin')
        and active = true
    )
  );

-- loading_orders: qualquer operador autenticado pode atualizar
create policy "orders_update_authenticated" on public.loading_orders
  for update using (auth.role() = 'authenticated');

-- order_events: leitura pública autenticada
create policy "events_select_authenticated" on public.order_events
  for select using (auth.role() = 'authenticated');

-- order_events: apenas inserção (imutável)
create policy "events_insert_authenticated" on public.order_events
  for insert with check (auth.role() = 'authenticated');

-- ─── REALTIME ───────────────────────────────────────────────
alter publication supabase_realtime add table public.loading_orders;
alter publication supabase_realtime add table public.order_events;
