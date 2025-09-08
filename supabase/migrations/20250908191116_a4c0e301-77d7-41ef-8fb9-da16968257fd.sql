-- Fix security vulnerability: Restrict access to production records
-- Remove the overly permissive policy that allows public access
DROP POLICY IF EXISTS "Todos pueden ver registros" ON public.registros_produccion;

-- Create a new restrictive policy that only allows authenticated users to view records
CREATE POLICY "Solo usuarios autenticados pueden ver registros" 
ON public.registros_produccion 
FOR SELECT 
TO authenticated 
USING (true);

-- Optional: Add more granular policy for operators to only see their own records
-- (Uncomment the next lines if you want operators to only see their own data)
/*
DROP POLICY IF EXISTS "Solo usuarios autenticados pueden ver registros" ON public.registros_produccion;

CREATE POLICY "Operarios ven sus registros, admins ven todos" 
ON public.registros_produccion 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM usuarios 
    WHERE auth_user_id = auth.uid() 
    AND (
      tipo_usuario = 'admin' 
      OR usuarios.id = registros_produccion.operario_id
    )
  )
);
*/