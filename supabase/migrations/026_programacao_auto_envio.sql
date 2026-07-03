-- ============================================================
-- FERTI FLORA — Migration 026: envio automático ao confirmar chegada
-- ============================================================
-- Quando confirmado_em é preenchido pela primeira vez (Faturamento ou
-- admin), envia automaticamente o agendamento para as Ordens do Dia —
-- mesmo o Faturamento não tendo permissão de escrita em ordens_diarias.
-- Isso roda dentro do próprio trigger de permissão (SECURITY DEFINER),
-- então funciona mesmo sem dar ao Faturamento acesso às tabelas de ordens.
--
-- Substitui só o CORPO da função já criada em 024 — o trigger
-- (trg_enforce_programacao_update) continua o mesmo.

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

  if v_role not in ('admin', 'logistica', 'faturamento') then
    raise exception 'Sem permissão para esta operação.';
  end if;

  if v_role = 'faturamento' then
    if (new.cliente    is distinct from old.cliente)
       or (new.data       is distinct from old.data)
       or (new.observacao is distinct from old.observacao) then
      raise exception 'Faturamento só pode confirmar a chegada do caminhão.';
    end if;
  end if;

  -- Confirmação de chegada pela primeira vez → envia pra Ordens do Dia,
  -- se ainda não tiver sido enviado (manual ou automaticamente) antes.
  if new.confirmado_em is not null and old.confirmado_em is null and old.enviado_em is null then
    select exists(select 1 from public.programacao_itens where programacao_id = new.id) into v_tem_itens;

    if v_tem_itens then
      insert into public.ordens_diarias (data, cliente, placa, envelopar, iniciado, finalizado)
      values (new.data, new.cliente, '', false, false, false)
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
