-- ============================================================
-- FERTI FLORA — Migration 058: Fluxo de transportadora/motorista
-- ============================================================
-- Fluxo: Logística seleciona a transportadora no agendamento e envia →
-- a transportadora (login próprio, role 'transportadora') escolhe/cadastra
-- o motorista (WhatsApp obrigatório) e envia a solicitação → a Logística
-- (Françoa) libera → mensagem de WhatsApp pronta pro motorista.
--
-- Também cria `recebimentos_previstos` (previsão de chegada de matéria-prima
-- exibida no painel de TV).
--
-- PRÉ-REQUISITO: migration 057 (enum 'transportadora') já commitada.

-- ─── TRANSPORTADORAS ─────────────────────────────────────────
create table public.transportadoras (
  id         uuid primary key default uuid_generate_v4(),
  nome       text not null,
  -- Login da transportadora (1 usuário por transportadora). O vínculo fica
  -- aqui (e não em profiles) porque profiles é compartilhada com outros apps.
  profile_id uuid unique references public.profiles(id) on delete set null,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_transportadoras_updated_at
  before update on public.transportadoras
  for each row execute function public.update_updated_at();

alter table public.transportadoras enable row level security;

-- Qualquer autenticado lê (a Logística precisa do dropdown; a transportadora
-- precisa achar o próprio registro). Só nome/ativo — nada sensível.
create policy "transportadoras_select_authenticated" on public.transportadoras
  for select using (auth.role() = 'authenticated');

-- Só admin/logistica gerenciam o cadastro de transportadoras.
create policy "transportadoras_write_admin_logistica" on public.transportadoras
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'logistica') and active = true
    )
  );

-- ─── MOTORISTAS ──────────────────────────────────────────────
create table public.motoristas (
  id                uuid primary key default uuid_generate_v4(),
  transportadora_id uuid not null references public.transportadoras(id) on delete cascade,
  nome              text not null,
  -- Obrigatório: é o número que recebe a mensagem de liberação do carregamento.
  whatsapp          text not null check (length(trim(whatsapp)) >= 10),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_motoristas_transportadora on public.motoristas(transportadora_id);

create trigger trg_motoristas_updated_at
  before update on public.motoristas
  for each row execute function public.update_updated_at();

alter table public.motoristas enable row level security;

-- Papéis internos (todos menos transportadora) veem todos os motoristas —
-- o Françoa precisa do nome/WhatsApp na hora de liberar.
create policy "motoristas_select_internos" on public.motoristas
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role <> 'transportadora' and active = true
    )
  );

-- A transportadora só enxerga e gerencia a própria frota.
create policy "motoristas_select_transportadora" on public.motoristas
  for select using (
    transportadora_id in (select id from public.transportadoras where profile_id = auth.uid())
  );

create policy "motoristas_insert_transportadora" on public.motoristas
  for insert with check (
    transportadora_id in (select id from public.transportadoras where profile_id = auth.uid())
  );

create policy "motoristas_update_transportadora" on public.motoristas
  for update using (
    transportadora_id in (select id from public.transportadoras where profile_id = auth.uid())
  );

-- Admin/logistica também podem corrigir cadastros de motorista.
create policy "motoristas_write_admin_logistica" on public.motoristas
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'logistica') and active = true
    )
  );

-- ─── FLUXO NO AGENDAMENTO ────────────────────────────────────
alter table public.programacao_carregamento
  add column if not exists transportadora_id         uuid references public.transportadoras(id) on delete set null,
  add column if not exists motorista_id              uuid references public.motoristas(id) on delete set null,
  add column if not exists solicitacao_status        text check (solicitacao_status in ('ENVIADO_TRANSPORTADORA', 'SOLICITADO', 'LIBERADO')),
  add column if not exists enviado_transportadora_em timestamptz,
  add column if not exists solicitado_em             timestamptz,
  add column if not exists liberado_em               timestamptz,
  add column if not exists liberado_por              text;

-- A transportadora perde o SELECT irrestrito: a policy antiga liberava para
-- qualquer autenticado; agora papéis internos continuam vendo tudo e a
-- transportadora só vê agendamentos endereçados a ela.
drop policy if exists "programacao_select_authenticated" on public.programacao_carregamento;

create policy "programacao_select_internos" on public.programacao_carregamento
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role <> 'transportadora' and active = true
    )
  );

create policy "programacao_select_transportadora" on public.programacao_carregamento
  for select using (
    transportadora_id in (select id from public.transportadoras where profile_id = auth.uid())
  );

-- Itens do agendamento: mesma regra (a transportadora precisa ver quantidade/
-- embalagem/fórmula — o nome da fórmula é mascarado na interface).
drop policy if exists "programacao_itens_select_authenticated" on public.programacao_itens;

create policy "programacao_itens_select_internos" on public.programacao_itens
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role <> 'transportadora' and active = true
    )
  );

create policy "programacao_itens_select_transportadora" on public.programacao_itens
  for select using (
    programacao_id in (
      select p.id from public.programacao_carregamento p
      where p.transportadora_id in (select t.id from public.transportadoras t where t.profile_id = auth.uid())
    )
  );

