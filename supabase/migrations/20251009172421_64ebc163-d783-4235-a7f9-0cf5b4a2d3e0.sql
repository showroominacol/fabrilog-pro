-- Crear tabla para ramas de árboles amarradora
-- Similar a niveles_ramas pero mide por tope de rama (no festones)
CREATE TABLE IF NOT EXISTS public.ramas_amarradora (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  diseno_id UUID NOT NULL REFERENCES public.disenos_arboles(id) ON DELETE CASCADE,
  numero_rama INTEGER NOT NULL,
  tope_rama NUMERIC NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(diseno_id, numero_rama)
);

-- Crear tabla para detalles de producción de ramas amarradora
-- Almacena la cantidad producida por cada rama
CREATE TABLE IF NOT EXISTS public.detalle_ramas_amarradora (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  detalle_produccion_id UUID NOT NULL REFERENCES public.detalle_produccion(id) ON DELETE CASCADE,
  numero_rama INTEGER NOT NULL,
  cantidad_producida NUMERIC NOT NULL DEFAULT 0,
  tope_rama NUMERIC NOT NULL DEFAULT 0,
  fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(detalle_produccion_id, numero_rama)
);

-- Habilitar RLS en las nuevas tablas
ALTER TABLE public.ramas_amarradora ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_ramas_amarradora ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para ramas_amarradora
CREATE POLICY "Todos pueden ver ramas amarradora"
  ON public.ramas_amarradora
  FOR SELECT
  USING (true);

CREATE POLICY "Permite operaciones en ramas amarradora"
  ON public.ramas_amarradora
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Políticas RLS para detalle_ramas_amarradora
CREATE POLICY "Todos pueden ver detalles ramas amarradora"
  ON public.detalle_ramas_amarradora
  FOR SELECT
  USING (true);

CREATE POLICY "Permite operaciones en detalles ramas amarradora"
  ON public.detalle_ramas_amarradora
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_ramas_amarradora_diseno ON public.ramas_amarradora(diseno_id);
CREATE INDEX IF NOT EXISTS idx_detalle_ramas_amarradora_detalle ON public.detalle_ramas_amarradora(detalle_produccion_id);