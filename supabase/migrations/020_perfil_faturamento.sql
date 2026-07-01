-- ============================================================
-- FERTI FLORA — Migration 020: perfil de Faturamento (somente leitura)
-- ============================================================
-- Faturamento acompanha as telas de Ordens e Programação em tempo real,
-- sem editar nada. As policies de SELECT já liberam qualquer autenticado;
-- como 'faturamento' não está em nenhuma policy de escrita, fica read-only.

alter type user_role add value if not exists 'faturamento';