-- A transportadora pode ATUALIZAR o agendamento dela, mas só para anexar o
-- motorista e enviar a solicitação — a função abaixo tranca as demais colunas.
create policy "programacao_update_transportadora" on public.programacao_carregamento
  for update using (
    transportadora_id in (select id from public.transportadoras where profile_id = auth.uid())
  );

-- Substitui só o CORPO da função criada em 024 e reescrita em 026 — o
-- trigger (trg_enforce_programacao_update) continua o mesmo. Mudanças:
--   1. transportadora passa a ser aceita, limitada a anexar motorista e
--      fazer a transição ENVIADO_TRANSPORTADORA → SOLICITADO;
--   2. o envio automático ao confirmar chegada agora grava programacao_id
--      na ordem criada (coluna da migration 056, usada pelo destaque na TV).
create or replace function public.enforce_programacao_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role      user_role;
  v_ordem_id  uuid;
  v_tem_itens boolean;
begin
  select role into v_role from public.profiles where id = auth.uid();

  if v_role not in ('admin', 'logistica', 'faturamento', 'transportadora') then
    raise exception 'Sem permissão para esta operação.';
  end if;

  if v_role = 'faturamento' then
    if (new.cliente    is distinct from old.cliente)
       or (new.data       is distinct from old.data)
       or (new.observacao is distinct from old.observacao) then
      raise exception 'Faturamento só pode confirmar a chegada do caminhão.';
    end if;
  end if;

  if v_role = 'transportadora' then
    -- Só pode mexer em motorista_id / solicitacao_status / solicitado_em,
    -- e só na transição ENVIADO_TRANSPORTADORA → SOLICITADO.
    if new.data                        is distinct from old.data
      or new.cliente                   is distinct from old.cliente
      or new.cliente_codigo            is distinct from old.cliente_codigo
      or new.observacao                is distinct from old.observacao
      or new.enviado_em                is distinct from old.enviado_em
      or new.confirmado_em             is distinct from old.confirmado_em
      or new.confirmado_por            is distinct from old.confirmado_por
      or new.transportadora_id         is distinct from old.transportadora_id
      or new.enviado_transportadora_em is distinct from old.enviado_transportadora_em
      or new.liberado_em               is distinct from old.liberado_em
      or new.liberado_por              is distinct from old.liberado_por
    then
      raise exception 'Transportadora só pode definir o motorista e enviar a solicitação.';
    end if;

    if new.solicitacao_status is distinct from old.solicitacao_status then
      if old.solicitacao_status <> 'ENVIADO_TRANSPORTADORA' or new.solicitacao_status <> 'SOLICITADO' then
        raise exception 'Transição de status inválida para transportadora.';
      end if;
      if new.motorista_id is null then
        raise exception 'Selecione o motorista antes de enviar a solicitação.';
      end if;
    end if;
  end if;

  -- Confirmação de chegada pela primeira vez → envia pra Ordens do Dia,
  -- se ainda não tiver sido enviado (manual ou automaticamente) antes.
  if new.confirmado_em is not null and old.confirmado_em is null and old.enviado_em is null then
    select exists(select 1 from public.programacao_itens where programacao_id = new.id) into v_tem_itens;

    if v_tem_itens then
      insert into public.ordens_diarias (data, cliente, placa, envelopar, iniciado, finalizado, programacao_id)
      values (new.data, new.cliente, '', false, false, false, new.id)
      returning id into v_ordem_id;

      insert into public.ordem_itens (ordem_id, formula_id, quantidade, embalagem)
      select v_ordem_id, formula_id, quantidade, embalagem
      from public.programacao_itens
      where programacao_id = new.id;

      new.enviado_em := now();
    end if;
  end if;

  return new;
end;
$$;

-- ─── RECEBIMENTOS PREVISTOS DE MATÉRIA-PRIMA ─────────────────
-- Lançado pela Logística; exibido no painel de TV pra equipe saber o que
-- está chegando de material.
create table public.recebimentos_previstos (
  id             uuid primary key default uuid_generate_v4(),
  data_prevista  date not null,
  materia_prima  text not null,
  quantidade_ton numeric(10,2) not null default 0 check (quantidade_ton >= 0),
  fornecedor     text not null default '',
  observacao     text not null default '',
  recebido       boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_recebimentos_data on public.recebimentos_previstos(data_prevista);

create trigger trg_recebimentos_updated_at
  before update on public.recebimentos_previstos
  for each row execute function public.update_updated_at();

alter table public.recebimentos_previstos enable row level security;

-- Papéis internos leem (TV, programação); transportadora não precisa ver.
create policy "recebimentos_select_internos" on public.recebimentos_previstos
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role <> 'transportadora' and active = true
    )
  );

create policy "recebimentos_write_admin_logistica" on public.recebimentos_previstos
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'logistica') and active = true
    )
  );

-- ─── REALTIME ────────────────────────────────────────────────
alter publication supabase_realtime add table public.recebimentos_previstos;
alter table public.recebimentos_previstos replica identity full;
