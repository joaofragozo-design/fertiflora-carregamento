-- Corrige um furo de autorização introduzido pela migration 058: o bloco
-- `v_role = 'faturamento'` em enforce_programacao_update() só travava
-- cliente/data/observacao (lista herdada da migration 024, de antes do
-- fluxo de transportadora existir). Como a trava era uma BLOCKLIST, as
-- colunas novas de transportadora_id/motorista_id/solicitacao_status/
-- liberado_em/liberado_por (058) NUNCA entraram nela -- faturamento tem
-- policy de UPDATE liberada pra linha inteira (024, "programacao_faturamento_
-- confirmar"), então um usuário faturamento podia, via update() direto
-- (fora da UI, que não expõe isso), setar solicitacao_status='LIBERADO',
-- forjar liberado_por, ou trocar motorista_id/transportadora_id sem
-- nenhuma restrição.
--
-- Troca pra ALLOWLIST (só confirmado_em/confirmado_por podem mudar) --
-- assim qualquer coluna nova futura fica travada por padrão, em vez de
-- aberta por padrão até alguém lembrar de adicionar na blocklist.
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
