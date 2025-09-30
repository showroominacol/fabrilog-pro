-- ====================================
-- PASO 1: Eliminar políticas inseguras
-- ====================================

DROP POLICY IF EXISTS "Usuarios pueden ver todos los perfiles" ON public.usuarios;
DROP POLICY IF EXISTS "Permite operaciones en usuarios" ON public.usuarios;

-- ====================================
-- PASO 2: Crear políticas RLS seguras
-- ====================================

-- Solo permitir SELECT de campos no sensibles para operaciones internas
-- Esta política es restrictiva - el acceso real será a través de Edge Functions
CREATE POLICY "Permitir lectura de datos públicos de usuarios"
ON public.usuarios
FOR SELECT
USING (false); -- Por defecto bloqueado, acceso vía Edge Functions

-- Bloquear INSERT/UPDATE/DELETE directos - solo vía Edge Functions con service role
CREATE POLICY "Bloquear INSERT directo"
ON public.usuarios
FOR INSERT
WITH CHECK (false);

CREATE POLICY "Bloquear UPDATE directo"
ON public.usuarios
FOR UPDATE
USING (false);

CREATE POLICY "Bloquear DELETE directo"
ON public.usuarios
FOR DELETE
USING (false);

-- ====================================
-- PASO 3: Crear función para validar contraseñas
-- ====================================

-- Nota: Esta función será usada por Edge Functions, no directamente por clientes
CREATE OR REPLACE FUNCTION public.get_user_for_auth(p_cedula text)
RETURNS TABLE (
  id uuid,
  nombre text,
  cedula text,
  tipo_usuario user_type,
  activo boolean,
  password_hash text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.nombre,
    u.cedula,
    u.tipo_usuario,
    u.activo,
    u.password_hash
  FROM public.usuarios u
  WHERE u.cedula = p_cedula
    AND u.activo = true;
END;
$$;

-- ====================================
-- PASO 4: Función para obtener lista de usuarios (sin password_hash)
-- ====================================

CREATE OR REPLACE FUNCTION public.get_usuarios_list()
RETURNS TABLE (
  id uuid,
  nombre text,
  cedula text,
  tipo_usuario user_type,
  activo boolean,
  fecha_creacion timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.nombre,
    u.cedula,
    u.tipo_usuario,
    u.activo,
    u.fecha_creacion
  FROM public.usuarios u
  WHERE u.activo = true
  ORDER BY u.nombre;
END;
$$;

-- ====================================
-- PASO 5: Función para consultar usuario por cédula (sin password)
-- ====================================

CREATE OR REPLACE FUNCTION public.get_usuario_by_cedula(p_cedula text)
RETURNS TABLE (
  id uuid,
  nombre text,
  cedula text,
  tipo_usuario user_type,
  activo boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.nombre,
    u.cedula,
    u.tipo_usuario,
    u.activo
  FROM public.usuarios u
  WHERE u.cedula = p_cedula
    AND u.activo = true;
END;
$$;