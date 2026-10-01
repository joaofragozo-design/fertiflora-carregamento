-- ============================================================
-- Migration 073: permite cancelar descarga já LIBERADA
--
-- Antes só existia LIBERADO → CONCLUIDO. Uma descarga liberada que não
-- aconteceu ficava presa pra sempre e, como o Centro Operacional mostra
-- a LIBERADA na frente, escondia as solicitações novas (2 cargas presas
-- desde 15/07/2026 travaram a tela em 01/10/2026).
-- Nova transição: LIBERADO → CANCELADO (Central de Solicitações).
-- ============================================================

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

  -- LIBERADO → CANCELADO: descarga liberada que não vai acontecer (073)
  IF old.status = 'LIBERADO' AND new.status = 'CANCELADO' THEN
    new.finished_at := coalesce(new.finished_at, now());
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

-- Limpa as 2 descargas presas como LIBERADO desde 15/07/2026
-- (M.O 3 conchas e CALTIMAG+S 2 conchas) — aprovado pelo usuário.
UPDATE public.carregamentos
   SET status = 'CANCELADO'
 WHERE status = 'LIBERADO'
   AND created_at < '2026-07-16T00:00:00Z';
