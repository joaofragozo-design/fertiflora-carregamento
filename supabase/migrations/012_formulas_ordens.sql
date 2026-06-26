-- ============================================================
-- FERTI FLORA — Ordens Diárias de Carregamento
-- Migration 012: Fórmulas + Ordens Diárias
-- ============================================================
-- Depende da 011 (perfis logistica / logistica_02 já commitados).

-- ─── TABELA: formulas ────────────────────────────────────────
create table public.formulas (
  id                  serial primary key,
  nome                text not null unique,
  mo                  numeric(7,4) not null default 0 check (mo >= 0 and mo <= 1),
  map                 numeric(7,4) not null default 0 check (map >= 0 and map <= 1),
  calcario_concha     numeric(7,4) not null default 0 check (calcario_concha >= 0 and calcario_concha <= 1),
  sulfato_amonia      numeric(7,4) not null default 0 check (sulfato_amonia >= 0 and sulfato_amonia <= 1),
  carbonato_ca_mg     numeric(7,4) not null default 0 check (carbonato_ca_mg >= 0 and carbonato_ca_mg <= 1),
  ureia               numeric(7,4) not null default 0 check (ureia >= 0 and ureia <= 1),
  cloreto_potassio    numeric(7,4) not null default 0 check (cloreto_potassio >= 0 and cloreto_potassio <= 1),
  enxofre_pastilhado  numeric(7,4) not null default 0 check (enxofre_pastilhado >= 0 and enxofre_pastilhado <= 1),
  oxmag_s             numeric(7,4) not null default 0 check (oxmag_s >= 0 and oxmag_s <= 1),
  tsp                 numeric(7,4) not null default 0 check (tsp >= 0 and tsp <= 1),
  caltimag            numeric(7,4) not null default 0 check (caltimag >= 0 and caltimag <= 1),
  hiphos_25           numeric(7,4) not null default 0 check (hiphos_25 >= 0 and hiphos_25 <= 1),
  ativo               boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_formulas_nome  on public.formulas using gin(to_tsvector('portuguese', nome));
create index idx_formulas_ativo on public.formulas(ativo);

create trigger trg_formulas_updated_at
  before update on public.formulas
  for each row execute function update_updated_at();

-- ─── TABELA: ordens_diarias ──────────────────────────────────
create table public.ordens_diarias (
  id          uuid primary key default uuid_generate_v4(),
  data        date not null default current_date,
  sequencia   smallint not null,
  cliente     text not null default '',
  placa       text not null default '',
  envelopar   boolean not null default false,
  quantidade  integer not null default 0 check (quantidade >= 0),
  embalagem   text not null default 'SACOS' check (embalagem in ('SACOS', 'BAGS')),
  tons        numeric(10,4) generated always as (
                case embalagem
                  when 'SACOS' then quantidade * 0.05
                  when 'BAGS'  then quantidade * 0.75
                  else 0
                end
              ) stored,
  formula_id  integer references public.formulas(id) on delete set null,
  iniciado    boolean not null default false,
  finalizado  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (data, sequencia)
);

create index idx_ordens_diarias_data    on public.ordens_diarias(data desc);
create index idx_ordens_diarias_formula on public.ordens_diarias(formula_id);
create index idx_ordens_diarias_status  on public.ordens_diarias(iniciado, finalizado);

create trigger trg_ordens_diarias_updated_at
  before update on public.ordens_diarias
  for each row execute function update_updated_at();

-- ─── SEQUENCIA AUTO ──────────────────────────────────────────
create or replace function set_sequencia_ordens_diarias()
returns trigger language plpgsql as $$
begin
  if new.sequencia is null then
    select coalesce(max(sequencia), 0) + 1
      into new.sequencia
      from public.ordens_diarias
     where data = new.data;
  end if;
  return new;
end;
$$;

create trigger trg_ordens_diarias_sequencia
  before insert on public.ordens_diarias
  for each row
  when (new.sequencia is null)
  execute function set_sequencia_ordens_diarias();

-- ─── PERMISSÃO POR COLUNA (defesa no banco) ──────────────────
-- logistica     NÃO pode alterar iniciado/finalizado
-- logistica_02  SÓ pode alterar iniciado/finalizado
-- admin         sem restrição
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
       or (new.quantidade is distinct from old.quantidade)
       or (new.embalagem  is distinct from old.embalagem)
       or (new.formula_id is distinct from old.formula_id)
       or (new.data       is distinct from old.data)
       or (new.sequencia  is distinct from old.sequencia) then
      raise exception 'Logística 02 só pode marcar Iniciado/Finalizado.';
    end if;
    return new;
  end if;

  return new;
end;
$$;

create trigger trg_enforce_ordem_diaria_update
  before update on public.ordens_diarias
  for each row execute function enforce_ordem_diaria_update();

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────
alter table public.formulas       enable row level security;
alter table public.ordens_diarias enable row level security;

-- formulas: qualquer autenticado lê
create policy "formulas_select_authenticated" on public.formulas
  for select using (auth.role() = 'authenticated');

-- formulas: admin e logistica escrevem
create policy "formulas_write_admin_logistica" on public.formulas
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'logistica') and active = true
    )
  );

-- ordens_diarias: todos autenticados leem
create policy "ordens_diarias_select_authenticated" on public.ordens_diarias
  for select using (auth.role() = 'authenticated');

-- ordens_diarias: admin e logistica criam linhas
create policy "ordens_diarias_insert" on public.ordens_diarias
  for insert with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'logistica') and active = true
    )
  );

-- ordens_diarias: admin e logistica removem linhas
create policy "ordens_diarias_delete" on public.ordens_diarias
  for delete using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'logistica') and active = true
    )
  );

-- ordens_diarias: admin, logistica e logistica_02 atualizam
-- (quais COLUNAS cada um pode mudar é garantido pelo trigger acima)
create policy "ordens_diarias_update" on public.ordens_diarias
  for update using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('admin', 'logistica', 'logistica_02')
        and active = true
    )
  );

-- ─── REALTIME ────────────────────────────────────────────────
alter publication supabase_realtime add table public.ordens_diarias;
