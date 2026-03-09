'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  UserPlus, Trash2, Mail, Phone, Trophy, Clock,
  CheckCircle, X, Loader2, Users, AlertCircle, ChevronDown, CalendarDays, GraduationCap,
} from 'lucide-react';
import { solicitudesEspera, alumnos as alumnosApi, clases as clasesApi } from '@/lib/api';
import type { SolicitudEspera, EstadoSolicitud, Alumno, ClaseDisponible } from '@/types';

// ── Colores por estado ─────────────────────────────────────────────────────────
const ESTADO_CONFIG: Record<EstadoSolicitud, { label: string; bg: string; text: string; border: string }> = {
  PENDIENTE:  { label: 'Pendiente',  bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  CONTACTADO: { label: 'Contactado', bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' },
  ASIGNADO:   { label: 'Asignado',   bg: '#dcfce7', text: '#14532d', border: '#bbf7d0' },
  RECHAZADO:  { label: 'Rechazado',  bg: '#fee2e2', text: '#991b1b', border: '#fecaca' },
};

const ESTADOS: EstadoSolicitud[] = ['PENDIENTE', 'CONTACTADO', 'ASIGNADO', 'RECHAZADO'];

// ── Formulario vacío ──────────────────────────────────────────────────────────
const FORM_VACIO = { nombre: '', apellidos: '', email: '', telefono: '', nivel: '', notas: '' };

export default function ListaEsperaPage() {
  const [solicitudes, setSolicitudes] = useState<SolicitudEspera[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<EstadoSolicitud | 'TODOS'>('TODOS');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [cambiandoEstado, setCambiandoEstado] = useState<string | null>(null);

  const [tab, setTab] = useState<'sin_plaza' | 'solicitudes'>('sin_plaza');
  const [alumnosSinPlaza, setAlumnosSinPlaza] = useState<Alumno[]>([]);
  const [cargandoSinPlaza, setCargandoSinPlaza] = useState(true);
  const [asignandoId, setAsignandoId] = useState<string | null>(null);
  const [clasesParaAsignar, setClasesParaAsignar] = useState<ClaseDisponible[]>([]);
  const [cargandoClases, setCargandoClases] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const cargar = async () => {
    try {
      const data = await solicitudesEspera.list();
      setSolicitudes(data);
    } finally {
      setCargando(false);
    }
  };

  const cargarSinPlaza = () => {
    setCargandoSinPlaza(true);
    alumnosApi.list({ activo: 'true', sinClase: 'true' })
      .then((data) =>
        setAlumnosSinPlaza([...data].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()))
      )
      .finally(() => setCargandoSinPlaza(false));
  };

  useEffect(() => { cargar(); cargarSinPlaza(); }, []);

  const iniciarAsignacion = async (a: Alumno) => {
    setAsignandoId(a.id);
    setClasesParaAsignar([]);
    setCargandoClases(true);
    try {
      const disponibles = await alumnosApi.clasesDisponibles(a.nivel);
      setClasesParaAsignar(disponibles.filter((c) => c.plazasLibres > 0));
    } finally {
      setCargandoClases(false);
    }
  };

  const confirmarAsignacion = async (claseId: string, alumnoId: string) => {
    try {
      await clasesApi.inscribir(claseId, alumnoId);
      setAsignandoId(null);
      setClasesParaAsignar([]);
      cargarSinPlaza();
      showToast('Clase asignada. El alumno pasa a activo.');
    } catch {
      showToast('Error al asignar clase');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre || !form.apellidos || !form.email) {
      setError('Nombre, apellidos y email son obligatorios');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      const nueva = await solicitudesEspera.create({
        nombre: form.nombre,
        apellidos: form.apellidos,
        email: form.email,
        telefono: form.telefono || undefined,
        nivel: form.nivel ? parseFloat(form.nivel) : undefined,
        notas: form.notas || undefined,
      });
      setSolicitudes((prev) => [...prev, nueva]);
      setForm(FORM_VACIO);
      setMostrarForm(false);
      showToast('Solicitud añadida correctamente');
    } catch (err: any) {
      setError(err.message ?? 'Error al guardar');
    }
    setGuardando(false);
  };

  const cambiarEstado = async (id: string, estado: EstadoSolicitud) => {
    setCambiandoEstado(id);
    try {
      const actualizada = await solicitudesEspera.update(id, { estado });
      setSolicitudes((prev) => prev.map((s) => s.id === id ? actualizada : s));
    } catch {
      showToast('Error al actualizar estado');
    }
    setCambiandoEstado(null);
  };

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar esta solicitud de la lista?')) return;
    try {
      await solicitudesEspera.remove(id);
      setSolicitudes((prev) => prev.filter((s) => s.id !== id));
      showToast('Solicitud eliminada');
    } catch {
      showToast('Error al eliminar');
    }
  };

  const filtradas = filtroEstado === 'TODOS'
    ? solicitudes
    : solicitudes.filter((s) => s.estado === filtroEstado);

  const contadores = ESTADOS.reduce((acc, e) => {
    acc[e] = solicitudes.filter((s) => s.estado === e).length;
    return acc;
  }, {} as Record<EstadoSolicitud, number>);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg shadow-lg text-white text-sm font-medium"
          style={{ background: '#1e83ec' }}
        >
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Lista de Espera</h1>
            <p className="text-sm text-slate-500">
              Gestión de alumnos sin plaza · Academia completa
            </p>
          </div>
          {tab === 'solicitudes' && (
            <button
              onClick={() => { setMostrarForm(true); setError(''); setForm(FORM_VACIO); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm"
              style={{ background: '#1e83ec' }}
            >
              <UserPlus size={16} />
              Nueva solicitud
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 border-b border-slate-100 -mx-6 px-6">
          <button
            onClick={() => setTab('sin_plaza')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === 'sin_plaza'
                ? 'text-[#1e83ec] border-[#1e83ec]'
                : 'text-slate-500 border-transparent hover:text-slate-700'
            }`}
          >
            <GraduationCap size={14} />
            Sin plaza asignada
            {alumnosSinPlaza.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                {alumnosSinPlaza.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('solicitudes')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === 'solicitudes'
                ? 'text-[#1e83ec] border-[#1e83ec]'
                : 'text-slate-500 border-transparent hover:text-slate-700'
            }`}
          >
            <Users size={14} />
            Solicitudes externas ({solicitudes.length})
          </button>
        </div>

        {/* Contadores por estado (solo en tab solicitudes) */}
        {tab === 'solicitudes' && (
          <div className="flex gap-2 mt-4 flex-wrap">
          <button
            onClick={() => setFiltroEstado('TODOS')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              filtroEstado === 'TODOS'
                ? 'text-white border-transparent'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
            }`}
            style={filtroEstado === 'TODOS' ? { background: '#1e83ec' } : {}}
          >
            Todos ({solicitudes.length})
          </button>
          {ESTADOS.map((estado) => {
            const cfg = ESTADO_CONFIG[estado];
            const active = filtroEstado === estado;
            return (
              <button
                key={estado}
                onClick={() => setFiltroEstado(estado)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
                style={{
                  background: active ? cfg.bg : 'white',
                  color: cfg.text,
                  borderColor: active ? cfg.border : '#e2e8f0',
                }}
              >
                {cfg.label} ({contadores[estado]})
              </button>
            );
          })}
        </div>
        )}
      </div>

      {/* Sin plaza asignada */}
      {tab === 'sin_plaza' && (
        <div className="flex-1 overflow-auto p-6">
          {cargandoSinPlaza ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="animate-spin text-slate-300" />
            </div>
          ) : alumnosSinPlaza.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <GraduationCap size={40} className="text-slate-200 mb-3" />
              <p className="text-slate-500 font-medium">Todos los alumnos tienen clase asignada</p>
              <p className="text-slate-400 text-sm mt-1">Cuando se cree un alumno sin plaza disponible, aparecerá aquí.</p>
            </div>
          ) : (
            <div className="grid gap-3 max-w-4xl">
              {alumnosSinPlaza.map((a, idx) => (
                <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-4 hover:shadow-sm transition-shadow">
                  {/* Posición en cola */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0 mt-0.5"
                    style={{ background: '#fef3c7', color: '#92400e' }}
                  >
                    {idx + 1}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-slate-800">{a.nombre} {a.apellidos}</h3>
                      <span className="flex items-center gap-0.5 text-xs text-slate-500">
                        <Trophy size={11} /> Niv. {a.nivel.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Mail size={11} /> {a.email}
                      </span>
                      {a.telefono && (
                        <span className="flex items-center gap-1">
                          <Phone size={11} /> {a.telefono}
                        </span>
                      )}
                      <span className="flex items-center gap-1 font-medium text-amber-600">
                        <CalendarDays size={11} />
                        Alta: {format(new Date(a.createdAt), "d MMM yyyy", { locale: es })}
                      </span>
                    </div>
                    {a.notas && <p className="text-xs text-slate-400 italic mt-1">{a.notas}</p>}

                    {/* Selector de clase */}
                    {asignandoId === a.id && (
                      <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                        {cargandoClases ? (
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Loader2 size={12} className="animate-spin" /> Buscando clases disponibles…
                          </div>
                        ) : clasesParaAsignar.length === 0 ? (
                          <p className="text-xs text-amber-600">No hay clases con plaza libre para nivel {a.nivel.toFixed(1)}.</p>
                        ) : (
                          <div>
                            <p className="text-xs font-semibold text-slate-600 mb-2">Selecciona una clase:</p>
                            <div className="grid gap-1.5">
                              {clasesParaAsignar.map((c) => (
                                <button
                                  key={c.id}
                                  onClick={() => confirmarAsignacion(c.id, a.id)}
                                  className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-xs text-left transition-colors"
                                >
                                  <span className="font-semibold text-slate-700">{c.nombre}</span>
                                  <span className="text-slate-400">{c.dia} · {c.hora} · {c.plazasLibres} plaza{c.plazasLibres !== 1 ? 's' : ''}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <button
                          onClick={() => setAsignandoId(null)}
                          className="mt-2 text-xs text-slate-400 hover:text-slate-600"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Botón asignar */}
                  {asignandoId !== a.id && (
                    <button
                      onClick={() => iniciarAsignacion(a)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white shrink-0"
                      style={{ background: '#1e83ec' }}
                    >
                      <CheckCircle size={12} />
                      Asignar clase
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Formulario nueva solicitud */}
      {tab === 'solicitudes' && mostrarForm && (
        <div className="bg-white border-b border-slate-200 px-6 py-5 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-700">Nueva solicitud de espera</h2>
            <button onClick={() => setMostrarForm(false)} className="p-1 rounded hover:bg-slate-100 text-slate-400">
              <X size={16} />
            </button>
          </div>
          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre *</label>
                <input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="Ana"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Apellidos *</label>
                <input
                  value={form.apellidos}
                  onChange={(e) => setForm({ ...form, apellidos: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="García López"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="ana@email.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Teléfono</label>
                <input
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="600 000 000"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nivel aproximado</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  step="0.5"
                  value={form.nivel}
                  onChange={(e) => setForm({ ...form, nivel: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="1–10"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Notas</label>
                <input
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="Disponibilidad, horario preferido..."
                />
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-1.5 text-sm text-red-600 mb-3">
                <AlertCircle size={14} /> {error}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={guardando}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: '#1e83ec' }}
              >
                {guardando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setMostrarForm(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 text-slate-500 hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista */}
      {tab === 'solicitudes' && (
      <div className="flex-1 overflow-auto p-6">
        {cargando ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-slate-300" />
          </div>
        ) : filtradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users size={40} className="text-slate-200 mb-3" />
            <p className="text-slate-500 font-medium">
              {filtroEstado === 'TODOS' ? 'No hay solicitudes de espera' : `No hay solicitudes en estado "${ESTADO_CONFIG[filtroEstado].label}"`}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              Cuando alguien quiera apuntarse y no haya plazas, añádelo aquí.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 max-w-4xl">
            {filtradas.map((s, idx) => {
              const cfg = ESTADO_CONFIG[s.estado];
              return (
                <div
                  key={s.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-4 hover:shadow-sm transition-shadow"
                >
                  {/* Posición */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0 mt-0.5"
                    style={{ background: '#e8f4fd', color: '#1565c4' }}
                  >
                    {idx + 1}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-slate-800">
                        {s.nombre} {s.apellidos}
                      </h3>
                      {s.nivel && (
                        <span className="flex items-center gap-0.5 text-xs text-slate-500">
                          <Trophy size={11} /> Niv. {s.nivel}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Mail size={11} /> {s.email}
                      </span>
                      {s.telefono && (
                        <span className="flex items-center gap-1">
                          <Phone size={11} /> {s.telefono}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-slate-400">
                        <Clock size={11} />
                        {format(new Date(s.createdAt), "d MMM yyyy", { locale: es })}
                      </span>
                    </div>
                    {s.notas && (
                      <p className="text-xs text-slate-400 italic mt-1">{s.notas}</p>
                    )}
                  </div>

                  {/* Estado selector */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="relative">
                      <select
                        value={s.estado}
                        onChange={(e) => cambiarEstado(s.id, e.target.value as EstadoSolicitud)}
                        disabled={cambiandoEstado === s.id}
                        className="appearance-none text-xs font-semibold pl-2.5 pr-6 py-1.5 rounded-full border cursor-pointer focus:outline-none"
                        style={{ background: cfg.bg, color: cfg.text, borderColor: cfg.border }}
                      >
                        {ESTADOS.map((e) => (
                          <option key={e} value={e}>{ESTADO_CONFIG[e].label}</option>
                        ))}
                      </select>
                      <ChevronDown
                        size={11}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none"
                        style={{ color: cfg.text }}
                      />
                    </div>
                    <button
                      onClick={() => eliminar(s.id)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                      title="Eliminar solicitud"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
