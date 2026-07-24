-- ============================================================
-- FERTI FLORA — Migration 068: Acompanhamento de descarga do recebimento
-- ============================================================
-- Estende o fluxo de recebimento com duas etapas novas depois da chegada
-- confirmada pelo Faturamento: Richardson (logistica_02) marca quando começa
-- e quando termina a descarga do caminhão na fábrica.
--
-- Estados (derivados dos timestamps, sem coluna de status separada — mesmo
-- padrão de ordens_diarias.iniciado/finalizado):
--   confirmado_em null              → Aguardando chegada
--   confirmado_em set, iniciado null → Aguardando na fila
--   iniciado_em set, finalizado null → Descarregando
--   finalizado_em set               → Finalizado
--
-- O estoque continua sendo somado no momento da CHEGADA (confirmado_em),
-- como já era antes desta migration -- essas duas etapas novas são só
-- acompanhamento operacional, não mexem em estoque_movimentos.

alter table public.recebimentos_previstos
  add column if not exists iniciado_em    timestamptz,
  add column if not exists iniciado_por   text,
  add column if not exists finalizado_em  timestamptz,
  add column if not exists finalizado_por text;

-- ─── RLS: Richardson (logistica_02) inicia/finaliza a descarga ───────────
create policy "recebimentos_logistica02_descarga" on public.recebimentos_previstos
  for update using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'logistica_02' and active = true
    )
  );

-- Redeclaração completa de enforce_recebimento_update (063) — adiciona
-- logistica_02 aos papéis permitidos, restringe o que ele pode tocar (só
-- iniciado_em/iniciado_por/finalizado_em/finalizado_por, com transição
-- válida), e fecha as 4 colunas novas na blocklist do faturamento (mesma
-- classe de bug já corrigida antes neste projeto: coluna nova esquecida na
-- blocklist de um role restrito por allowlist-via-blocklist).
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

  if v_role not in ('admin', 'logistica', 'faturamento', 'logistica_02') then
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
      or new.iniciado_em        is distinct from old.iniciado_em
      or new.iniciado_por       is distinct from old.iniciado_por
      or new.finalizado_em      is distinct from old.finalizado_em
      or new.finalizado_por     is distinct from old.finalizado_por
    then
      raise exception 'Faturamento só pode confirmar a chegada do caminhão.';
    end if;
  end if;

  if v_role = 'logistica_02' then
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
      or new.confirmado_em      is distinct from old.confirmado_em
      or new.confirmado_por     is distinct from old.confirmado_por
      or new.recebido           is distinct from old.recebido
    then
      raise exception 'Richardson só pode iniciar/finalizar a descarga.';
    end if;

    -- Imutável depois de setado -- bloqueia tanto "desfazer" (voltar pra null,
    -- sem deixar rastro) quanto reexecutar a mesma transição (2 cliques
    -- concorrentes na mesma linha: o segundo commit sempre vê old.* já
    -- preenchido e cai aqui, em vez de sobrescrever iniciado_por/finalizado_por
    -- do primeiro em silêncio).
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
