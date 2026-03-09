import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

const router = Router();

// ── Helper: enviar email (simulado / nodemailer si está configurado) ────────────
async function notificarPlazaEmail(
  alumno: { nombre: string; apellidos: string; email: string },
  clase: { nombre: string; horaInicio: string; horaFin: string; diaSemana: string },
): Promise<void> {
  const asunto = `🎾 Plaza disponible en ${clase.nombre}`;
  const mensaje = `
Hola ${alumno.nombre},

¡Se ha liberado una plaza en la clase ${clase.nombre}!

📅 Día:   ${clase.diaSemana}
⏰ Hora:  ${clase.horaInicio} – ${clase.horaFin}

Accede al portal para confirmar tu plaza. La asignación es por orden de llegada.

Academia Pádel
  `.trim();

  // Intenta enviar email real si hay SMTP configurado
  const smtpHost = process.env.SMTP_HOST;
  if (smtpHost) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'academia@padel.com',
        to: alumno.email,
        subject: asunto,
        text: mensaje,
      });
      console.log(`✉️  Email enviado a ${alumno.email}`);
    } catch (err) {
      console.error(`Error enviando email a ${alumno.email}:`, err);
    }
  } else {
    // Log en desarrollo
    console.log(`\n📧 [EMAIL SIMULADO] → ${alumno.email}\nAsunto: ${asunto}\n${mensaje}\n`);
  }
}

// ── GET /api/lista-espera?claseId=xxx ─────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const { claseId } = req.query;
    if (!claseId) return res.status(400).json({ error: 'Se requiere claseId' });

    const lista = await prisma.listaEspera.findMany({
      where: { claseId: claseId as string },
      include: { alumno: true },
      orderBy: { posicion: 'asc' },
    });

    res.json(lista);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener lista de espera' });
  }
});

// ── POST /api/lista-espera ─────────────────────────────────────────────────────
// Body: { alumnoId, claseId }
router.post('/', async (req: Request, res: Response) => {
  try {
    const { alumnoId, claseId } = req.body;
    if (!alumnoId || !claseId) return res.status(400).json({ error: 'Se requiere alumnoId y claseId' });

    // Verificar que la clase existe y está completa
    const clase = await prisma.clase.findUnique({
      where: { id: claseId },
      include: { inscripciones: { where: { activo: true } } },
    });
    if (!clase) return res.status(404).json({ error: 'Clase no encontrada' });

    // Si hay plazas libres, inscribir directamente en vez de añadir a lista
    if (clase.inscripciones.length < clase.plazasTotal) {
      return res.status(409).json({ error: 'La clase tiene plazas disponibles. Inscribe directamente.' });
    }

    // Calcular posición (último en la lista)
    const ultima = await prisma.listaEspera.findFirst({
      where: { claseId },
      orderBy: { posicion: 'desc' },
    });
    const posicion = (ultima?.posicion ?? 0) + 1;

    const entrada = await prisma.listaEspera.upsert({
      where: { alumnoId_claseId: { alumnoId, claseId } },
      update: {},
      create: { alumnoId, claseId, posicion },
      include: { alumno: true, clase: true },
    });

    res.status(201).json(entrada);
  } catch (error) {
    res.status(500).json({ error: 'Error al añadir a lista de espera' });
  }
});

// ── DELETE /api/lista-espera/:id ──────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const entrada = await prisma.listaEspera.delete({ where: { id: req.params.id } });

    // Reordenar posiciones del resto
    await prisma.listaEspera.updateMany({
      where: { claseId: entrada.claseId, posicion: { gt: entrada.posicion } },
      data: { posicion: { decrement: 1 } },
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar de lista de espera' });
  }
});

// ── POST /api/lista-espera/notificar/:claseId ─────────────────────────────────
// Notifica a TODOS los de la lista que hay una plaza libre
router.post('/notificar/:claseId', async (req: Request, res: Response) => {
  try {
    const { claseId } = req.params;

    const clase = await prisma.clase.findUnique({
      where: { id: claseId },
      select: { nombre: true, horaInicio: true, horaFin: true, diaSemana: true },
    });
    if (!clase) return res.status(404).json({ error: 'Clase no encontrada' });

    const lista = await prisma.listaEspera.findMany({
      where: { claseId },
      include: { alumno: true },
      orderBy: { posicion: 'asc' },
    });

    if (lista.length === 0) return res.json({ ok: true, notificados: 0 });

    // Enviar email a todos (en paralelo)
    await Promise.all(lista.map((e) => notificarPlazaEmail(e.alumno, clase)));

    // Registrar en tabla notificaciones
    await prisma.notificacion.createMany({
      data: lista.map((e) => ({
        alumnoId: e.alumnoId,
        tipo: 'PLAZA_LIBRE' as const,
        mensaje: `Plaza disponible en ${clase.nombre} (${clase.horaInicio}–${clase.horaFin})`,
        estado: 'ENVIADA' as const,
        enviadaEn: new Date(),
      })),
      skipDuplicates: true,
    });

    res.json({ ok: true, notificados: lista.length });
  } catch (error) {
    res.status(500).json({ error: 'Error al notificar lista de espera' });
  }
});

// ── POST /api/lista-espera/inscribir/:id ──────────────────────────────────────
// Inscribe manualmente al alumno de esa entrada en la clase
router.post('/inscribir/:id', async (req: Request, res: Response) => {
  try {
    const entrada = await prisma.listaEspera.findUnique({
      where: { id: req.params.id },
      include: { clase: { include: { inscripciones: { where: { activo: true } } } } },
    });
    if (!entrada) return res.status(404).json({ error: 'Entrada no encontrada' });

    if (entrada.clase.inscripciones.length >= entrada.clase.plazasTotal) {
      return res.status(409).json({ error: 'La clase sigue sin plazas disponibles' });
    }

    // Inscribir en la clase
    await prisma.alumnoClase.upsert({
      where: { alumnoId_claseId: { alumnoId: entrada.alumnoId, claseId: entrada.claseId } },
      update: { activo: true, fechaInicio: new Date() },
      create: { alumnoId: entrada.alumnoId, claseId: entrada.claseId },
    });

    // Eliminar de lista de espera y reordenar
    await prisma.listaEspera.delete({ where: { id: req.params.id } });
    await prisma.listaEspera.updateMany({
      where: { claseId: entrada.claseId, posicion: { gt: entrada.posicion } },
      data: { posicion: { decrement: 1 } },
    });

    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al inscribir desde lista de espera', detalle: error.message });
  }
});

export default router;
