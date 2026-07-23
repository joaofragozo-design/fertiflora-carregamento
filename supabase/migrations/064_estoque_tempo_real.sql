-- ============================================================
-- FERTI FLORA — Migration 064: Estoque de matéria-prima em tempo real
-- ============================================================
-- Fase 2 do módulo de recebimento: saldo por matéria-prima, atualizado
-- automaticamente quando uma carga COMEÇA a ser carregada (desconta) e
-- quando um recebimento é CONFIRMADO (soma) — sempre pelos mesmos eventos
-- que já disparam o resto do fluxo (iniciado/confirmado_em), sem precisar
-- de nenhuma ação manual extra da Logística/Faturamento.
--
-- Duas tabelas:
--   estoque_movimentos — ledger insert-only (auditoria: o que mexeu, quando,
--     por causa de quê). Nunca é editado depois de criado.
--   estoque_atual       — saldo materializado por matéria-prima, mantido em
--     sincronia com o ledger via trigger. É o que a tela de TV lê/assina em
--     tempo real (ledger cresce sem limite; saldo é sempre 1 linha por MP).

-- ─── ESTOQUE ATUAL (saldo materializado) ─────────────────────
create table public.estoque_atual (
  materia_prima_key text primary key,
  quantidade_ton     numeric(12,3) not null default 0,
  updated_at         timestamptz not null default now()
);

insert into public.estoque_atual (materia_prima_key) values
  ('ureia'), ('cloreto_potassio'), ('map'), ('carbonato_ca_mg'), ('mo'), ('sulfato_amonia'),
  ('calcario_concha'), ('boro'), ('enxofre_pastilhado'), ('fte_br_12'), ('oxmag_s'), ('tsp'),
  ('caltimag'), ('hiphos_25')
on conflict do nothing;

alter table public.estoque_atual enable row level security;

create policy "estoque_atual_select_internos" on public.estoque_atual
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role <> 'transportadora' and active = true)
  );

-- ─── CONFIGURAÇÃO DE LIMITES (termômetro por matéria-prima) ──
-- 3 limites (em toneladas) definem 4 faixas: perigo, cuidado, tudo bem,
-- bem tranquilo (acima de limite_confortavel).
create table public.estoque_config (
  materia_prima_key  text primary key references public.estoque_atual(materia_prima_key),
  limite_perigo      numeric(12,3) not null default 0,
  limite_cuidado     numeric(12,3) not null default 0,
  limite_confortavel numeric(12,3) not null default 0,
  updated_at         timestamptz not null default now()
);

insert into public.estoque_config (materia_prima_key)
select materia_prima_key from public.estoque_atual
on conflict do nothing;

create trigger trg_estoque_config_updated_at
  before update on public.estoque_config
  for each row execute function public.update_updated_at();

alter table public.estoque_config enable row level security;

create policy "estoque_config_select_internos" on public.estoque_config
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role <> 'transportadora' and active = true)
  );

create policy "estoque_config_write_admin_logistica" on public.estoque_config
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'logistica') and active = true)
  );

-- ─── LEDGER DE MOVIMENTOS ─────────────────────────────────────
create table public.estoque_movimentos (
  id                uuid primary key default uuid_generate_v4(),
  materia_prima_key text not null references public.estoque_atual(materia_prima_key),
  quantidade_ton    numeric(12,3) not null, -- positivo = entra, negativo = sai
  origem            text not null check (origem in ('CARREGAMENTO', 'RECEBIMENTO', 'CSV', 'AJUSTE_MANUAL')),
  referencia_id     uuid, -- id da ordem_diaria ou do recebimento_previsto, quando aplicável
  observacao        text not null default '',
  created_at        timestamptz not null default now(),
  created_por       text not null default ''
);

create index idx_estoque_movimentos_mp on public.estoque_movimentos(materia_prima_key, created_at);

alter table public.estoque_movimentos enable row level security;

create policy "estoque_movimentos_select_internos" on public.estoque_movimentos
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role <> 'transportadora' and active = true)
  );

