
-- Corregir turno de registros de Monterrey 3 del 4 de noviembre de 2025
-- De 7:00am - 5:00pm a 6:00am - 2:00pm

UPDATE registros_produccion
SET turno = '6:00am - 2:00pm'
WHERE id IN (
  'c10efefa-62a8-4eb0-b24d-b29435c1cd70',
  'd371caa9-ab85-4448-8ea5-0bb4c8f3409a'
)
AND fecha = '2025-11-04';
