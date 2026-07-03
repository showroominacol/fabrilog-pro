CREATE OR REPLACE FUNCTION public.generar_id_consecutivo(p_maquina_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_nombre_maquina TEXT;
  v_prefijo TEXT;
  v_ultimo_numero INT;
  v_nuevo_id TEXT;
  v_existe BOOLEAN;
BEGIN
  SELECT nombre INTO v_nombre_maquina FROM maquinas WHERE id = p_maquina_id;
  IF v_nombre_maquina IS NULL THEN
    RAISE EXCEPTION 'Máquina no encontrada';
  END IF;

  v_prefijo := UPPER(REGEXP_REPLACE(SUBSTRING(v_nombre_maquina, 1, 6), '[^A-Za-z]', '', 'g'));
  IF v_prefijo = '' OR LENGTH(v_prefijo) < 2 THEN
    v_prefijo := UPPER(REGEXP_REPLACE(SUBSTRING(v_nombre_maquina, 1, 6), '[^A-Za-z0-9]', '', 'g'));
  END IF;

  -- Serialize concurrent generation per prefix to avoid duplicate keys
  PERFORM pg_advisory_xact_lock(hashtext('id_consecutivo:' || v_prefijo));

  -- Consider ALL rows with this prefix (not only principals) to avoid collisions
  SELECT COALESCE(MAX(CAST(SUBSTRING(id_consecutivo FROM '[0-9]+$') AS INTEGER)), 0)
    INTO v_ultimo_numero
  FROM registros_produccion
  WHERE id_consecutivo LIKE v_prefijo || '-%';

  -- Loop until a free id is found (safety net)
  LOOP
    v_ultimo_numero := v_ultimo_numero + 1;
    v_nuevo_id := v_prefijo || '-' || LPAD(v_ultimo_numero::TEXT, 3, '0');
    SELECT EXISTS(SELECT 1 FROM registros_produccion WHERE id_consecutivo = v_nuevo_id) INTO v_existe;
    EXIT WHEN NOT v_existe;
  END LOOP;

  RETURN v_nuevo_id;
END;
$function$;