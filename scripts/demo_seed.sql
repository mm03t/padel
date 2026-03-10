-- ============================================================
--  DEMO SEED — Academia de Pádel
--  Reset completo + datos de demostración
-- ============================================================

-- 1. Limpiar en orden FK-safe
TRUNCATE TABLE
  notificaciones, recuperaciones, asistencias,
  sesiones, lista_espera, solicitudes_espera,
  alumno_clases, pagos,
  alumnos, clases, profesores, pistas
RESTART IDENTITY CASCADE;

-- ============================================================
-- 2. PISTAS
-- ============================================================
INSERT INTO pistas (id, nombre, numero, activa) VALUES
  ('pista-1', 'Pista 1', 1, true),
  ('pista-2', 'Pista 2', 2, true),
  ('pista-3', 'Pista 3', 3, true);

-- ============================================================
-- 3. PROFESORES
-- ============================================================
INSERT INTO profesores (id, nombre, apellidos, email, telefono, activo, created_at) VALUES
  ('prof-1', 'Carlos',  'Martínez Ruiz',  'carlos.martinez@padel.com', '600111001', true, NOW()),
  ('prof-2', 'Laura',   'Gómez Sánchez',  'laura.gomez@padel.com',     '600111002', true, NOW()),
  ('prof-3', 'Sergio',  'Navarro López',  'sergio.navarro@padel.com',  '600111003', true, NOW());

-- ============================================================
-- 4. CLASES  (4 plazas cada una)
-- ============================================================
-- Iniciación Mañana  – Lunes 09:00  pista 1  prof Carlos    nivel 1.0-1.5
-- Iniciación Tarde   – Martes 18:00 pista 2  prof Laura     nivel 1.0-1.5
-- Intermedio Mañana  – Miércoles 10:00 pista 1 prof Carlos  nivel 2.0-2.5
-- Intermedio Tarde   – Jueves 19:00 pista 3  prof Sergio    nivel 2.0-3.0
-- Avanzado Sábado    – Sábado 10:00 pista 2  prof Laura     nivel 3.0-4.0  (llena → espera)
-- Flexible Viernes   – Viernes 17:00 pista 3 prof Sergio    nivel 1.5-3.5
INSERT INTO clases (id, nombre, nivel_min, nivel_max, profesor_id, pista_id, dia_semana, hora_inicio, hora_fin, plazas_total, activa, created_at) VALUES
  ('clase-ini-m', 'Iniciación Mañana',   1.0, 1.5, 'prof-1', 'pista-1', 'LUNES',      '09:00', '10:00', 4, true, NOW()),
  ('clase-ini-t', 'Iniciación Tarde',    1.0, 1.5, 'prof-2', 'pista-2', 'MARTES',     '18:00', '19:00', 4, true, NOW()),
  ('clase-int-m', 'Intermedio Mañana',   2.0, 2.5, 'prof-1', 'pista-1', 'MIERCOLES',  '10:00', '11:00', 4, true, NOW()),
  ('clase-int-t', 'Intermedio Tarde',    2.0, 3.0, 'prof-3', 'pista-3', 'JUEVES',     '19:00', '20:00', 4, true, NOW()),
  ('clase-avz-s', 'Avanzado Sábado',     3.0, 4.0, 'prof-2', 'pista-2', 'SABADO',     '10:00', '11:30', 4, true, NOW()),
  ('clase-vrs-v', 'Mixto Viernes',       1.5, 3.5, 'prof-3', 'pista-3', 'VIERNES',    '17:00', '18:00', 4, true, NOW());

-- ============================================================
-- 5. ALUMNOS  (nombres ficticios variados)
-- ============================================================
-- Iniciación × 4 alumnos activos con clase (ini-m: 3, ini-t: 3)
-- Intermedio × 4 alumnos (int-m: 4 llena, int-t: 3)
-- Avanzado   × 4 llena (4 inscritos)
-- Mixto      × 2 inscritos
-- Sin clase  × 5 en lista de espera
-- Inactivos  × 2

