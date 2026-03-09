import { Router, Request, Response } from 'express';
import { addDays } from 'date-fns';
import { prisma } from '../../lib/prisma';

const router = Router();

// GET /api/sesiones
router.get('/', async (req: Request, res: Response) => {
  try {
    const { claseId, estado, desde, hasta } = req.query;

    const sesiones = await prisma.sesion.findMany({
      where: {
        ...(claseId ? { claseId: claseId as string } : {}),
        ...(estado ? { estado: estado as any } : {}),
        ...(desde || hasta
          ? {
              fecha: {
                ...(desde ? { gte: new Date(desde as string) } : {}),
                ...(hasta ? { lte: new Date(hasta as string) } : {}),
              },
            }
          : {}),
      },
      include: {
        clase: { include: { profesor: true, pista: true } },
        asistencias: { include: { alumno: true } },
      },
      orderBy: { fecha: 'desc' },
    });

    res.json(sesiones);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener sesiones' });
  }
});

// GET /api/sesiones/proximas — sesiones programadas desde hoy
router.get('/proximas', async (_req: Request, res: Response) => {
  try {
    const sesiones = await prisma.sesion.findMany({
      where: {
        estado: 'PROGRAMADA',
        fecha: { gte: new Date() },
      },
      include: {
        clase: { include: { profesor: true, pista: true, inscripciones: { where: { activo: true } } } },
        asistencias: true,
      },
      orderBy: { fecha: 'asc' },
      take: 20,
    });
    res.json(sesiones);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener sesiones próximas' });
  }
});

// GET /api/sesiones/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const sesion = await prisma.sesion.findUnique({
      where: { id: req.params.id },
      include: {
        clase: {
          include: {
            profesor: true,
            pista: true,
            inscripciones: {
              where: { activo: true },
              include: { alumno: true },
            },
          },
        },
        asistencias: { include: { alumno: true } },
      },
    });

    if (!sesion) return res.status(404).json({ error: 'Sesión no encontrada' });
    res.json(sesion);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener sesión' });
  }
});

// POST /api/sesiones
router.post('/', async (req: Request, res: Response) => {
  try {
    const { claseId, fecha, notas } = req.body;

    const clase = await prisma.clase.findUnique({ where: { id: claseId } });
    if (!clase) return res.status(404).json({ error: 'Clase no encontrada' });

    const [h, m] = clase.horaInicio.split(':').map(Number);
    const fechaSesion = new Date(fecha);
    fechaSesion.setHours(h, m, 0, 0);

    const sesion = await prisma.sesion.create({
      data: { claseId, fecha: fechaSesion, notas },
      include: { clase: { include: { profesor: true, pista: true } } },
    });

    res.status(201).json(sesion);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear sesión' });
  }
});

// ─── MARCAR ASISTENCIA ─────────────────────────────────────────────────────
// POST /api/sesiones/:id/asistencia
// Body: { asistencias: [{ alumnoId, estado }] }
// Lógica clave:
//   FALTA   → crea Recuperacion si no existe
//   PRESENTE/JUSTIFICADA → cancela recuperación PENDIENTE de esta sesión
router.post('/:id/asistencia', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { asistencias }: { asistencias: { alumnoId: string; estado: string }[] } = req.body;

    if (!asistencias || !Array.isArray(asistencias)) {
      return res.status(400).json({ error: 'Se requiere array de asistencias' });
    }

    const sesion = await prisma.sesion.findUnique({
      where: { id },
      include: { clase: true },
    });
    if (!sesion) return res.status(404).json({ error: 'Sesión no encontrada' });

    const resultados = [];
    let recuperacionesGeneradas = 0;

    for (const item of asistencias) {
      // Upsert asistencia
      const asistencia = await prisma.asistencia.upsert({
        where: { sesionId_alumnoId: { sesionId: id, alumnoId: item.alumnoId } },
        update: { estado: item.estado as any },
        create: { sesionId: id, alumnoId: item.alumnoId, estado: item.estado as any },
      });

      // FALTA → generar recuperación automática (30 días para usarla)
      if (item.estado === 'FALTA') {
        const yaExiste = await prisma.recuperacion.findFirst({
          where: {
            alumnoId: item.alumnoId,
            sesionOrigenId: id,
            estado: { notIn: ['CANCELADA', 'VENCIDA'] },
          },
        });
        if (!yaExiste) {
          await prisma.recuperacion.create({
            data: {
              alumnoId: item.alumnoId,
              sesionOrigenId: id,
              estado: 'PENDIENTE',
              expiraEn: addDays(new Date(), 30),
            },
          });
          recuperacionesGeneradas++;
        }
      }

      // PRESENTE / JUSTIFICADA → cancelar recuperación pendiente de esta sesión
      if (item.estado === 'PRESENTE' || item.estado === 'JUSTIFICADA') {
        await prisma.recuperacion.updateMany({
          where: {
            alumnoId: item.alumnoId,
            sesionOrigenId: id,
            estado: 'PENDIENTE',
          },
          data: { estado: 'CANCELADA' },
        });
      }

      resultados.push(asistencia);
    }

    // Marcar sesión como completada
    await prisma.sesion.update({
      where: { id },
      data: { estado: 'COMPLETADA' },
    });

    res.json({
      ok: true,
      asistencias: resultados,
      recuperacionesGeneradas,
      mensaje: `Asistencia guardada. ${recuperacionesGeneradas} recuperación(es) generada(s) automáticamente.`,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al marcar asistencia', detalle: error.message });
  }
});

