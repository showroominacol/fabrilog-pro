-- Add new columns for Producido Molino product type
ALTER TABLE public.productos 
ADD COLUMN tope_jornada_8h numeric,
ADD COLUMN tope_jornada_10h numeric;