-- Insert direto (fora de trigger) só pra CSV/ajuste manual, feito por admin/logistica.
create policy "estoque_movimentos_insert_admin_logistica" on public.estoque_movimentos
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'logistica') and active = true)
  );

-- Todo INSERT no ledger atualiza o saldo materializado.
create or replace function public.aplicar_movimento_estoque()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.estoque_atual
  set quantidade_ton = quantidade_ton + new.quantidade_ton,
      updated_at = now()
  where materia_prima_key = new.materia_prima_key;

  return new;
end;
$$;

create trigger trg_aplicar_movimento_estoque
  after insert on public.estoque_movimentos
  for each row execute function public.aplicar_movimento_estoque();

-- ─── DESCONTO AO INICIAR UM CARREGAMENTO ──────────────────────
-- Dispara na transição de `iniciado` em ordens_diarias.
--   true  (iniciar) → desconta com base no que a carga TEM AGORA (snapshot
--     do momento em que começou a carregar).
--   false (reabrir) → NÃO relê ordem_itens (que pode ter mudado de fórmula/
--     quantidade nesse meio tempo, o que faria o estorno devolver o valor
--     ERRADO) -- em vez disso, soma o que este ordem_id já debitou no
--     próprio ledger e estorna exatamente isso. Reinício posterior debita de
--     novo com base no estado atual (correto, já que reabrir+editar+reiniciar
--     é o fluxo esperado pra corrigir fórmula/quantidade de uma carga já
--     iniciada).
-- Limitação aceita: editar item (fórmula/quantidade) SEM reabrir a carga
-- (ou seja, com iniciado ainda true) não gera nenhum ajuste — não existe
-- trigger em ordem_itens, só em ordens_diarias.iniciado. Pra corrigir uma
-- carga já iniciada, reabra, edite, e inicie de novo.
create or replace function public.movimentar_estoque_carregamento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item  record;
  v_mp    record;
  v_tons  numeric;
begin
  if new.iniciado is distinct from old.iniciado then
    if new.iniciado then
      for v_item in
        select oi.tons, f.*
        from public.ordem_itens oi
        join public.formulas f on f.id = oi.formula_id
        where oi.ordem_id = new.id
      loop
        -- `proporcao`: valor bruto da coluna da fórmula (0 a ~0,5 = fração de
        -- 1 tonelada de produto final) — NÃO multiplicado por 1000 como em
        -- calcularMateriaPrima() do app (aquilo dá kg/ton; aqui já queremos
        -- o resultado direto em toneladas, então `tons_do_item * proporcao`
        -- já fecha a conta sem precisar escalar por 1000 e depois desfazer).
        for v_mp in
          select key, value::numeric as proporcao
          from jsonb_each_text(to_jsonb(v_item))
          where key in (
            'ureia', 'cloreto_potassio', 'map', 'carbonato_ca_mg', 'mo', 'sulfato_amonia',
            'calcario_concha', 'boro', 'enxofre_pastilhado', 'fte_br_12', 'oxmag_s', 'tsp',
            'caltimag', 'hiphos_25'
          )
        loop
          if v_mp.proporcao > 0 then
            v_tons := round((v_item.tons * v_mp.proporcao)::numeric, 3);
            insert into public.estoque_movimentos (materia_prima_key, quantidade_ton, origem, referencia_id, observacao)
            values (v_mp.key, -v_tons, 'CARREGAMENTO', new.id, 'Carga ' || coalesce(new.cliente, '') || ' · placa ' || coalesce(new.placa, ''));
          end if;
        end loop;
      end loop;
    else
      for v_mp in
        select materia_prima_key, sum(quantidade_ton) as total
        from public.estoque_movimentos
        where referencia_id = new.id and origem = 'CARREGAMENTO'
        group by materia_prima_key
      loop
        if v_mp.total <> 0 then
          insert into public.estoque_movimentos (materia_prima_key, quantidade_ton, origem, referencia_id, observacao)
          values (v_mp.materia_prima_key, -v_mp.total, 'CARREGAMENTO', new.id, 'Estorno (reabertura) da carga ' || coalesce(new.cliente, '') || ' · placa ' || coalesce(new.placa, ''));
        end if;
      end loop;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_movimentar_estoque_carregamento on public.ordens_diarias;
