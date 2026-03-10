import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

const router = Router();

// GET /api/clases
router.get('/', async (req: Request, res: Response) => {
  try {
    const { activa, diaSemana } = req.query;

    const clases = await prisma.clase.findMany({
      where: {
        ...(activa !== undefined ? { activa: activa === 'true' } : {}),
        ...(diaSemana ? { diaSemana: diaSemana as any } : {}),
      },
      include: {
        profesor: true,
        pista: true,
        inscripciones: {
          where: { activo: true },
          include: { alumno: true },
        },
        _count: { select: { sesiones: true } },
      },
      orderBy: [
        { diaSemana: 'asc' },
        { horaInicio: 'asc' },
      ],
    });

    res.json(clases);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener clases' });
  }
});

// GET /api/clases/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const clase = await prisma.clase.findUnique({
      where: { id: req.params.id },
      include: {
        profesor: true,
        pista: true,
        inscripciones: {
          include: { alumno: true },
          orderBy: { fechaInicio: 'desc' },
        },
        sesiones: {
          orderBy: { fecha: 'desc' },
          take: 10,
          include: { _count: { select: { asistencias: true } } },
        },
      },
    });

    if (!clase) return res.status(404).json({ error: 'Clase no encontrada' });
    res.json(clase);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener clase' });
  }
});

// POST /api/clases
router.post('/', async (req: Request, res: Response) => {
  try {
    const { nombre, nivelMin, nivelMax, profesorId, pistaId, diaSemana, horaInicio, horaFin, plazasTotal, fechaFin } = req.body;

    const clase = await prisma.clase.create({
      data: {
        nombre,
        nivelMin: parseFloat(nivelMin),
        nivelMax: parseFloat(nivelMax),
        profesorId,
        pistaId,
        diaSemana,
        horaInicio,
        horaFin,
        plazasTotal: parseInt(plazasTotal) || 4,
        ...(fechaFin ? { fechaFin: new Date(fechaFin) } : {}),
      },
      include: { profesor: true, pista: true },
    });

    res.status(201).json(clase);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear clase' });
  }
});

// PUT /api/clases/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const clase = await prisma.clase.update({
      where: { id: req.params.id },
      data: req.body,
      include: { profesor: true, pista: true },
    });
    res.json(clase);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar clase' });
  }
});

// POST /api/clases/:id/inscribir
router.post('/:id/inscribir', async (req: Request, res: Response) => {
  try {
    const { alumnoId } = req.body;
    const claseId = req.params.id;

    const clase = await prisma.clase.findUnique({
      where: { id: claseId },
      include: { inscripciones: { where: { activo: true } } },
    });
    if (!clase) return res.status(404).json({ error: 'Clase no encontrada' });
    if (clase.inscripciones.length >= clase.plazasTotal) {
      return res.status(409).json({ error: 'La clase está completa (sin plazas disponibles)' });
    }

    const inscripcion = await prisma.alumnoClase.upsert({
      where: { alumnoId_claseId: { alumnoId, claseId } },
      update: { activo: true, fechaInicio: new Date() },
      create: { alumnoId, claseId },
      include: { alumno: true, clase: true },
    });

    res.status(201).json(inscripcion);
  } catch (error) {
    res.status(500).json({ error: 'Error al inscribir alumno' });
  }
});

// DELETE /api/clases/:id/alumnos/:alumnoId
router.delete('/:id/alumnos/:alumnoId', async (req: Request, res: Response) => {
  try {
    await prisma.alumnoClase.update({
      where: {
        alumnoId_claseId: { alumnoId: req.params.alumnoId, claseId: req.params.id },
      },
      data: { activo: false },
    });

    // Si hay alumnos en lista de espera, informar al llamador
    const enEspera = await prisma.listaEspera.count({ where: { claseId: req.params.id } });
    res.json({ ok: true, tieneListaEspera: enEspera > 0, totalEnEspera: enEspera });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar alumno de la clase' });
  }
});

// POST /api/clases/:id/sesion — Generar próxima sesión
router.post('/:id/sesion', async (req: Request, res: Response) => {
  try {
    const { fecha } = req.body;
    const clase = await prisma.clase.findUnique({ where: { id: req.params.id } });
    if (!clase) return res.status(404).json({ error: 'Clase no encontrada' });

    const [h, m] = clase.horaInicio.split(':').map(Number);
    const fechaSesion = new Date(fecha);
    fechaSesion.setHours(h, m, 0, 0);

    const sesion = await prisma.sesion.create({
      data: { claseId: clase.id, fecha: fechaSesion },
      include: { clase: { include: { profesor: true, pista: true } } },
    });

    res.status(201).json(sesion);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear sesión' });
  }
});

// DELETE /api/clases/:id/purge — elimina la clase y todos sus datos asociados
router.delete('/:id/purge', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    // sesionIds para cascada
    const sesiones = await prisma.sesion.findMany({ where: { claseId: id }, select: { id: true } });
    const sesionIds = sesiones.map((s) => s.id);
    // recuperaciones que referencian sesiones de esta clase
    await prisma.recuperacion.deleteMany({ where: { sesionOrigenId: { in: sesionIds } } });
    await prisma.recuperacion.deleteMany({ where: { sesionRecuperacionId: { in: sesionIds } } });
    // asistencias
    await prisma.asistencia.deleteMany({ where: { sesionId: { in: sesionIds } } });
    // sesiones
    await prisma.sesion.deleteMany({ where: { claseId: id } });
    // lista espera e inscripciones
    await prisma.listaEspera.deleteMany({ where: { claseId: id } });
    await prisma.alumnoClase.deleteMany({ where: { claseId: id } });
    // clase
    await prisma.clase.delete({ where: { id } });
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al eliminar la clase' });
  }
});

// GET /api/clases/pistas/todas
router.get('/pistas/todas', async (_req: Request, res: Response) => {
  try {
    const pistas = await prisma.pista.findMany({ where: { activa: true }, orderBy: { numero: 'asc' } });
    res.json(pistas);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener pistas' });
  }
});

export default router;
