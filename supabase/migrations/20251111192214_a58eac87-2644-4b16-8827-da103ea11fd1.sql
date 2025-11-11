
-- Eliminar el registro de producción de BENERANDA DOMINGUEZ RIVAS
-- Amarradora 1, 30 octubre 2025, turno 2:00pm - 10:00pm

-- Primero eliminar los detalles de producción asociados
DELETE FROM detalle_produccion 
WHERE registro_id = 'e34851f6-67c5-4c54-9102-b233cefd13bc';

-- Luego eliminar los asistentes asociados
DELETE FROM registro_asistentes 
WHERE registro_id = 'e34851f6-67c5-4c54-9102-b233cefd13bc';

-- Finalmente eliminar el registro principal
DELETE FROM registros_produccion 
WHERE id = 'e34851f6-67c5-4c54-9102-b233cefd13bc';
