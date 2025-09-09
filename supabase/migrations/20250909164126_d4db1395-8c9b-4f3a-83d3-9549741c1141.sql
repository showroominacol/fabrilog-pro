-- Eliminación de políticas RLS que dependen de auth_user_id

-- 1. Eliminar políticas que dependen de auth_user_id
DROP POLICY IF EXISTS "Solo admins pueden modificar máquinas" ON public.maquinas;
DROP POLICY IF EXISTS "Solo admins pueden modificar productos" ON public.productos;
DROP POLICY IF EXISTS "Solo admins pueden modificar metas" ON public.metas_produccion;
DROP POLICY IF EXISTS "Operarios pueden insertar sus registros" ON public.registros_produccion;
DROP POLICY IF EXISTS "Solo admins pueden modificar registros" ON public.registros_produccion;
DROP POLICY IF EXISTS "Permitir registro inicial" ON public.usuarios;

-- 2. Ahora podemos eliminar auth_user_id y agregar las nuevas columnas
ALTER TABLE public.usuarios 
DROP COLUMN IF EXISTS auth_user_id,
ADD COLUMN IF NOT EXISTS cedula TEXT,
ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 3. Hacer las columnas NOT NULL después de agregarlas
UPDATE public.usuarios SET cedula = 'temp_' || id::text WHERE cedula IS NULL;
UPDATE public.usuarios SET password_hash = 'temp_hash' WHERE password_hash IS NULL;

ALTER TABLE public.usuarios 
ALTER COLUMN cedula SET NOT NULL,
ALTER COLUMN password_hash SET NOT NULL;

-- 4. Agregar constraint unique para cedula
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_cedula_unique UNIQUE (cedula);