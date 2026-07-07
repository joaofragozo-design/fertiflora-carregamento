-- Ranking Comercial (FertiFloraVendas): leaderboard anual de toneladas por
-- vendedor, visível para admin e vendedores. Decoupled de `profiles`/auth
-- porque hoje a maioria dos vendedores do ranking (ex-planilha) ainda não
-- tem login no app -- `profile_id` é o vínculo opcional para quem já tem.
--
-- Modelo "híbrido": o admin ajusta `faturamento_comercial.toneladas`
-- manualmente (substitui a edição da planilha), e um trigger em `pedidos`
-- soma automaticamente as toneladas de contratos aprovados para vendedores
-- já vinculados a uma conta do app. `faturamento_historico` guarda um
-- snapshot diário do valor para alimentar badges de evolução/crescimento
-- sem inventar dado que não existe.

create table public.vendedores_comerciais (
  id          uuid primary key default gen_random_uuid(),
  codigo      integer not null unique,
  nome        text not null,
  profile_id  uuid references public.profiles(id) on delete set null,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.metas_comerciais (
  id              uuid primary key default gen_random_uuid(),
  vendedor_id     uuid not null references public.vendedores_comerciais(id) on delete cascade,
  ano             integer not null,
  meta_toneladas  numeric not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (vendedor_id, ano)
);

create table public.faturamento_comercial (
  id            uuid primary key default gen_random_uuid(),
  vendedor_id   uuid not null references public.vendedores_comerciais(id) on delete cascade,
  ano           integer not null,
  toneladas     numeric not null default 0,
  atualizado_em timestamptz not null default now(),
  unique (vendedor_id, ano)
);

-- Snapshot diário (1 linha por vendedor/dia) do valor de `toneladas`, criado
-- via trigger sempre que faturamento_comercial muda. Base para badges de
-- "maior crescimento"/"venda do dia" sem depender de dado inexistente.
create table public.faturamento_historico (
  id          uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references public.vendedores_comerciais(id) on delete cascade,
  data        date not null default current_date,
  toneladas   numeric not null,
  unique (vendedor_id, data)
);

create index faturamento_historico_vendedor_idx on public.faturamento_historico(vendedor_id, data desc);

alter table public.vendedores_comerciais enable row level security;
alter table public.metas_comerciais enable row level security;
alter table public.faturamento_comercial enable row level security;
alter table public.faturamento_historico enable row level security;

-- Leitura liberada para qualquer usuário autenticado (admin e vendedores
-- veem o mesmo ranking). Escrita restrita ao admin -- subquery contra
-- `profiles` (tabela diferente), não é recursivo.
create policy "autenticado ve vendedores comerciais" on public.vendedores_comerciais
  for select using (auth.uid() is not null);
create policy "admin gerencia vendedores comerciais" on public.vendedores_comerciais
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "autenticado ve metas comerciais" on public.metas_comerciais
  for select using (auth.uid() is not null);
create policy "admin gerencia metas comerciais" on public.metas_comerciais
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "autenticado ve faturamento comercial" on public.faturamento_comercial
  for select using (auth.uid() is not null);
create policy "admin gerencia faturamento comercial" on public.faturamento_comercial
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- faturamento_historico é só leitura para o app -- escrita acontece via
-- trigger SECURITY DEFINER (bypassa RLS como owner da função).
create policy "autenticado ve historico" on public.faturamento_historico
  for select using (auth.uid() is not null);

-- ─── SEED automático: todo vendedor novo já nasce com meta/faturamento
--     zerados no ano corrente, evitando joins com linhas ausentes no app.
create or replace function public.seed_ranking_vendedor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.metas_comerciais (vendedor_id, ano, meta_toneladas)
  values (new.id, extract(year from now())::int, 0)
  on conflict (vendedor_id, ano) do nothing;

  insert into public.faturamento_comercial (vendedor_id, ano, toneladas)
  values (new.id, extract(year from now())::int, 0)
  on conflict (vendedor_id, ano) do nothing;

  return new;
end;
$$;

create trigger trg_seed_ranking_vendedor
  after insert on public.vendedores_comerciais
  for each row
  execute function public.seed_ranking_vendedor();

-- ─── Snapshot diário: espelha toneladas em faturamento_historico sempre
--     que faturamento_comercial é criado/alterado (ajuste manual ou trigger
--     automático de pedidos, ambos passam por aqui).
create or replace function public.snapshot_faturamento_historico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.faturamento_historico (vendedor_id, data, toneladas)
  values (new.vendedor_id, current_date, new.toneladas)
  on conflict (vendedor_id, data) do update set toneladas = excluded.toneladas;

  return new;
end;
$$;

create trigger trg_snapshot_faturamento
  after insert or update of toneladas on public.faturamento_comercial
  for each row
  execute function public.snapshot_faturamento_historico();

-- ─── Auto-soma: quando um Pedido é aprovado, soma a tonelagem no vendedor
--     comercial vinculado (se houver) -- "atualiza direto do sistema
--     conforme é vendido". Usa Pedido (aprovação deliberada do admin), não
--     Cotação (aprovado=true por padrão, sem gate real), porque o ranking
--     tem prêmio em dinheiro e não pode contar tonelagem que ainda não
--     virou contrato assinado.
create or replace function public.somar_faturamento_pedido_aprovado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendedor_comercial_id uuid;
  v_ano int := extract(year from now())::int;
begin
  if new.status = 'aprovado' and (old.status is distinct from 'aprovado') then
    select id into v_vendedor_comercial_id
    from public.vendedores_comerciais
    where profile_id = new.vendedor_id and ativo = true
    limit 1;

    if v_vendedor_comercial_id is not null then
      insert into public.faturamento_comercial (vendedor_id, ano, toneladas)
      values (v_vendedor_comercial_id, v_ano, new.quantidade_toneladas)
      on conflict (vendedor_id, ano) do update
        set toneladas = public.faturamento_comercial.toneladas + excluded.toneladas,
            atualizado_em = now();
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_somar_faturamento_pedido
  after update of status on public.pedidos
  for each row
  execute function public.somar_faturamento_pedido_aprovado();
