-- Add foreign key constraints to ensure proper relationships for metrics calculation

-- Add foreign key constraint from metas_produccion to maquinas
ALTER TABLE public.metas_produccion 
ADD CONSTRAINT fk_metas_produccion_maquina 
FOREIGN KEY (maquina_id) REFERENCES public.maquinas(id) ON DELETE CASCADE;

-- Add foreign key constraint from metas_produccion to productos  
ALTER TABLE public.metas_produccion 
ADD CONSTRAINT fk_metas_produccion_producto 
FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;

-- Add foreign key constraint from productos to maquinas
ALTER TABLE public.productos 
ADD CONSTRAINT fk_productos_maquina 
FOREIGN KEY (maquina_id) REFERENCES public.maquinas(id) ON DELETE CASCADE;

-- Add foreign key constraint from productos to disenos_arboles
ALTER TABLE public.productos 
ADD CONSTRAINT fk_productos_diseno 
FOREIGN KEY (diseno_id) REFERENCES public.disenos_arboles(id) ON DELETE SET NULL;

-- Add foreign key constraint from niveles_ramas to disenos_arboles
ALTER TABLE public.niveles_ramas 
ADD CONSTRAINT fk_niveles_ramas_diseno 
FOREIGN KEY (diseno_id) REFERENCES public.disenos_arboles(id) ON DELETE CASCADE;

-- Add foreign key constraint from detalle_produccion to productos
ALTER TABLE public.detalle_produccion 
ADD CONSTRAINT fk_detalle_produccion_producto 
FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;

-- Add foreign key constraint from detalle_produccion to registros_produccion
ALTER TABLE public.detalle_produccion 
ADD CONSTRAINT fk_detalle_produccion_registro 
FOREIGN KEY (registro_id) REFERENCES public.registros_produccion(id) ON DELETE CASCADE;

-- Add foreign key constraint from registros_produccion to usuarios
ALTER TABLE public.registros_produccion 
ADD CONSTRAINT fk_registros_produccion_operario 
FOREIGN KEY (operario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;

-- Add foreign key constraint from registros_produccion to maquinas
ALTER TABLE public.registros_produccion 
ADD CONSTRAINT fk_registros_produccion_maquina 
FOREIGN KEY (maquina_id) REFERENCES public.maquinas(id) ON DELETE CASCADE;

-- Add foreign key constraint from registro_asistentes to registros_produccion
ALTER TABLE public.registro_asistentes 
ADD CONSTRAINT fk_registro_asistentes_registro 
FOREIGN KEY (registro_id) REFERENCES public.registros_produccion(id) ON DELETE CASCADE;

-- Add foreign key constraint from registro_asistentes to usuarios
ALTER TABLE public.registro_asistentes 
ADD CONSTRAINT fk_registro_asistentes_asistente 
FOREIGN KEY (asistente_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;