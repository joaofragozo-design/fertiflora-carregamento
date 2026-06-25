-- ============================================================
-- FERTI FLORA — Sistema de Carregamento
-- Migration 004: Tabela única carregamentos
--
-- Substitui o schema de ordens pelo modelo definitivo.
-- Tabela: carregamentos (id, insumo, quantidade, status, timestamps)
-- ============================================================

-- ─── LIMPEZA ────────────────────────────────────────────────
drop table  if exists public.itens_ordem   cascade;
drop table  if exists public.ordens        cascade;
drop type   if exists ordem_status         cascade;
drop type   if exists carregamento_status  cascade;
drop sequence if exists public.seq_numero_ordem;

-- ─── ENUM ───────────────────────────────────────────────────
create type carregamento_status as enum (
  'PENDENTE',
  'CARREGANDO',
  'CONCLUIDO'
);

-- ─── TABELA ─────────────────────────────────────────────────
create table public.carregamentos (
  id          uuid                  primary key default gen_random_uuid(),
  insumo      text                  not null
                                    check (char_length(insumo) between 2 and 150),
  quantidade  numeric(12, 3)        not null
                                    check (quantidade > 0),
  status      carregamento_status   not null default 'PENDENTE',
  created_at  timestamptz           not null default now(),
  started_at  timestamptz,
  finished_at timestamptz,

  constraint chk_started_after_created
    check (started_at  is null or started_at  >= created_at),
  constraint chk_finished_requires_started
    check (finished_at is null or started_at  is not null),
  constraint chk_finished_after_started
    check (finished_at is null or finished_at >= started_at)
);

comment on table  public.carregamentos             is 'Solicitações de carregamento — criadas pelo operador, executadas pela pá.';
comment on column public.carregamentos.insumo      is 'Nome do insumo a ser carregado.';
comment on column public.carregamentos.quantidade  is 'Quantidade em toneladas.';
comment on column public.carregamentos.started_at  is 'Preenchido automaticamente ao mudar para CARREGANDO.';
comment on column public.carregamentos.finished_at is 'Preenchido automaticamente ao mudar para CONCLUIDO.';

-- ─── TRIGGER: timestamps automáticos ────────────────────────
-- PENDENTE → CARREGANDO  : registra started_at
-- CARREGANDO → CONCLUIDO : registra finished_at
-- Qualquer outra transição: erro

create or replace function public.fn_carregamento_timestamps()
returns trigger
language plpgsql
as $$
begin
  -- Idempotente: mesmo status, nada a fazer
  if new.status = old.status then
    return new;
  end if;

  if old.status = 'PENDENTE' and new.status = 'CARREGANDO' then
    new.started_at := coalesce(new.started_at, now());
    return new;
  end if;

  if old.status = 'CARREGANDO' and new.status = 'CONCLUIDO' then
    new.finished_at := coalesce(new.finished_at, now());
    return new;
  end if;

  raise exception
    'Transição de status inválida: % → %. '
    'Fluxo permitido: PENDENTE → CARREGANDO → CONCLUIDO.',
    old.status, new.status;
end;
$$;

create trigger trg_carregamento_timestamps
  before update of status on public.carregamentos
  for each row
  execute function public.fn_carregamento_timestamps();

-- ─── ÍNDICES ────────────────────────────────────────────────
-- Fila ativa (PENDENTE + CARREGANDO) — consulta principal da pá
create index idx_carregamentos_status_ativo
  on public.carregamentos (status)
  where status <> 'CONCLUIDO';

-- Listagem cronológica
create index idx_carregamentos_created_at
  on public.carregamentos (created_at desc);

-- ─── RLS ────────────────────────────────────────────────────
alter table public.carregamentos enable row level security;

-- Leitura: qualquer usuário autenticado
create policy "carregamentos_select"
  on public.carregamentos for select
  using (auth.role() = 'authenticated');

-- Criação: operador_carregamento e admin
create policy "carregamentos_insert"
  on public.carregamentos for insert
  with check (
    exists (
      select 1 from public.profiles
      where id     = auth.uid()
        and role   in ('operador_carregamento', 'admin')
        and active = true
    )
  );

-- Atualização: qualquer autenticado (operador_pa atualiza status)
create policy "carregamentos_update"
  on public.carregamentos for update
  using  (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Exclusão: somente admin
create policy "carregamentos_delete"
  on public.carregamentos for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ─── REALTIME ───────────────────────────────────────────────
alter publication supabase_realtime add table public.carregamentos;
