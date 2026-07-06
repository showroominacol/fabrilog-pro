-- Sincronizar/crear contadores para todos los prefijos existentes antes de cambiar la función
WITH machine_prefixes AS (
  SELECT DISTINCT
    CASE
      WHEN LENGTH(UPPER(REGEXP_REPLACE(SUBSTRING(nombre, 1, 6), '[^A-Za-z]', '', 'g'))) >= 2
        THEN UPPER(REGEXP_REPLACE(SUBSTRING(nombre, 1, 6), '[^A-Za-z]', '', 'g'))
      ELSE UPPER(REGEXP_REPLACE(SUBSTRING(nombre, 1, 6), '[^A-Za-z0-9]', '', 'g'))
    END AS prefijo
  FROM public.maquinas
  WHERE nombre IS NOT NULL
), maximos AS (
  SELECT
    mp.prefijo,
    COALESCE(MAX(CAST(SUBSTRING(r.id_consecutivo FROM '[0-9]+$') AS integer)), 0) AS ultimo_numero
  FROM machine_prefixes mp
  LEFT JOIN public.registros_produccion r
    ON r.id_consecutivo LIKE mp.prefijo || '-%'
   AND r.id_consecutivo ~ ('^' || mp.prefijo || '-[0-9]+$')
  GROUP BY mp.prefijo
)
INSERT INTO public.consecutivos_produccion (prefijo, ultimo_numero, fecha_actualizacion)
SELECT prefijo, ultimo_numero, now()
FROM maximos
WHERE prefijo IS NOT NULL AND prefijo <> ''
ON CONFLICT (prefijo) DO UPDATE
SET ultimo_numero = GREATEST(public.consecutivos_produccion.ultimo_numero, EXCLUDED.ultimo_numero),
    fecha_actualizacion = now();

-- Generación rápida: no escanea registros_produccion y no usa loop de búsqueda
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

  UPDATE public.consecutivos_produccion
  SET ultimo_numero = ultimo_numero + 1,
      fecha_actualizacion = now()
  WHERE prefijo = v_prefijo
  RETURNING ultimo_numero INTO v_ultimo_numero;

  IF v_ultimo_numero IS NULL THEN
    RAISE EXCEPTION 'No se pudo generar consecutivo para la máquina';
  END IF;

  RETURN v_prefijo || '-' || LPAD(v_ultimo_numero::text, 3, '0');
END;
$function$;