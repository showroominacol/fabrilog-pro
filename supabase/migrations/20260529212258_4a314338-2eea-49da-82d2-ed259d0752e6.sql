ALTER TABLE public.registros_produccion
  ADD COLUMN IF NOT EXISTS peso_pvc_ocre numeric,
  ADD COLUMN IF NOT EXISTS peso_pvc_marron numeric,
  ADD COLUMN IF NOT EXISTS monofilamento_usado numeric,
  ADD COLUMN IF NOT EXISTS peso_alambre numeric,
  ADD COLUMN IF NOT EXISTS desperdicio_monofilamento numeric,
  ADD COLUMN IF NOT EXISTS desperdicio_alambre numeric;