-- ============================================================
-- FERTI FLORA — Migration 074: carga confirmada também gera a ordem
-- ============================================================
-- Bug (relatado em 01/10/2026): quando a Logística confirmava a carga
-- (confirmado_em) ANTES de a transportadora indicar o motorista — ou
-- confirmava sem clicar "Liberar" —, a carga sumia da fila de liberação
-- (que só lista não confirmadas) e nunca virava LIBERADO, então o
-- numero_ordem (migration 067, atribuído na liberação) nunca era gerado.
-- 16 cargas assim entre 22/09 e 01/10.
--
-- Regra nova (decidida pelo usuário): carga confirmada = carga liberada.
--   1. Transportadora indica o motorista numa carga JÁ confirmada →
--      vai direto pra LIBERADO e o número da ordem sai na hora.
--   2. Logística confirma uma carga que já estava SOLICITADO (motorista
--      indicado, faltando o "Liberar") → libera junto.
-- O trigger de número (trg_programacao_atribuir_numero_ordem) roda DEPOIS
-- deste (ordem alfabética, ver 067) e enxerga o LIBERADO → atribui o nº.
--
-- Também corrige uma regressão da 071: ao redeclarar esta função ela
-- voltou à versão antiga e perdeu (a) a trava de numero_ordem pra
-- transportadora/faturamento e (b) a lista completa de colunas que o
-- faturamento não pode mexer (060/067). Redeclaração completa abaixo.

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
      or new.whatsapp_enviado_em       is distinct from old.whatsapp_enviado_em
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
      or new.whatsapp_enviado_em       is distinct from old.whatsapp_enviado_em
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

      -- (1) Carga já confirmada pela Logística: libera na hora → gera a ordem.
      if old.confirmado_em is not null then
        new.solicitacao_status := 'LIBERADO';
        new.liberado_em        := now();
        new.liberado_por       := 'Automático (carga já confirmada)';
      end if;
    end if;
  end if;

  -- (2) Logística confirma uma carga que já tinha motorista indicado e
  -- estava esperando o "Liberar" → libera junto, pra ordem sair.
  if new.confirmado_em is not null and old.confirmado_em is null
     and new.solicitacao_status = 'SOLICITADO' and new.motorista_id is not null then
    new.solicitacao_status := 'LIBERADO';
    new.liberado_em        := coalesce(new.liberado_em, now());
    new.liberado_por       := coalesce(new.liberado_por, 'Automático (carga confirmada)');
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

-- ─── BACKFILL: cargas confirmadas com motorista e sem ordem ────────────────
-- Aprovado pelo usuário em 01/10/2026 (eram 10). Libera na ordem em que
-- foram confirmadas, pra numeração refletir a sequência real.
do $$
declare
  r record;
begin
  for r in
    select id, confirmado_em
    from public.programacao_carregamento
    where confirmado_em is not null
      and solicitacao_status = 'SOLICITADO'
      and motorista_id is not null
      and numero_ordem is null
    order by confirmado_em, created_at
  loop
    update public.programacao_carregamento
       set solicitacao_status = 'LIBERADO',
           liberado_em        = r.confirmado_em,
           liberado_por       = 'Automático (carga confirmada)'
     where id = r.id;
  end loop;
end;
$$;

-- Conferência: deve listar as cargas recém-liberadas com o número da ordem.
select data, cliente, numero_ordem, liberado_por
from public.programacao_carregamento
where liberado_por like 'Automático%'
order by numero_ordem;
