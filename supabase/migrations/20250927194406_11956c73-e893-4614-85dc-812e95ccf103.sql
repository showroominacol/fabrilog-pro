-- Crear función pública para consultar cumplimiento por cédula
CREATE OR REPLACE FUNCTION public.consultar_cumplimiento_operario(
  cedula_operario text,
  fecha_inicio date DEFAULT date_trunc('month', CURRENT_DATE)::date,
  fecha_fin date DEFAULT (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date
)
RETURNS TABLE (
  nombre text,
  cedula text,
  fecha_inicio_periodo date,
  fecha_fin_periodo date,
  porcentaje_cumplimiento numeric,
  dias_laborales integer,
  dias_con_produccion integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  operario_id uuid;
  total_porcentaje numeric := 0;
  dias_laborales_count integer := 0;
  dias_produccion_count integer := 0;
BEGIN
  -- Buscar el operario por cédula
  SELECT u.id, u.nombre, u.cedula 
  INTO operario_id, nombre, cedula
  FROM usuarios u 
  WHERE u.cedula = cedula_operario 
    AND u.activo = true 
    AND u.tipo_usuario = 'operario';
  
  -- Si no existe el operario, retornar vacío
  IF operario_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Establecer las fechas del período
  fecha_inicio_periodo := fecha_inicio;
  fecha_fin_periodo := fecha_fin;
  
  -- Calcular días laborales (excluyendo domingos)
  SELECT COUNT(*)
  INTO dias_laborales_count
  FROM generate_series(fecha_inicio, fecha_fin, '1 day'::interval) as fecha
  WHERE EXTRACT(DOW FROM fecha) != 0; -- 0 = domingo
  
  -- Calcular métricas de producción
  WITH metricas_diarias AS (
    SELECT 
      r.fecha,
      COALESCE(SUM(
        CASE 
          WHEN dp.produccion_real > 0 AND 
               CASE 
                 WHEN r.turno IN ('6:00am - 2:00pm', '2:00pm - 10:00pm', '10:00pm - 6:00am') THEN p.tope
                 WHEN r.turno IN ('7:00am - 5:00pm') THEN p.tope_jornada_10h
                 ELSE p.tope_jornada_8h
               END > 0 
          THEN 
            (dp.produccion_real::numeric / 
             CASE 
               WHEN r.turno IN ('6:00am - 2:00pm', '2:00pm - 10:00pm', '10:00pm - 6:00am') THEN p.tope
               WHEN r.turno IN ('7:00am - 5:00pm') THEN p.tope_jornada_10h
               ELSE p.tope_jornada_8h
             END) * 100
          ELSE 0
        END
      ), 0) as porcentaje_dia
    FROM registros_produccion r
    LEFT JOIN detalle_produccion dp ON r.id = dp.registro_id
    LEFT JOIN productos p ON dp.producto_id = p.id
    WHERE r.operario_id = operario_id
      AND r.fecha BETWEEN fecha_inicio AND fecha_fin
      AND r.es_asistente = false
    GROUP BY r.fecha
  )
  SELECT 
    COALESCE(SUM(porcentaje_dia), 0),
    COUNT(DISTINCT fecha)
  INTO total_porcentaje, dias_produccion_count
  FROM metricas_diarias;
  
  -- Calcular porcentaje promedio
  IF dias_laborales_count > 0 THEN
    porcentaje_cumplimiento := total_porcentaje / dias_laborales_count;
  ELSE
    porcentaje_cumplimiento := 0;
  END IF;
  
  RETURN NEXT;
END;
$$;