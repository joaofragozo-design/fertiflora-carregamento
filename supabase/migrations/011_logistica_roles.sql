-- ============================================================
-- FERTI FLORA — Ordens Diárias
-- Migration 011: Novos perfis de Logística
-- ============================================================
-- IMPORTANTE: valores novos de enum precisam estar COMMITADOS antes
-- de serem referenciados em policies/triggers. Por isso a criação
-- dos perfis fica isolada nesta migration, separada do schema (012).
--
-- logistica     → edita os dados das ordens (cliente, placa, etc.)
-- logistica_02  → marca apenas Iniciado / Finalizado

alter type user_role add value if not exists 'logistica';
alter type user_role add value if not exists 'logistica_02';
