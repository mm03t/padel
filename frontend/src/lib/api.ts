import type {
  Alumno, Clase, Sesion, Recuperacion, Notificacion,
  DashboardStats, PlazaLibre, Profesor, Pista,
} from '@/types';

const BASE = '/api';

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

// ─────────────────────────────────────────
//  DASHBOARD
// ─────────────────────────────────────────
export const dashboard = {
  stats: () => req<DashboardStats>('/dashboard/stats'),
};

// ─────────────────────────────────────────
//  ALUMNOS
// ─────────────────────────────────────────
export const alumnos = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params) : '';
    return req<Alumno[]>(`/alumnos${qs}`);
  },
  get: (id: string) => req<Alumno>(`/alumnos/${id}`),
  create: (data: Partial<Alumno>) =>
    req<Alumno>('/alumnos', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Alumno>) =>
    req<Alumno>(`/alumnos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => req(`/alumnos/${id}`, { method: 'DELETE' }),
};

// ─────────────────────────────────────────
//  PROFESORES
// ─────────────────────────────────────────
export const profesores = {
  list: () => req<Profesor[]>('/profesores'),
};

// ─────────────────────────────────────────
//  PISTAS
// ─────────────────────────────────────────
export const pistas = {
  list: () => req<Pista[]>('/clases/pistas/todas'),
};

// ─────────────────────────────────────────
//  CLASES
// ─────────────────────────────────────────
export const clases = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params) : '';
    return req<Clase[]>(`/clases${qs}`);
  },
  get: (id: string) => req<Clase>(`/clases/${id}`),
  create: (data: Partial<Clase>) =>
    req<Clase>('/clases', { method: 'POST', body: JSON.stringify(data) }),
  inscribir: (claseId: string, alumnoId: string) =>
    req(`/clases/${claseId}/inscribir`, { method: 'POST', body: JSON.stringify({ alumnoId }) }),
  desinscribir: (claseId: string, alumnoId: string) =>
    req(`/clases/${claseId}/alumnos/${alumnoId}`, { method: 'DELETE' }),
};

// ─────────────────────────────────────────
//  SESIONES
// ─────────────────────────────────────────
export const sesiones = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params) : '';
    return req<Sesion[]>(`/sesiones${qs}`);
  },
  proximas: () => req<Sesion[]>('/sesiones/proximas'),
  get: (id: string) => req<Sesion>(`/sesiones/${id}`),
  marcarAsistencia: (
    id: string,
    asistencias: { alumnoId: string; estado: string }[],
  ) =>
    req<{ ok: boolean; recuperacionesGeneradas: number; mensaje: string }>(
      `/sesiones/${id}/asistencia`,
      { method: 'POST', body: JSON.stringify({ asistencias }) },
    ),
};

// ─────────────────────────────────────────
//  RECUPERACIONES
// ─────────────────────────────────────────
export const recuperaciones = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params) : '';
    return req<Recuperacion[]>(`/recuperaciones${qs}`);
  },
  sesionesDisponibles: (id: string) =>
    req<Sesion[]>(`/recuperaciones/${id}/sesiones-disponibles`),
  reservar: (id: string, sesionRecuperacionId: string) =>
    req(`/recuperaciones/${id}/reservar`, {
      method: 'PUT',
      body: JSON.stringify({ sesionRecuperacionId }),
    }),
  cancelar: (id: string) =>
    req(`/recuperaciones/${id}/cancelar`, { method: 'PUT' }),
};

// ─────────────────────────────────────────
//  NOTIFICACIONES
// ─────────────────────────────────────────
export const notificaciones = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params) : '';
    return req<Notificacion[]>(`/notificaciones${qs}`);
  },
  detectarPlazas: () => req<PlazaLibre[]>('/notificaciones/detectar-plazas', { method: 'POST' }),
  enviarLote: (sesionId: string, alumnoIds: string[], mensajePersonalizado?: string) =>
    req<{ ok: boolean; enviadas: number; simulado: boolean; mensaje: string }>(
      '/notificaciones/enviar-lote',
      {
        method: 'POST',
        body: JSON.stringify({ sesionId, alumnoIds, mensajePersonalizado }),
      },
    ),
};