INSERT INTO alumnos (id, nombre, apellidos, email, telefono, nivel, disponibilidad, activo, notas, tarifa_mensual, created_at, updated_at) VALUES
  -- Iniciación Mañana (nivel 1.0-1.5)
  ('a01','Ana',       'García López',     'ana.garcia@demo.com',      '600201001', 1.0, 'MANANA',   true,  null, 50, NOW() - INTERVAL '6 months', NOW()),
  ('a02','Pedro',     'Ruiz Fernández',   'pedro.ruiz@demo.com',      '600201002', 1.0, 'MANANA',   true,  null, 50, NOW() - INTERVAL '5 months', NOW()),
  ('a03','Marta',     'López Sanz',       'marta.lopez@demo.com',     '600201003', 1.5, 'MANANA',   true,  null, 50, NOW() - INTERVAL '4 months', NOW()),
  -- Iniciación Tarde (nivel 1.0-1.5)
  ('a04','Luis',      'Pérez Moreno',     'luis.perez@demo.com',      '600201004', 1.0, 'TARDE',    true,  null, 50, NOW() - INTERVAL '4 months', NOW()),
  ('a05','Sara',      'Martínez Gil',     'sara.martinez@demo.com',   '600201005', 1.5, 'TARDE',    true,  null, 50, NOW() - INTERVAL '3 months', NOW()),
  ('a06','Jorge',     'Sánchez Ramos',    'jorge.sanchez@demo.com',   '600201006', 1.0, 'TARDE',    true,  null, 50, NOW() - INTERVAL '3 months', NOW()),
  -- Intermedio Mañana (nivel 2.0-2.5) — 4 plazas llena
  ('a07','Elena',     'Navarro Díaz',     'elena.navarro@demo.com',   '600201007', 2.0, 'MANANA',   true,  null, 55, NOW() - INTERVAL '8 months', NOW()),
  ('a08','Raúl',      'Castro Vega',      'raul.castro@demo.com',     '600201008', 2.0, 'MANANA',   true,  null, 55, NOW() - INTERVAL '7 months', NOW()),
  ('a09','Carmen',    'Flores Ortiz',     'carmen.flores@demo.com',   '600201009', 2.5, 'MANANA',   true,  null, 55, NOW() - INTERVAL '6 months', NOW()),
  ('a10','Alberto',   'Romero Torres',    'alberto.romero@demo.com',  '600201010', 2.5, 'MANANA',   true,  null, 55, NOW() - INTERVAL '5 months', NOW()),
  -- Intermedio Tarde (nivel 2.0-3.0)
  ('a11','Isabel',    'Herrera Blanco',   'isabel.herrera@demo.com',  '600201011', 2.5, 'TARDE',    true,  null, 55, NOW() - INTERVAL '7 months', NOW()),
  ('a12','David',     'Moreno Jiménez',   'david.moreno@demo.com',    '600201012', 3.0, 'TARDE',    true,  null, 55, NOW() - INTERVAL '6 months', NOW()),
  ('a13','Lucía',     'Vargas Pardo',     'lucia.vargas@demo.com',    '600201013', 2.5, 'FLEXIBLE', true,  null, 55, NOW() - INTERVAL '4 months', NOW()),
  -- Avanzado Sábado (nivel 3.0-4.0) — 4 plazas llena
  ('a14','Miguel',    'Fuentes Cano',     'miguel.fuentes@demo.com',  '600201014', 3.5, 'FLEXIBLE', true,  null, 60, NOW() - INTERVAL '10 months', NOW()),
  ('a15','Patricia',  'Molina Rubio',     'patricia.molina@demo.com', '600201015', 4.0, 'FLEXIBLE', true,  null, 60, NOW() - INTERVAL '9 months', NOW()),
  ('a16','Roberto',   'Delgado León',     'roberto.delgado@demo.com', '600201016', 3.5, 'FLEXIBLE', true,  null, 60, NOW() - INTERVAL '8 months', NOW()),
  ('a17','Cristina',  'Serrano Medina',   'cristina.serrano@demo.com','600201017', 3.0, 'FLEXIBLE', true,  null, 60, NOW() - INTERVAL '7 months', NOW()),
  -- Mixto Viernes
  ('a18','Tomás',     'Bravo Iglesias',   'tomas.bravo@demo.com',     '600201018', 2.0, 'TARDE',    true,  null, 50, NOW() - INTERVAL '3 months', NOW()),
  ('a19','Nuria',     'Campos Reyes',     'nuria.campos@demo.com',    '600201019', 3.0, 'TARDE',    true,  null, 50, NOW() - INTERVAL '2 months', NOW()),
  -- Sin clase — lista de espera (5 alumnos, fechas escalonadas para orden FIFO)
  ('a20','Pablo',     'Méndez Aguilar',   'pablo.mendez@demo.com',    '600201020', 1.0, 'MANANA',   true,  'Quiere mañanas si es posible', 50, NOW() - INTERVAL '3 months', NOW()),
  ('a21','Sofía',     'Ibáñez Guerrero',  'sofia.ibanez@demo.com',    '600201021', 2.0, 'TARDE',    true,  null, 50, NOW() - INTERVAL '2 months', NOW()),
  ('a22','Andrés',    'Pascual Vidal',    'andres.pascual@demo.com',  '600201022', 3.5, 'FLEXIBLE', true,  'Nivel avanzado, espera Sábado', 60, NOW() - INTERVAL '1 month', NOW()),
  ('a23','Beatriz',   'Ríos Caballero',   'beatriz.rios@demo.com',    '600201023', 1.5, 'TARDE',    true,  null, 50, NOW() - INTERVAL '3 weeks', NOW()),
  ('a24','Marcos',    'Lozano Santana',   'marcos.lozano@demo.com',   '600201024', 2.5, 'MANANA',   true,  null, 55, NOW() - INTERVAL '1 week', NOW()),
  -- Inactivos
  ('a25','Víctor',    'Prado Crespo',     'victor.prado@demo.com',    '600201025', 2.0, 'MANANA',   false, 'Baja temporal por lesión', 50, NOW() - INTERVAL '1 year', NOW()),
  ('a26','Gloria',    'Nieto Durán',      'gloria.nieto@demo.com',    '600201026', 1.5, 'TARDE',    false, null, 50, NOW() - INTERVAL '8 months', NOW());

