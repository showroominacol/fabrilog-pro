-- Simplify RLS policies for user registration
-- Remove both conflicting INSERT policies
DROP POLICY IF EXISTS "Permitir registro de nuevos usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir creacion durante registro" ON public.usuarios;

-- Create a single, simple policy for user registration
-- Allow any user (anon or authenticated) to insert if they provide a valid auth_user_id
CREATE POLICY "Permitir registro inicial" 
ON public.usuarios 
FOR INSERT 
TO anon, authenticated
WITH CHECK (auth_user_id IS NOT NULL);

-- Keep the admin modification policy but make it more specific
-- Only for UPDATE and DELETE operations
CREATE POLICY "Solo admins modifican usuarios existentes" 
ON public.usuarios 
FOR UPDATE, DELETE
TO authenticated 
USING (public.get_current_user_role() = 'admin')
WITH CHECK (public.get_current_user_role() = 'admin');