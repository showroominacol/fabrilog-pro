
-- Eliminar registro de 185 unidades de BENERANDA DOMINGUEZ RIVAS
-- Amarradora 1, 30 octubre 2025, turno 2:00pm - 10:00pm

-- Eliminar detalles de producción
DELETE FROM detalle_produccion 
WHERE registro_id = '8b45e2fc-3f27-44cf-924d-2c0ab5d04170';

-- Eliminar asistentes asociados
DELETE FROM registro_asistentes 
WHERE registro_id = '8b45e2fc-3f27-44cf-924d-2c0ab5d04170';

-- Eliminar el registro principal
DELETE FROM registros_produccion 
WHERE id = '8b45e2fc-3f27-44cf-924d-2c0ab5d04170';
