CREATE OR REPLACE FUNCTION public.generar_id_consecutivo(p_maquina_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_nombre_maquina text;
  v_prefijo text;
  v_ultimo_numero integer;
  v_nuevo_id text;
  v_intentos integer := 0;
BEGIN
  SELECT nombre INTO v_nombre_maquina
  FROM public.maquinas
  WHERE id = p_maquina_id;

  IF v_nombre_maquina IS NULL THEN
    RAISE EXCEPTION 'Máquina no encontrada';
  END IF;

  v_prefijo := UPPER(REGEXP_REPLACE(SUBSTRING(v_nombre_maquina, 1, 6), '[^A-Za-z]', '', 'g'));
  IF v_prefijo = '' OR LENGTH(v_prefijo) < 2 THEN
    v_prefijo := UPPER(REGEXP_REPLACE(SUBSTRING(v_nombre_maquina, 1, 6), '[^A-Za-z0-9]', '', 'g'));
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('consecutivo_produccion:' || v_prefijo));

  INSERT INTO public.consecutivos_produccion (prefijo, ultimo_numero, fecha_actualizacion)
  VALUES (v_prefijo, 0, now())
  ON CONFLICT (prefijo) DO NOTHING;

  LOOP
    v_intentos := v_intentos + 1;

    UPDATE public.consecutivos_produccion
    SET ultimo_numero = ultimo_numero + 1,
        fecha_actualizacion = now()
    WHERE prefijo = v_prefijo
    RETURNING ultimo_numero INTO v_ultimo_numero;

    IF v_ultimo_numero IS NULL THEN
      RAISE EXCEPTION 'No se pudo generar consecutivo para la máquina';
    END IF;

    v_nuevo_id := v_prefijo || '-' || LPAD(v_ultimo_numero::text, 3, '0');

    IF NOT EXISTS (
      SELECT 1
      FROM public.registros_produccion
      WHERE id_consecutivo = v_nuevo_id
    ) THEN
      RETURN v_nuevo_id;
    END IF;

    IF v_intentos >= 10000 THEN
      RAISE EXCEPTION 'No se pudo generar un ID consecutivo único para el prefijo %', v_prefijo;
    END IF;
  END LOOP;
END;
$function$;