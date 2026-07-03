-- ============================================================
-- FERTI FLORA — Migration 025: cadastro de clientes
-- ============================================================
-- Catálogo de clientes para o combobox (igual ao de fórmulas), usado nas
-- telas de Ordens e Programação. Continua salvando `cliente` como texto
-- livre nas tabelas existentes — este catálogo é só a lista de sugestão.

create table if not exists public.clientes (
  id         uuid primary key default uuid_generate_v4(),
  nome       text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_clientes_updated_at on public.clientes;
create trigger trg_clientes_updated_at
  before update on public.clientes
  for each row execute function public.update_updated_at();

alter table public.clientes enable row level security;

drop policy if exists "clientes_select_authenticated" on public.clientes;
create policy "clientes_select_authenticated" on public.clientes
  for select using (auth.role() = 'authenticated');

drop policy if exists "clientes_write_admin_logistica" on public.clientes;
create policy "clientes_write_admin_logistica" on public.clientes
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'logistica') and active = true
    )
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'clientes'
  ) then
    alter publication supabase_realtime add table public.clientes;
  end if;
end $$;
alter table public.clientes replica identity full;
