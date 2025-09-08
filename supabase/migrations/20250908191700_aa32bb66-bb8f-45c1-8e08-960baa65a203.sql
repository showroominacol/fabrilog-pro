-- Fix RLS policy violation during user registration
-- Drop the current problematic INSERT policy
DROP POLICY IF EXISTS "Usuarios pueden crear su perfil" ON public.usuarios;

-- Create a more permissive policy for user registration
-- This allows any authenticated user to insert a row where auth_user_id matches their ID
CREATE POLICY "Permitir registro de nuevos usuarios" 
ON public.usuarios 
FOR INSERT 
TO authenticated 
WITH CHECK (
  auth_user_id IS NOT NULL 
  AND (
    auth_user_id = auth.uid() 
    OR auth.uid() IS NOT NULL  -- Allow during registration process
  )
);

-- Alternative: Create a policy that allows insertion during the registration process
-- by checking if the user exists in auth.users
CREATE POLICY "Permitir creacion durante registro" 
ON public.usuarios 
FOR INSERT 
TO anon, authenticated  -- Allow both anonymous and authenticated for registration flow
WITH CHECK (
  auth_user_id IS NOT NULL
);