-- ============================================================
-- 6. INSCRIPCIONES (alumno_clases)
-- ============================================================
INSERT INTO alumno_clases (id, alumno_id, clase_id, fecha_inicio, activo) VALUES
  -- Iniciación Mañana
  (gen_random_uuid()::text, 'a01', 'clase-ini-m', NOW() - INTERVAL '6 months', true),
  (gen_random_uuid()::text, 'a02', 'clase-ini-m', NOW() - INTERVAL '5 months', true),
  (gen_random_uuid()::text, 'a03', 'clase-ini-m', NOW() - INTERVAL '4 months', true),
  -- Iniciación Tarde
  (gen_random_uuid()::text, 'a04', 'clase-ini-t', NOW() - INTERVAL '4 months', true),
  (gen_random_uuid()::text, 'a05', 'clase-ini-t', NOW() - INTERVAL '3 months', true),
  (gen_random_uuid()::text, 'a06', 'clase-ini-t', NOW() - INTERVAL '3 months', true),
  -- Intermedio Mañana (LLENA: 4/4)
  (gen_random_uuid()::text, 'a07', 'clase-int-m', NOW() - INTERVAL '8 months', true),
  (gen_random_uuid()::text, 'a08', 'clase-int-m', NOW() - INTERVAL '7 months', true),
  (gen_random_uuid()::text, 'a09', 'clase-int-m', NOW() - INTERVAL '6 months', true),
  (gen_random_uuid()::text, 'a10', 'clase-int-m', NOW() - INTERVAL '5 months', true),
  -- Intermedio Tarde
  (gen_random_uuid()::text, 'a11', 'clase-int-t', NOW() - INTERVAL '7 months', true),
  (gen_random_uuid()::text, 'a12', 'clase-int-t', NOW() - INTERVAL '6 months', true),
  (gen_random_uuid()::text, 'a13', 'clase-int-t', NOW() - INTERVAL '4 months', true),
  -- Avanzado Sábado (LLENA: 4/4)
  (gen_random_uuid()::text, 'a14', 'clase-avz-s', NOW() - INTERVAL '10 months', true),
  (gen_random_uuid()::text, 'a15', 'clase-avz-s', NOW() - INTERVAL '9 months',  true),
  (gen_random_uuid()::text, 'a16', 'clase-avz-s', NOW() - INTERVAL '8 months',  true),
  (gen_random_uuid()::text, 'a17', 'clase-avz-s', NOW() - INTERVAL '7 months',  true),
  -- Mixto Viernes
  (gen_random_uuid()::text, 'a18', 'clase-vrs-v', NOW() - INTERVAL '3 months', true);

