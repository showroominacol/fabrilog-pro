-- Eliminar todas las políticas que dependen de get_current_user_role

-- Usuarios
DROP POLICY IF EXISTS "Solo admins pueden modificar usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Solo admins actualizan usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Solo admins eliminan usuarios" ON public.usuarios;

-- Maquinas
DROP POLICY IF EXISTS "Solo admins pueden modificar máquinas" ON public.maquinas;

-- Productos
DROP POLICY IF EXISTS "Solo admins pueden modificar productos" ON public.productos;

-- Metas produccion
DROP POLICY IF EXISTS "Solo admins pueden modificar metas" ON public.metas_produccion;

-- Registros produccion
DROP POLICY IF EXISTS "Solo admins pueden modificar registros" ON public.registros_produccion;

-- Detalle produccion
DROP POLICY IF EXISTS "Solo admins pueden modificar detalles" ON public.detalle_produccion;

-- Registro asistentes
DROP POLICY IF EXISTS "Solo admins pueden modificar asistentes" ON public.registro_asistentes;

-- Ahora eliminar las funciones
DROP FUNCTION IF EXISTS public.get_current_user_role();
DROP FUNCTION IF EXISTS public.get_current_user_profile();

-- Crear políticas simples que permiten todas las operaciones temporalmente
-- Usuarios
CREATE POLICY "Permite operaciones en usuarios" 
ON public.usuarios 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Maquinas
CREATE POLICY "Permite operaciones en maquinas" 
ON public.maquinas 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Productos
CREATE POLICY "Permite operaciones en productos" 
ON public.productos 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Metas produccion
CREATE POLICY "Permite operaciones en metas" 
ON public.metas_produccion 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Registros produccion
CREATE POLICY "Permite operaciones en registros" 
ON public.registros_produccion 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Detalle produccion
CREATE POLICY "Permite operaciones en detalles" 
ON public.detalle_produccion 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Registro asistentes
CREATE POLICY "Permite operaciones en asistentes" 
ON public.registro_asistentes 
FOR ALL 
USING (true) 
WITH CHECK (true);