// Seed de base de datos — Academia de Pádel
// Ejecutar: npm run seed

import 'dotenv/config';
import {
  PrismaClient,
  Disponibilidad,
  DiaSemana,
  EstadoAsistencia,
  EstadoRecuperacion,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { addDays, subDays, setHours, setMinutes, setSeconds } from 'date-fns';

const prisma = new PrismaClient({
  log: ['error'],
});

// Fecha base: 8 marzo 2026 (domingo)
const HOY = new Date('2026-03-08T12:00:00Z');

function fechaConHora(date: Date, hora: string): Date {
  const [h, m] = hora.split(':').map(Number);
  const d = new Date(date);
  d.setUTCHours(h, m, 0, 0);
  return d;
}

async function main() {
  console.log('🌱 Iniciando seed de la Academia de Pádel...');

  // Limpiar en orden correcto (FK constraints)
  await prisma.notificacion.deleteMany();
  await prisma.recuperacion.deleteMany();
  await prisma.asistencia.deleteMany();
  await prisma.sesion.deleteMany();
  await prisma.alumnoClase.deleteMany();
  await prisma.clase.deleteMany();
  await prisma.pista.deleteMany();
  await prisma.profesor.deleteMany();
  await prisma.alumno.deleteMany();
  await prisma.usuario.deleteMany();

  // ── USUARIO ADMIN ────────────────────────────────────
  const adminHash = await bcrypt.hash('admin123', 10);
  await prisma.usuario.create({
    data: {
      email: 'admin@academia.com',
      password: adminHash,
      nombre: 'Administrador',
      role: 'ADMIN',
    },
  });
  console.log('✅ Usuario admin creado (admin@academia.com / admin123)');

  // ── PROFESORES ───────────────────────────────────────
  const hugo = await prisma.profesor.create({
    data: { nombre: 'Hugo', apellidos: 'Cases', email: 'hugo@academia.com', telefono: '600111222' },
  });
  const carlos = await prisma.profesor.create({
    data: { nombre: 'Carlos', apellidos: 'Ruiz', email: 'carlos@academia.com', telefono: '600333444' },
  });
  const ana = await prisma.profesor.create({
    data: { nombre: 'Ana', apellidos: 'Martínez', email: 'ana@academia.com', telefono: '600555666' },
  });
  console.log('✅ Profesores creados');

  // ── PISTAS ───────────────────────────────────────────
  const pista1 = await prisma.pista.create({ data: { nombre: 'Pista Principal', numero: 1 } });
  const pista2 = await prisma.pista.create({ data: { nombre: 'Pista Secundaria', numero: 2 } });
  const pista3 = await prisma.pista.create({ data: { nombre: 'Pista Escuela', numero: 3 } });
  console.log('✅ Pistas creadas');

  // ── CLASES ───────────────────────────────────────────
  const claseIniciacionA = await prisma.clase.create({
    data: {
      nombre: 'Iniciación A',
      nivelMin: 1.0, nivelMax: 1.5,
      profesorId: hugo.id, pistaId: pista1.id,
      diaSemana: DiaSemana.LUNES,
      horaInicio: '10:00', horaFin: '11:00',
      plazasTotal: 4,
    },
  });
  const claseIniciacionB = await prisma.clase.create({
    data: {
      nombre: 'Iniciación B',
      nivelMin: 1.0, nivelMax: 1.5,
      profesorId: ana.id, pistaId: pista2.id,
      diaSemana: DiaSemana.MIERCOLES,
      horaInicio: '10:00', horaFin: '11:00',
      plazasTotal: 4,
    },
  });
  const claseIntermedioA = await prisma.clase.create({
    data: {
      nombre: 'Intermedio A',
      nivelMin: 2.0, nivelMax: 2.5,
      profesorId: hugo.id, pistaId: pista1.id,
      diaSemana: DiaSemana.LUNES,
      horaInicio: '19:00', horaFin: '20:00',
      plazasTotal: 4,
    },
  });
  const claseIntermedioB = await prisma.clase.create({
    data: {
      nombre: 'Intermedio B',
      nivelMin: 2.0, nivelMax: 2.5,
      profesorId: carlos.id, pistaId: pista2.id,
      diaSemana: DiaSemana.JUEVES,
      horaInicio: '19:00', horaFin: '20:00',
      plazasTotal: 4,
    },
  });
  const claseAvanzadoA = await prisma.clase.create({
    data: {
      nombre: 'Avanzado A',
      nivelMin: 3.0, nivelMax: 3.5,
      profesorId: hugo.id, pistaId: pista3.id,
      diaSemana: DiaSemana.MARTES,
      horaInicio: '20:00', horaFin: '21:00',
      plazasTotal: 4,
    },
  });
  const claseAvanzadoB = await prisma.clase.create({
    data: {
      nombre: 'Avanzado B',
      nivelMin: 3.0, nivelMax: 3.5,
      profesorId: carlos.id, pistaId: pista3.id,
      diaSemana: DiaSemana.VIERNES,
      horaInicio: '20:00', horaFin: '21:00',
      plazasTotal: 4,
    },
  });
  console.log('✅ Clases creadas (6)');

  // ── ALUMNOS ──────────────────────────────────────────
  const alumnosData = [
    // Iniciación A (nivel 1.0)
    { nombre: 'María', apellidos: 'García López', email: 'maria.garcia@email.com', telefono: '611001001', nivel: 1.0, disponibilidad: Disponibilidad.MANANA },
    { nombre: 'Carmen', apellidos: 'López Sánchez', email: 'carmen.lopez@email.com', telefono: '611001002', nivel: 1.0, disponibilidad: Disponibilidad.MANANA },
    { nombre: 'Francisco', apellidos: 'Jiménez Ruiz', email: 'francisco.jimenez@email.com', telefono: '611001003', nivel: 1.0, disponibilidad: Disponibilidad.FLEXIBLE },
    { nombre: 'Jorge', apellidos: 'Ortiz Vega', email: 'jorge.ortiz@email.com', telefono: '611001004', nivel: 1.0, disponibilidad: Disponibilidad.TARDE },
    // Iniciación B (nivel 1.5)
    { nombre: 'Laura', apellidos: 'Pérez Moreno', email: 'laura.perez@email.com', telefono: '611002001', nivel: 1.5, disponibilidad: Disponibilidad.MANANA },
    { nombre: 'Cristina', apellidos: 'Vega Castro', email: 'cristina.vega@email.com', telefono: '611002002', nivel: 1.5, disponibilidad: Disponibilidad.MANANA },
    { nombre: 'Juan', apellidos: 'Martínez Gil', email: 'juan.martinez@email.com', telefono: '611002003', nivel: 1.5, disponibilidad: Disponibilidad.TARDE },
    { nombre: 'Isabel', apellidos: 'Romero Blanco', email: 'isabel.romero@email.com', telefono: '611002004', nivel: 1.5, disponibilidad: Disponibilidad.FLEXIBLE },
    // Intermedio A (nivel 2.0)
    { nombre: 'Antonio', apellidos: 'Sánchez Torres', email: 'antonio.sanchez@email.com', telefono: '611003001', nivel: 2.0, disponibilidad: Disponibilidad.TARDE },
    { nombre: 'Carlos', apellidos: 'Díaz Navarro', email: 'carlos.diaz@email.com', telefono: '611003002', nivel: 2.0, disponibilidad: Disponibilidad.MANANA },
    { nombre: 'Roberto', apellidos: 'Ruiz Herrero', email: 'roberto.ruiz@email.com', telefono: '611003003', nivel: 2.0, disponibilidad: Disponibilidad.MANANA },
    { nombre: 'Patricia', apellidos: 'Blanco Morales', email: 'patricia.blanco@email.com', telefono: '611003004', nivel: 2.0, disponibilidad: Disponibilidad.FLEXIBLE },
    // Intermedio B (nivel 2.5)
    { nombre: 'Pedro', apellidos: 'Gómez Serrano', email: 'pedro.gomez@email.com', telefono: '611004001', nivel: 2.5, disponibilidad: Disponibilidad.TARDE },
    { nombre: 'Elena', apellidos: 'Moreno Castillo', email: 'elena.moreno@email.com', telefono: '611004002', nivel: 2.5, disponibilidad: Disponibilidad.TARDE },
    { nombre: 'Miguel', apellidos: 'Herrero Fuentes', email: 'miguel.herrero@email.com', telefono: '611004003', nivel: 2.5, disponibilidad: Disponibilidad.FLEXIBLE },
    { nombre: 'Diego', apellidos: 'Morales Reyes', email: 'diego.morales@email.com', telefono: '611004004', nivel: 2.5, disponibilidad: Disponibilidad.TARDE },
    // Avanzado A (nivel 3.0)
    { nombre: 'Ana', apellidos: 'Fernández Cano', email: 'ana.fernandez@email.com', telefono: '611005001', nivel: 3.0, disponibilidad: Disponibilidad.TARDE },
    { nombre: 'David', apellidos: 'Torres Molina', email: 'david.torres@email.com', telefono: '611005002', nivel: 3.0, disponibilidad: Disponibilidad.TARDE },
    { nombre: 'Sara', apellidos: 'Castro Prado', email: 'sara.castro@email.com', telefono: '611005003', nivel: 3.0, disponibilidad: Disponibilidad.TARDE },
    { nombre: 'Marta', apellidos: 'Álvarez Soler', email: 'marta.alvarez@email.com', telefono: '611005004', nivel: 3.5, disponibilidad: Disponibilidad.TARDE },
    // Avanzado B (nivel 3.0-3.5)
    { nombre: 'Raúl', apellidos: 'Navarro León', email: 'raul.navarro@email.com', telefono: '611006001', nivel: 3.5, disponibilidad: Disponibilidad.TARDE },
    { nombre: 'Beatriz', apellidos: 'Molina Ramos', email: 'beatriz.molina@email.com', telefono: '611006002', nivel: 3.0, disponibilidad: Disponibilidad.FLEXIBLE },
    { nombre: 'Alejandro', apellidos: 'Gil Vargas', email: 'alejandro.gil@email.com', telefono: '611006003', nivel: 3.5, disponibilidad: Disponibilidad.TARDE },
    { nombre: 'Natalia', apellidos: 'Vidal Santos', email: 'natalia.vidal@email.com', telefono: '611006004', nivel: 3.0, disponibilidad: Disponibilidad.TARDE },
  ];

  const alumnos = await prisma.alumno.createManyAndReturn({ data: alumnosData });
  console.log(`✅ Alumnos creados (${alumnos.length})`);

  // Índices por nombre para fácil referencia
  const byNombre = (n: string) => alumnos.find(a => a.nombre === n)!;

  // ── INSCRIPCIONES ────────────────────────────────────
  const inscripcionesData = [
    // Iniciación A → María, Carmen, Francisco, Jorge
    { alumnoId: byNombre('María').id,     claseId: claseIniciacionA.id },
    { alumnoId: byNombre('Carmen').id,    claseId: claseIniciacionA.id },
    { alumnoId: byNombre('Francisco').id, claseId: claseIniciacionA.id },
    { alumnoId: byNombre('Jorge').id,     claseId: claseIniciacionA.id },
    // Iniciación B → Laura, Cristina, Juan, Isabel
    { alumnoId: byNombre('Laura').id,     claseId: claseIniciacionB.id },
    { alumnoId: byNombre('Cristina').id,  claseId: claseIniciacionB.id },
    { alumnoId: byNombre('Juan').id,      claseId: claseIniciacionB.id },
    { alumnoId: byNombre('Isabel').id,    claseId: claseIniciacionB.id },
    // Intermedio A → Antonio, Carlos, Roberto, Patricia
    { alumnoId: byNombre('Antonio').id,   claseId: claseIntermedioA.id },
    { alumnoId: byNombre('Carlos').id,    claseId: claseIntermedioA.id },
    { alumnoId: byNombre('Roberto').id,   claseId: claseIntermedioA.id },
    { alumnoId: byNombre('Patricia').id,  claseId: claseIntermedioA.id },
    // Intermedio B → Pedro, Elena, Miguel, Diego
    { alumnoId: byNombre('Pedro').id,     claseId: claseIntermedioB.id },
    { alumnoId: byNombre('Elena').id,     claseId: claseIntermedioB.id },
    { alumnoId: byNombre('Miguel').id,    claseId: claseIntermedioB.id },
    { alumnoId: byNombre('Diego').id,     claseId: claseIntermedioB.id },
    // Avanzado A → Ana, David, Sara, Marta
    { alumnoId: byNombre('Ana').id,       claseId: claseAvanzadoA.id },
    { alumnoId: byNombre('David').id,     claseId: claseAvanzadoA.id },
    { alumnoId: byNombre('Sara').id,      claseId: claseAvanzadoA.id },
    { alumnoId: byNombre('Marta').id,     claseId: claseAvanzadoA.id },
    // Avanzado B → Raúl, Beatriz, Alejandro, Natalia
    { alumnoId: byNombre('Raúl').id,      claseId: claseAvanzadoB.id },
    { alumnoId: byNombre('Beatriz').id,   claseId: claseAvanzadoB.id },
    { alumnoId: byNombre('Alejandro').id, claseId: claseAvanzadoB.id },
    { alumnoId: byNombre('Natalia').id,   claseId: claseAvanzadoB.id },
  ];
  await prisma.alumnoClase.createMany({ data: inscripcionesData });
  console.log('✅ Inscripciones creadas');

  // ── SESIONES PASADAS (semana del 2-6 marzo) ──────────
  // Lunes 2 mar
  const sesIniA_pasada = await prisma.sesion.create({
    data: { claseId: claseIniciacionA.id, fecha: fechaConHora(new Date('2026-03-02'), '10:00'), estado: 'COMPLETADA' },
  });
  const sesIntA_pasada = await prisma.sesion.create({
    data: { claseId: claseIntermedioA.id, fecha: fechaConHora(new Date('2026-03-02'), '19:00'), estado: 'COMPLETADA' },
  });
  // Martes 3 mar
  const sesAvaA_pasada = await prisma.sesion.create({
    data: { claseId: claseAvanzadoA.id, fecha: fechaConHora(new Date('2026-03-03'), '20:00'), estado: 'COMPLETADA' },
  });
  // Miércoles 4 mar
  const sesIniB_pasada = await prisma.sesion.create({
    data: { claseId: claseIniciacionB.id, fecha: fechaConHora(new Date('2026-03-04'), '10:00'), estado: 'COMPLETADA' },
  });
  // Jueves 5 mar
  const sesIntB_pasada = await prisma.sesion.create({
    data: { claseId: claseIntermedioB.id, fecha: fechaConHora(new Date('2026-03-05'), '19:00'), estado: 'COMPLETADA' },
  });
  // Viernes 6 mar
  const sesAvaB_pasada = await prisma.sesion.create({
    data: { claseId: claseAvanzadoB.id, fecha: fechaConHora(new Date('2026-03-06'), '20:00'), estado: 'COMPLETADA' },
  });
  console.log('✅ Sesiones pasadas creadas (6)');

  // ── ASISTENCIAS SEMANA PASADA ─────────────────────────
  // Iniciación A — Carmen FALTA
  await prisma.asistencia.createMany({
    data: [
      { sesionId: sesIniA_pasada.id, alumnoId: byNombre('María').id,     estado: EstadoAsistencia.PRESENTE },
      { sesionId: sesIniA_pasada.id, alumnoId: byNombre('Carmen').id,    estado: EstadoAsistencia.FALTA },
      { sesionId: sesIniA_pasada.id, alumnoId: byNombre('Francisco').id, estado: EstadoAsistencia.PRESENTE },
      { sesionId: sesIniA_pasada.id, alumnoId: byNombre('Jorge').id,     estado: EstadoAsistencia.PRESENTE },
    ],
  });
  // Iniciación B — Cristina e Isabel FALTA
  await prisma.asistencia.createMany({
    data: [
      { sesionId: sesIniB_pasada.id, alumnoId: byNombre('Laura').id,    estado: EstadoAsistencia.PRESENTE },
      { sesionId: sesIniB_pasada.id, alumnoId: byNombre('Cristina').id, estado: EstadoAsistencia.FALTA },
      { sesionId: sesIniB_pasada.id, alumnoId: byNombre('Juan').id,     estado: EstadoAsistencia.PRESENTE },
      { sesionId: sesIniB_pasada.id, alumnoId: byNombre('Isabel').id,   estado: EstadoAsistencia.FALTA },
    ],
  });
  // Intermedio A — Carlos FALTA
  await prisma.asistencia.createMany({
    data: [
      { sesionId: sesIntA_pasada.id, alumnoId: byNombre('Antonio').id,  estado: EstadoAsistencia.PRESENTE },
      { sesionId: sesIntA_pasada.id, alumnoId: byNombre('Carlos').id,   estado: EstadoAsistencia.FALTA },
      { sesionId: sesIntA_pasada.id, alumnoId: byNombre('Roberto').id,  estado: EstadoAsistencia.PRESENTE },
      { sesionId: sesIntA_pasada.id, alumnoId: byNombre('Patricia').id, estado: EstadoAsistencia.PRESENTE },
    ],
  });
  // Intermedio B — Elena FALTA
  await prisma.asistencia.createMany({
    data: [
      { sesionId: sesIntB_pasada.id, alumnoId: byNombre('Pedro').id,  estado: EstadoAsistencia.PRESENTE },
      { sesionId: sesIntB_pasada.id, alumnoId: byNombre('Elena').id,  estado: EstadoAsistencia.FALTA },
      { sesionId: sesIntB_pasada.id, alumnoId: byNombre('Miguel').id, estado: EstadoAsistencia.PRESENTE },
      { sesionId: sesIntB_pasada.id, alumnoId: byNombre('Diego').id,  estado: EstadoAsistencia.PRESENTE },
    ],
  });
  // Avanzado A — Ana FALTA
  await prisma.asistencia.createMany({
    data: [
      { sesionId: sesAvaA_pasada.id, alumnoId: byNombre('Ana').id,   estado: EstadoAsistencia.FALTA },
      { sesionId: sesAvaA_pasada.id, alumnoId: byNombre('David').id, estado: EstadoAsistencia.PRESENTE },
      { sesionId: sesAvaA_pasada.id, alumnoId: byNombre('Sara').id,  estado: EstadoAsistencia.PRESENTE },
      { sesionId: sesAvaA_pasada.id, alumnoId: byNombre('Marta').id, estado: EstadoAsistencia.PRESENTE },
    ],
  });
  // Avanzado B — Beatriz FALTA
  await prisma.asistencia.createMany({
    data: [
      { sesionId: sesAvaB_pasada.id, alumnoId: byNombre('Raúl').id,      estado: EstadoAsistencia.PRESENTE },
      { sesionId: sesAvaB_pasada.id, alumnoId: byNombre('Beatriz').id,   estado: EstadoAsistencia.FALTA },
      { sesionId: sesAvaB_pasada.id, alumnoId: byNombre('Alejandro').id, estado: EstadoAsistencia.PRESENTE },
      { sesionId: sesAvaB_pasada.id, alumnoId: byNombre('Natalia').id,   estado: EstadoAsistencia.PRESENTE },
    ],
  });
  console.log('✅ Asistencias registradas (6 sesiones, 7 faltas)');

  // ── SESIONES PRÓXIMAS (semana del 9-13 marzo) ────────
  // Lunes 9 mar
  const sesIniA_proxima = await prisma.sesion.create({
    data: { claseId: claseIniciacionA.id, fecha: fechaConHora(new Date('2026-03-09'), '10:00') },
  });
  const sesIntA_proxima = await prisma.sesion.create({
    data: { claseId: claseIntermedioA.id, fecha: fechaConHora(new Date('2026-03-09'), '19:00') },
  });
  // Martes 10 mar
  const sesAvaA_proxima = await prisma.sesion.create({
    data: { claseId: claseAvanzadoA.id, fecha: fechaConHora(new Date('2026-03-10'), '20:00') },
  });
  // Miércoles 11 mar
  await prisma.sesion.create({
    data: { claseId: claseIniciacionB.id, fecha: fechaConHora(new Date('2026-03-11'), '10:00') },
  });
  // Jueves 12 mar
  const sesIntB_proxima = await prisma.sesion.create({
    data: { claseId: claseIntermedioB.id, fecha: fechaConHora(new Date('2026-03-12'), '19:00') },
  });
  // Viernes 13 mar
  await prisma.sesion.create({
    data: { claseId: claseAvanzadoB.id, fecha: fechaConHora(new Date('2026-03-13'), '20:00') },
  });
  console.log('✅ Sesiones próximas creadas (6)');

  // ── RECUPERACIONES ───────────────────────────────────
  const expiracBase = new Date('2026-04-07');

  // Carmen (iniciación 1.0) → PENDIENTE
  await prisma.recuperacion.create({
    data: {
      alumnoId: byNombre('Carmen').id,
      sesionOrigenId: sesIniA_pasada.id,
      estado: EstadoRecuperacion.PENDIENTE,
      expiraEn: new Date('2026-04-01'),
    },
  });
  // Cristina (iniciación 1.5) → PENDIENTE
  await prisma.recuperacion.create({
    data: {
      alumnoId: byNombre('Cristina').id,
      sesionOrigenId: sesIniB_pasada.id,
      estado: EstadoRecuperacion.PENDIENTE,
      expiraEn: new Date('2026-04-03'),
    },
  });
  // Isabel (iniciación 1.5) → PENDIENTE
  await prisma.recuperacion.create({
    data: {
      alumnoId: byNombre('Isabel').id,
      sesionOrigenId: sesIniB_pasada.id,
      estado: EstadoRecuperacion.PENDIENTE,
      expiraEn: new Date('2026-04-03'),
    },
  });
  // Carlos (intermedio 2.0) → RESERVADA en Intermedio B del jueves 12 mar (1 plaza libre disponible)
  await prisma.recuperacion.create({
    data: {
      alumnoId: byNombre('Carlos').id,
      sesionOrigenId: sesIntA_pasada.id,
      sesionRecuperacionId: sesIntB_proxima.id,
      estado: EstadoRecuperacion.RESERVADA,
      expiraEn: new Date('2026-04-02'),
      notas: 'Recupera el jueves 12 en Intermedio B',
    },
  });
  // Elena (intermedio 2.5) → PENDIENTE
  await prisma.recuperacion.create({
    data: {
      alumnoId: byNombre('Elena').id,
      sesionOrigenId: sesIntB_pasada.id,
      estado: EstadoRecuperacion.PENDIENTE,
      expiraEn: new Date('2026-04-05'),
    },
  });
  // Ana (avanzado 3.0) → PENDIENTE
  await prisma.recuperacion.create({
    data: {
      alumnoId: byNombre('Ana').id,
      sesionOrigenId: sesAvaA_pasada.id,
      estado: EstadoRecuperacion.PENDIENTE,
      expiraEn: new Date('2026-04-03'),
    },
  });
  // Beatriz (avanzado 3.0) → PENDIENTE
  await prisma.recuperacion.create({
    data: {
      alumnoId: byNombre('Beatriz').id,
      sesionOrigenId: sesAvaB_pasada.id,
      estado: EstadoRecuperacion.PENDIENTE,
      expiraEn: new Date('2026-04-06'),
    },
  });
  console.log('✅ Recuperaciones creadas (7: 5 pendientes, 1 reservada)');

  // ── NOTIFICACIÓN DE EJEMPLO ──────────────────────────
  await prisma.notificacion.create({
    data: {
      alumnoId: byNombre('Carmen').id,
      sesionId: sesIniA_proxima.id,
      tipo: 'PLAZA_LIBRE',
      mensaje: '🎾 Plaza libre disponible\n\nClase: Iniciación A\n📅 Lunes 9 de marzo\n⏰ 10:00\n🏟️ Pista 1\n\n¿Quieres reservar esta plaza?\nResponde *SI* o haz clic aquí.',
      estado: 'ENVIADA',
      enviadaEn: new Date('2026-03-08T10:00:00Z'),
    },
  });
  console.log('✅ Notificación de ejemplo creada');

  console.log('\n🎾 ¡Seed completado!');
  console.log('───────────────────────────────');
  console.log('  Profesores: 3');
  console.log('  Pistas:     3');
  console.log('  Clases:     6');
  console.log('  Alumnos:    24');
  console.log('  Sesiones:   12 (6 pasadas + 6 próximas)');
  console.log('  Recuperaciones: 7');
  console.log('  Admin: admin@academia.com / admin123');
  console.log('───────────────────────────────');
}

main()
  .catch((e) => { console.error('❌ Error en seed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