-- ============================================================
-- 7. SESIONES — últimas 3 semanas + 2 próximas por clase
-- ============================================================
-- Iniciación Mañana (Lunes)
INSERT INTO sesiones (id, clase_id, fecha, estado, created_at) VALUES
  (gen_random_uuid()::text, 'clase-ini-m', NOW() - INTERVAL '14 days', 'COMPLETADA', NOW()),
  (gen_random_uuid()::text, 'clase-ini-m', NOW() - INTERVAL '7 days',  'COMPLETADA', NOW()),
  (gen_random_uuid()::text, 'clase-ini-m', NOW() + INTERVAL '7 days',  'PROGRAMADA', NOW()),
-- Iniciación Tarde (Martes)
  (gen_random_uuid()::text, 'clase-ini-t', NOW() - INTERVAL '13 days', 'COMPLETADA', NOW()),
  (gen_random_uuid()::text, 'clase-ini-t', NOW() - INTERVAL '6 days',  'COMPLETADA', NOW()),
  (gen_random_uuid()::text, 'clase-ini-t', NOW() + INTERVAL '8 days',  'PROGRAMADA', NOW()),
-- Intermedio Mañana (Miércoles)
  (gen_random_uuid()::text, 'clase-int-m', NOW() - INTERVAL '12 days', 'COMPLETADA', NOW()),
  (gen_random_uuid()::text, 'clase-int-m', NOW() - INTERVAL '5 days',  'COMPLETADA', NOW()),
  (gen_random_uuid()::text, 'clase-int-m', NOW() + INTERVAL '9 days',  'PROGRAMADA', NOW()),
-- Intermedio Tarde (Jueves)
  (gen_random_uuid()::text, 'clase-int-t', NOW() - INTERVAL '11 days', 'COMPLETADA', NOW()),
  (gen_random_uuid()::text, 'clase-int-t', NOW() - INTERVAL '4 days',  'COMPLETADA', NOW()),
  (gen_random_uuid()::text, 'clase-int-t', NOW() + INTERVAL '10 days', 'PROGRAMADA', NOW()),
-- Avanzado Sábado
  (gen_random_uuid()::text, 'clase-avz-s', NOW() - INTERVAL '9 days',  'COMPLETADA', NOW()),
  (gen_random_uuid()::text, 'clase-avz-s', NOW() + INTERVAL '5 days',  'PROGRAMADA', NOW()),
-- Mixto Viernes
  (gen_random_uuid()::text, 'clase-vrs-v', NOW() - INTERVAL '10 days', 'COMPLETADA', NOW()),
  (gen_random_uuid()::text, 'clase-vrs-v', NOW() - INTERVAL '3 days',  'COMPLETADA', NOW()),
  (gen_random_uuid()::text, 'clase-vrs-v', NOW() + INTERVAL '4 days',  'PROGRAMADA', NOW());

-- ============================================================
-- 8. ASISTENCIAS — para sesiones completadas
--    1 falta con recuperación pendiente en Iniciación Mañana
--    1 falta justificada en Intermedio Tarde
-- ============================================================
-- Sesión ini-m hace 14 días: Ana PRESENTE, Pedro FALTA (recuperación), Marta PRESENTE
DO $$
DECLARE
  ses1 TEXT; ses2 TEXT; ses3 TEXT; ses4 TEXT; ses5 TEXT; ses6 TEXT; ses7 TEXT; ses8 TEXT;
