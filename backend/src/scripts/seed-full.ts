/**
 * seed-full.ts — population script for Academia Pádel
 * Run: npx ts-node src/scripts/seed-full.ts
 *
 * Creates:
 * - 4th pista + 4th professor (Lucía Fernández, Pista 4)
 * - Full schedule: mornings 10-14, evenings 17-21 across Mon-Sat (4 classes/pista/week)
 * - Fictional students to fill every class to plazasTotal
 */

import { PrismaClient, DiaSemana, Disponibilidad } from '@prisma/client';
const prisma = new PrismaClient();

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🎾 Seeding full schedule…');

  // ── 1. Ensure 4th pista exists ───────────────────────────────────────────────
  let pista4 = await prisma.pista.findFirst({ where: { numero: 4 } });
  if (!pista4) {
    pista4 = await prisma.pista.create({
      data: { nombre: 'Pista Competición', numero: 4, activa: true },
    });
    console.log('✅  Pista 4 created');
  }

  // ── 2. Ensure 4th professor exists ───────────────────────────────────────────
  let lucia = await prisma.profesor.findFirst({ where: { email: 'lucia@academia.com' } });
  if (!lucia) {
    lucia = await prisma.profesor.create({
      data: {
        nombre: 'Lucía',
        apellidos: 'Fernández Ruiz',
        email: 'lucia@academia.com',
        telefono: '600000004',
        activo: true,
      },
    });
    console.log('✅  Profesor Lucía created');
  }

  // ── 3. Get existing professors and pistas ────────────────────────────────────
  const profesores = await prisma.profesor.findMany({ orderBy: { createdAt: 'asc' } });
  const pistas = await prisma.pista.findMany({ orderBy: { numero: 'asc' } });

  const pMap = Object.fromEntries(pistas.map((p) => [p.numero, p.id]));
  const profByName: Record<string, string> = Object.fromEntries(
    profesores.map((p) => [p.nombre, p.id]),
  );

  // ── 4. Class template: each pista × days × times ────────────────────────────
  type SlotDef = {
    nombre: string; nivelMin: number; nivelMax: number;
    profesorId: string; pistaId: string;
    diaSemana: DiaSemana; horaInicio: string; horaFin: string;
  };

  const schedule: SlotDef[] = [
    // PISTA 1 — Hugo
    { nombre: 'Iniciación A', nivelMin: 1, nivelMax: 2, profesorId: profByName['Hugo'], pistaId: pMap[1], diaSemana: 'LUNES',     horaInicio: '10:00', horaFin: '11:00' },
    { nombre: 'Iniciación A', nivelMin: 1, nivelMax: 2, profesorId: profByName['Hugo'], pistaId: pMap[1], diaSemana: 'MARTES',    horaInicio: '10:00', horaFin: '11:00' },
    { nombre: 'Intermedio A', nivelMin: 2, nivelMax: 4, profesorId: profByName['Hugo'], pistaId: pMap[1], diaSemana: 'MIERCOLES', horaInicio: '11:00', horaFin: '12:00' },
    { nombre: 'Intermedio A', nivelMin: 2, nivelMax: 4, profesorId: profByName['Hugo'], pistaId: pMap[1], diaSemana: 'JUEVES',    horaInicio: '13:00', horaFin: '14:00' },
    { nombre: 'Avanzado A',   nivelMin: 3, nivelMax: 5, profesorId: profByName['Hugo'], pistaId: pMap[1], diaSemana: 'LUNES',     horaInicio: '19:00', horaFin: '20:00' },
    { nombre: 'Avanzado A',   nivelMin: 3, nivelMax: 5, profesorId: profByName['Hugo'], pistaId: pMap[1], diaSemana: 'MIERCOLES', horaInicio: '20:00', horaFin: '21:00' },
    { nombre: 'Avanzado A',   nivelMin: 3, nivelMax: 5, profesorId: profByName['Hugo'], pistaId: pMap[1], diaSemana: 'JUEVES',    horaInicio: '17:00', horaFin: '18:00' },
    { nombre: 'Avanzado A',   nivelMin: 3, nivelMax: 5, profesorId: profByName['Hugo'], pistaId: pMap[1], diaSemana: 'VIERNES',   horaInicio: '17:00', horaFin: '18:00' },

    // PISTA 2 — Ana
    { nombre: 'Iniciación B', nivelMin: 1, nivelMax: 2, profesorId: profByName['Ana'],    pistaId: pMap[2], diaSemana: 'LUNES',     horaInicio: '11:00', horaFin: '12:00' },
    { nombre: 'Iniciación B', nivelMin: 1, nivelMax: 2, profesorId: profByName['Ana'],    pistaId: pMap[2], diaSemana: 'MARTES',    horaInicio: '12:00', horaFin: '13:00' },
    { nombre: 'Iniciación B', nivelMin: 1, nivelMax: 2, profesorId: profByName['Ana'],    pistaId: pMap[2], diaSemana: 'MIERCOLES', horaInicio: '10:00', horaFin: '11:00' },
    { nombre: 'Intermedio B', nivelMin: 2, nivelMax: 4, profesorId: profByName['Ana'],    pistaId: pMap[2], diaSemana: 'JUEVES',    horaInicio: '19:00', horaFin: '20:00' },
    { nombre: 'Intermedio B', nivelMin: 2, nivelMax: 4, profesorId: profByName['Ana'],    pistaId: pMap[2], diaSemana: 'VIERNES',   horaInicio: '10:00', horaFin: '11:00' },
    { nombre: 'Avanzado B',   nivelMin: 3, nivelMax: 5, profesorId: profByName['Ana'],    pistaId: pMap[2], diaSemana: 'LUNES',     horaInicio: '17:00', horaFin: '18:00' },
    { nombre: 'Avanzado B',   nivelMin: 3, nivelMax: 5, profesorId: profByName['Ana'],    pistaId: pMap[2], diaSemana: 'MARTES',    horaInicio: '18:00', horaFin: '19:00' },
    { nombre: 'Avanzado B',   nivelMin: 3, nivelMax: 5, profesorId: profByName['Ana'],    pistaId: pMap[2], diaSemana: 'VIERNES',   horaInicio: '19:00', horaFin: '20:00' },

    // PISTA 3 — Carlos
    { nombre: 'Avanzado A',   nivelMin: 3, nivelMax: 5, profesorId: profByName['Carlos'], pistaId: pMap[3], diaSemana: 'MARTES',    horaInicio: '20:00', horaFin: '21:00' },
    { nombre: 'Avanzado A',   nivelMin: 3, nivelMax: 5, profesorId: profByName['Carlos'], pistaId: pMap[3], diaSemana: 'JUEVES',    horaInicio: '20:00', horaFin: '21:00' },
    { nombre: 'Intermedio C', nivelMin: 2, nivelMax: 4, profesorId: profByName['Carlos'], pistaId: pMap[3], diaSemana: 'LUNES',     horaInicio: '12:00', horaFin: '13:00' },
    { nombre: 'Intermedio C', nivelMin: 2, nivelMax: 4, profesorId: profByName['Carlos'], pistaId: pMap[3], diaSemana: 'MIERCOLES', horaInicio: '13:00', horaFin: '14:00' },
    { nombre: 'Iniciación C', nivelMin: 1, nivelMax: 2, profesorId: profByName['Carlos'], pistaId: pMap[3], diaSemana: 'VIERNES',   horaInicio: '20:00', horaFin: '21:00' },
    { nombre: 'Iniciación C', nivelMin: 1, nivelMax: 2, profesorId: profByName['Carlos'], pistaId: pMap[3], diaSemana: 'MIERCOLES', horaInicio: '18:00', horaFin: '19:00' },

    // PISTA 4 — Lucía
    { nombre: 'Iniciación D', nivelMin: 1, nivelMax: 2, profesorId: lucia.id, pistaId: pista4.id, diaSemana: 'LUNES',     horaInicio: '10:00', horaFin: '11:00' },
    { nombre: 'Iniciación D', nivelMin: 1, nivelMax: 2, profesorId: lucia.id, pistaId: pista4.id, diaSemana: 'MARTES',    horaInicio: '11:00', horaFin: '12:00' },
    { nombre: 'Iniciación D', nivelMin: 1, nivelMax: 2, profesorId: lucia.id, pistaId: pista4.id, diaSemana: 'MIERCOLES', horaInicio: '12:00', horaFin: '13:00' },
    { nombre: 'Intermedio D', nivelMin: 2, nivelMax: 4, profesorId: lucia.id, pistaId: pista4.id, diaSemana: 'JUEVES',    horaInicio: '11:00', horaFin: '12:00' },
    { nombre: 'Intermedio D', nivelMin: 2, nivelMax: 4, profesorId: lucia.id, pistaId: pista4.id, diaSemana: 'VIERNES',   horaInicio: '13:00', horaFin: '14:00' },
    { nombre: 'Avanzado C',   nivelMin: 3, nivelMax: 5, profesorId: lucia.id, pistaId: pista4.id, diaSemana: 'LUNES',     horaInicio: '18:00', horaFin: '19:00' },
    { nombre: 'Avanzado C',   nivelMin: 3, nivelMax: 5, profesorId: lucia.id, pistaId: pista4.id, diaSemana: 'MARTES',    horaInicio: '19:00', horaFin: '20:00' },
    { nombre: 'Avanzado C',   nivelMin: 3, nivelMax: 5, profesorId: lucia.id, pistaId: pista4.id, diaSemana: 'VIERNES',   horaInicio: '20:00', horaFin: '21:00' },
  ];

  // ── 5. Upsert classes (skip if same pista+dia+hora already exists) ────────────
  const clasesCreadas: string[] = [];
  for (const slot of schedule) {
    const existe = await prisma.clase.findFirst({
      where: {
        pistaId: slot.pistaId,
        diaSemana: slot.diaSemana,
        horaInicio: slot.horaInicio,
        activa: true,
      },
    });
    if (existe) { clasesCreadas.push(existe.id); continue; }

    const c = await prisma.clase.create({
      data: {
        nombre: slot.nombre,
        nivelMin: slot.nivelMin,
        nivelMax: slot.nivelMax,
        profesorId: slot.profesorId,
        pistaId: slot.pistaId,
        diaSemana: slot.diaSemana,
        horaInicio: slot.horaInicio,
        horaFin: slot.horaFin,
        plazasTotal: 4,
        activa: true,
      },
    });
    clasesCreadas.push(c.id);
  }
  console.log(`✅  Classes ensured (${clasesCreadas.length} total slots)`);

  // ── 6. Generate enough fake students ────────────────────────────────────────
  const allClases = await prisma.clase.findMany({
    where: { activa: true },
    include: { inscripciones: { where: { activo: true } } },
  });

  // Count how many student slots we still need
  let slotsNeeded = 0;
  for (const c of allClases) {
    const libre = c.plazasTotal - c.inscripciones.length;
    if (libre > 0) slotsNeeded += libre;
  }
  console.log(`📦  Need ${slotsNeeded} student slots to fill all classes`);

  const nombres = ['Álvaro','Beatriz','César','Diana','Eduardo','Fátima','Gonzalo','Helena','Ignacio','Julia','Kevin','Lorena','Marcos','Nuria','Óscar','Paula','Quique','Raquel','Samuel','Teresa','Ulises','Valentina','Walter','Xenia','Yanira','Zoe','Adrián','Blanca','Claudia','Daniel','Esther','Fernando','Gabriela','Héctor','Irene','Javier','Kira','Luis','Mónica','Nicolás'];
  const apellidos1 = ['García','López','Martínez','Sánchez','González','Rodríguez','Fernández','Pérez','Alonso','Ruiz','Torres','Ramos','Jiménez','Navarro','Castro','Moreno','Ortiz','Vargas','Reyes','Cruz','Herrera','Campos','Vega','Santos','Medina'];
  const apellidos2 = ['Blanco','Romero','Molina','Suárez','Gil','Delgado','Muñoz','Rubio','Morales','Guerrero','Soler','Llorente','Pardo','Bravo','Calvo','Peña','Prieto','Salvador','Cabrera','Ríos'];

  const rd = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  // Get existing emails to avoid dupes
  const existingEmails = new Set(
    (await prisma.alumno.findMany({ select: { email: true } })).map((a) => a.email),
  );

  const generatedAlumnos: string[] = [];
  for (let i = 0; i < slotsNeeded + 5; i++) {
    const nombre = rd(nombres);
    const ap1 = rd(apellidos1);
    const ap2 = rd(apellidos2);
    const email = `${nombre.toLowerCase().replace(/[áéíóúü]/g, c => 'aeiou'['áéíóú'.indexOf(c)] ?? c)}.${ap1.toLowerCase()}.${i}@test.com`;
    if (existingEmails.has(email)) continue;
    existingEmails.add(email);

    const nivel = parseFloat((Math.random() * 4 + 1).toFixed(1));
    const dispOptions: Disponibilidad[] = ['MANANA', 'TARDE', 'FLEXIBLE'];
    const a = await prisma.alumno.create({
      data: {
        nombre, apellidos: `${ap1} ${ap2}`, email,
        telefono: `6${Math.floor(Math.random() * 99999999).toString().padStart(8, '0')}`,
        nivel, disponibilidad: dispOptions[i % 3],
        activo: true,
        tarifaMensual: [35, 40, 45, 50][Math.floor(Math.random() * 4)],
      },
    });
    generatedAlumnos.push(a.id);
  }
  console.log(`✅  Created ${generatedAlumnos.length} new students`);

  // ── 7. Fill every class to plazasTotal ───────────────────────────────────────
  const clasesRefresh = await prisma.clase.findMany({
    where: { activa: true },
    include: { inscripciones: { where: { activo: true } } },
    orderBy: { createdAt: 'asc' },
  });

  // Pool of unassigned students
  const allAlumnos = await prisma.alumno.findMany({
    where: { activo: true },
    orderBy: { createdAt: 'desc' },
  });

  // Build a usage map (alumnoId → set of claseIds already enrolled)
  const enrollment = new Map<string, Set<string>>();
  for (const a of allAlumnos) enrollment.set(a.id, new Set());
  const allInscripciones = await prisma.alumnoClase.findMany({ where: { activo: true } });
  for (const i of allInscripciones) {
    enrollment.get(i.alumnoId)?.add(i.claseId);
  }

  let inscritosTotal = 0;
  for (const clase of clasesRefresh) {
    const inscritos = clase.inscripciones.length;
    const plazasLibres = clase.plazasTotal - inscritos;
    if (plazasLibres <= 0) continue;

    // Find compatible students not already in this class and no time conflict on same day+slot
    const candidates = allAlumnos.filter((a) => {
      const enrolados = enrollment.get(a.id);
      if (!enrolados) return false;
      if (enrolados.has(clase.id)) return false;
      // Level compatibility
      if (a.nivel < clase.nivelMin || a.nivel > clase.nivelMax + 1) return false;
      return true;
    });

    let added = 0;
    for (const cand of candidates) {
      if (added >= plazasLibres) break;
      try {
        await prisma.alumnoClase.upsert({
          where: { alumnoId_claseId: { alumnoId: cand.id, claseId: clase.id } },
          update: { activo: true },
          create: { alumnoId: cand.id, claseId: clase.id, activo: true },
        });
        enrollment.get(cand.id)!.add(clase.id);
        added++;
        inscritosTotal++;
      } catch { /* skip conflicts */ }
    }
  }
  console.log(`✅  Filled ${inscritosTotal} class slots`);

  // ── 8. Summary ────────────────────────────────────────────────────────────────
  const summary = await prisma.clase.findMany({
    where: { activa: true },
    include: { inscripciones: { where: { activo: true } }, pista: true },
    orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
  });

  console.log('\n📋 Final schedule:');
  for (const c of summary) {
    const full = c.inscripciones.length >= c.plazasTotal ? '🟢' : '🟡';
    console.log(`  ${full} Pista ${c.pista.numero} · ${c.diaSemana} ${c.horaInicio} · ${c.nombre} · ${c.inscripciones.length}/${c.plazasTotal}`);
  }

  console.log('\n✅ Seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
