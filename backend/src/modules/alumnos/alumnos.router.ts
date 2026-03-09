import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

const router = Router();

// GET /api/alumnos
router.get('/', async (req: Request, res: Response) => {
  try {
    const { nivel, disponibilidad, activo, search } = req.query;

    const alumnos = await prisma.alumno.findMany({
      where: {
        ...(activo !== undefined ? { activo: activo === 'true' } : {}),
        ...(disponibilidad ? { disponibilidad: disponibilidad as any } : {}),
        ...(nivel ? { nivel: parseFloat(nivel as string) } : {}),
        ...(search
          ? {
              OR: [
                { nombre: { contains: search as string, mode: 'insensitive' } },
                { apellidos: { contains: search as string, mode: 'insensitive' } },
                { email: { contains: search as string, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        inscripciones: {
          where: { activo: true },
          include: { clase: { include: { profesor: true, pista: true } } },
        },
        _count: {
          select: {
            recuperaciones: { where: { estado: 'PENDIENTE' } },
          },
        },
      },
      orderBy: [{ apellidos: 'asc' }, { nombre: 'asc' }],
    });

    res.json(alumnos);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al obtener alumnos' });
  }
});

// GET /api/alumnos/clases-disponibles?nivel=X
router.get('/clases-disponibles', async (req: Request, res: Response) => {
  try {
    const nivel = parseFloat(req.query.nivel as string);
    if (isNaN(nivel)) return res.status(400).json({ error: 'nivel requerido' });

    const clases = await prisma.clase.findMany({
      where: {
        activa: true,
        nivelMin: { lte: nivel + 0.5 },
        nivelMax: { gte: nivel - 0.5 },
      },
      include: {
        inscripciones: { where: { activo: true } },
        pista: true,
        profesor: true,
      },
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
    });

    const result = clases.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      dia: c.diaSemana,
      hora: c.horaInicio,
      pista: c.pista.numero,
      profesor: `${c.profesor.nombre} ${c.profesor.apellidos}`,
      plazasTotal: c.plazasTotal,
      inscritos: c.inscripciones.length,
      plazasLibres: c.plazasTotal - c.inscripciones.length,
    }));

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al obtener clases disponibles' });
  }
});

// GET /api/alumnos/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const alumno = await prisma.alumno.findUnique({
      where: { id: req.params.id },
      include: {
        inscripciones: {
          include: { clase: { include: { profesor: true, pista: true } } },
        },
        recuperaciones: {
          include: {
            sesionOrigen: { include: { clase: true } },
            sesionRecuperacion: { include: { clase: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });
    res.json(alumno);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al obtener alumno' });
  }
});

// POST /api/alumnos
router.post('/', async (req: Request, res: Response) => {
  try {
    const { nombre, apellidos, email, telefono, nivel, disponibilidad, notas, tarifaMensual, claseId } = req.body;

    if (!nombre || !apellidos || !email || !telefono || nivel === undefined) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const alumno = await prisma.alumno.create({
      data: { nombre, apellidos, email, telefono, nivel: parseFloat(nivel), disponibilidad, notas,
        ...(tarifaMensual !== undefined ? { tarifaMensual: parseFloat(tarifaMensual) } : {}),
      },
    });

    const nivelAlumno = parseFloat(nivel);
    let asignacion: { claseId: string; nombre: string; pista: number; dia: string; hora: string } | null = null;
    let enEspera = false;

    // ── Si se indicó una clase concreta, usarla directamente ─────────────────────
    if (claseId) {
      const clase = await prisma.clase.findUnique({
        where: { id: claseId },
        include: { inscripciones: { where: { activo: true } }, pista: true, profesor: true },
      });
      if (clase) {
        if (clase.inscripciones.length < clase.plazasTotal) {
          await prisma.alumnoClase.create({ data: { alumnoId: alumno.id, claseId: clase.id } });
          asignacion = { claseId: clase.id, nombre: clase.nombre, pista: clase.pista.numero, dia: clase.diaSemana, hora: clase.horaInicio };
        } else {
          const ultima = await prisma.listaEspera.findFirst({ where: { claseId: clase.id }, orderBy: { posicion: 'desc' } });
          await prisma.listaEspera.create({ data: { alumnoId: alumno.id, claseId: clase.id, posicion: (ultima?.posicion ?? 0) + 1 } });
          enEspera = true;
        }
      }
    } else {
      // ── Auto-asignación: buscar clase con plaza libre y nivel compatible ────────
      const claseLibre = await prisma.clase.findFirst({
        where: {
          activa: true,
          nivelMin: { lte: nivelAlumno + 0.5 },
          nivelMax: { gte: nivelAlumno - 0.5 },
        },
        include: { inscripciones: { where: { activo: true } }, pista: true, profesor: true },
        orderBy: { createdAt: 'asc' },
      });

      if (claseLibre) {
        if (claseLibre.inscripciones.length < claseLibre.plazasTotal) {
          await prisma.alumnoClase.create({ data: { alumnoId: alumno.id, claseId: claseLibre.id } });
          asignacion = { claseId: claseLibre.id, nombre: claseLibre.nombre, pista: claseLibre.pista.numero, dia: claseLibre.diaSemana, hora: claseLibre.horaInicio };
        } else {
          const ultima = await prisma.listaEspera.findFirst({ where: { claseId: claseLibre.id }, orderBy: { posicion: 'desc' } });
          await prisma.listaEspera.create({ data: { alumnoId: alumno.id, claseId: claseLibre.id, posicion: (ultima?.posicion ?? 0) + 1 } });
          enEspera = true;
        }
      } else {
        enEspera = true;
      }
    }

    res.status(201).json({ alumno, asignacion, enEspera });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Ya existe un alumno con ese email' });
    }
    res.status(500).json({ error: 'Error al crear alumno' });
  }
});

// PUT /api/alumnos/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { nombre, apellidos, email, telefono, nivel, disponibilidad, activo, notas } = req.body;

    const alumno = await prisma.alumno.update({
      where: { id: req.params.id },
      data: {
        ...(nombre !== undefined ? { nombre } : {}),
        ...(apellidos !== undefined ? { apellidos } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(telefono !== undefined ? { telefono } : {}),
        ...(nivel !== undefined ? { nivel: parseFloat(nivel) } : {}),
        ...(disponibilidad !== undefined ? { disponibilidad } : {}),
        ...(activo !== undefined ? { activo } : {}),
        ...(notas !== undefined ? { notas } : {}),
      },
    });

    res.json(alumno);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al actualizar alumno' });
  }
});

