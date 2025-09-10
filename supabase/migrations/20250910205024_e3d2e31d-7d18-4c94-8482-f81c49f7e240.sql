-- Create junction table for productos-maquinas many-to-many relationship
CREATE TABLE public.productos_maquinas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  producto_id UUID NOT NULL,
  maquina_id UUID NOT NULL,
  fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(producto_id, maquina_id)
);

-- Enable RLS on the junction table
ALTER TABLE public.productos_maquinas ENABLE ROW LEVEL SECURITY;

-- Create policies for the junction table
CREATE POLICY "Todos pueden ver productos-maquinas" 
ON public.productos_maquinas 
FOR SELECT 
USING (true);

CREATE POLICY "Permite operaciones en productos-maquinas" 
ON public.productos_maquinas 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Migrate existing data from productos.maquina_id to the junction table
INSERT INTO public.productos_maquinas (producto_id, maquina_id)
SELECT id, maquina_id 
FROM public.productos 
WHERE maquina_id IS NOT NULL;

-- Remove the maquina_id column from productos table
ALTER TABLE public.productos DROP COLUMN maquina_id;

-- Add foreign key constraints to the junction table
ALTER TABLE public.productos_maquinas
ADD CONSTRAINT fk_productos_maquinas_producto 
FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;

ALTER TABLE public.productos_maquinas
ADD CONSTRAINT fk_productos_maquinas_maquina 
FOREIGN KEY (maquina_id) REFERENCES public.maquinas(id) ON DELETE CASCADE;