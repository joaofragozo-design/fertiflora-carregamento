-- ============================================================
-- Migration 010: Fluxo de descarga incremental por conchas
--
-- Novos status: SOLICITADO, LIBERADO
-- Novo campo: conchas_executadas
-- Transições: SOLICITADO → LIBERADO → CONCLUIDO
--             SOLICITADO → CANCELADO
-- ============================================================

-- Adiciona novos valores ao enum (deve rodar fora de transação)
ALTER TYPE carregamento_status ADD VALUE IF NOT EXISTS 'SOLICITADO';
ALTER TYPE carregamento_status ADD VALUE IF NOT EXISTS 'LIBERADO';

-- Adiciona campo de progresso de conchas
ALTER TABLE public.carregamentos
  ADD COLUMN IF NOT EXISTS conchas_executadas INTEGER NOT NULL DEFAULT 0;

-- Atualiza trigger para suportar o novo fluxo
CREATE OR REPLACE FUNCTION public.fn_carregamento_timestamps()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Sem mudança de status: atualização de conchas_executadas apenas
  IF new.status = old.status THEN
    RETURN new;
  END IF;

  -- SOLICITADO → LIBERADO: Richardson libera a descarga
  IF old.status = 'SOLICITADO' AND new.status = 'LIBERADO' THEN
    new.started_at := coalesce(new.started_at, now());
    RETURN new;
  END IF;

  -- LIBERADO → CONCLUIDO: todas as conchas executadas
  IF old.status = 'LIBERADO' AND new.status = 'CONCLUIDO' THEN
    new.finished_at := coalesce(new.finished_at, now());
    RETURN new;
  END IF;

  -- SOLICITADO → CANCELADO: Richardson cancela antes de liberar
  IF old.status = 'SOLICITADO' AND new.status = 'CANCELADO' THEN
    RETURN new;
  END IF;

  -- Legado: PENDENTE → CARREGANDO → CONCLUIDO (compatibilidade)
  IF old.status = 'PENDENTE' AND new.status = 'CARREGANDO' THEN
    new.started_at := coalesce(new.started_at, now());
    RETURN new;
  END IF;
  IF old.status = 'CARREGANDO' AND new.status = 'CONCLUIDO' THEN
    new.finished_at := coalesce(new.finished_at, now());
    RETURN new;
  END IF;
  IF old.status = 'PENDENTE' AND new.status = 'CANCELADO' THEN
    RETURN new;
  END IF;

  RAISE EXCEPTION 'Transição inválida: % → %', old.status, new.status;
END;
$$;
