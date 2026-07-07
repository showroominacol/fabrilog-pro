-- Sincronizar los contadores con los IDs ya existentes antes de generar nuevos IDs.
WITH existing_max AS (
  SELECT
    split_part(id_consecutivo, '-', 1) AS prefijo,
    MAX(NULLIF(split_part(id_consecutivo, '-', 2), '')::integer) AS ultimo_numero
  FROM public.registros_produccion
  WHERE id_consecutivo IS NOT NULL
    AND id_consecutivo ~ '^[^-]+-[0-9]+$'
  GROUP BY split_part(id_consecutivo, '-', 1)
)
INSERT INTO public.consecutivos_produccion (prefijo, ultimo_numero, fecha_actualizacion)
SELECT prefijo, ultimo_numero, now()
FROM existing_max
ON CONFLICT (prefijo) DO UPDATE
SET ultimo_numero = GREATEST(public.consecutivos_produccion.ultimo_numero, EXCLUDED.ultimo_numero),
    fecha_actualizacion = now();

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

  INSERT INTO public.consecutivos_produccion (prefijo, ultimo_numero, fecha_actualizacion)
  VALUES (v_prefijo, 0, now())
  ON CONFLICT (prefijo) DO NOTHING;

  LOOP
    v_intentos := v_intentos + 1;

    UPDATE public.consecutivos_produccion
    SET ultimo_numero = GREATEST(
          ultimo_numero,
          COALESCE((
            SELECT MAX(NULLIF(split_part(r.id_consecutivo, '-', 2), '')::integer)
            FROM public.registros_produccion r
            WHERE r.id_consecutivo LIKE v_prefijo || '-%'
              AND r.id_consecutivo ~ ('^' || v_prefijo || '-[0-9]+$')
          ), 0)
        ) + 1,
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

    IF v_intentos >= 10 THEN
      RAISE EXCEPTION 'No se pudo generar un ID consecutivo único para el prefijo %', v_prefijo;
    END IF;
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.generar_id_consecutivo(uuid) TO anon, authenticated, service_role;