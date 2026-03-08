import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

const router = Router();

// GET /api/recuperaciones
router.get('/', async (req: Request, res: Response) => {
  try {
    const { estado, alumnoId } = req.query;

    const recuperaciones = await prisma.recuperacion.findMany({
      where: {
        ...(estado ? { estado: estado as any } : {}),
        ...(alumnoId ? { alumnoId: alumnoId as string } : {}),
      },
      include: {
        alumno: true,
        sesionOrigen: { include: { clase: { include: { profesor: true, pista: true } } } },
        sesionRecuperacion: { include: { clase: { include: { profesor: true, pista: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(recuperaciones);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener recuperaciones' });
  }
});

// GET /api/recuperaciones/:id/sesiones-disponibles
// Devuelve sesiones futuras con plazas libres y nivel compatible con el alumno
router.get('/:id/sesiones-disponibles', async (req: Request, res: Response) => {
  try {
    const recuperacion = await prisma.recuperacion.findUnique({
      where: { id: req.params.id },
      include: { alumno: true },
    });

    if (!recuperacion) return res.status(404).json({ error: 'Recuperación no encontrada' });

    const nivel = recuperacion.alumno.nivel;
    const margen = 0.5; // nivel ± 0.5

    const sesiones = await prisma.sesion.findMany({
      where: {
        fecha: { gte: new Date() },
        estado: { in: ['PROGRAMADA', 'EN_CURSO'] },
        clase: {
          nivelMin: { lte: nivel + margen },
          nivelMax: { gte: nivel - margen },
        },
        // Excluir la sesión origen
        NOT: { id: recuperacion.sesionOrigenId },
      },
      include: {
        clase: { include: { profesor: true, pista: true } },
        asistencias: true,
      },
      orderBy: { fecha: 'asc' },
    });

    // Filtrar sesiones con plaza disponible
    const disponibles = sesiones.filter((s) => {
      const inscritos = s.asistencias.length; // aproximación con asistencias ya registradas
      return inscritos < s.clase.plazasTotal;
    });

    res.json(disponibles);
  } catch (error) {
    res.status(500).json({ error: 'Error al buscar sesiones disponibles' });
  }
});

// PUT /api/recuperaciones/:id/reservar
router.put('/:id/reservar', async (req: Request, res: Response) => {
  try {
    const { sesionRecuperacionId } = req.body;

    if (!sesionRecuperacionId) {
      return res.status(400).json({ error: 'Se requiere sesionRecuperacionId' });
    }

    const recuperacion = await prisma.recuperacion.update({
      where: { id: req.params.id },
      data: {
        sesionRecuperacionId,
        estado: 'RESERVADA',
      },
      include: {
        alumno: true,
        sesionOrigen: { include: { clase: true } },
        sesionRecuperacion: { include: { clase: { include: { profesor: true, pista: true } } } },
      },
    });

    // Registrar asistencia de tipo RECUPERACION en la sesión de recuperación
    await prisma.asistencia.upsert({
      where: {
        sesionId_alumnoId: {
          sesionId: sesionRecuperacionId,
          alumnoId: recuperacion.alumnoId,
        },
      },
      update: { estado: 'RECUPERACION' },
      create: {
        sesionId: sesionRecuperacionId,
        alumnoId: recuperacion.alumnoId,
        estado: 'RECUPERACION',
      },
    });

    res.json({ ok: true, recuperacion });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al reservar recuperación', detalle: error.message });
  }
});

// PUT /api/recuperaciones/:id/cancelar
router.put('/:id/cancelar', async (req: Request, res: Response) => {
  try {
    const recuperacion = await prisma.recuperacion.update({
      where: { id: req.params.id },
      data: { estado: 'CANCELADA', sesionRecuperacionId: null },
    });
    res.json({ ok: true, recuperacion });
  } catch (error) {
    res.status(500).json({ error: 'Error al cancelar recuperación' });
  }
});

// PUT /api/recuperaciones/:id/completar
router.put('/:id/completar', async (req: Request, res: Response) => {
  try {
    const recuperacion = await prisma.recuperacion.update({
      where: { id: req.params.id },
      data: { estado: 'COMPLETADA' },
    });
    res.json({ ok: true, recuperacion });
  } catch (error) {
    res.status(500).json({ error: 'Error al completar recuperación' });
  }
});

export default router;