BEGIN
  -- Recuperar IDs de sesiones completadas
  SELECT id INTO ses1 FROM sesiones WHERE clase_id='clase-ini-m' AND fecha < NOW() ORDER BY fecha LIMIT 1;
  SELECT id INTO ses2 FROM sesiones WHERE clase_id='clase-ini-m' AND fecha < NOW() ORDER BY fecha DESC LIMIT 1;
  SELECT id INTO ses3 FROM sesiones WHERE clase_id='clase-ini-t' AND fecha < NOW() ORDER BY fecha DESC LIMIT 1;
  SELECT id INTO ses4 FROM sesiones WHERE clase_id='clase-int-m' AND fecha < NOW() ORDER BY fecha DESC LIMIT 1;
  SELECT id INTO ses5 FROM sesiones WHERE clase_id='clase-int-t' AND fecha < NOW() ORDER BY fecha DESC LIMIT 1;
  SELECT id INTO ses6 FROM sesiones WHERE clase_id='clase-avz-s' AND fecha < NOW() ORDER BY fecha DESC LIMIT 1;
  SELECT id INTO ses7 FROM sesiones WHERE clase_id='clase-vrs-v' AND fecha < NOW() ORDER BY fecha DESC LIMIT 1;
  SELECT id INTO ses8 FROM sesiones WHERE clase_id='clase-vrs-v' AND fecha < NOW() ORDER BY fecha LIMIT 1;

  -- ini-m sesión antigua: Pedro falta
  IF ses1 IS NOT NULL THEN
    INSERT INTO asistencias (id, sesion_id, alumno_id, estado, created_at) VALUES
      (gen_random_uuid()::text, ses1, 'a01', 'PRESENTE',    NOW()),
      (gen_random_uuid()::text, ses1, 'a02', 'FALTA',       NOW()),
      (gen_random_uuid()::text, ses1, 'a03', 'PRESENTE',    NOW());
    -- Recuperación pendiente para Pedro
    INSERT INTO recuperaciones (id, alumno_id, sesion_origen_id, estado, expira_en, created_at) VALUES
      (gen_random_uuid()::text, 'a02', ses1, 'PENDIENTE', NOW() + INTERVAL '30 days', NOW());
  END IF;

  -- ini-m última sesión
  IF ses2 IS NOT NULL AND ses2 != ses1 THEN
    INSERT INTO asistencias (id, sesion_id, alumno_id, estado, created_at) VALUES
      (gen_random_uuid()::text, ses2, 'a01', 'PRESENTE', NOW()),
      (gen_random_uuid()::text, ses2, 'a02', 'PRESENTE', NOW()),
      (gen_random_uuid()::text, ses2, 'a03', 'PRESENTE', NOW());
  END IF;

  -- ini-t última sesión: Sara justificada
  IF ses3 IS NOT NULL THEN
    INSERT INTO asistencias (id, sesion_id, alumno_id, estado, created_at) VALUES
      (gen_random_uuid()::text, ses3, 'a04', 'PRESENTE',    NOW()),
      (gen_random_uuid()::text, ses3, 'a05', 'JUSTIFICADA', NOW()),
      (gen_random_uuid()::text, ses3, 'a06', 'PRESENTE',    NOW());
  END IF;

  -- int-m última sesión
  IF ses4 IS NOT NULL THEN
    INSERT INTO asistencias (id, sesion_id, alumno_id, estado, created_at) VALUES
      (gen_random_uuid()::text, ses4, 'a07', 'PRESENTE', NOW()),
      (gen_random_uuid()::text, ses4, 'a08', 'PRESENTE', NOW()),
      (gen_random_uuid()::text, ses4, 'a09', 'PRESENTE', NOW()),
      (gen_random_uuid()::text, ses4, 'a10', 'FALTA',    NOW());
    -- Recuperación pendiente para Alberto
    INSERT INTO recuperaciones (id, alumno_id, sesion_origen_id, estado, expira_en, created_at) VALUES
      (gen_random_uuid()::text, 'a10', ses4, 'PENDIENTE', NOW() + INTERVAL '30 days', NOW());
  END IF;

  -- int-t última sesión
  IF ses5 IS NOT NULL THEN
    INSERT INTO asistencias (id, sesion_id, alumno_id, estado, created_at) VALUES
      (gen_random_uuid()::text, ses5, 'a11', 'PRESENTE', NOW()),
      (gen_random_uuid()::text, ses5, 'a12', 'PRESENTE', NOW()),
      (gen_random_uuid()::text, ses5, 'a13', 'PRESENTE', NOW());
  END IF;

  -- avz-s última sesión
  IF ses6 IS NOT NULL THEN
    INSERT INTO asistencias (id, sesion_id, alumno_id, estado, created_at) VALUES
      (gen_random_uuid()::text, ses6, 'a14', 'PRESENTE', NOW()),
      (gen_random_uuid()::text, ses6, 'a15', 'PRESENTE', NOW()),
      (gen_random_uuid()::text, ses6, 'a16', 'FALTA',    NOW()),
      (gen_random_uuid()::text, ses6, 'a17', 'PRESENTE', NOW());
    INSERT INTO recuperaciones (id, alumno_id, sesion_origen_id, estado, expira_en, created_at) VALUES
      (gen_random_uuid()::text, 'a16', ses6, 'PENDIENTE', NOW() + INTERVAL '30 days', NOW());
  END IF;

  -- vrs-v sesiones
  IF ses7 IS NOT NULL THEN
    INSERT INTO asistencias (id, sesion_id, alumno_id, estado, created_at) VALUES
      (gen_random_uuid()::text, ses7, 'a18', 'PRESENTE', NOW()),
      (gen_random_uuid()::text, ses7, 'a19', 'PRESENTE', NOW());
  END IF;
  IF ses8 IS NOT NULL AND ses8 != ses7 THEN
    INSERT INTO asistencias (id, sesion_id, alumno_id, estado, created_at) VALUES
      (gen_random_uuid()::text, ses8, 'a18', 'PRESENTE', NOW()),
      (gen_random_uuid()::text, ses8, 'a19', 'PRESENTE', NOW());
  END IF;
