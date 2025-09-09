-- Completar modificaciones para el sistema de producción industrial

-- 1. Crear enum para turnos
DO $$ BEGIN
    CREATE TYPE public.turno_produccion AS ENUM (
        '6:00am - 2:00pm',
        '2:00pm - 10:00pm', 
        '10:00pm - 6:00am',
        '7:00am - 5:00pm',
        '7:00am - 3:00pm',
        '7:00am - 3:30pm'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Modificar tabla registros_produccion
ALTER TABLE public.registros_produccion 
DROP COLUMN IF EXISTS producto_id,
DROP COLUMN IF EXISTS produccion_real,
DROP COLUMN IF EXISTS porcentaje_cumplimiento,
ADD COLUMN IF NOT EXISTS es_asistente BOOLEAN NOT NULL DEFAULT false;

-- 3. Cambiar el tipo de turno
ALTER TABLE public.registros_produccion 
ALTER COLUMN turno TYPE turno_produccion USING turno::text::turno_produccion;

-- 4. Crear tabla detalle_produccion
CREATE TABLE IF NOT EXISTS public.detalle_produccion (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    registro_id UUID NOT NULL REFERENCES public.registros_produccion(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
    produccion_real INTEGER NOT NULL DEFAULT 0,
    porcentaje_cumplimiento NUMERIC(5,2) NOT NULL DEFAULT 0,
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Crear tabla para asistentes en registros
CREATE TABLE IF NOT EXISTS public.registro_asistentes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    registro_id UUID NOT NULL REFERENCES public.registros_produccion(id) ON DELETE CASCADE,
    asistente_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(registro_id, asistente_id)
);

-- 6. Habilitar RLS en las nuevas tablas
ALTER TABLE public.detalle_produccion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registro_asistentes ENABLE ROW LEVEL SECURITY;

-- 7. Recrear políticas RLS simplificadas (sin auth_user_id)
CREATE POLICY "Solo admins pueden modificar máquinas" 
ON public.maquinas 
FOR ALL 
USING (get_current_user_role() = 'admin');

CREATE POLICY "Solo admins pueden modificar productos" 
ON public.productos 
FOR ALL 
USING (get_current_user_role() = 'admin');

CREATE POLICY "Solo admins pueden modificar metas" 
ON public.metas_produccion 
FOR ALL 
USING (get_current_user_role() = 'admin');

-- 8. Políticas para registros_produccion (simplificadas)
CREATE POLICY "Operarios pueden insertar registros" 
ON public.registros_produccion 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Solo admins pueden modificar registros" 
ON public.registros_produccion 
FOR UPDATE 
USING (get_current_user_role() = 'admin');

-- 9. Políticas para detalle_produccion
CREATE POLICY "Todos pueden ver detalles de producción" 
ON public.detalle_produccion 
FOR SELECT 
USING (true);

CREATE POLICY "Operarios pueden insertar detalles" 
ON public.detalle_produccion 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Solo admins pueden modificar detalles" 
ON public.detalle_produccion 
FOR UPDATE 
USING (get_current_user_role() = 'admin');

-- 10. Políticas para registro_asistentes
CREATE POLICY "Todos pueden ver asistentes" 
ON public.registro_asistentes 
FOR SELECT 
USING (true);

CREATE POLICY "Operarios pueden insertar asistentes" 
ON public.registro_asistentes 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Solo admins pueden modificar asistentes" 
ON public.registro_asistentes 
FOR UPDATE 
USING (get_current_user_role() = 'admin');