-- ============================================================
-- FERTI FLORA — Ordem de Carregamento
-- Migration 002: Schema simplificado de solicitações
--
-- Fluxo: operador_carregamento cria solicitação (insumo + quantidade)
--        operador_pa recebe em tempo real, inicia e conclui.
-- ============================================================

-- ─── LIMPEZA ────────────────────────────────────────────────
drop table if exists public.itens_ordem    cascade;
drop table if exists public.ordens         cascade;
drop table if exists public.order_events   cascade;
drop table if exists public.loading_orders cascade;

drop type if exists ordem_status   cascade;
drop type if exists order_status   cascade;
drop type if exists order_priority cascade;
drop type if exists product_type   cascade;

drop sequence if exists public.seq_numero_ordem;

-- ─── ENUM ───────────────────────────────────────────────────
create type ordem_status as enum (
  'PENDENTE',
  'CARREGANDO',
  'CONCLUIDO'
);

-- ─── SEQUENCE ───────────────────────────────────────────────
create sequence public.seq_numero_ordem
  start with 1
  increment by 1
  no minvalue
  no maxvalue
  cache 1;

-- ─── TABELA ─────────────────────────────────────────────────
create table public.ordens (
  id           uuid          primary key default uuid_generate_v4(),
  numero_ordem text          not null unique,

  insumo       text          not null
                             check (char_length(insumo) between 2 and 150),

  quantidade   numeric(12,3) not null
                             check (quantidade > 0),

  unidade      text          not null default 't'
                             check (unidade in ('kg', 't', 'sc')),

  observacao   text          check (observacao is null or char_length(observacao) <= 500),

  status       ordem_status  not null default 'PENDENTE',

  created_at   timestamptz   not null default now(),
  started_at   timestamptz,
  completed_at timestamptz,

  constraint chk_started_after_created
    check (started_at is null or started_at >= created_at),
  constraint chk_completed_requires_started
    check (completed_at is null or started_at is not null),
  constraint chk_completed_after_started
    check (completed_at is null or completed_at >= started_at)
);

comment on table  public.ordens              is 'Solicitações de carregamento — criadas pelo operador, executadas pela pá.';
comment on column public.ordens.numero_ordem is 'Código sequencial no formato SC-YYYYMMDD-0001.';
comment on column public.ordens.unidade      is 'Unidade de medida: kg, t (toneladas) ou sc (sacas).';

-- ─── TRIGGER: gerar numero_ordem ────────────────────────────
create or replace function public.fn_gerar_numero_ordem()
returns trigger
language plpgsql
as $$
declare
  v_seq  bigint;
  v_data text;
begin
  v_data := to_char(now() at time zone 'America/Sao_Paulo', 'YYYYMMDD');
  select nextval('public.seq_numero_ordem') into v_seq;
  new.numero_ordem := 'SC-' || v_data || '-' || lpad(v_seq::text, 4, '0');
  return new;
end;
$$;

create trigger trg_gerar_numero_ordem
  before insert on public.ordens
  for each row
  when (new.numero_ordem is null or new.numero_ordem = '')
  execute function public.fn_gerar_numero_ordem();

-- ─── TRIGGER: validar transições de status ──────────────────
-- Garante fluxo linear: PENDENTE → CARREGANDO → CONCLUIDO
-- Preenche timestamps automaticamente nas transições.
create or replace function public.fn_validar_status_ordem()
returns trigger
language plpgsql
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if old.status = 'PENDENTE' and new.status <> 'CARREGANDO' then
    raise exception 'Transição inválida: % → %. Use CARREGANDO.', old.status, new.status;
  end if;

  if old.status = 'CARREGANDO' and new.status <> 'CONCLUIDO' then
    raise exception 'Transição inválida: % → %. Use CONCLUIDO.', old.status, new.status;
  end if;

  if old.status = 'CONCLUIDO' then
    raise exception 'Ordem já concluída — status não pode ser alterado.';
  end if;

  if new.status = 'CARREGANDO' and new.started_at is null then
    new.started_at := now();
  end if;

  if new.status = 'CONCLUIDO' and new.completed_at is null then
    new.completed_at := now();
  end if;

  return new;
end;
$$;

create trigger trg_validar_status_ordem
  before update of status on public.ordens
  for each row
  execute function public.fn_validar_status_ordem();

-- ─── ÍNDICES ────────────────────────────────────────────────
create index idx_ordens_status_ativo
  on public.ordens (status)
  where status <> 'CONCLUIDO';

create index idx_ordens_created_at
  on public.ordens (created_at desc);

-- ─── RLS ────────────────────────────────────────────────────
alter table public.ordens enable row level security;

create policy "ordens_select"
  on public.ordens for select
  using (auth.role() = 'authenticated');

create policy "ordens_insert"
  on public.ordens for insert
  with check (
    exists (
      select 1 from public.profiles
      where id   = auth.uid()
        and role in ('operador_carregamento', 'admin')
        and active = true
    )
  );

create policy "ordens_update"
  on public.ordens for update
  using  (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "ordens_delete"
  on public.ordens for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ─── REALTIME ───────────────────────────────────────────────
alter publication supabase_realtime add table public.ordens;
