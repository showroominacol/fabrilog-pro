-- Primero, limpiar los IDs consecutivos existentes
UPDATE registros_produccion SET id_consecutivo = NULL;

-- Recrear función para generar IDs consecutivos ordenados por fecha
CREATE OR REPLACE FUNCTION generar_id_consecutivo(p_maquina_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_nombre_maquina TEXT;
  v_prefijo TEXT;
  v_ultimo_numero INT;
  v_nuevo_id TEXT;
BEGIN
  -- Obtener nombre de la máquina
  SELECT nombre INTO v_nombre_maquina
  FROM maquinas
  WHERE id = p_maquina_id;
  
  IF v_nombre_maquina IS NULL THEN
    RAISE EXCEPTION 'Máquina no encontrada';
  END IF;
  
  -- Generar prefijo (primeras 4-6 letras del nombre en mayúsculas, sin espacios ni números)
  v_prefijo := UPPER(REGEXP_REPLACE(
    SUBSTRING(v_nombre_maquina, 1, 6),
    '[^A-Za-z]',
    '',
    'g'
  ));
  
  -- Si el prefijo quedó vacío, usar las primeras letras incluyendo números
  IF v_prefijo = '' OR LENGTH(v_prefijo) < 2 THEN
    v_prefijo := UPPER(REGEXP_REPLACE(
      SUBSTRING(v_nombre_maquina, 1, 6),
      '[^A-Za-z0-9]',
      '',
      'g'
    ));
  END IF;
  
  -- Obtener el último número usado para esta máquina (solo registros principales)
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(id_consecutivo FROM '[0-9]+$') 
      AS INTEGER
    )
  ), 0) INTO v_ultimo_numero
  FROM registros_produccion
  WHERE id_consecutivo LIKE v_prefijo || '-%'
    AND es_asistente = false;
  
  -- Generar nuevo ID
  v_nuevo_id := v_prefijo || '-' || LPAD((v_ultimo_numero + 1)::TEXT, 3, '0');
  
  RETURN v_nuevo_id;
END;
$$;

-- Poblar IDs consecutivos SOLO para registros principales ordenados por fecha_registro
DO $$
DECLARE
  v_registro RECORD;
  v_nuevo_id TEXT;
BEGIN
  FOR v_registro IN 
    SELECT id, maquina_id 
    FROM registros_produccion 
    WHERE es_asistente = false
    ORDER BY fecha_registro ASC
  LOOP
    v_nuevo_id := generar_id_consecutivo(v_registro.maquina_id);
    UPDATE registros_produccion 
    SET id_consecutivo = v_nuevo_id 
    WHERE id = v_registro.id;
  END LOOP;
END;
$$;