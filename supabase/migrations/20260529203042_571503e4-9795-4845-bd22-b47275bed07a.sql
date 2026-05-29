ALTER TABLE public.registros_produccion
  ADD COLUMN IF NOT EXISTS verde_medio_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS verde_oscuro_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS ocre_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS alambre_calibre_20_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS alambre_calibre_22_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS festones_reciclados_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS desperdicio_puntas_kg NUMERIC;