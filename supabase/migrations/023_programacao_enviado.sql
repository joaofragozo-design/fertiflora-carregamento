-- ============================================================
-- FERTI FLORA — Migration 023: marcar programação como enviada
-- ============================================================
-- Quando o Fransua clica "Enviar para Ordens do Dia", registramos quando
-- foi enviado — vira um selo na tela (não bloqueia reenvio intencional).

alter table public.programacao_carregamento add column if not exists enviado_em timestamptz;
