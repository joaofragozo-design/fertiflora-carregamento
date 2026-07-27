-- ============================================================
-- FERTI FLORA — Migration 069: Faturamento passa a operar todo o recebimento
-- ============================================================
-- Consolida as 3 etapas do recebimento de matéria-prima (confirmar chegada,
-- iniciar descarga, finalizar descarga) no Faturamento. `logistica_02`
-- (Richardson) deixa de ter permissão de escrita nesse fluxo — mantém apenas
-- leitura (já garantida pela policy ampla de SELECT da migration 058, não
-- precisa de mudança aqui).
--
-- Também muda QUANDO o estoque soma: antes somava na CONFIRMAÇÃO DE CHEGADA
-- (068 e anteriores); agora soma só na FINALIZAÇÃO DA DESCARGA — reflete
-- melhor a realidade física (só é estoque de verdade o que foi de fato
-- descarregado e conferido, não o que só chegou no portão).

-- ─── Remove a permissão de escrita do logistica_02 ───────────────────────
drop policy if exists "recebimentos_logistica02_descarga" on public.recebimentos_previstos;

-- ─── enforce_recebimento_update: Faturamento ganha iniciar/finalizar,
--     logistica_02 sai da lista de roles permitidos ──────────────────────
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
      or new.transportadora_id  is distinct from old.transportadora_id
      or new.motorista_nome     is distinct from old.motorista_nome
      or new.numero_nota        is distinct from old.numero_nota
      or new.placa_cavalo       is distinct from old.placa_cavalo
      or new.placa_1            is distinct from old.placa_1
      or new.placa_2            is distinct from old.placa_2
      or new.placa_3            is distinct from old.placa_3
      or new.placa_4            is distinct from old.placa_4
      or new.observacao         is distinct from old.observacao
    then
      raise exception 'Faturamento só pode confirmar chegada e iniciar/finalizar a descarga.';
    end if;

    -- Imutável depois de setado — mesma proteção que já existia pro
    -- logistica_02 (068): bloqueia desfazer e bloqueia reexecutar a mesma
    -- transição (2 cliques concorrentes / duas abas).
    if old.iniciado_em is not null and new.iniciado_em is distinct from old.iniciado_em then
      raise exception 'A descarga já foi iniciada — não é possível alterar.';
    end if;
    if old.finalizado_em is not null and new.finalizado_em is distinct from old.finalizado_em then
      raise exception 'A descarga já foi finalizada — não é possível alterar.';
    end if;

    if new.iniciado_em is distinct from old.iniciado_em and new.iniciado_em is not null and old.confirmado_em is null then
      raise exception 'Só é possível iniciar a descarga depois da chegada confirmada.';
    end if;
    if new.finalizado_em is distinct from old.finalizado_em and new.finalizado_em is not null and old.iniciado_em is null then
      raise exception 'Só é possível finalizar depois de iniciar a descarga.';
    end if;
  end if;

  -- `recebido` (coluna antiga, migration 058) precisa sempre refletir se
  -- confirmado_em está preenchido.
  if new.recebido is distinct from (new.confirmado_em is not null) then
    raise exception '`recebido` precisa ficar em sincronia com confirmado_em -- use confirmarChegada().';
  end if;

  return new;
end;
$$;

-- ─── movimentar_estoque_recebimento: soma no FINALIZADO, não no CONFIRMADO ─
create or replace function public.movimentar_estoque_recebimento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.finalizado_em is distinct from old.finalizado_em then
    if new.finalizado_em is not null and old.finalizado_em is null and new.materia_prima_key is not null then
      insert into public.estoque_movimentos (materia_prima_key, quantidade_ton, origem, referencia_id, observacao)
      values (new.materia_prima_key, new.quantidade_ton, 'RECEBIMENTO', new.id, 'Recebimento finalizado · placa ' || coalesce(new.placa_cavalo, new.placa, ''));
    elsif new.finalizado_em is null and old.finalizado_em is not null and old.materia_prima_key is not null then
      insert into public.estoque_movimentos (materia_prima_key, quantidade_ton, origem, referencia_id, observacao)
      values (old.materia_prima_key, -old.quantidade_ton, 'RECEBIMENTO', old.id, 'Desfaz recebimento finalizado · placa ' || coalesce(old.placa_cavalo, old.placa, ''));
    end if;
  end if;

  return new;
end;
$$;

-- ─── reverter_estoque_ao_excluir_recebimento: só estorna se já tinha
--     finalizado (é o momento que agora credita o estoque) ────────────────
create or replace function public.reverter_estoque_ao_excluir_recebimento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.finalizado_em is not null and old.materia_prima_key is not null then
    insert into public.estoque_movimentos (materia_prima_key, quantidade_ton, origem, referencia_id, observacao)
    values (old.materia_prima_key, -old.quantidade_ton, 'RECEBIMENTO', old.id, 'Estorno (recebimento excluído)');
  end if;
  return old;
end;
$$;

-- ─── Backfill: realinha recebimentos em trânsito com a nova regra ────────
-- Registros que já foram confirmados (chegada) mas ainda não finalizaram a
-- descarga tinham sido creditados no estoque pela regra ANTIGA (na
-- confirmação). Pela regra NOVA, esse crédito só deveria existir depois de
-- finalizado_em. Estorna agora o que foi creditado prematuramente; quando
-- esses registros forem finalizados, o trigger novo credita corretamente
-- nesse momento. Idempotente: some(quantidade_ton) por referencia_id já
-- estornado dá 0, então uma segunda execução não estorna de novo.
insert into public.estoque_movimentos (materia_prima_key, quantidade_ton, origem, referencia_id, observacao, created_por)
select r.materia_prima_key, -saldo.net, 'RECEBIMENTO', r.id,
       'Estorno técnico (migration 069) — recreditado na finalização da descarga',
       'migration_069'
from public.recebimentos_previstos r
join (
  select referencia_id, sum(quantidade_ton) as net
  from public.estoque_movimentos
  where origem = 'RECEBIMENTO'
  group by referencia_id
) saldo on saldo.referencia_id = r.id
where r.confirmado_em is not null
  and r.finalizado_em is null
  and r.materia_prima_key is not null
  and saldo.net <> 0;
