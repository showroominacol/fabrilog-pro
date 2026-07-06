CREATE TABLE IF NOT EXISTS public.consecutivos_produccion (
  prefijo text PRIMARY KEY,
  ultimo_numero integer NOT NULL DEFAULT 0,
  fecha_actualizacion timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.consecutivos_produccion TO service_role;

ALTER TABLE public.consecutivos_produccion ENABLE ROW LEVEL SECURITY;

INSERT INTO public.consecutivos_produccion (prefijo, ultimo_numero)
SELECT
  split_part(id_consecutivo, '-', 1) AS prefijo,
  MAX(CAST(SUBSTRING(id_consecutivo FROM '[0-9]+$') AS integer)) AS ultimo_numero
FROM public.registros_produccion
WHERE id_consecutivo IS NOT NULL
  AND id_consecutivo ~ '^[^-]+-[0-9]+$'
GROUP BY split_part(id_consecutivo, '-', 1)
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
  v_existe boolean;
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

  INSERT INTO public.consecutivos_produccion (prefijo, ultimo_numero)
  SELECT
    v_prefijo,
    COALESCE(MAX(CAST(SUBSTRING(id_consecutivo FROM '[0-9]+$') AS integer)), 0)
  FROM public.registros_produccion
  WHERE id_consecutivo LIKE v_prefijo || '-%'
    AND id_consecutivo ~ ('^' || v_prefijo || '-[0-9]+$')
  ON CONFLICT (prefijo) DO NOTHING;

  LOOP
    UPDATE public.consecutivos_produccion
    SET ultimo_numero = ultimo_numero + 1,
        fecha_actualizacion = now()
    WHERE prefijo = v_prefijo
    RETURNING ultimo_numero INTO v_ultimo_numero;

    v_nuevo_id := v_prefijo || '-' || LPAD(v_ultimo_numero::text, 3, '0');

    SELECT EXISTS (
      SELECT 1
      FROM public.registros_produccion
      WHERE id_consecutivo = v_nuevo_id
    ) INTO v_existe;

    EXIT WHEN NOT v_existe;
  END LOOP;

  RETURN v_nuevo_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.generar_id_consecutivo(uuid) TO anon, authenticated, service_role;