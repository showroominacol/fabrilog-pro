CREATE OR REPLACE FUNCTION public.crear_registro_produccion(
  p_fecha date,
  p_turno public.turno_produccion,
  p_operario_id uuid,
  p_maquina_id uuid,
  p_extra jsonb DEFAULT '{}'::jsonb,
  p_productos jsonb DEFAULT '[]'::jsonb,
  p_asistentes jsonb DEFAULT '[]'::jsonb
)
RETURNS TABLE(id uuid, id_consecutivo text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_registro_id uuid;
  v_id_consecutivo text;
  v_producto jsonb;
  v_detalle_id uuid;
  v_asistente_id uuid;
BEGIN
  IF p_fecha IS NULL THEN
    RAISE EXCEPTION 'La fecha es requerida';
  END IF;

  IF p_turno IS NULL THEN
    RAISE EXCEPTION 'El turno es requerido';
  END IF;

  IF p_operario_id IS NULL OR p_maquina_id IS NULL THEN
    RAISE EXCEPTION 'Operario y máquina son requeridos';
  END IF;

  v_id_consecutivo := public.generar_id_consecutivo(p_maquina_id);

  INSERT INTO public.registros_produccion (
    fecha,
    turno,
    operario_id,
    maquina_id,
    es_asistente,
    id_consecutivo,
    verde_medio_kg,
    verde_oscuro_kg,
    ocre_kg,
    alambre_calibre_20_kg,
    alambre_calibre_22_kg,
    festones_reciclados_kg,
    desperdicio_puntas_kg,
    peso_pvc_ocre,
    peso_pvc_marron,
    monofilamento_usado,
    peso_alambre,
    desperdicio_monofilamento,
    desperdicio_alambre,
    alambre_desperdicio,
    inyectora_peso_inyectado_kg,
    inyectora_desperdicio_kg,
    monterrey_peso_alambre,
    monterrey_calibre_alambre,
    monterrey_peso_cinta,
    china_verde_claro,
    china_verde_medio,
    china_verde_oscuro,
    china_ocre,
    china_alambre,
    calandra_calibre,
    calandra_desperdicio,
    pvc_peso_bobina,
    pvc_peso_desperdicio,
    pvc_cantidad_bobinas,
    varillas_peso_material,
    varillas_desperdicio,
    nevado_nieve,
    formulado_desperdicio,
    flecadora_desperdicio
  ) VALUES (
    p_fecha,
    p_turno,
    p_operario_id,
    p_maquina_id,
    false,
    v_id_consecutivo,
    NULLIF(p_extra->>'verde_medio_kg', '')::numeric,
    NULLIF(p_extra->>'verde_oscuro_kg', '')::numeric,
    NULLIF(p_extra->>'ocre_kg', '')::numeric,
    NULLIF(p_extra->>'alambre_calibre_20_kg', '')::numeric,
    NULLIF(p_extra->>'alambre_calibre_22_kg', '')::numeric,
    NULLIF(p_extra->>'festones_reciclados_kg', '')::numeric,
    NULLIF(p_extra->>'desperdicio_puntas_kg', '')::numeric,
    NULLIF(p_extra->>'peso_pvc_ocre', '')::numeric,
    NULLIF(p_extra->>'peso_pvc_marron', '')::numeric,
    NULLIF(p_extra->>'monofilamento_usado', '')::numeric,
    NULLIF(p_extra->>'peso_alambre', '')::numeric,
    NULLIF(p_extra->>'desperdicio_monofilamento', '')::numeric,
    NULLIF(p_extra->>'desperdicio_alambre', '')::numeric,
    NULLIF(p_extra->>'alambre_desperdicio', '')::numeric,
    NULLIF(p_extra->>'inyectora_peso_inyectado_kg', '')::numeric,
    NULLIF(p_extra->>'inyectora_desperdicio_kg', '')::numeric,
    NULLIF(p_extra->>'monterrey_peso_alambre', '')::numeric,
    NULLIF(p_extra->>'monterrey_calibre_alambre', '')::numeric,
    NULLIF(p_extra->>'monterrey_peso_cinta', '')::numeric,
    NULLIF(p_extra->>'china_verde_claro', '')::numeric,
    NULLIF(p_extra->>'china_verde_medio', '')::numeric,
    NULLIF(p_extra->>'china_verde_oscuro', '')::numeric,
    NULLIF(p_extra->>'china_ocre', '')::numeric,
    NULLIF(p_extra->>'china_alambre', '')::numeric,
    NULLIF(p_extra->>'calandra_calibre', '')::numeric,
    NULLIF(p_extra->>'calandra_desperdicio', '')::numeric,
    NULLIF(p_extra->>'pvc_peso_bobina', '')::numeric,
    NULLIF(p_extra->>'pvc_peso_desperdicio', '')::numeric,
    NULLIF(p_extra->>'pvc_cantidad_bobinas', '')::numeric,
    NULLIF(p_extra->>'varillas_peso_material', '')::numeric,
    NULLIF(p_extra->>'varillas_desperdicio', '')::numeric,
    NULLIF(p_extra->>'nevado_nieve', '')::numeric,
    NULLIF(p_extra->>'formulado_desperdicio', '')::numeric,
    NULLIF(p_extra->>'flecadora_desperdicio', '')::numeric
  )
  RETURNING registros_produccion.id INTO v_registro_id;

  FOR v_producto IN SELECT value FROM jsonb_array_elements(COALESCE(p_productos, '[]'::jsonb))
  LOOP
    INSERT INTO public.detalle_produccion (
      registro_id,
      producto_id,
      produccion_real,
      porcentaje_cumplimiento,
      observaciones
    ) VALUES (
      v_registro_id,
      (v_producto->>'producto_id')::uuid,
      COALESCE(NULLIF(v_producto->>'produccion_real', '')::integer, 0),
      COALESCE(NULLIF(v_producto->>'porcentaje_cumplimiento', '')::numeric, 0),
      NULLIF(v_producto->>'observaciones', '')
    )
    RETURNING detalle_produccion.id INTO v_detalle_id;

    IF jsonb_typeof(v_producto->'ramas_amarradora') = 'array' THEN
      INSERT INTO public.detalle_ramas_amarradora (
        detalle_produccion_id,
        numero_rama,
        cantidad_producida,
        tope_rama
      )
      SELECT
        v_detalle_id,
        (rama->>'numero_rama')::integer,
        COALESCE(NULLIF(rama->>'cantidad_producida', '')::integer, 0),
        COALESCE(NULLIF(rama->>'tope_rama', '')::numeric, 0)
      FROM jsonb_array_elements(v_producto->'ramas_amarradora') AS rama;
    END IF;
  END LOOP;

  FOR v_asistente_id IN SELECT value::uuid FROM jsonb_array_elements_text(COALESCE(p_asistentes, '[]'::jsonb))
  LOOP
    IF v_asistente_id <> p_operario_id THEN
      INSERT INTO public.registro_asistentes (registro_id, asistente_id)
      VALUES (v_registro_id, v_asistente_id)
      ON CONFLICT (registro_id, asistente_id) DO NOTHING;

      INSERT INTO public.registros_produccion (
        fecha,
        turno,
        operario_id,
        maquina_id,
        es_asistente
      ) VALUES (
        p_fecha,
        p_turno,
        v_asistente_id,
        p_maquina_id,
        true
      );
    END IF;
  END LOOP;

  id := v_registro_id;
  id_consecutivo := v_id_consecutivo;
  RETURN NEXT;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.crear_registro_produccion(date, public.turno_produccion, uuid, uuid, jsonb, jsonb, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.crear_registro_produccion(date, public.turno_produccion, uuid, uuid, jsonb, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_registro_produccion(date, public.turno_produccion, uuid, uuid, jsonb, jsonb, jsonb) TO service_role;