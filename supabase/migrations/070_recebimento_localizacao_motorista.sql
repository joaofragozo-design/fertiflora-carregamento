-- ============================================================
-- FERTI FLORA — Migration 070: Localização ao vivo do motorista
-- ============================================================
-- O motorista de matéria-prima, ao abrir o link de chegada (/chegada/[id]),
-- pode optar por compartilhar a localização enquanto viaja — atualizada
-- periodicamente nestas 3 colunas (só a posição mais recente, não um
-- histórico de trajeto). Logística/Faturamento acompanham num mapa ao vivo
-- via Realtime, reaproveitando a mesma assinatura que já existe em
-- `recebimentos_previstos` (nenhuma mudança de frontend adicional
-- necessária além de ler os novos campos).
--
-- Sem coluna de status separada: `motorista_localizacao_em` recente (ex.:
-- últimos 5-10 min) indica "compartilhamento ativo agora"; se parar de
-- atualizar, a UI trata como offline (o motorista fechou a página).

alter table public.recebimentos_previstos
  add column if not exists motorista_lat           double precision,
  add column if not exists motorista_lng           double precision,
  add column if not exists motorista_localizacao_em timestamptz;

-- ─── REALTIME ─────────────────────────────────────────────────
-- `recebimentos_previstos` provavelmente já está na publicação (usada pelo
-- hook use-recebimentos-semana) — `add table` é idempotente via exceção
-- tratada, mas replica identity full pode ser redefinido sem problema.
do $$
begin
  alter publication supabase_realtime add table public.recebimentos_previstos;
exception
  when duplicate_object then null;
end $$;

alter table public.recebimentos_previstos replica identity full;
