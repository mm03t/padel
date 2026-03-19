'use client';

import { useEffect, useState, useCallback } from 'react';
import { format, addDays, subDays, parseISO, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, Users, Clock, Trophy,
  UserPlus, Bell, X, CheckCircle, Loader2, UserMinus,
  UserX, XCircle, AlertTriangle, Send,
} from 'lucide-react';
import * as api from '@/lib/api';
import type { Clase, ListaEspera, Alumno, CandidatosHueco } from '@/types';
import ModalNotificacion from '@/components/ModalNotificacion';
import UpgradeGate from '@/components/UpgradeGate';

// ── Colores por pista ──────────────────────────────────────────────────────────
const PISTA_COLORS: Record<number, { bg: string; court: string; lines: string; text: string; badge: string }> = {
  1: { bg: '#0f2744',   court: '#0a1d34', lines: '#1a4a7a', text: 'white',    badge: '#1e83ec' },
  2: { bg: '#e8e4f5',   court: '#d8d2f0', lines: '#b8aee0', text: '#3d2c8d',  badge: '#7c6fd4' },
  3: { bg: '#90c8f0',   court: '#78b8e8', lines: '#4890c8', text: '#0d3d6e',  badge: '#1e83ec' },
  4: { bg: '#d4db6a',   court: '#c8d058', lines: '#a8b030', text: '#3a4010',  badge: '#7a8c10' },
};

// ── SVG padel court lines ──────────────────────────────────────────────────────
function CourtSVG({ color }: { color: { court: string; lines: string } }) {
  return (
    <svg
      viewBox="0 0 200 100"
      className="absolute inset-0 w-full h-full opacity-30"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Fondo */}
      <rect x="0" y="0" width="200" height="100" fill={color.court} />
      {/* Líneas exteriores */}
      <rect x="10" y="8" width="180" height="84" fill="none" stroke={color.lines} strokeWidth="1.5" />
      {/* Línea central vertical */}
      <line x1="100" y1="8" x2="100" y2="92" stroke={color.lines} strokeWidth="1.5" />
      {/* Línea de servicio izquierda */}
      <line x1="40" y1="8" x2="40" y2="92" stroke={color.lines} strokeWidth="1" />
      {/* Línea de servicio derecha */}
      <line x1="160" y1="8" x2="160" y2="92" stroke={color.lines} strokeWidth="1" />
      {/* Línea media horizontal */}
      <line x1="10" y1="50" x2="190" y2="50" stroke={color.lines} strokeWidth="1" />
      {/* Red */}
      <line x1="100" y1="8" x2="100" y2="92" stroke={color.lines} strokeWidth="3" />
      {/* Círculo central */}
      <circle cx="100" cy="50" r="5" fill="none" stroke={color.lines} strokeWidth="1" />
      {/* Cristales (esquinas) */}
      <rect x="10" y="8" width="30" height="84" fill={color.lines} fillOpacity="0.15" />
      <rect x="160" y="8" width="30" height="84" fill={color.lines} fillOpacity="0.15" />
    </svg>
  );
}

// ── Badge ocupación ────────────────────────────────────────────────────────────
function OcupacionBadge({
  inscritos, total, textColor, badgeColor,
}: {
  inscritos: number; total: number; textColor: string; badgeColor: string;
}) {
  const libre = inscritos < total;
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-bold"
      style={{
        background: libre ? badgeColor : '#ef4444',
        color: 'white',
        opacity: 0.95,
      }}
    >
      {inscritos}/{total}
    </span>
  );
}

// ── Tipos locales ──────────────────────────────────────────────────────────────
interface ClaseConEspera extends Clase {
  listaEspera?: ListaEspera[];
}

