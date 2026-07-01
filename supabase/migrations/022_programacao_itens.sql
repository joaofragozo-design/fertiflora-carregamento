-- ============================================================
-- FERTI FLORA — Migration 022: itens na programação (múltiplas fórmulas)
-- ============================================================
-- Mesmo padrão de 021 (ordem_itens): um agendamento pode ter mais de um
-- item (fórmulas/embalagens diferentes para o mesmo cliente/dia).

-- ─── TABELA: programacao_itens ───────────────────────────────
create table if not exists public.programacao_itens (
  id             uuid primary key default uuid_generate_v4(),
  programacao_id uuid not null references public.programacao_carregamento(id) on delete cascade,
  formula_id     integer references public.formulas(id) on delete set null,
  quantidade     integer not null default 0 check (quantidade >= 0),
  embalagem      text not null default 'SACOS' check (embalagem in ('SACOS', 'BAG_750', 'BAG_1000')),
  tons           numeric(10,4) generated always as (
                   case embalagem
                     when 'SACOS'    then quantidade * 0.05
                     when 'BAG_750'  then quantidade * 0.75
                     when 'BAG_1000' then quantidade * 1.0
                     else 0
                   end
                 ) stored,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_programacao_itens_prog_id on public.programacao_itens(programacao_id);

drop trigger if exists trg_programacao_itens_updated_at on public.programacao_itens;
create trigger trg_programacao_itens_updated_at
  before update on public.programacao_itens
  for each row execute function public.update_updated_at();

-- ─── MIGRA DADOS EXISTENTES ──────────────────────────────────
-- Só migra se `programacao_carregamento` ainda tiver `quantidade` (evita
-- duplicar itens caso esta migration seja executada mais de uma vez).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'programacao_carregamento' and column_name = 'quantidade'
  ) then
    insert into public.programacao_itens (programacao_id, formula_id, quantidade, embalagem, created_at)
    select id, formula_id, quantidade, embalagem, created_at
    from public.programacao_carregamento;
  end if;
end $$;

-- ─── programacao_carregamento PASSA A SER SÓ O AGENDAMENTO ───
-- `tons` é GERADA a partir de quantidade/embalagem — precisa sair primeiro.
alter table public.programacao_carregamento drop column if exists tons;
alter table public.programacao_carregamento drop column if exists formula_id;
alter table public.programacao_carregamento drop column if exists quantidade;
alter table public.programacao_carregamento drop column if exists embalagem;

-- ─── RLS: programacao_itens ───────────────────────────────────
alter table public.programacao_itens enable row level security;

drop policy if exists "programacao_itens_select_authenticated" on public.programacao_itens;
create policy "programacao_itens_select_authenticated" on public.programacao_itens
  for select using (auth.role() = 'authenticated');

drop policy if exists "programacao_itens_write_admin_logistica" on public.programacao_itens;
create policy "programacao_itens_write_admin_logistica" on public.programacao_itens
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'logistica') and active = true
    )
  );

-- ─── REALTIME ────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'programacao_itens'
  ) then
    alter publication supabase_realtime add table public.programacao_itens;
  end if;
end $$;
alter table public.programacao_itens replica identity full;
