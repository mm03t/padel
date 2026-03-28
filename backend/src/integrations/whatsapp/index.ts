// Integración WhatsApp — Academia de Pádel
// En producción: activar con variables de entorno TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN

export interface MensajeWhatsApp {
  to: string; // teléfono con código de país, ej: "+34611001001"
  mensaje: string;
}

export interface ResultadoEnvio {
  exito: boolean;
  sid?: string;
  error?: string;
  simulado?: boolean;
}

export async function enviarWhatsApp(msg: MensajeWhatsApp): Promise<ResultadoEnvio> {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM } = process.env;

  // Modo simulado — cuando no hay credenciales de Twilio configuradas
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.log(`[WhatsApp SIMULADO] → ${msg.to}`);
    console.log(`────────────────────────────`);
    console.log(msg.mensaje);
    console.log(`────────────────────────────`);
    await new Promise((r) => setTimeout(r, 300)); // simular latencia
    return { exito: true, sid: `SIM_${Date.now()}`, simulado: true };
  }

  // Modo real con Twilio
  try {
    const twilio = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const result = await twilio.messages.create({
      from: `whatsapp:${TWILIO_WHATSAPP_FROM || '+14155238886'}`,
      to: `whatsapp:${msg.to}`,
      body: msg.mensaje,
    });
    return { exito: true, sid: result.sid };
  } catch (error: any) {
    console.error('[WhatsApp ERROR]', error.message);
    return { exito: false, error: error.message };
  }
}

// ─────────────────────────────────────────
//  PLANTILLAS DE MENSAJES
// ─────────────────────────────────────────

export function mensajePlazaLibre(params: {
  nivelClase: string;
  diaSemana: string;
  fecha: string;
  horaInicio: string;
  numeroPista: number;
  nombreAlumno: string;
}): string {
  return `🎾 *Plaza libre disponible*

Clase: Nivel ${params.nivelClase}
📅 ${params.diaSemana} ${params.fecha}
⏰ ${params.horaInicio}
🏟️ Pista ${params.numeroPista}

Hola ${params.nombreAlumno}, hay una plaza libre en esta clase que encaja con tu nivel.

¿Quieres reservarla? Responde *SI* para confirmar tu plaza.

_Academia de Pádel 🎾_`;
}

export function mensajeRecuperacionDisponible(params: {
  nombreAlumno: string;
  claseOrigen: string;
  claseDestino: string;
  fecha: string;        // "Martes 31 de marzo"
  horaInicio: string;   // "18:00"
  diaContexto?: string; // " (hoy)" | " (mañana)" | " (el martes)" | ""
}): string {
  const contexto = params.diaContexto ?? '';
  return `Hola ${params.nombreAlumno},

Tienes una clase pendiente de ${params.claseOrigen}${contexto}.

Recuperación:
📅 ${params.fecha}
🕕 ${params.horaInicio} (${params.claseDestino})

Responde *SI* para confirmar.

Academia de Pádel 🎾`;
}
