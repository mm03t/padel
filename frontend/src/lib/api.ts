import type {
  Alumno, Clase, Sesion, Recuperacion, Notificacion,
  DashboardStats, PlazaLibre, Profesor, Pista, Pago, ListaEspera, SolicitudEspera,
  AltaResult, BajaResult,
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
  clasesDisponibles: (nivel: number) =>
    req<import('@/types').ClaseDisponible[]>(`/alumnos/clases-disponibles?nivel=${nivel}`),
  create: (data: Partial<Alumno> & { claseId?: string }) =>
    req<AltaResult>('/alumnos', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Alumno>) =>
    req<Alumno>(`/alumnos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => req<BajaResult>(`/alumnos/${id}`, { method: 'DELETE' }),
  purge: (id: string) => req<{ ok: boolean }>(`/alumnos/${id}/purge`, { method: 'DELETE' }),
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
  update: (id: string, data: Partial<Clase>) =>
    req<Clase>(`/clases/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  purge: (id: string) => req<{ ok: boolean }>(`/clases/${id}/purge`, { method: 'DELETE' }),
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
  cancelarSesion: (claseId: string, fecha: string, motivo?: string) =>
    req<{ ok: boolean; sesionId: string; alumnosAfectados: number; afectados: string[] }>(
      '/sesiones/cancelar-sesion',
      { method: 'POST', body: JSON.stringify({ claseId, fecha, motivo }) },
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
  reservarDesdeClase: (id: string, claseId: string) =>
    req(`/recuperaciones/${id}/reservar-desde-clase`, {
      method: 'PUT',
      body: JSON.stringify({ claseId }),
    }),
  cancelar: (id: string) =>
    req(`/recuperaciones/${id}/cancelar`, { method: 'PUT' }),
  faltaAnticipada: (claseId: string, alumnoId: string, fecha: string) =>
    req<{ ok: boolean; sesionId: string; recuperacion: Recuperacion }>(
      '/recuperaciones/falta-anticipada',
      { method: 'POST', body: JSON.stringify({ claseId, alumnoId, fecha }) },
    ),
    candidatos: (claseId: string) =>
      req<import('@/types').CandidatosHueco>(`/recuperaciones/candidatos?claseId=${claseId}`),
    clasesDisponibles: () =>
      req<import('@/types').ClaseParaRecuperar[]>('/recuperaciones/clases-disponibles'),
};

// ─────────────────────────────────────────
//  PAGOS
// ─────────────────────────────────────────
export const pagos = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params) : '';
    return req<Pago[]>(`/pagos${qs}`);
  },
  generarMes: (mes: number, año: number) =>
    req<{ ok: boolean; creados: number; mensaje?: string }>(
      '/pagos/generar-mes',
      { method: 'POST', body: JSON.stringify({ mes, año }) },
    ),
  update: (id: string, data: { estado?: string; importe?: number; notas?: string }) =>
    req<Pago>(`/pagos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => req(`/pagos/${id}`, { method: 'DELETE' }),
};

// ─────────────────────────────────────────
//  LISTA DE ESPERA
// ─────────────────────────────────────────
export const listaEspera = {
  list: (claseId: string) => req<ListaEspera[]>(`/lista-espera?claseId=${claseId}`),
  add: (alumnoId: string, claseId: string) =>
    req<ListaEspera>('/lista-espera', { method: 'POST', body: JSON.stringify({ alumnoId, claseId }) }),
  remove: (id: string) => req(`/lista-espera/${id}`, { method: 'DELETE' }),
  inscribir: (id: string) => req('/lista-espera/inscribir/' + id, { method: 'POST' }),
  notificar: (claseId: string) =>
    req<{ ok: boolean; notificados: number }>(`/lista-espera/notificar/${claseId}`, { method: 'POST' }),
};

// ─────────────────────────────────────────
//  SOLICITUDES DE ESPERA GENERAL
// ─────────────────────────────────────────
export const solicitudesEspera = {
  list: (estado?: string) => {
    const qs = estado ? `?estado=${estado}` : '';
    return req<SolicitudEspera[]>(`/solicitudes-espera${qs}`);
  },
  create: (data: Partial<SolicitudEspera>) =>
    req<SolicitudEspera>('/solicitudes-espera', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<SolicitudEspera>) =>
    req<SolicitudEspera>(`/solicitudes-espera/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => req(`/solicitudes-espera/${id}`, { method: 'DELETE' }),
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
  notificarHueco: (alumnoIds: string[], claseId: string, fecha: string) =>
    req<{ ok: boolean; notificados: number }>(
      '/notificaciones/notificar-hueco',
      { method: 'POST', body: JSON.stringify({ alumnoIds, claseId, fecha }) },
    ),
};
