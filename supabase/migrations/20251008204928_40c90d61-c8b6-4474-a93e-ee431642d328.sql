-- Actualizar función con search_path para seguridad
CREATE OR REPLACE FUNCTION public.consultar_cumplimiento_operario(
  cedula_operario text, 
  fecha_inicio date, 
  fecha_fin date, 
  OUT nombre text, 
  OUT cedula text, 
  OUT fecha_inicio_periodo date, 
  OUT fecha_fin_periodo date, 
  OUT porcentaje_cumplimiento numeric,
  OUT dias_laborales integer,
  OUT dias_con_produccion integer
)
RETURNS SETOF record
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_operario_id uuid;
  v_nombre text;
  v_cedula text;
  total_porcentaje numeric := 0;
  dias_laborales_count integer := 0;
  dias_produccion_count integer := 0;
BEGIN
  -- Buscar el operario por cédula
  SELECT u.id, u.nombre, u.cedula
  INTO v_operario_id, v_nombre, v_cedula
  FROM public.usuarios u
  WHERE u.cedula = cedula_operario
    AND u.activo = true
    AND u.tipo_usuario = 'operario';
 
  -- Si no existe el operario, retornar vacío
  IF v_operario_id IS NULL THEN
    RETURN;
  END IF;

  -- Asignar valores a las variables de salida
  nombre := v_nombre;
  cedula := v_cedula;
  fecha_inicio_periodo := fecha_inicio;
  fecha_fin_periodo := fecha_fin;
 
  -- Calcular días laborales (excluyendo domingos)
  SELECT COUNT(*)
  INTO dias_laborales_count
  FROM generate_series(fecha_inicio, fecha_fin, '1 day'::interval) as fecha
  WHERE EXTRACT(DOW FROM fecha) != 0; -- 0 = domingo
 
  -- Calcular métricas de producción
  -- Incluye todos los registros donde operario_id = v_operario_id (tanto operario principal como ayudante)
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
    FROM public.registros_produccion r
    LEFT JOIN public.detalle_produccion dp ON r.id = dp.registro_id
    LEFT JOIN public.productos p ON dp.producto_id = p.id
    WHERE r.operario_id = v_operario_id
      AND r.fecha BETWEEN fecha_inicio AND fecha_fin
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

  -- Asignar días laborales y días con producción
  dias_laborales := dias_laborales_count;
  dias_con_produccion := dias_produccion_count;
 
  RETURN NEXT;
END;
$function$;