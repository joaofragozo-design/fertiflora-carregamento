-- ============================================================
-- FERTI FLORA — Migration 067: Número de ordem de carregamento
-- ============================================================
-- Número sequencial e IMUTÁVEL, atribuído automaticamente no momento em que
-- a Logística libera a solicitação (solicitacao_status vira 'LIBERADO') —
-- é o número impresso no PDF da ordem de carregamento entregue ao motorista.
--
-- Diferente de `ordens_diarias.sequencia` (fila do dia, livremente
-- reordenável pela Logística): este número nunca muda depois de atribuído,
-- por isso mora aqui em `programacao_carregamento` (o registro da
-- solicitação/liberação) e não em `ordens_diarias`.

create sequence if not exists public.numero_ordem_carregamento_seq start 1;

alter table public.programacao_carregamento
  add column if not exists numero_ordem integer unique;

create or replace function public.atribuir_numero_ordem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.solicitacao_status = 'LIBERADO' and new.numero_ordem is null then
    new.numero_ordem := nextval('public.numero_ordem_carregamento_seq');
  end if;
  return new;
end;
$$;

-- Nome do trigger escolhido de propósito ("trg_programacao_...", não
-- "trg_atribuir_...") — Postgres dispara múltiplos triggers BEFORE ROW na
-- mesma tabela em ordem ALFABÉTICA pelo nome do trigger, e
-- trg_enforce_programacao_update (024/058/060) PRECISA rodar antes deste:
-- senão, uma tentativa inválida (ex.: transportadora tentando forjar
-- solicitacao_status='LIBERADO' direto, fora da UI) consumiria um número da
-- sequence via nextval() e só DEPOIS seria rejeitada pelo enforce — e
-- nextval() não é revertido por ROLLBACK, então o número ficaria queimado
-- pra sempre. Com "trg_programacao_..." (que soa depois de "trg_enforce_"
-- alfabeticamente), o enforce roda primeiro e barra a tentativa inválida
-- antes de qualquer nextval() ser chamado.
drop trigger if exists trg_atribuir_numero_ordem on public.programacao_carregamento;
drop trigger if exists trg_programacao_atribuir_numero_ordem on public.programacao_carregamento;
create trigger trg_programacao_atribuir_numero_ordem
  before insert or update on public.programacao_carregamento
  for each row execute function public.atribuir_numero_ordem();

-- ─── BACKFILL: solicitações já liberadas ANTES desta migration ─────────────
-- O trigger acima só dispara numa futura MUDANÇA de status — sem isso,
-- solicitações que já estavam 'LIBERADO' (ex.: as que a Logística liberou
-- antes de rodar esta migration) ficariam para sempre sem número e sem PDF.
-- Backfill ordenado por liberado_em pra refletir a ordem real de liberação.
update public.programacao_carregamento t
set numero_ordem = sub.novo_numero
from (
  select id, row_number() over (order by liberado_em) as novo_numero
  from public.programacao_carregamento
  where solicitacao_status = 'LIBERADO' and numero_ordem is null
) sub
where t.id = sub.id;

-- Avança a sequence pra não colidir com os números usados no backfill.
select setval(
  'public.numero_ordem_carregamento_seq',
  coalesce((select max(numero_ordem) from public.programacao_carregamento), 0) + 1,
  false
);

-- ─── FECHA A BLOCKLIST DE enforce_programacao_update PRA numero_ordem ──────
-- `numero_ordem` é uma coluna nova — sem essa atualização, a checagem de
-- faturamento/transportadora (migration 060) simplesmente não sabe que ela
-- existe, e um update() direto (fora da UI) poderia forjar/apagar o número
-- oficial da ordem. Mesma classe de bug já corrigida duas vezes antes neste
-- arquivo (blocklist não é allowlist: toda coluna nova tem que ser somada
-- manualmente). Redeclaração completa da função de 060, só com essa adição.
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
    if new.data                        is distinct from old.data
      or new.cliente                   is distinct from old.cliente
      or new.cliente_codigo            is distinct from old.cliente_codigo
      or new.observacao                is distinct from old.observacao
      or new.enviado_em                is distinct from old.enviado_em
      or new.transportadora_id         is distinct from old.transportadora_id
      or new.motorista_id              is distinct from old.motorista_id
      or new.solicitacao_status        is distinct from old.solicitacao_status
      or new.enviado_transportadora_em is distinct from old.enviado_transportadora_em
      or new.solicitado_em             is distinct from old.solicitado_em
      or new.liberado_em               is distinct from old.liberado_em
      or new.liberado_por              is distinct from old.liberado_por
      or new.numero_ordem              is distinct from old.numero_ordem
    then
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
      or new.numero_ordem              is distinct from old.numero_ordem
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
