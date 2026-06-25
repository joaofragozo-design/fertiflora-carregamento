-- Adiciona CANCELADO ao enum carregamento_status
ALTER TYPE carregamento_status ADD VALUE IF NOT EXISTS 'CANCELADO';

-- Atualiza o trigger para permitir PENDENTE → CANCELADO
CREATE OR REPLACE FUNCTION public.fn_carregamento_status_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- PENDENTE → CARREGANDO: registra started_at
  IF old.status = 'PENDENTE' AND new.status = 'CARREGANDO' THEN
    new.started_at = now();
    RETURN new;
  END IF;

  -- CARREGANDO → CONCLUIDO: registra finished_at
  IF old.status = 'CARREGANDO' AND new.status = 'CONCLUIDO' THEN
    new.finished_at = now();
    RETURN new;
  END IF;

  -- PENDENTE → CANCELADO: cancelamento pelo operador de carregamento
  IF old.status = 'PENDENTE' AND new.status = 'CANCELADO' THEN
    RETURN new;
  END IF;

  RAISE EXCEPTION 'Transição inválida: % → %', old.status, new.status;
END;
$$;
