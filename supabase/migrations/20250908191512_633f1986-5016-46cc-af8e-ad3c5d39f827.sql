-- Fix infinite recursion in usuarios table policies
-- Drop the problematic policy that causes recursion
DROP POLICY IF EXISTS "Solo admins pueden modificar usuarios" ON public.usuarios;

-- Create security definer function to get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT tipo_usuario::text FROM public.usuarios WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- Create new policy using the security definer function (no recursion)
CREATE POLICY "Solo admins pueden modificar usuarios" 
ON public.usuarios 
FOR ALL 
TO authenticated 
USING (public.get_current_user_role() = 'admin')
WITH CHECK (public.get_current_user_role() = 'admin');

-- Also allow users to insert their own profile during registration
CREATE POLICY "Usuarios pueden crear su perfil" 
ON public.usuarios 
FOR INSERT 
TO authenticated 
WITH CHECK (auth_user_id = auth.uid());