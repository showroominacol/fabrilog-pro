-- Add categoria column to productos table to link products with machine categories
ALTER TABLE public.productos 
ADD COLUMN categoria TEXT;

-- Add comment to explain the new relationship model
COMMENT ON COLUMN public.productos.categoria IS 'Categoría de máquinas que pueden producir este producto';

-- The productos_maquinas table is now deprecated as products are linked to categories
-- Products will be associated with machine categories instead of individual machines