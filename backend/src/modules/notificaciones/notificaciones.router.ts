import { Router, Request, Response } from 'express';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { prisma } from '../../lib/prisma';
import { enviarWhatsApp, mensajePlazaLibre } from '../../integrations/whatsapp';

const router = Router();

// GET /api/notificaciones
router.get('/', async (req: Request, res: Response) => {
  try {
    const { estado, tipo } = req.query;

    const notificaciones = await prisma.notificacion.findMany({
      where: {
        ...(estado ? { estado: estado as any } : {}),
        ...(tipo ? { tipo: tipo as any } : {}),
      },
      include: { alumno: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(notificaciones);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

// POST /api/notificaciones/detectar-plazas
// Detecta sesiones con plazas libres y encuentra alumnos compatibles
router.post('/detectar-plazas', async (req: Request, res: Response) => {
  try {
    // Sesiones próximas con plazas libres
    const sesiones = await prisma.sesion.findMany({
      where: {
        estado: 'PROGRAMADA',
        fecha: { gte: new Date() },
      },
      include: {
        clase: {
          include: {
            profesor: true,
            pista: true,
            inscripciones: { where: { activo: true }, include: { alumno: true } },
          },
        },
        asistencias: true,
      },
      orderBy: { fecha: 'asc' },
      take: 20,
    });

    const resultado = [];

    for (const sesion of sesiones) {
      const inscritos = sesion.clase.inscripciones.length;
      const plazasLibres = sesion.clase.plazasTotal - inscritos;
      if (plazasLibres <= 0) continue;

      // Alumnos compatibles: nivel dentro del rango de la clase, activos, NO inscritos en esta clase
      const inscritosIds = sesion.clase.inscripciones.map((i: any) => i.alumnoId);

      const alumnosCompatibles = await prisma.alumno.findMany({
        where: {
          activo: true,
          nivel: {
            gte: sesion.clase.nivelMin - 0.5,
            lte: sesion.clase.nivelMax + 0.5,
          },
          id: { notIn: inscritosIds },
          // Filtrar por disponibilidad horaria
          OR: [
            { disponibilidad: 'FLEXIBLE' },
            {
              disponibilidad: sesion.fecha.getHours() < 14 ? 'MANANA' : 'TARDE',
            },
          ],
        },
        select: { id: true, nombre: true, apellidos: true, telefono: true, nivel: true, disponibilidad: true },
      });

      resultado.push({
        sesion: {
          id: sesion.id,
          fecha: sesion.fecha,
          clase: sesion.clase.nombre,
          nivel: `${sesion.clase.nivelMin}–${sesion.clase.nivelMax}`,
          profesor: `${sesion.clase.profesor.nombre} ${sesion.clase.profesor.apellidos}`,
          pista: sesion.clase.pista.numero,
          horaInicio: sesion.clase.horaInicio,
        },
        plazasLibres,
        alumnosCompatibles,
      });
    }

    res.json(resultado);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al detectar plazas', detalle: error.message });
  }
});

// POST /api/notificaciones/enviar-lote
// Envía WhatsApp a una lista de alumnos sobre una plaza libre
router.post('/enviar-lote', async (req: Request, res: Response) => {
  try {
    const { sesionId, alumnoIds, mensajePersonalizado } = req.body;

    const sesion = await prisma.sesion.findUnique({
      where: { id: sesionId },
      include: { clase: { include: { pista: true } } },
    });
    if (!sesion) return res.status(404).json({ error: 'Sesión no encontrada' });

    const alumnos = await prisma.alumno.findMany({
      where: { id: { in: alumnoIds } },
    });

    const resultados: { alumnoId: string; exito: boolean; simulado?: boolean }[] = [];
    const notificacionesCreadas: string[] = [];

    for (const alumno of alumnos) {
      const mensaje = mensajePersonalizado || mensajePlazaLibre({
        nivelClase: `${sesion.clase.nivelMin}–${sesion.clase.nivelMax}`,
        diaSemana: format(sesion.fecha, 'EEEE', { locale: es }),
        fecha: format(sesion.fecha, "d 'de' MMMM", { locale: es }),
        horaInicio: sesion.clase.horaInicio,
        numeroPista: sesion.clase.pista.numero,
        nombreAlumno: alumno.nombre,
      });

      const resultado = await enviarWhatsApp({
        to: `+34${alumno.telefono}`,
        mensaje,
      });

      // Registrar en BD
      const notif = await prisma.notificacion.create({
        data: {
          alumnoId: alumno.id,
          sesionId,
          tipo: 'PLAZA_LIBRE',
          mensaje,
          estado: resultado.exito ? 'ENVIADA' : 'FALLIDA',
          enviadaEn: resultado.exito ? new Date() : undefined,
        },
      });

      notificacionesCreadas.push(notif.id);
      resultados.push({ alumnoId: alumno.id, exito: resultado.exito, simulado: resultado.simulado });
    }

    const enviadas = resultados.filter((r) => r.exito).length;
    const simuladas = resultados.filter((r) => r.simulado).length;

    res.json({
      ok: true,
      enviadas,
      fallos: resultados.length - enviadas,
      simulado: simuladas > 0,
      notificacionesIds: notificacionesCreadas,
      mensaje: simuladas > 0
        ? `${enviadas} mensajes enviados (modo simulado — sin credenciales Twilio).`
        : `${enviadas} mensajes enviados por WhatsApp.`,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al enviar notificaciones', detalle: error.message });
  }
});

export default router;
