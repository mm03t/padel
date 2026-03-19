import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { enviarWhatsApp, mensajeRecuperacionDisponible } from '../../integrations/whatsapp';

const router = Router();

function toE164Spain(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('+')) {
    return `+${trimmed.slice(1).replace(/\D/g, '')}`;
  }

  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.startsWith('34') && digits.length >= 11) return `+${digits}`;
  return `+34${digits}`;
}

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

    // Notificación automática por WhatsApp (si Twilio está configurado)
    let notificacion = {
      enviada: false,
      simulado: false,
      error: null as string | null,
      sid: null as string | null,
    };

    const telefono = toE164Spain(recuperacion.alumno.telefono);
    if (telefono) {
      const mensaje = mensajeRecuperacionDisponible({
        nombreAlumno: recuperacion.alumno.nombre,
        claseOrigen: recuperacion.sesionOrigen.clase.nombre,
        claseDestino: recuperacion.sesionRecuperacion?.clase.nombre || 'Clase asignada',
        fecha: recuperacion.sesionRecuperacion
          ? format(new Date(recuperacion.sesionRecuperacion.fecha), "EEEE d 'de' MMMM", { locale: es })
          : '-',
        horaInicio: recuperacion.sesionRecuperacion?.clase.horaInicio || '-',
      });

      const envio = await enviarWhatsApp({ to: telefono, mensaje });
      notificacion = {
        enviada: envio.exito,
        simulado: !!envio.simulado,
        error: envio.error || null,
        sid: envio.sid || null,
      };

      await prisma.notificacion.create({
        data: {
          alumnoId: recuperacion.alumnoId,
          sesionId: sesionRecuperacionId,
          tipo: 'RECUPERACION_DISPONIBLE',
          mensaje,
          estado: envio.exito ? 'ENVIADA' : 'FALLIDA',
          enviadaEn: envio.exito ? new Date() : undefined,
        },
      });
    }

    res.json({ ok: true, recuperacion, notificacion });
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

// POST /api/recuperaciones/falta-anticipada
// Body: { claseId, alumnoId, fecha: "2026-03-15" }
// Registra una falta anticipada desde el calendario: crea/busca la sesión, marca la asistencia como
// FALTA y genera la recuperación pendiente para que el alumno pueda recuperarla más adelante.
router.post('/falta-anticipada', async (req: Request, res: Response) => {
  try {
    const { claseId, alumnoId, fecha } = req.body;

    if (!claseId || !alumnoId || !fecha) {
      return res.status(400).json({ error: 'Se requiere claseId, alumnoId y fecha' });
    }

    // Verificar que la clase existe y el alumno está inscrito
    const clase = await prisma.clase.findUnique({
      where: { id: claseId },
      include: {
        inscripciones: { where: { alumnoId, activo: true } },
      },
    });

    if (!clase) return res.status(404).json({ error: 'Clase no encontrada' });
    if (clase.inscripciones.length === 0) {
      return res.status(409).json({ error: 'El alumno no está inscrito en esta clase' });
    }

    // Construir la fecha/hora de la sesión
    const [h, m] = clase.horaInicio.split(':').map(Number);
    const fechaSesion = new Date(fecha);
    fechaSesion.setHours(h, m, 0, 0);

    // Buscar o crear la sesión para esa fecha
    let sesion = await prisma.sesion.findFirst({
      where: {
        claseId,
        fecha: {
          gte: new Date(new Date(fechaSesion).setHours(0, 0, 0, 0)),
          lt: new Date(new Date(fechaSesion).setHours(23, 59, 59, 999)),
        },
      },
    });

    if (!sesion) {
      sesion = await prisma.sesion.create({
        data: { claseId, fecha: fechaSesion, estado: 'PROGRAMADA' },
      });
    }

    // Registrar asistencia como FALTA
    await prisma.asistencia.upsert({
      where: { sesionId_alumnoId: { sesionId: sesion.id, alumnoId } },
      update: { estado: 'FALTA' },
      create: { sesionId: sesion.id, alumnoId, estado: 'FALTA' },
    });

    // Crear recuperación si no existe ya una activa para esta sesión
    const yaExiste = await prisma.recuperacion.findFirst({
      where: {
        alumnoId,
        sesionOrigenId: sesion.id,
        estado: { notIn: ['CANCELADA', 'VENCIDA'] },
      },
    });

    let recuperacion = yaExiste;
    if (!yaExiste) {
      const expiraEn = new Date(fechaSesion);
      expiraEn.setDate(expiraEn.getDate() + 30);

      recuperacion = await prisma.recuperacion.create({
        data: {
          alumnoId,
          sesionOrigenId: sesion.id,
          estado: 'PENDIENTE',
          expiraEn,
        },
      });
    }

    res.json({ ok: true, sesionId: sesion.id, recuperacion });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al registrar falta anticipada', detalle: error.message });
  }
});

// GET /api/recuperaciones/candidatos?claseId=X
// Alumnos con recuperación PENDIENTE agrupados por nivel compatible con la clase
router.get('/candidatos', async (req: Request, res: Response) => {
  try {
    const { claseId } = req.query;
    if (!claseId) return res.status(400).json({ error: 'claseId requerido' });

    const clase = await prisma.clase.findUnique({ where: { id: claseId as string } });
    if (!clase) return res.status(404).json({ error: 'Clase no encontrada' });

    const recuperaciones = await prisma.recuperacion.findMany({
      where: { estado: 'PENDIENTE' },
      include: {
        alumno: true,
        sesionOrigen: { include: { clase: { include: { pista: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Excluir alumnos ya inscritos en esta clase
    const inscritos = await prisma.alumnoClase.findMany({
      where: { claseId: claseId as string, activo: true },
      select: { alumnoId: true },
    });
    const inscritosIds = new Set(inscritos.map((i) => i.alumnoId));

    const candidatos = recuperaciones
      .filter((r) => !inscritosIds.has(r.alumnoId))
      .map((r) => ({
        recuperacionId: r.id,
        alumnoId: r.alumnoId,
        nombre: r.alumno.nombre,
        apellidos: r.alumno.apellidos,
        nivel: r.alumno.nivel,
        claseOrigen: r.sesionOrigen.clase.nombre,
        pistaOrigen: r.sesionOrigen.clase.pista.numero,
        fechaOrigen: r.sesionOrigen.fecha,
        expiraEn: r.expiraEn,
        compatible: r.alumno.nivel >= clase.nivelMin - 0.5 && r.alumno.nivel <= clase.nivelMax + 0.5,
      }));

    const compatibles = candidatos.filter((c) => c.compatible);
    const otros = candidatos.filter((c) => !c.compatible);

    res.json({ compatibles, otros, clase: { nombre: clase.nombre, nivelMin: clase.nivelMin, nivelMax: clase.nivelMax } });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al obtener candidatos', detalle: error.message });
  }
});

export default router;