// PUT /api/sesiones/:id — actualizar estado/notas
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const sesion = await prisma.sesion.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(sesion);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar sesión' });
  }
});

// POST /api/sesiones/generar — genera sesiones para un rango de fechas
router.post('/generar', async (req: Request, res: Response) => {
  try {
    const { fechaInicio, fechaFin } = req.body;

    const clases = await prisma.clase.findMany({ where: { activa: true } });

    const DIAS: Record<string, number> = {
      DOMINGO: 0, LUNES: 1, MARTES: 2, MIERCOLES: 3,
      JUEVES: 4, VIERNES: 5, SABADO: 6,
    };

    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    const creadas: any[] = [];

    for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
      const diaSemana = d.getDay();

      for (const clase of clases) {
        if (DIAS[clase.diaSemana] !== diaSemana) continue;

        // Evitar duplicados
        const fechaInicioDia = new Date(d); fechaInicioDia.setHours(0, 0, 0, 0);
        const fechaFinDia = new Date(d);    fechaFinDia.setHours(23, 59, 59, 999);

        const existe = await prisma.sesion.findFirst({
          where: { claseId: clase.id, fecha: { gte: fechaInicioDia, lte: fechaFinDia } },
        });
        if (existe) continue;

        const [h, m] = clase.horaInicio.split(':').map(Number);
        const fecha = new Date(d);
        fecha.setHours(h, m, 0, 0);

        const sesion = await prisma.sesion.create({ data: { claseId: clase.id, fecha } });
        creadas.push(sesion);
      }
    }

    res.status(201).json({ ok: true, creadas: creadas.length, sesiones: creadas });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al generar sesiones', detalle: error.message });
  }
});

// POST /api/sesiones/cancelar-sesion
// Cancela la sesión de una clase en una fecha: todas las faltas + recuperaciones
router.post('/cancelar-sesion', async (req: Request, res: Response) => {
  try {
    const { claseId, fecha, motivo } = req.body;
    if (!claseId || !fecha) return res.status(400).json({ error: 'claseId y fecha requeridos' });

    const clase = await prisma.clase.findUnique({
      where: { id: claseId },
      include: { inscripciones: { where: { activo: true }, include: { alumno: true } } },
    });
    if (!clase) return res.status(404).json({ error: 'Clase no encontrada' });

    // Buscar o crear sesión para ese día
    const fechaSesion = new Date(fecha);
    const [h, m] = clase.horaInicio.split(':').map(Number);
    fechaSesion.setHours(h, m, 0, 0);

    const inicioDia = new Date(fechaSesion); inicioDia.setHours(0, 0, 0, 0);
    const finDia = new Date(fechaSesion); finDia.setHours(23, 59, 59, 999);

    let sesion = await prisma.sesion.findFirst({
      where: { claseId, fecha: { gte: inicioDia, lte: finDia } },
    });
    if (!sesion) {
      sesion = await prisma.sesion.create({ data: { claseId, fecha: fechaSesion, notas: motivo } });
    }

    // Marcar sesión como cancelada
    await prisma.sesion.update({ where: { id: sesion.id }, data: { estado: 'CANCELADA', notas: motivo } });

    // FALTA + recuperacion para cada alumno inscrito
    const { addDays } = await import('date-fns');
    const afectados: string[] = [];
    for (const insc of clase.inscripciones) {
      await prisma.asistencia.upsert({
        where: { sesionId_alumnoId: { sesionId: sesion.id, alumnoId: insc.alumnoId } },
        update: { estado: 'FALTA' },
        create: { sesionId: sesion.id, alumnoId: insc.alumnoId, estado: 'FALTA' },
      });
      const yaExiste = await prisma.recuperacion.findFirst({
        where: { alumnoId: insc.alumnoId, sesionOrigenId: sesion.id, estado: { notIn: ['CANCELADA', 'VENCIDA'] } },
      });
      if (!yaExiste) {
        await prisma.recuperacion.create({
          data: { alumnoId: insc.alumnoId, sesionOrigenId: sesion.id, estado: 'PENDIENTE', expiraEn: addDays(new Date(), 30) },
        });
      }
      afectados.push(insc.alumnoId);
    }

    res.json({ ok: true, sesionId: sesion.id, alumnosAfectados: afectados.length, afectados });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al cancelar sesión', detalle: error.message });
  }
});

export default router;
