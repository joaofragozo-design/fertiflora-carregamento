-- Adiciona CANCELADO ao enum carregamento_status
ALTER TYPE carregamento_status ADD VALUE IF NOT EXISTS 'CANCELADO';
