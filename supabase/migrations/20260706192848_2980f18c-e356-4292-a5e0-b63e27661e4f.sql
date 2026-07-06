CREATE INDEX IF NOT EXISTS idx_detalle_produccion_registro_id ON public.detalle_produccion(registro_id);
CREATE INDEX IF NOT EXISTS idx_registro_asistentes_registro_id ON public.registro_asistentes(registro_id);
CREATE INDEX IF NOT EXISTS idx_registro_asistentes_asistente_id ON public.registro_asistentes(asistente_id);
CREATE INDEX IF NOT EXISTS idx_registros_produccion_fecha_registro ON public.registros_produccion(fecha_registro DESC);
CREATE INDEX IF NOT EXISTS idx_registros_produccion_fecha ON public.registros_produccion(fecha);
CREATE INDEX IF NOT EXISTS idx_registros_produccion_operario_id ON public.registros_produccion(operario_id);
CREATE INDEX IF NOT EXISTS idx_registros_produccion_maquina_id ON public.registros_produccion(maquina_id);
CREATE INDEX IF NOT EXISTS idx_id_consecutivo_pattern ON public.registros_produccion(id_consecutivo text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_detalle_ramas_amarradora_detalle_id ON public.detalle_ramas_amarradora(detalle_produccion_id);