// DELETE /api/alumnos/:id  (soft delete + liberar plaza)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.alumno.update({
      where: { id: req.params.id },
      data: { activo: false },
    });

    // Desinscribir de todas sus clases activas
    const inscripciones = await prisma.alumnoClase.findMany({
      where: { alumnoId: req.params.id, activo: true },
    });
    await prisma.alumnoClase.updateMany({
      where: { alumnoId: req.params.id, activo: true },
      data: { activo: false },
    });

    // Por cada clase liberada, asignar el primero de la lista de espera si existe
    const asignados: Array<{ claseId: string; alumnoId: string; posicion: number }> = [];
    for (const insc of inscripciones) {
      const primero = await prisma.listaEspera.findFirst({
        where: { claseId: insc.claseId },
        orderBy: { posicion: 'asc' },
        include: { alumno: true },
      });
      if (primero) {
        // Inscribir al primero de la espera
        await prisma.alumnoClase.upsert({
          where: { alumnoId_claseId: { alumnoId: primero.alumnoId, claseId: insc.claseId } },
          update: { activo: true, fechaInicio: new Date() },
          create: { alumnoId: primero.alumnoId, claseId: insc.claseId },
        });
        // Eliminar de la lista y reordenar
        await prisma.listaEspera.delete({ where: { id: primero.id } });
        await prisma.listaEspera.updateMany({
          where: { claseId: insc.claseId, posicion: { gt: primero.posicion } },
          data: { posicion: { decrement: 1 } },
        });
        asignados.push({ claseId: insc.claseId, alumnoId: primero.alumnoId, posicion: primero.posicion });
      }
    }

    res.json({ ok: true, mensaje: 'Alumno desactivado', plazasLiberadas: inscripciones.length, asignados });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al eliminar alumno' });
  }
});

export default router;
