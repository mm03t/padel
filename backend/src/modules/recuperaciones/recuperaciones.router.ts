import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { format, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { enviarWhatsApp, mensajeRecuperacionDisponible } from '../../integrations/whatsapp';

function diaContexto(fecha: Date): string {
  const diff = differenceInCalendarDays(fecha, new Date());
  if (diff === 0) return ' (hoy)';
  if (diff === 1) return ' (ma\u00f1ana)';
  if (diff > 1 && diff < 7) return ` (el ${format(fecha, 'EEEE', { locale: es })})`;
  return '';
}

const router = Router();

const DIA_MAP: Record<string, number> = {
  DOMINGO: 0, LUNES: 1, MARTES: 2, MIERCOLES: 3,
  JUEVES: 4, VIERNES: 5, SABADO: 6,
};

function nextOccurrence(diaSemana: string, horaInicio: string): Date {
  const target = DIA_MAP[diaSemana] ?? 1;
  const now = new Date();
  let daysAhead = target - now.getDay();
  if (daysAhead <= 0) daysAhead += 7;
  const next = new Date(now);
  next.setDate(now.getDate() + daysAhead);
  const [h, m] = horaInicio.split(':').map(Number);
  next.setHours(h, m, 0, 0);
  return next;
}

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

// GET /api/recuperaciones/clases-disponibles
// Clases activas con plazas libres + candidatos compatibles (alumnos con PENDIENTE)
router.get('/clases-disponibles', async (req: Request, res: Response) => {
  try {
    const clases = await prisma.clase.findMany({
      where: { activa: true },
      include: {
        profesor: true,
        pista: true,
        inscripciones: { where: { activo: true }, select: { alumnoId: true } },
      },
    });

    const pendientes = await prisma.recuperacion.findMany({
      where: { estado: 'PENDIENTE' },
      include: {
        alumno: { select: { id: true, nombre: true, apellidos: true, nivel: true, telefono: true } },
      },
    });

    const pendientesPorAlumno = new Map<string, number>();
    for (const r of pendientes) {
      pendientesPorAlumno.set(r.alumnoId, (pendientesPorAlumno.get(r.alumnoId) ?? 0) + 1);
    }

    const resultado = clases
      .map((c) => {
        const inscritos = c.inscripciones.length;
        const plazasLibres = c.plazasTotal - inscritos;
        if (plazasLibres <= 0) return null;

        const inscritosIds = new Set(c.inscripciones.map((i) => i.alumnoId));
        const candidatoMap = new Map<string, {
          recuperacionId: string; alumnoId: string; nombre: string; apellidos: string;
          nivel: number; telefono: string; totalPendientes: number;
        }>();

        for (const r of pendientes) {
          if (inscritosIds.has(r.alumnoId)) continue;
          const nivelOk = r.alumno.nivel >= c.nivelMin - 0.5 && r.alumno.nivel <= c.nivelMax + 0.5;
          if (!nivelOk) continue;
          if (!candidatoMap.has(r.alumnoId)) {
            candidatoMap.set(r.alumnoId, {
              recuperacionId: r.id,
              alumnoId: r.alumnoId,
              nombre: r.alumno.nombre,
              apellidos: r.alumno.apellidos,
              nivel: r.alumno.nivel,
              telefono: r.alumno.telefono ?? '',
              totalPendientes: pendientesPorAlumno.get(r.alumnoId) ?? 1,
            });
          }
        }

        return {
          id: c.id,
          nombre: c.nombre,
          diaSemana: c.diaSemana,
          horaInicio: c.horaInicio,
          horaFin: c.horaFin,
          nivelMin: c.nivelMin,
          nivelMax: c.nivelMax,
          plazasTotal: c.plazasTotal,
          plazasLibres,
          profesor: c.profesor,
          pista: c.pista,
          candidatos: Array.from(candidatoMap.values()),
        };
      })
      .filter(Boolean);

    res.json(resultado);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al obtener clases disponibles', detalle: error.message });
  }
});

// GET /api/recuperaciones/:id/sesiones-disponibles
// Clases compatibles con nivel del alumno que tienen plazas libres.
// Calcula la próxima ocurrencia de cada clase y crea/encuentra la sesión.
router.get('/:id/sesiones-disponibles', async (req: Request, res: Response) => {
  try {
    const recuperacion = await prisma.recuperacion.findUnique({
      where: { id: req.params.id },
      include: {
        alumno: true,
        sesionOrigen: { select: { claseId: true } },
      },
    });

    if (!recuperacion) return res.status(404).json({ error: 'Recuperación no encontrada' });

    const nivel = recuperacion.alumno.nivel;
    const margen = 0.5;
    const origenClaseId = recuperacion.sesionOrigen?.claseId;

    // Buscar clases activas compatibles con hueco disponible
    const clases = await prisma.clase.findMany({
      where: {
        activa: true,
        nivelMin: { lte: nivel + margen },
        nivelMax: { gte: nivel - margen },
        ...(origenClaseId ? { NOT: { id: origenClaseId } } : {}),
      },
      include: {
        profesor: true,
        pista: true,
        inscripciones: { where: { activo: true }, select: { alumnoId: true } },
      },
    });

    const clasesConHueco = clases.filter((c) => c.inscripciones.length < c.plazasTotal);

    const disponibles = [];
    for (const clase of clasesConHueco) {
      const nextFecha = nextOccurrence(clase.diaSemana, clase.horaInicio);
      const dayStart = new Date(nextFecha);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(nextFecha);
      dayEnd.setHours(23, 59, 59, 999);

      // Buscar sesión existente para esa fecha o crear una nueva
      let sesion = await prisma.sesion.findFirst({
        where: { claseId: clase.id, fecha: { gte: dayStart, lt: dayEnd } },
        include: { clase: { include: { profesor: true, pista: true } }, asistencias: true },
      });

      if (!sesion) {
        sesion = await prisma.sesion.create({
          data: { claseId: clase.id, fecha: nextFecha, estado: 'PROGRAMADA' },
          include: { clase: { include: { profesor: true, pista: true } }, asistencias: true },
        });
      }

      disponibles.push(sesion);
    }

    disponibles.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

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

    // Contar pendientes del alumno ANTES de marcar esta como RESERVADA
    const recupAntes = await prisma.recuperacion.findUnique({
      where: { id: req.params.id },
      select: { alumnoId: true },
    });
    const pendientesCount = recupAntes
      ? await prisma.recuperacion.count({
          where: { alumnoId: recupAntes.alumnoId, estado: 'PENDIENTE' },
        })
      : 1;

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
        diaContexto: recuperacion.sesionRecuperacion
          ? diaContexto(new Date(recuperacion.sesionRecuperacion.fecha))
          : '',
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

// PUT /api/recuperaciones/:id/reservar-desde-clase
// Asigna la recuperación a la próxima sesión de una clase (sin necesidad de sesión preexistente)
router.put('/:id/reservar-desde-clase', async (req: Request, res: Response) => {
  try {
    const { claseId } = req.body;
    if (!claseId) return res.status(400).json({ error: 'Se requiere claseId' });

    const clase = await prisma.clase.findUnique({
      where: { id: claseId },
      include: { profesor: true, pista: true },
    });
    if (!clase) return res.status(404).json({ error: 'Clase no encontrada' });

    // Calcular próxima ocurrencia y buscar/crear sesión
    const nextFecha = nextOccurrence(clase.diaSemana, clase.horaInicio);
    const dayStart = new Date(nextFecha); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(nextFecha); dayEnd.setHours(23, 59, 59, 999);

    let sesion = await prisma.sesion.findFirst({
      where: { claseId, fecha: { gte: dayStart, lt: dayEnd } },
    });
    if (!sesion) {
      sesion = await prisma.sesion.create({
        data: { claseId, fecha: nextFecha, estado: 'PROGRAMADA' },
      });
    }

    const sesionRecuperacionId = sesion.id;

    const recupAntes = await prisma.recuperacion.findUnique({
      where: { id: req.params.id },
      select: { alumnoId: true },
    });
    const pendientesCount = recupAntes
      ? await prisma.recuperacion.count({
          where: { alumnoId: recupAntes.alumnoId, estado: 'PENDIENTE' },
        })
      : 1;

    const recuperacion = await prisma.recuperacion.update({
      where: { id: req.params.id },
      data: { sesionRecuperacionId, estado: 'RESERVADA' },
      include: {
        alumno: true,
        sesionOrigen: { include: { clase: true } },
        sesionRecuperacion: { include: { clase: { include: { profesor: true, pista: true } } } },
      },
    });

    await prisma.asistencia.upsert({
      where: { sesionId_alumnoId: { sesionId: sesionRecuperacionId, alumnoId: recuperacion.alumnoId } },
      update: { estado: 'RECUPERACION' },
      create: { sesionId: sesionRecuperacionId, alumnoId: recuperacion.alumnoId, estado: 'RECUPERACION' },
    });

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
        claseDestino: clase.nombre,
        fecha: format(nextFecha, "EEEE d 'de' MMMM", { locale: es }),
        horaInicio: clase.horaInicio,
        diaContexto: diaContexto(nextFecha),
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
    res.status(500).json({ error: 'Error al reservar desde clase', detalle: error.message });
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