interface PanelData {
  pista: number;
  clase: ClaseConEspera;
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function PistasPage() {
  return (
    <UpgradeGate feature="vistadiaria">
      <PistasContent />
    </UpgradeGate>
  );
}

function PistasContent() {
  const [fecha, setFecha] = useState(new Date());
  const [clases, setClases] = useState<ClaseConEspera[]>([]);
  const [cargando, setCargando] = useState(true);
  const [panel, setPanel] = useState<PanelData | null>(null);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [buscando, setBuscando] = useState('');
  const [procesando, setProcesando] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [pistaConfig, setPistaConfig] = useState<Record<number, { id: string; nombre: string }>>({})
  const [confirmarNotificar, setConfirmarNotificar] = useState(false);
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);
  const [modalCanal, setModalCanal] = useState<{ count: number; context: 'espera' | 'candidatos' } | null>(null);

  // Modal de hueco / notificación de recuperación
  const [modalHueco, setModalHueco] = useState<{
    origen: string; // texto descriptivo de qué liberó el hueco
    claseId: string;
    candidatos: CandidatosHueco | null;
  } | null>(null);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);

  const diaSemana = format(fecha, 'EEEE', { locale: es }).toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace('MIERCOLES', 'MIERCOLES');

  // Normalizar días con tilde
  const DIA_MAP: Record<string, string> = {
    LUNES: 'LUNES', MARTES: 'MARTES', MIERCOLES: 'MIERCOLES',
    JUEVES: 'JUEVES', VIERNES: 'VIERNES', SABADO: 'SABADO', DOMINGO: 'DOMINGO',
  };
  const diaKey = DIA_MAP[diaSemana] ?? diaSemana;

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  // Cargar pistas y configuración inicial
  useEffect(() => {
    api.pistas.list().then((list) => {
      const map: Record<number, { id: string; nombre: string }> = {};
      list.forEach((p) => { map[p.numero] = { id: p.id, nombre: p.nombre }; });
      setPistaConfig(map);
    });
    api.alumnos.list({ activo: 'true' }).then(setAlumnos);
  }, []);

  // Cargar clases del día
  useEffect(() => {
    setCargando(true);
    api.clases.list({ diaSemana: diaKey, activa: 'true' }).then(async (data) => {
      // Enriquecer con lista de espera
      const enriquecidas = await Promise.all(
        data.map(async (c) => {
          try {
            const le = await api.listaEspera.list(c.id);
            return { ...c, listaEspera: le };
          } catch {
            return { ...c, listaEspera: [] };
          }
        }),
      );
      setClases(enriquecidas);
      setCargando(false);
    }).catch(() => setCargando(false));
  }, [diaKey]);

  // Obtener clases por número de pista
  const clasesPorPista = useCallback((numPista: number): ClaseConEspera[] => {
    const pistaId = pistaConfig[numPista]?.id;
    if (!pistaId) return clases.filter((c) => c.pista?.numero === numPista);
    return clases.filter((c) => c.pistaId === pistaId);
  }, [clases, pistaConfig]);

  // Abrir panel de pista
  const abrirPanel = (numPista: number, clase: ClaseConEspera) => {
    setPanel({ pista: numPista, clase });
    setConfirmarNotificar(false);
    setBuscando('');
  };

  // Añadir a lista de espera
  const addEspera = async (alumnoId: string) => {
    if (!panel) return;
    setProcesando(alumnoId);
    try {
      await api.listaEspera.add(alumnoId, panel.clase.id);
      const le = await api.listaEspera.list(panel.clase.id);
      const claseActualizada = { ...panel.clase, listaEspera: le };
      setPanel({ ...panel, clase: claseActualizada });
      setClases((prev) => prev.map((c) => c.id === panel.clase.id ? claseActualizada : c));
      showToast('Alumno añadido a lista de espera');
      setBuscando('');
    } catch (e: any) {
      showToast(e.message ?? 'Error', false);
    }
    setProcesando(null);
  };

  // Quitar de lista de espera
  const quitarEspera = async (entradaId: string) => {
    if (!panel) return;
    setProcesando(entradaId);
    try {
      await api.listaEspera.remove(entradaId);
      const le = await api.listaEspera.list(panel.clase.id);
      const claseActualizada = { ...panel.clase, listaEspera: le };
      setPanel({ ...panel, clase: claseActualizada });
      setClases((prev) => prev.map((c) => c.id === panel.clase.id ? claseActualizada : c));
      showToast('Eliminado de lista de espera');
    } catch {
      showToast('Error al eliminar', false);
    }
    setProcesando(null);
  };

  // Inscribir desde lista de espera
  const inscribirDesdeEspera = async (entradaId: string) => {
    if (!panel) return;
    setProcesando(entradaId);
    try {
      await api.listaEspera.inscribir(entradaId);
      // Recargar clase completa
      const claseRefrescada = await api.clases.get(panel.clase.id);
      const le = await api.listaEspera.list(panel.clase.id);
      const claseActualizada = { ...claseRefrescada, listaEspera: le };
      setPanel({ ...panel, clase: claseActualizada });
      setClases((prev) => prev.map((c) => c.id === panel.clase.id ? claseActualizada : c));
      showToast('Alumno inscrito en la clase ✓');
    } catch (e: any) {
      showToast(e.message ?? 'Error al inscribir', false);
    }
    setProcesando(null);
  };

  // Notificar a todos en lista de espera
  const notificarTodos = () => {
    if (!panel) return;
    setConfirmarNotificar(false);
    setModalCanal({ count: panel.clase.listaEspera?.length ?? 0, context: 'espera' });
  };

  // Registrar falta de un alumno y abrir modal de huecos
  const registrarFalta = async (alumnoId: string, alumnoNombre: string) => {
    if (!panel) return;
    const claseId = panel.clase.id;
    const claseNombre = panel.clase.nombre;
    setProcesando('falta_' + alumnoId);
    try {
      await api.recuperaciones.faltaAnticipada(claseId, alumnoId, fecha.toISOString());
      showToast(`Falta registrada para ${alumnoNombre} ✓`);
      // Abrir modal con candidatos inmediatamente
      await abrirModalHueco(`Falta de ${alumnoNombre} en ${claseNombre}`, claseId);
      // Refrescar clase en background (no bloquea el modal)
      api.clases.get(claseId).then((claseRefrescada) => {
        api.listaEspera.list(claseId).then((le) => {
          const claseActualizada = { ...claseRefrescada, listaEspera: le };
          setPanel((prev) => prev ? { ...prev, clase: claseActualizada } : prev);
          setClases((prev) => prev.map((c) => c.id === claseId ? claseActualizada : c));
        });
      }).catch(() => {});
    } catch (e: any) {
      showToast(e.message ?? 'Error al registrar falta', false);
    }
    setProcesando(null);
  };

  // Cancelar clase entera
  const cancelarClase = async () => {
    if (!panel) return;
    const claseId = panel.clase.id;
    const claseNombre = panel.clase.nombre;
    setProcesando('cancelar');
    setConfirmarCancelar(false);
    try {
      const res = await api.sesiones.cancelarSesion(claseId, fecha.toISOString(), 'Clase cancelada');
      showToast(`Clase cancelada · ${res.alumnosAfectados} alumno(s) con recuperación pendiente`);
      await abrirModalHueco(`Clase cancelada: ${claseNombre}`, claseId);
      api.clases.get(claseId).then((claseRefrescada) => {
        api.listaEspera.list(claseId).then((le) => {
          const claseActualizada = { ...claseRefrescada, listaEspera: le };
          setPanel((prev) => prev ? { ...prev, clase: claseActualizada } : prev);
          setClases((prev) => prev.map((c) => c.id === claseId ? claseActualizada : c));
        });
      }).catch(() => {});
    } catch (e: any) {
      showToast(e.message ?? 'Error al cancelar', false);
    }
    setProcesando(null);
  };

  // Cargar candidatos y abrir modal
  const abrirModalHueco = async (origen: string, claseId: string) => {
    try {
      const candidatos = await api.recuperaciones.candidatos(claseId);
      // Pre-seleccionar los compatibles
      setSeleccionados(new Set(candidatos.compatibles.map((c) => c.alumnoId)));
      setModalHueco({ origen, claseId, candidatos });
    } catch {
      // Si falla, abrir sin candidatos
      setModalHueco({ origen, claseId, candidatos: null });
    }
  };

  // Notificar los seleccionados (crear notificaciones en BD)
  const notificarSeleccionados = () => {
    if (!modalHueco || seleccionados.size === 0) return;
    setModalCanal({ count: seleccionados.size, context: 'candidatos' });
  };

  const toggleSeleccionado = (alumnoId: string) => {
    setSeleccionados((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(alumnoId)) next.delete(alumnoId); else next.add(alumnoId);
      return next;
    });
  };

  // ── Alumnos para añadir a espera (no inscritos y no ya en espera) ────────────
  const alumnosFiltrados = alumnos.filter((a) => {
    if (!panel) return false;
    const yaInscrito = panel.clase.inscripciones.some((i) => i.alumnoId === a.id && i.activo);
    const yaEnEspera = panel.clase.listaEspera?.some((e) => e.alumnoId === a.id);
    if (yaInscrito || yaEnEspera) return false;
    if (!buscando.trim()) return false;
    const q = buscando.toLowerCase();
    return `${a.nombre} ${a.apellidos}`.toLowerCase().includes(q) || a.email.toLowerCase().includes(q);
  }).slice(0, 5);

  const classesActivas = panel?.clase.inscripciones.filter((i) => i.activo) ?? [];
  const plazasLibres = panel ? panel.clase.plazasTotal - classesActivas.length : 0;

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg shadow-lg text-white text-sm font-medium transition-all"
          style={{ background: toast.ok ? '#1e83ec' : '#ef4444' }}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Pistas</h1>
          <p className="text-sm text-slate-500">Vista interactiva de las 4 pistas</p>
        </div>
        {/* Navegador de fechas */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFecha(subDays(fecha, 1))}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="text-center min-w-[140px]">
            <p className="font-bold text-slate-800 capitalize">
              {format(fecha, "EEEE d 'de' MMMM", { locale: es })}
            </p>
            {isToday(fecha) && (
              <p className="text-xs font-semibold" style={{ color: '#1e83ec' }}>Hoy</p>
            )}
          </div>
          <button
            onClick={() => setFecha(addDays(fecha, 1))}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => setFecha(new Date())}
            className="ml-2 px-3 py-1.5 text-xs font-semibold rounded-lg border"
            style={{ borderColor: '#1e83ec', color: '#1e83ec' }}
          >
            Hoy
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Courts grid — always 2×2, fills available space */}
        <div
          className="flex-1 p-3 md:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 min-h-0"
          style={{ gridTemplateRows: '1fr 1fr' }}
        >
          {[1, 2, 3, 4].map((numPista) => {
            const colors = PISTA_COLORS[numPista];
            const clasesHoy = clasesPorPista(numPista);
            const pistaInfo = pistaConfig[numPista];

            return (
              <div
                key={numPista}
                className="relative rounded-2xl overflow-hidden shadow-md flex flex-col"
                style={{ background: colors.bg }}
              >
                <CourtSVG color={colors} />

                {/* Content */}
                <div className="relative z-10 flex flex-col h-full p-4">
                  {/* Header pista */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2
                        className="font-black text-lg leading-none"
                        style={{ color: colors.text, opacity: 0.9 }}
                      >
                        Pista {numPista}
                      </h2>
                      {pistaInfo && (
                        <p className="text-xs mt-0.5 font-medium" style={{ color: colors.text, opacity: 0.6 }}>
                          {pistaInfo.nombre}
                        </p>
                      )}
                    </div>
                    <span
                      className="text-xs font-bold px-2 py-1 rounded-lg"
                      style={{ background: colors.badge, color: 'white' }}
                    >
                      {clasesHoy.length} clase{clasesHoy.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Clases del día */}
                  <div className="flex-1 flex flex-col gap-2 overflow-y-auto min-h-0">
                    {cargando ? (
                      <div className="flex items-center justify-center h-full opacity-60">
                        <Loader2 size={20} style={{ color: colors.text }} className="animate-spin" />
                      </div>
                    ) : clasesHoy.length === 0 ? (
                      <div className="flex items-center justify-center h-full opacity-40">
                        <p className="text-sm font-medium" style={{ color: colors.text }}>
                          Sin clases este día
                        </p>
                      </div>
                    ) : (
                      clasesHoy.map((clase) => {
                        const inscritos = clase.inscripciones.filter((i) => i.activo).length;
                        const llena = inscritos >= clase.plazasTotal;
                        const enEsperaCount = clase.listaEspera?.length ?? 0;
                        const isSelected = panel?.clase.id === clase.id;

                        return (
                          <button
                            key={clase.id}
                            onClick={() => abrirPanel(numPista, clase)}
                            className="text-left rounded-xl p-2.5 transition-all border-2 hover:scale-[1.01]"
                            style={{
                              background: isSelected
                                ? 'rgba(255,255,255,0.30)'
                                : 'rgba(255,255,255,0.15)',
                              borderColor: isSelected ? 'rgba(255,255,255,0.7)' : 'transparent',
                              backdropFilter: 'blur(4px)',
                            }}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-xs" style={{ color: colors.text }}>
                                {clase.horaInicio} – {clase.horaFin}
                              </span>
                              <OcupacionBadge
                                inscritos={inscritos}
                                total={clase.plazasTotal}
                                textColor={colors.text}
                                badgeColor={colors.badge}
                              />
                            </div>
                            <p className="font-semibold text-sm leading-snug" style={{ color: colors.text, opacity: 0.9 }}>
                              {clase.nombre}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: colors.text, opacity: 0.65 }}>
                              {clase.profesor.nombre} {clase.profesor.apellidos}
                            </p>
                            {enEsperaCount > 0 && (
                              <div className="mt-1 flex items-center gap-1">
                                <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-yellow-400 text-yellow-900">
                                  {enEsperaCount} en espera
                                </span>
                              </div>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Side panel */}
        {panel && (
          <>
          <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setPanel(null)} />
          <div className="fixed right-0 top-0 bottom-0 w-80 z-40 lg:relative lg:z-auto bg-white border-l border-slate-200 flex flex-col overflow-hidden shrink-0">
            {/* Panel header */}
            <div className="px-4 py-4 border-b border-slate-100">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-0.5">
                    Pista {panel.pista}
                  </p>
                  <h2 className="font-bold text-slate-800 text-base leading-tight">{panel.clase.nombre}</h2>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock size={12} /> {panel.clase.horaInicio}–{panel.clase.horaFin}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Trophy size={12} /> Niv. {panel.clase.nivelMin}–{panel.clase.nivelMax}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setPanel(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
                >
                  <X size={18} />
                </button>
              </div>
              {/* Cancelar clase */}
              {!confirmarCancelar ? (
                <button
                  onClick={() => setConfirmarCancelar(true)}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 transition-colors mt-1"
                >
                  <XCircle size={12} /> Cancelar clase hoy
                </button>
              ) : (
                <div className="mt-1 rounded-lg border border-red-200 bg-red-50 p-2.5">
                  <p className="text-xs font-semibold text-red-800 mb-2">
                    ⚠️ Todos los alumnos recibirán una recuperación pendiente. ¿Confirmar?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={cancelarClase}
                      disabled={procesando === 'cancelar'}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold text-white bg-red-500 disabled:opacity-50"
                    >
                      {procesando === 'cancelar' ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
                      Sí, cancelar
                    </button>
                    <button
                      onClick={() => setConfirmarCancelar(false)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 text-slate-500 hover:bg-white"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Profesor */}
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Profesor</p>
              <p className="text-sm font-semibold text-slate-700">
                {panel.clase.profesor.nombre} {panel.clase.profesor.apellidos}
              </p>
            </div>

            {/* Plazas */}
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-400 uppercase flex items-center gap-1">
                  <Users size={12} /> Alumnos
                </p>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                  style={{ background: plazasLibres > 0 ? '#1e83ec' : '#ef4444' }}
                >
                  {classesActivas.length}/{panel.clase.plazasTotal}
                  {plazasLibres > 0 && ` · ${plazasLibres} libre${plazasLibres > 1 ? 's' : ''}`}
                </span>
              </div>

              <div className="space-y-1 max-h-40 overflow-auto">
                {classesActivas.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">Sin alumnos inscritos</p>
                ) : (
                  classesActivas.map((i) => (
                    <div key={i.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 bg-slate-50">
                      <span className="text-sm text-slate-700 font-medium truncate flex-1">
                        {i.alumno.nombre} {i.alumno.apellidos}
                      </span>
                      <button
                        onClick={() => registrarFalta(i.alumno.id, i.alumno.nombre)}
                        disabled={!!procesando}
                        title="Registrar falta y liberar plaza"
                        className="ml-2 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-rose-500 hover:bg-rose-50 border border-rose-200 disabled:opacity-40 shrink-0"
                      >
                        {procesando === 'falta_' + i.alumno.id
                          ? <Loader2 size={11} className="animate-spin" />
                          : <UserX size={11} />}
                        Falta
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Lista de espera */}
            <div className="px-4 py-3 border-b border-slate-100 flex-1 overflow-auto">

              {/* Banda CTA cuando hay plaza libre Y hay en espera */}
              {plazasLibres > 0 && (panel.clase.listaEspera?.length ?? 0) > 0 && (
                <div className="mb-3 p-2.5 rounded-xl border-2 border-blue-200 bg-blue-50">
                  <p className="text-xs font-bold text-blue-700 mb-0.5">
                    🎾 {plazasLibres} plaza{plazasLibres > 1 ? 's libres' : ' libre'}
                  </p>
                  <p className="text-xs text-blue-600">
                    Asigna manualmente o notifica cuando decidas.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-400 uppercase flex items-center gap-1">
                  <Clock size={12} /> Lista de espera
                  {(panel.clase.listaEspera?.length ?? 0) > 0 && (
                    <span className="ml-1 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center text-[9px] font-black text-amber-900">
                      {panel.clase.listaEspera!.length}
                    </span>
                  )}
                </p>
              </div>

              {(panel.clase.listaEspera?.length ?? 0) === 0 ? (
                <p className="text-xs text-slate-400 italic py-1">Sin alumnos en espera</p>
              ) : (
                <div className="space-y-1.5">
                  {panel.clase.listaEspera!.map((entrada) => (
                    <div
                      key={entrada.id}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 bg-amber-50 border border-amber-200"
                    >
                      <span className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center text-xs font-black text-amber-900 shrink-0">
                        {entrada.posicion}
                      </span>
                      <span className="text-sm font-medium text-slate-700 flex-1 truncate">
                        {entrada.alumno.nombre} {entrada.alumno.apellidos}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {plazasLibres > 0 && (
                          <button
                            onClick={() => inscribirDesdeEspera(entrada.id)}
                            disabled={!!procesando}
                            title="Asignar plaza manualmente"
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
                            style={{ background: '#1e83ec' }}
                          >
                            {procesando === entrada.id ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : (
                              <CheckCircle size={11} />
                            )}
                            Asignar
                          </button>
                        )}
                        <button
                          onClick={() => quitarEspera(entrada.id)}
                          disabled={!!procesando}
                          title="Quitar de lista"
                          className="p-1 rounded text-red-400 hover:bg-red-50 disabled:opacity-40"
                        >
                          <UserMinus size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Notificar a todos — sin confirmación previa, va directo al modal de canales */}
              {(panel.clase.listaEspera?.length ?? 0) > 0 && (
                <div className="mt-3">
                  <button
                    onClick={() => setModalCanal({ count: panel.clase.listaEspera!.length, context: 'espera' })}
                    className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg border border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                  >
                    <Bell size={12} />
                    Notificar a todos en espera
                  </button>
                </div>
              )}

              {/* Buscador añadir a espera */}
              <div className="mt-3">
                <p className="text-xs font-semibold text-slate-400 mb-1.5 uppercase">Áadir a espera</p>
                <div className="relative">
                  <UserPlus size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    value={buscando}
                    onChange={(e) => setBuscando(e.target.value)}
                    placeholder="Buscar alumno..."
                    className="w-full pl-7 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                {alumnosFiltrados.length > 0 && (
                  <div className="mt-1 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                    {alumnosFiltrados.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => addEspera(a.id)}
                        disabled={!!procesando}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between border-b border-slate-100 last:border-0 disabled:opacity-50"
                      >
                        <span className="text-slate-700 font-medium">{a.nombre} {a.apellidos}</span>
                        {procesando === a.id ? (
                          <Loader2 size={13} className="animate-spin text-slate-400" />
                        ) : (
                          <UserPlus size={13} className="text-slate-400" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          </>
        )}
      </div>

      {/* ── Modal: Hueco disponible / Notificar para recuperación ──────────── */}
      {modalHueco && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <AlertTriangle size={16} className="text-amber-500" />
                  <h2 className="font-black text-slate-800 text-base">Hueco disponible</h2>
                </div>
                <p className="text-xs text-slate-500">{modalHueco.origen}</p>
              </div>
              <button onClick={() => setModalHueco(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {!modalHueco.candidatos ? (
                <p className="text-sm text-slate-400 text-center py-8">No se pudieron cargar los candidatos.</p>
              ) : modalHueco.candidatos.compatibles.length === 0 && modalHueco.candidatos.otros.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle size={32} className="text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No hay alumnos con recuperaciones pendientes en este momento.</p>
                </div>
              ) : (
                <>
                  {/* Compatibles por nivel */}
                  {modalHueco.candidatos.compatibles.length > 0 && (
                    <div className="mb-5">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                        Nivel compatible (Niv. {modalHueco.candidatos.clase.nivelMin}–{modalHueco.candidatos.clase.nivelMax})
                      </p>
                      <div className="space-y-2">
                        {modalHueco.candidatos.compatibles.map((c) => (
                          <label
                            key={c.alumnoId}
                            className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                              seleccionados.has(c.alumnoId)
                                ? 'border-[#1e83ec] bg-blue-50'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={seleccionados.has(c.alumnoId)}
                              onChange={() => toggleSeleccionado(c.alumnoId)}
                              className="mt-0.5 accent-[#1e83ec]"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-800 text-sm">{c.nombre} {c.apellidos}</p>
                              <p className="text-xs text-slate-500">Niv. {c.nivel} · Faltó de: {c.claseOrigen}</p>
                              <p className="text-xs text-slate-400">{new Date(c.fechaOrigen).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Otros niveles */}
                  {modalHueco.candidatos.otros.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
                        Otros niveles
                      </p>
                      <div className="space-y-2 opacity-60">
                        {modalHueco.candidatos.otros.map((c) => (
                          <label
                            key={c.alumnoId}
                            className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                              seleccionados.has(c.alumnoId)
                                ? 'border-slate-400 bg-slate-50'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={seleccionados.has(c.alumnoId)}
                              onChange={() => toggleSeleccionado(c.alumnoId)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-700 text-sm">{c.nombre} {c.apellidos}</p>
                              <p className="text-xs text-slate-500">Niv. {c.nivel} · Faltó de: {c.claseOrigen}</p>
                              <p className="text-xs text-slate-400">{new Date(c.fechaOrigen).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                onClick={() => setModalHueco(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-500 hover:bg-slate-50"
              >
                Saltar
              </button>
              <button
                onClick={notificarSeleccionados}
                disabled={enviando || seleccionados.size === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: '#1e83ec' }}
              >
                {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Notificar {seleccionados.size > 0 ? `(${seleccionados.size})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Modal canal notificación ── */}
      {modalCanal && (
        <ModalNotificacion
          count={modalCanal.count}
          onConfirm={() => {
            if (modalCanal.context === 'candidatos') setModalHueco(null);
            showToast(`Notificados ${modalCanal.count} alumno(s) ✓`);
            setModalCanal(null);
          }}
          onClose={() => setModalCanal(null)}
        />
      )}
    </div>
  );
}
