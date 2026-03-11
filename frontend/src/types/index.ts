// Tipos TypeScript que reflejan los modelos Prisma

export type Disponibilidad = 'MANANA' | 'TARDE' | 'FLEXIBLE';
export type DiaSemana = 'LUNES' | 'MARTES' | 'MIERCOLES' | 'JUEVES' | 'VIERNES' | 'SABADO' | 'DOMINGO';
export type EstadoSesion = 'PROGRAMADA' | 'EN_CURSO' | 'COMPLETADA' | 'CANCELADA';
export type EstadoAsistencia = 'PRESENTE' | 'FALTA' | 'RECUPERACION' | 'JUSTIFICADA';
export type EstadoRecuperacion = 'PENDIENTE' | 'RESERVADA' | 'COMPLETADA' | 'VENCIDA' | 'CANCELADA';
export type EstadoNotificacion = 'PENDIENTE' | 'ENVIADA' | 'FALLIDA' | 'LEIDA';
export type TipoNotificacion = 'PLAZA_LIBRE' | 'RECUPERACION_DISPONIBLE' | 'RECORDATORIO';
export type EstadoPago = 'PAGADO' | 'PENDIENTE' | 'VENCIDO';

export interface Alumno {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  telefono: string;
  nivel: number;
  disponibilidad: Disponibilidad;
  activo: boolean;
  pagoAlDia: boolean;
  notas?: string;
  tarifaMensual?: number;
  createdAt: string;
  inscripciones?: AlumnoClase[];
  recuperaciones?: Recuperacion[];
  _count?: { recuperaciones: number };
}

export interface Profesor {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  telefono?: string;
  activo: boolean;
  _count?: { clases: number };
}

export interface Pista {
  id: string;
  nombre: string;
  numero: number;
  activa: boolean;
}

export interface Clase {
  id: string;
  nombre: string;
  nivelMin: number;
  nivelMax: number;
  profesorId: string;
  pistaId: string;
  diaSemana: DiaSemana;
  horaInicio: string;
  horaFin: string;
  plazasTotal: number;
  activa: boolean;
  fechaFin?: string;
  profesor: Profesor;
  pista: Pista;
  inscripciones: AlumnoClase[];
  sesiones?: Sesion[];
  _count?: { sesiones: number };
}

export interface AlumnoClase {
  id: string;
  alumnoId: string;
  claseId: string;
  fechaInicio: string;
  activo: boolean;
  alumno: Alumno;
  clase: Clase;
}

export interface Sesion {
  id: string;
  claseId: string;
  fecha: string;
  estado: EstadoSesion;
  notas?: string;
  clase: Clase;
  asistencias: Asistencia[];
}

export interface Asistencia {
  id: string;
  sesionId: string;
  alumnoId: string;
  estado: EstadoAsistencia;
  alumno: Alumno;
}

export interface Recuperacion {
  id: string;
  alumnoId: string;
  sesionOrigenId: string;
  sesionRecuperacionId?: string;
  estado: EstadoRecuperacion;
  expiraEn: string;
  notas?: string;
  createdAt: string;
  alumno: Alumno;
  sesionOrigen: Sesion;
  sesionRecuperacion?: Sesion;
}

export interface Notificacion {
  id: string;
  alumnoId: string;
  sesionId?: string;
  tipo: TipoNotificacion;
  mensaje: string;
  estado: EstadoNotificacion;
  enviadaEn?: string;
  createdAt: string;
  alumno: Alumno;
}

export interface DashboardStats {
  totalAlumnos: number;
  totalClases: number;
  recuperacionesPendientes: number;
  sesionesEstaSemana: number;
  notificacionesSemana: number;
  vencenPronto: number;
  proximasSesiones: Sesion[];
  ultimasFaltas: Asistencia[];
}

export interface PlazaLibre {
  sesion: {
    id: string;
    fecha: string;
    clase: string;
    nivel: string;
    profesor: string;
    pista: number;
    horaInicio: string;
  };
  plazasLibres: number;
  alumnosCompatibles: Alumno[];
}

export interface Pago {
  id: string;
  alumnoId: string;
  mes: number;
  año: number;
  importe: number;
  estado: EstadoPago;
  notas?: string;
  createdAt: string;
  alumno: Alumno;
}

export interface ListaEspera {
  id: string;
  alumnoId: string;
  claseId: string;
  posicion: number;
  createdAt: string;
  alumno: Alumno;
  clase: Clase;
}

export type EstadoSolicitud = 'PENDIENTE' | 'CONTACTADO' | 'ASIGNADO' | 'RECHAZADO';

export interface SolicitudEspera {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  telefono?: string;
  nivel?: number;
  notas?: string;
  estado: EstadoSolicitud;
  createdAt: string;
}

export interface AltaResult {
  alumno: Alumno;
  asignacion: { claseId: string; nombre: string; pista: number; dia: string; hora: string } | null;
  enEspera: boolean;
}

export interface ClaseDisponible {
  id: string;
  nombre: string;
  dia: string;
  hora: string;
  pista: number;
  profesor: string;
  plazasTotal: number;
  inscritos: number;
  plazasLibres: number;
}

export interface BajaResult {
  ok: boolean;
  mensaje: string;
  plazasLiberadas: number;
  asignados: Array<{ claseId: string; alumnoId: string; posicion: number }>;
}

export interface CandidatoHueco {
  recuperacionId: string;
  alumnoId: string;
  nombre: string;
  apellidos: string;
  nivel: number;
  claseOrigen: string;
  pistaOrigen: number;
  fechaOrigen: string;
  expiraEn: string;
  compatible: boolean;
}

export interface CandidatosHueco {
  compatibles: CandidatoHueco[];
  otros: CandidatoHueco[];
  clase: { nombre: string; nivelMin: number; nivelMax: number };
}
