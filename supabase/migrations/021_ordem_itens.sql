-- ============================================================
-- FERTI FLORA — Migration 021: itens por ordem (múltiplas fórmulas/caminhão)
-- ============================================================
-- Um caminhão pode levar mais de um item (ex.: sacos de uma fórmula + bag
-- de outra). `ordens_diarias` passa a representar o CAMINHÃO/CARGA (cliente,
-- placa, envelopar, status, cronômetro); cada item vai para `ordem_itens`.

-- ─── TABELA: ordem_itens ─────────────────────────────────────
create table if not exists public.ordem_itens (
  id          uuid primary key default uuid_generate_v4(),
  ordem_id    uuid not null references public.ordens_diarias(id) on delete cascade,
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
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_ordem_itens_ordem_id on public.ordem_itens(ordem_id);

drop trigger if exists trg_ordem_itens_updated_at on public.ordem_itens;
create trigger trg_ordem_itens_updated_at
  before update on public.ordem_itens
  for each row execute function public.update_updated_at();

-- ─── MIGRA DADOS EXISTENTES ──────────────────────────────────
-- Cada ordem existente vira um item único dentro dela mesma.
-- Só migra se `ordens_diarias` ainda tiver a coluna `quantidade` (evita
-- duplicar itens caso esta migration seja executada mais de uma vez).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ordens_diarias' and column_name = 'quantidade'
  ) then
    insert into public.ordem_itens (ordem_id, formula_id, quantidade, embalagem, created_at)
    select id, formula_id, quantidade, embalagem, created_at
    from public.ordens_diarias;
  end if;
end $$;

-- ─── ordens_diarias PASSA A SER SÓ O CAMINHÃO/CARGA ──────────
-- `tons` é GERADA a partir de quantidade/embalagem — precisa sair primeiro.
alter table public.ordens_diarias drop column if exists tons;
alter table public.ordens_diarias drop column if exists formula_id;
alter table public.ordens_diarias drop column if exists quantidade;
alter table public.ordens_diarias drop column if exists embalagem;

-- ─── TRIGGER DE PERMISSÃO (reescrita: sem as colunas removidas) ─
create or replace function enforce_ordem_diaria_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role user_role;
begin
  select role into v_role from public.profiles where id = auth.uid();

  if v_role = 'admin' then
    return new;
  end if;

  if v_role = 'logistica' then
    if (new.iniciado   is distinct from old.iniciado)
       or (new.finalizado is distinct from old.finalizado) then
      raise exception 'Logística não tem permissão para marcar Iniciado/Finalizado.';
    end if;
    return new;
  end if;

  if v_role = 'logistica_02' then
    if (new.cliente    is distinct from old.cliente)
       or (new.placa      is distinct from old.placa)
       or (new.envelopar  is distinct from old.envelopar)
       or (new.data       is distinct from old.data)
       or (new.sequencia  is distinct from old.sequencia) then
      raise exception 'Logística 02 só pode marcar Iniciado/Finalizado.';
    end if;
    return new;
  end if;

  return new;
end;
$$;

-- ─── RLS: ordem_itens ────────────────────────────────────────
alter table public.ordem_itens enable row level security;

drop policy if exists "ordem_itens_select_authenticated" on public.ordem_itens;
create policy "ordem_itens_select_authenticated" on public.ordem_itens
  for select using (auth.role() = 'authenticated');

drop policy if exists "ordem_itens_write_admin_logistica" on public.ordem_itens;
create policy "ordem_itens_write_admin_logistica" on public.ordem_itens
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
    where pubname = 'supabase_realtime' and tablename = 'ordem_itens'
  ) then
    alter publication supabase_realtime add table public.ordem_itens;
  end if;
end $$;
alter table public.ordem_itens replica identity full;
