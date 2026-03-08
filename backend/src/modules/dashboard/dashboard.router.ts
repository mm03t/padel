import { Router, Request, Response } from 'express';
import { startOfWeek, endOfWeek } from 'date-fns';
import { prisma } from '../../lib/prisma';

const router = Router();

// GET /api/dashboard/stats
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const ahora = new Date();
    const inicioSemana = startOfWeek(ahora, { weekStartsOn: 1 });
    const finSemana = endOfWeek(ahora, { weekStartsOn: 1 });

    const [
      totalAlumnos,
      totalClases,
      recuperacionesPendientes,
      sesionesEstaSemana,
      notificacionesSemana,
      proximasSesiones,
      ultimasFaltas,
    ] = await Promise.all([
      prisma.alumno.count({ where: { activo: true } }),
      prisma.clase.count({ where: { activa: true } }),
      prisma.recuperacion.count({ where: { estado: 'PENDIENTE' } }),
      prisma.sesion.count({ where: { fecha: { gte: inicioSemana, lte: finSemana } } }),
      prisma.notificacion.count({
        where: { createdAt: { gte: inicioSemana }, estado: 'ENVIADA' },
      }),
      prisma.sesion.findMany({
        where: { estado: 'PROGRAMADA', fecha: { gte: ahora } },
        include: {
          clase: { include: { profesor: true, pista: true } },
          asistencias: true,
        },
        orderBy: { fecha: 'asc' },
        take: 5,
      }),
      prisma.asistencia.findMany({
        where: { estado: 'FALTA' },
        include: {
          alumno: { select: { nombre: true, apellidos: true } },
          sesion: { include: { clase: { select: { nombre: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    // Recuperaciones que vencen en menos de 7 días
    const vencenPronto = await prisma.recuperacion.count({
      where: {
        estado: 'PENDIENTE',
        expiraEn: { lte: new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000) },
      },
    });

    res.json({
      totalAlumnos,
      totalClases,
      recuperacionesPendientes,
      sesionesEstaSemana,
      notificacionesSemana,
      vencenPronto,
      proximasSesiones,
      ultimasFaltas,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al obtener estadísticas', detalle: error.message });
  }
});

export default router;
