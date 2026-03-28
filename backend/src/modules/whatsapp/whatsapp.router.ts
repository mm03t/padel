import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const router = Router();

// Normaliza teléfono a E.164 español (+34XXXXXXXXX)
function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.replace(/^whatsapp:/, '').trim();
  if (!t) return null;
  if (t.startsWith('+')) return `+${t.slice(1).replace(/\D/g, '')}`;
  const digits = t.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.startsWith('34') && digits.length >= 11) return `+${digits}`;
  return `+34${digits}`;
}

function twiml(msg: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${msg}</Message></Response>`;
}

// POST /api/whatsapp/webhook
// Twilio llama aquí con cada mensaje entrante (URL-encoded form data)
router.post('/webhook', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/xml');

  const from: string = req.body?.From ?? '';
  const body: string = (req.body?.Body ?? '').trim().toUpperCase();

  // Solo procesar "SI" (admite variantes: "Sí", "SI ", "si", etc.)
  if (!['SI', 'SÍ', 'S\u00cd'].includes(body)) {
    return res.send(twiml(''));   // respuesta vacía — ignoramos otros mensajes
  }

  const telefonoNormalizado = toE164(from);
  if (!telefonoNormalizado) {
    return res.send(twiml('No pudimos identificar tu número. Contacta con la academia.'));
  }

  try {
    // Buscar alumno por teléfono (normalizado o variantes)
    const alumno = await prisma.alumno.findFirst({
      where: {
        OR: [
          { telefono: telefonoNormalizado },
          { telefono: telefonoNormalizado.replace('+34', '') },
          { telefono: telefonoNormalizado.slice(1) },  // sin +
        ],
      },
    });

    if (!alumno) {
      return res.send(twiml('No encontramos ningún alumno con este número. Contacta con la academia.'));
    }

    // Buscar recuperación RESERVADA más reciente del alumno
    const recuperacion = await prisma.recuperacion.findFirst({
      where: { alumnoId: alumno.id, estado: 'RESERVADA' },
      orderBy: { createdAt: 'desc' },
      include: {
        sesionRecuperacion: {
          include: { clase: true },
        },
      },
    });

    if (!recuperacion) {
      return res.send(twiml('No tienes ninguna recuperación pendiente de confirmar en este momento.'));
    }

    // Marcar como CONFIRMADA
    await prisma.recuperacion.update({
      where: { id: recuperacion.id },
      data: { estado: 'CONFIRMADA' },
    });

    const sesion = recuperacion.sesionRecuperacion;
    let detalle = '';
    if (sesion) {
      const fechaFmt = format(new Date(sesion.fecha), "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es });
      detalle = `\nTe esperamos el ${fechaFmt}. ¡Hasta pronto!`;
    }

    return res.send(twiml(`✅ ¡Confirmado! Tu recuperación ha quedado registrada.${detalle}\n\nAcademia de Pádel 🎾`));

  } catch (error: any) {
    console.error('[Webhook WhatsApp ERROR]', error.message);
    return res.send(twiml('Error interno. Contacta con la academia.'));
  }
});

export default router;