create trigger trg_movimentar_estoque_carregamento
  after update on public.ordens_diarias
  for each row execute function public.movimentar_estoque_carregamento();

-- Excluir uma carga que já tinha sido iniciada (estoque já descontado) —
-- sem isso o desconto ficava permanente e órfão, sem forma de estornar.
create or replace function public.reverter_estoque_ao_excluir_ordem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mp record;
begin
  if old.iniciado then
    for v_mp in
      select materia_prima_key, sum(quantidade_ton) as total
      from public.estoque_movimentos
      where referencia_id = old.id and origem = 'CARREGAMENTO'
      group by materia_prima_key
    loop
      if v_mp.total <> 0 then
        insert into public.estoque_movimentos (materia_prima_key, quantidade_ton, origem, referencia_id, observacao)
        values (v_mp.materia_prima_key, -v_mp.total, 'CARREGAMENTO', old.id, 'Estorno (carga excluída) ' || coalesce(old.cliente, ''));
      end if;
    end loop;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_reverter_estoque_ao_excluir_ordem on public.ordens_diarias;
create trigger trg_reverter_estoque_ao_excluir_ordem
  after delete on public.ordens_diarias
  for each row execute function public.reverter_estoque_ao_excluir_ordem();

-- ─── SOMA AO CONFIRMAR UM RECEBIMENTO ─────────────────────────
-- Dispara na transição de `confirmado_em` em recebimentos_previstos: chegou
-- agora = soma; desfeito (confirmado_em volta a null) = subtrai de volta.
-- Registros antigos sem materia_prima_key (texto livre legado) não geram
-- movimento — não há como mapear pra uma matéria-prima conhecida.
create or replace function public.movimentar_estoque_recebimento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.confirmado_em is distinct from old.confirmado_em then
    if new.confirmado_em is not null and old.confirmado_em is null and new.materia_prima_key is not null then
      insert into public.estoque_movimentos (materia_prima_key, quantidade_ton, origem, referencia_id, observacao)
      values (new.materia_prima_key, new.quantidade_ton, 'RECEBIMENTO', new.id, 'Recebimento · placa ' || coalesce(new.placa, ''));
    elsif new.confirmado_em is null and old.confirmado_em is not null and old.materia_prima_key is not null then
      insert into public.estoque_movimentos (materia_prima_key, quantidade_ton, origem, referencia_id, observacao)
      values (old.materia_prima_key, -old.quantidade_ton, 'RECEBIMENTO', old.id, 'Desfaz recebimento · placa ' || coalesce(old.placa, ''));
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_movimentar_estoque_recebimento on public.recebimentos_previstos;
create trigger trg_movimentar_estoque_recebimento
  after update on public.recebimentos_previstos
  for each row execute function public.movimentar_estoque_recebimento();

-- Excluir um recebimento já confirmado (estoque já somado) — sem isso a
-- soma ficava permanente e órfã, sem forma de estornar.
create or replace function public.reverter_estoque_ao_excluir_recebimento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.confirmado_em is not null and old.materia_prima_key is not null then
    insert into public.estoque_movimentos (materia_prima_key, quantidade_ton, origem, referencia_id, observacao)
    values (old.materia_prima_key, -old.quantidade_ton, 'RECEBIMENTO', old.id, 'Estorno (recebimento excluído)');
  end if;
  return old;
end;
$$;

drop trigger if exists trg_reverter_estoque_ao_excluir_recebimento on public.recebimentos_previstos;
create trigger trg_reverter_estoque_ao_excluir_recebimento
  after delete on public.recebimentos_previstos
  for each row execute function public.reverter_estoque_ao_excluir_recebimento();

-- ─── REALTIME ─────────────────────────────────────────────────
alter publication supabase_realtime add table public.estoque_atual;
alter table public.estoque_atual replica identity full;
