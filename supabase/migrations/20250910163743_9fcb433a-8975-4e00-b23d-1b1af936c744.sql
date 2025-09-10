-- Create table for tree designs
CREATE TABLE public.disenos_arboles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for branch levels in each design
CREATE TABLE public.niveles_ramas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  diseno_id UUID NOT NULL,
  nivel INTEGER NOT NULL,
  festones_por_rama INTEGER NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add columns to productos table
ALTER TABLE public.productos 
ADD COLUMN tipo_producto TEXT NOT NULL DEFAULT 'general',
ADD COLUMN diseno_id UUID;

-- Enable RLS on new tables
ALTER TABLE public.disenos_arboles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.niveles_ramas ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for disenos_arboles
CREATE POLICY "Todos pueden ver diseños" 
ON public.disenos_arboles 
FOR SELECT 
USING (true);

CREATE POLICY "Permite operaciones en diseños" 
ON public.disenos_arboles 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create RLS policies for niveles_ramas
CREATE POLICY "Todos pueden ver niveles" 
ON public.niveles_ramas 
FOR SELECT 
USING (true);

CREATE POLICY "Permite operaciones en niveles" 
ON public.niveles_ramas 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Insert sample Monterrey machines
INSERT INTO public.maquinas (nombre, descripcion) VALUES
('Monterrey 1', 'Máquina de producción Monterrey número 1'),
('Monterrey 2', 'Máquina de producción Monterrey número 2'),
('Monterrey 3', 'Máquina de producción Monterrey número 3'),
('Monterrey 4', 'Máquina de producción Monterrey número 4');

-- Insert sample tree design
INSERT INTO public.disenos_arboles (nombre, descripcion) VALUES
('Clásico', 'Diseño clásico de árbol navideño con 11 niveles');

-- Get the design ID for the Clásico design
-- Insert levels for Clásico design (11 levels with specific festoon counts)
INSERT INTO public.niveles_ramas (diseno_id, nivel, festones_por_rama)
SELECT 
  (SELECT id FROM public.disenos_arboles WHERE nombre = 'Clásico'),
  nivel,
  CASE nivel
    WHEN 1 THEN 3
    WHEN 2 THEN 4
    WHEN 3 THEN 6
    WHEN 4 THEN 8
    WHEN 5 THEN 10
    WHEN 6 THEN 12
    WHEN 7 THEN 14
    WHEN 8 THEN 16
    WHEN 9 THEN 18
    WHEN 10 THEN 20
    WHEN 11 THEN 26
  END as festones_por_rama
FROM generate_series(1, 11) as nivel;

-- Get Monterrey 1 machine ID for sample products
-- Insert sample products
INSERT INTO public.productos (nombre, maquina_id, tipo_producto, diseno_id)
SELECT 
  'Árbol Clásico',
  m.id,
  'arbol_navideno',
  d.id
FROM public.maquinas m, public.disenos_arboles d
WHERE m.nombre = 'Monterrey 1' AND d.nombre = 'Clásico';

INSERT INTO public.productos (nombre, maquina_id, tipo_producto)
SELECT 
  'Guirnaldas',
  m.id,
  'general'
FROM public.maquinas m
WHERE m.nombre = 'Monterrey 1';