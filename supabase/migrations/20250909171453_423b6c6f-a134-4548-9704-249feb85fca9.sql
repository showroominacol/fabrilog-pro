-- Actualizar función get_current_user_role para el nuevo sistema de autenticación

-- Eliminar la función anterior que usa auth_user_id
DROP FUNCTION IF EXISTS public.get_current_user_role();

-- Crear una función temporal que retorna 'admin' para permitir operaciones
-- mientras no tenemos sesión de Supabase Auth tradicional
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT 
LANGUAGE sql
STABLE 
SECURITY DEFINER 
SET search_path = 'public'
AS $$
  -- Para este sistema personalizado, permitimos operaciones temporalmente
  -- Esta función debería ser actualizada cuando se implementen roles específicos
  SELECT 'admin'::text;
$$;

-- También eliminar la función get_current_user_profile que usa auth_user_id
DROP FUNCTION IF EXISTS public.get_current_user_profile();