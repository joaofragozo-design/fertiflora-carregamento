-- ============================================================
-- FERTI FLORA — Migration 065: Transportadora/motorista/nota no recebimento
-- ============================================================
-- A migration 063 (já aplicada) só tinha um campo `placa` genérico. Agora o
-- recebimento ganha os mesmos dados que o carregamento já tem sobre quem
-- está trazendo a carga: transportadora (reaproveitando a MESMA tabela
-- `transportadoras` da migration 058 — não é uma entidade nova), nome do
-- motorista (texto simples — recebimento não precisa do fluxo de login/
-- WhatsApp da tabela `motoristas`, só do registro de quem dirigiu),
-- número da nota fiscal, e a mesma lógica de placas do motorista de
-- carregamento (cavalo + reboque 1 obrigatórios, reboques 2-4 opcionais).
alter table public.recebimentos_previstos
  add column if not exists transportadora_id uuid references public.transportadoras(id) on delete set null,
  add column if not exists motorista_nome     text not null default '',
  add column if not exists numero_nota        text not null default '',
  add column if not exists placa_cavalo       text not null default '',
  add column if not exists placa_1            text not null default '',
  add column if not exists placa_2            text,
  add column if not exists placa_3            text,
  add column if not exists placa_4            text;

-- Backfill: usa o `placa` antigo (texto livre, migration 063) como placa do
-- cavalo pros recebimentos já lançados antes desta migration.
update public.recebimentos_previstos
set placa_cavalo = placa
where placa_cavalo = '' and placa <> '';

-- Redefine a função de trava do faturamento (criada na 063, já aplicada) —
-- as colunas novas entram na lista desde já, pra não repetir o mesmo furo
-- que a migration 060 corrigiu em programacao_carregamento (colunas novas
-- esquecidas na blocklist).
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
      or new.transportadora_id  is distinct from old.transportadora_id
      or new.motorista_nome     is distinct from old.motorista_nome
      or new.numero_nota        is distinct from old.numero_nota
      or new.placa_cavalo       is distinct from old.placa_cavalo
      or new.placa_1            is distinct from old.placa_1
      or new.placa_2            is distinct from old.placa_2
      or new.placa_3            is distinct from old.placa_3
      or new.placa_4            is distinct from old.placa_4
    then
      raise exception 'Faturamento só pode confirmar a chegada do caminhão.';
    end if;
  end if;

  if new.recebido is distinct from (new.confirmado_em is not null) then
    raise exception '`recebido` precisa ficar em sincronia com confirmado_em -- use confirmarChegada().';
  end if;

  return new;
end;
$$;