END $$;

-- ============================================================
-- 9. SOLICITUDES ESPERA EXTERNAS (2 pendientes para la demo)
-- ============================================================
INSERT INTO solicitudes_espera (id, nombre, apellidos, email, telefono, nivel, notas, estado, created_at) VALUES
  (gen_random_uuid()::text, 'Fernando', 'Blanco Muñoz', 'fernando.blanco@ext.com', '600300001', 2.0, 'Disponible tardes y fines de semana', 'PENDIENTE', NOW() - INTERVAL '5 days'),
  (gen_random_uuid()::text, 'Rosa',     'Gutiérrez Vera','rosa.gutierrez@ext.com',  '600300002', 1.0, null, 'CONTACTADO', NOW() - INTERVAL '2 days');

-- ============================================================
-- Verificación
-- ============================================================
SELECT 'profesores' AS tabla, COUNT(*) FROM profesores
UNION ALL SELECT 'pistas',           COUNT(*) FROM pistas
UNION ALL SELECT 'clases',           COUNT(*) FROM clases
UNION ALL SELECT 'alumnos activos',  COUNT(*) FROM alumnos WHERE activo=true
UNION ALL SELECT 'alumnos inactivos',COUNT(*) FROM alumnos WHERE activo=false
UNION ALL SELECT 'con clase',        COUNT(DISTINCT alumno_id) FROM alumno_clases WHERE activo=true
UNION ALL SELECT 'sin clase',        COUNT(*) FROM alumnos WHERE activo=true AND id NOT IN (SELECT alumno_id FROM alumno_clases WHERE activo=true)
UNION ALL SELECT 'sesiones',         COUNT(*) FROM sesiones
UNION ALL SELECT 'asistencias',      COUNT(*) FROM asistencias
UNION ALL SELECT 'recuperaciones',   COUNT(*) FROM recuperaciones
UNION ALL SELECT 'solicitudes ext',  COUNT(*) FROM solicitudes_espera;
