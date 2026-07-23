-- ============================================================
-- FERTI FLORA — Migration 063: Programação de Recebimento
-- ============================================================
-- Espelha a Programação de Carregamento, só que pro lado de dentro: em vez
-- de cliente, fornecedor; em vez de carregar, receber matéria-prima. A
-- Logística lança (data prevista, matéria-prima, quantidade, fornecedor,
-- placa do caminhão); o Faturamento confirma a chegada — mesmo papel que já
-- confirma chegada de caminhão na Programação de Carregamento.

-- ─── FORNECEDORES (espelha clientes_carregamento) ────────────
create table public.fornecedores (
  id         uuid primary key default uuid_generate_v4(),
  nome       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_fornecedores_updated_at
  before update on public.fornecedores
  for each row execute function public.update_updated_at();

alter table public.fornecedores enable row level security;

-- Papéis internos leem (Logística lança, Faturamento vê); transportadora não precisa.
create policy "fornecedores_select_internos" on public.fornecedores
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role <> 'transportadora' and active = true
    )
  );

create policy "fornecedores_write_admin_logistica" on public.fornecedores
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'logistica') and active = true
    )
  );

-- ─── EXTENSÃO DE recebimentos_previstos ──────────────────────
-- `materia_prima` (texto livre) e `fornecedor` (texto livre) já existiam
-- (migration 058, versão simples) — mantidos pra não quebrar o que já foi
-- lançado. `materia_prima_key` (uma das 14 chaves conhecidas, igual às
-- fórmulas) e `fornecedor_id` são os novos campos estruturados, usados a
-- partir de agora; a interface prioriza eles e cai pro texto livre só pra
-- registros antigos.
alter table public.recebimentos_previstos
  add column if not exists materia_prima_key text,
  add column if not exists fornecedor_id      uuid references public.fornecedores(id) on delete set null,
  add column if not exists placa              text not null default '',
  add column if not exists confirmado_em      timestamptz,
  add column if not exists confirmado_por     text;

-- Backfill: cria um fornecedor pro texto livre já lançado (se ainda não existir
-- um com esse nome) e vincula o registro existente a ele. `distinct on
-- (lower(trim(...)))` — não só `distinct` puro — pra não criar duas linhas se
-- o texto livre tiver variações de maiúsculas/minúsculas (ex.: "Coonagro" e
-- "COONAGRO"), já que um `select distinct` comum não enxerga essa duplicata
-- dentro do próprio conjunto sendo inserido.
insert into public.fornecedores (nome)
select distinct on (lower(trim(r.fornecedor))) trim(r.fornecedor)
from public.recebimentos_previstos r
where trim(coalesce(r.fornecedor, '')) <> ''
  and not exists (
    select 1 from public.fornecedores f where lower(f.nome) = lower(trim(r.fornecedor))
  );

update public.recebimentos_previstos r
set fornecedor_id = f.id
from public.fornecedores f
where r.fornecedor_id is null
  and trim(coalesce(r.fornecedor, '')) <> ''
  and lower(f.nome) = lower(trim(r.fornecedor));

-- ─── RLS: Faturamento confirma chegada (só confirmado_em/confirmado_por) ──
create policy "recebimentos_faturamento_confirmar" on public.recebimentos_previstos
  for update using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'faturamento' and active = true
    )
  );

create or replace function public.enforce_recebimento_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role user_role;
begin
  select role into v_role from public.profiles where id = auth.uid();

  if v_role not in ('admin', 'logistica', 'faturamento') then
    raise exception 'Sem permissão para esta operação.';
  end if;

  if v_role = 'faturamento' then
    if new.data_prevista     is distinct from old.data_prevista
      or new.materia_prima      is distinct from old.materia_prima
      or new.materia_prima_key  is distinct from old.materia_prima_key
      or new.quantidade_ton     is distinct from old.quantidade_ton
      or new.fornecedor         is distinct from old.fornecedor
      or new.fornecedor_id      is distinct from old.fornecedor_id
      or new.placa              is distinct from old.placa
      or new.observacao         is distinct from old.observacao
    then
      raise exception 'Faturamento só pode confirmar a chegada do caminhão.';
    end if;
  end if;

  -- `recebido` (coluna antiga, migration 058) precisa sempre refletir se
  -- confirmado_em está preenchido -- sem essa checagem, um update que só
  -- toque `recebido` (sem passar por confirmarChegada()) passaria batido
  -- pelo bloqueio acima (nenhuma das colunas ali muda) e deixaria os dois
  -- campos dessincronizados, pra QUALQUER role, não só faturamento.
  if new.recebido is distinct from (new.confirmado_em is not null) then
    raise exception '`recebido` precisa ficar em sincronia com confirmado_em -- use confirmarChegada().';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_recebimento_update on public.recebimentos_previstos;
create trigger trg_enforce_recebimento_update
  before update on public.recebimentos_previstos
  for each row execute function public.enforce_recebimento_update();
