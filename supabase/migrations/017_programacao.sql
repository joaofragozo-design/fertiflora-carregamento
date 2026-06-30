-- ============================================================
-- FERTI FLORA — Migration 017: Programação semanal de carregamento
-- ============================================================
-- Camada de PLANEJAMENTO (separada das ordens diárias). O Fransua programa
-- a semana; o Richardson (logistica_02) vê em modo leitura para se preparar.

-- garante a função de updated_at (idempotente)
create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.programacao_carregamento (
  id          uuid primary key default uuid_generate_v4(),
  data        date not null,
  cliente     text not null default '',
  formula_id  integer references public.formulas(id) on delete set null,
  quantidade  integer not null default 0 check (quantidade >= 0),
  embalagem   text not null default 'SACOS' check (embalagem in ('SACOS', 'BAG_750', 'BAG_1000')),
  tons        numeric(10,4) generated always as (
                case embalagem
                  when 'SACOS'    then quantidade * 0.05
                  when 'BAG_750'  then quantidade * 0.75
                  when 'BAG_1000' then quantidade * 1.0
                  else 0
                end
              ) stored,
  observacao  text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_programacao_data on public.programacao_carregamento(data);

create trigger trg_programacao_updated_at
  before update on public.programacao_carregamento
  for each row execute function public.update_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────
alter table public.programacao_carregamento enable row level security;

-- todos autenticados leem (Richardson vê a prévia)
create policy "programacao_select_authenticated" on public.programacao_carregamento
  for select using (auth.role() = 'authenticated');

-- só admin e logistica escrevem (Fransua programa)
create policy "programacao_write_admin_logistica" on public.programacao_carregamento
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'logistica') and active = true
    )
  );

-- ─── REALTIME ────────────────────────────────────────────────
alter publication supabase_realtime add table public.programacao_carregamento;
alter table public.programacao_carregamento replica identity full;
