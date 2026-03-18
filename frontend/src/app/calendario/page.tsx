'use client';

import { useEffect, useState, useCallback } from 'react';
import { format, getDaysInMonth, startOfMonth, getDay, addDays, startOfWeek as dateFnsStartOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, X, Users, AlertCircle, Check, Clock,
  Bell, UserPlus, CheckCircle, Loader2, UserMinus, AlertTriangle,
  Send, Plus, Lock, CalendarDays, LayoutGrid,
} from 'lucide-react';
import {
  clases as clasesApi, recuperaciones as recuperApi,
  listaEspera as listaEsperaApi, alumnos as alumnosApi,
  notificaciones as notifApi, profesores as profesoresApi,
  pistas as pistasApi,
} from '@/lib/api';
import type { Clase, DiaSemana, ListaEspera, Alumno, CandidatosHueco, Profesor, Pista } from '@/types';
import ModalNotificacion from '@/components/ModalNotificacion';
import { usePlan } from '@/components/PlanContext';
import { canAccess } from '@/lib/plans';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DIA_NUMERO: Record<DiaSemana, number> = {
  LUNES: 1, MARTES: 2, MIERCOLES: 3, JUEVES: 4,
  VIERNES: 5, SABADO: 6, DOMINGO: 0,
};
const DIAS_HEADER = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const PROF_PALETTES = [
  { bg: '#e8f4fd', text: '#1565c4', border: '#bfdbfe', dot: '#1e83ec' },
  { bg: '#fef3c7', text: '#92400e', border: '#fde68a', dot: '#f59e0b' },
  { bg: '#f3e8ff', text: '#6b21a8', border: '#ddd6fe', dot: '#8b5cf6' },
  { bg: '#dcfce7', text: '#14532d', border: '#bbf7d0', dot: '#22c55e' },
  { bg: '#fee2e2', text: '#991b1b', border: '#fecaca', dot: '#ef4444' },
  { bg: '#ffedd5', text: '#9a3412', border: '#fed7aa', dot: '#f97316' },
  { bg: '#f0fdf4', text: '#166534', border: '#a7f3d0', dot: '#10b981' },
];

function getProfPalette(profesorId: string, allIds: string[]) {
  const idx = allIds.indexOf(profesorId) % PROF_PALETTES.length;
  return PROF_PALETTES[idx < 0 ? 0 : idx];
}

function getCalendarWeeks(mes: number, año: number): (number | null)[][] {
  const totalDias = getDaysInMonth(new Date(año, mes - 1));
  const firstWeekday = getDay(startOfMonth(new Date(año, mes - 1)));
  const offset = firstWeekday === 0 ? 6 : firstWeekday - 1;
  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= totalDias; d++) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

function clasesDelDia(clases: Clase[], dayOfWeek: number, año: number, mes: number, dia: number): Clase[] {
  const fecha = new Date(año, mes - 1, dia);
  return clases.filter((c) => {
    if (DIA_NUMERO[c.diaSemana] !== dayOfWeek) return false;
    if (c.fechaFin) return new Date(c.fechaFin) >= fecha;
    return true;
  });
}

function dayOfWeekForCell(colIndex: number): number {
  return colIndex === 6 ? 0 : colIndex + 1;
}

interface PanelInfo {
  clase: Clase;
  dia: number;
  mes: number;
  año: number;
  fechaStr: string;
  listaEspera?: ListaEspera[];
  cargandoEspera?: boolean;
}

export default function CalendarioPage() {
  const { plan } = usePlan();
  const hasFaltas = plan ? canAccess(plan, 'faltas') : false;

  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [año, setAño] = useState(hoy.getFullYear());
  const [vista, setVista] = useState<'semana' | 'mes'>('semana');
  const [diaSeleccionado, setDiaSeleccionado] = useState(hoy);
  const [clases, setClases] = useState<Clase[]>([]);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<PanelInfo | null>(null);
  const [registrando, setRegistrando] = useState<Record<string, boolean>>({});
  const [registrado, setRegistrado] = useState<Record<string, boolean>>({});
  const [quitando, setQuitando] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState('');
  const [todosAlumnos, setTodosAlumnos] = useState<Alumno[]>([]);
  const [buscarEspera, setBuscarEspera] = useState('');
  const [procesandoEspera, setProcesandoEspera] = useState<string | null>(null);

  // ── Modal nueva clase ──────────────────────────────────────────────────────
  const DIAS_SEMANA: { value: DiaSemana; label: string }[] = [
    { value: 'LUNES', label: 'Lun' }, { value: 'MARTES', label: 'Mar' },
    { value: 'MIERCOLES', label: 'Mié' }, { value: 'JUEVES', label: 'Jue' },
    { value: 'VIERNES', label: 'Vie' }, { value: 'SABADO', label: 'Sáb' },
    { value: 'DOMINGO', label: 'Dom' },
  ];
  const NIVELES = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0];

  const [modalNueva, setModalNueva] = useState(false);
  const [pasoNueva, setPasoNueva] = useState<'form' | 'candidatos'>('form');
  const [clasesCreadas, setClasesCreadas] = useState<Clase[]>([]);
  const [candidatosEspera, setCandidatosEspera] = useState<Alumno[]>([]);
  const [selEspera, setSelEspera] = useState<Set<string>>(new Set());
  const [inscribiendoEspera, setInscribiendoEspera] = useState(false);
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [pistas, setPistas] = useState<Pista[]>([]);
  const [formClase, setFormClase] = useState({
    nombre: '', nivelMin: 1.0, nivelMax: 2.0,
    profesorId: '', pistaId: '',
    diasSemana: ['LUNES'] as DiaSemana[],
    horaInicio: '09:00', horaFin: '10:00',
    plazasTotal: 4,
    recurrencia: 'permanente' as 'permanente' | 'este_mes' | 'hasta_fecha',
    fechaFin: '',
  });
  const [guardandoClase, setGuardandoClase] = useState(false);
  const [errorClase, setErrorClase] = useState('');
  const [modalCanal, setModalCanal] = useState<{ count: number; context: 'espera' | 'candidatos' } | null>(null);

  // ── Confirmar quitar alumno ─────────────────────────────────────────────
  const [confirmarQuitar, setConfirmarQuitar] = useState<{ alumnoId: string; nombre: string } | null>(null);

  // ── Modal recuperación ──────────────────────────────────────────────────────
  const [modalCandidatos, setModalCandidatos] = useState<{
    origen: string; claseId: string; candidatos: CandidatosHueco | null;
  } | null>(null);
  const [seleccionadosMod, setSeleccionadosMod] = useState<Set<string>>(new Set());
  const [enviandoMod, setEnviandoMod] = useState(false);
  const [fechaMod, setFechaMod] = useState('');

  const abrirModalCandidatos = async (origen: string, claseId: string, fecha: string) => {
    setFechaMod(fecha);
    setModalCandidatos({ origen, claseId, candidatos: null });
    try {
      const candidatos = await recuperApi.candidatos(claseId);
      setSeleccionadosMod(new Set(candidatos.compatibles.map((c) => c.alumnoId)));
      setModalCandidatos({ origen, claseId, candidatos });
    } catch {
      setModalCandidatos((prev) => prev ? { ...prev, candidatos: null } : null);
    }
  };

  const notificarSeleccionadosMod = () => {
    if (!modalCandidatos || seleccionadosMod.size === 0) return;
    setModalCanal({ count: seleccionadosMod.size, context: 'candidatos' });
  };

  const toggleSelecMod = (alumnoId: string) => {
    setSeleccionadosMod((prev) => {
      const next = new Set(prev);
      if (next.has(alumnoId)) next.delete(alumnoId); else next.add(alumnoId);
      return next;
    });
  };

  const abrirModalNueva = async () => {
    setErrorClase('');
    setPasoNueva('form');
    setClasesCreadas([]);
    setCandidatosEspera([]);
    setSelEspera(new Set());
    setFormClase({ nombre: '', nivelMin: 1.0, nivelMax: 2.0, profesorId: '', pistaId: '', diasSemana: ['LUNES'], horaInicio: '09:00', horaFin: '10:00', plazasTotal: 4, recurrencia: 'permanente', fechaFin: '' });
    const [profs, pts] = await Promise.all([profesoresApi.list(), pistasApi.list()]);
    setProfesores(profs.filter((p) => p.activo));
    setPistas(pts.filter((p) => p.activa));
    if (profs.length > 0) setFormClase((f) => ({ ...f, profesorId: profs[0].id }));
    if (pts.length > 0) setFormClase((f) => ({ ...f, pistaId: pts[0].id }));
    setModalNueva(true);
  };

  const guardarClase = async () => {
    if (!formClase.nombre.trim()) { setErrorClase('El nombre es obligatorio'); return; }
    if (!formClase.profesorId) { setErrorClase('Selecciona un profesor'); return; }
    if (!formClase.pistaId) { setErrorClase('Selecciona una pista'); return; }
    if (formClase.nivelMin >= formClase.nivelMax) { setErrorClase('El nivel mínimo debe ser menor que el máximo'); return; }
    if (formClase.diasSemana.length === 0) { setErrorClase('Selecciona al menos un día'); return; }
    if (formClase.recurrencia === 'hasta_fecha' && !formClase.fechaFin) { setErrorClase('Selecciona una fecha de fin'); return; }
    setGuardandoClase(true); setErrorClase('');
    try {
      const fechaFinValue =
        formClase.recurrencia === 'este_mes'
          ? new Date(año, mes, 0).toISOString()
          : formClase.recurrencia === 'hasta_fecha' && formClase.fechaFin
          ? new Date(formClase.fechaFin).toISOString()
          : null;
      const nuevas = await Promise.all(
        formClase.diasSemana.map((diaSemana) =>
          clasesApi.create({
            nombre: formClase.nombre, nivelMin: formClase.nivelMin, nivelMax: formClase.nivelMax,
            profesorId: formClase.profesorId, pistaId: formClase.pistaId,
            diaSemana, horaInicio: formClase.horaInicio, horaFin: formClase.horaFin,
            plazasTotal: formClase.plazasTotal,
            ...(fechaFinValue ? { fechaFin: fechaFinValue } : {}),
          } as any),
        ),
      );
      const updated = await clasesApi.list({ activa: 'true' });
      setClases(updated);
      const horaNum = parseInt(formClase.horaInicio.split(':')[0], 10);
      const esTurnoMañana = horaNum < 14;
      const sinClase = await alumnosApi.list({ activo: 'true', sinClase: 'true' } as any);
      const candidatos = sinClase.filter((a) => {
        if (a.nivel < formClase.nivelMin - 0.5 || a.nivel > formClase.nivelMax + 0.5) return false;
        if (a.disponibilidad === 'FLEXIBLE') return true;
        return esTurnoMañana ? a.disponibilidad === 'MANANA' : a.disponibilidad === 'TARDE';
      });
      setClasesCreadas(nuevas as Clase[]);
      setCandidatosEspera(candidatos);
      setSelEspera(new Set(candidatos.map((a) => a.id)));
      if (candidatos.length > 0) {
        setPasoNueva('candidatos');
      } else {
        setModalNueva(false);
        const n = formClase.diasSemana.length;
        setToast(`${n === 1 ? 'Clase creada' : `${n} clases creadas`} correctamente ✓`);
        setTimeout(() => setToast(''), 3000);
      }
    } catch (e: any) {
      setErrorClase(e.message ?? 'Error al crear la clase');
    } finally {
      setGuardandoClase(false);
    }
  };

  const inscribirDesdeEspera = async () => {
    if (selEspera.size === 0 || clasesCreadas.length === 0) { setModalNueva(false); return; }
    setInscribiendoEspera(true);
    const alumnoIds = Array.from(selEspera);
    const clase = clasesCreadas[0];
    let inscritos = 0;
    for (const alumnoId of alumnoIds) {
      if (inscritos >= clase.plazasTotal) break;
      try { await clasesApi.inscribir(clase.id, alumnoId); inscritos++; } catch {}
    }
    const updated = await clasesApi.list({ activa: 'true' });
    setClases(updated);
    setModalNueva(false);
    const n = formClase.diasSemana.length;
    setToast(`${n === 1 ? 'Clase creada' : `${n} clases creadas`} · ${inscritos} alumno(s) inscrito(s) ✓`);
    setTimeout(() => setToast(''), 3500);
    setInscribiendoEspera(false);
  };

  useEffect(() => {
    clasesApi.list({ activa: 'true' }).then(setClases).finally(() => setLoading(false));
    alumnosApi.list({ activo: 'true' }).then(setTodosAlumnos);
  }, []);

  const profesorIds = [...new Set(clases.map((c) => c.profesorId))];

  const navMes = (delta: number) => {
    let nm = mes + delta;
    let na = año;
    if (nm < 1) { nm = 12; na--; }
    if (nm > 12) { nm = 1; na++; }
    setMes(nm); setAño(na);
  };

  const navVista = (delta: number) => {
    if (vista === 'mes') { navMes(delta); return; }
    // semana
    const d = addDays(diaSeleccionado, delta * 7);
    setDiaSeleccionado(d);
    setMes(d.getMonth() + 1); setAño(d.getFullYear());
  };

  const irAHoy = () => {
    const h = new Date();
    setDiaSeleccionado(h);
    setMes(h.getMonth() + 1); setAño(h.getFullYear());
  };

  // Week calculation for semana view
  const getWeekDays = (ref: Date): Date[] => {
    const start = dateFnsStartOfWeek(ref, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };
  const weekDays = getWeekDays(diaSeleccionado);

  const abrirPanel = (clase: Clase, dia: number, mesOverride?: number, añoOverride?: number) => {
    const m = mesOverride ?? mes;
    const a = añoOverride ?? año;
    const fechaStr = `${a}-${String(m).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    setPanel({ clase, dia, mes: m, año: a, fechaStr, listaEspera: undefined, cargandoEspera: true });
    setRegistrado({});
    setBuscarEspera('');
    listaEsperaApi.list(clase.id).then((le) => {
      setPanel((prev) => prev ? { ...prev, listaEspera: le, cargandoEspera: false } : null);
    }).catch(() => {
      setPanel((prev) => prev ? { ...prev, listaEspera: [], cargandoEspera: false } : null);
    });
  };

  const notificarFalta = useCallback(async (alumnoId: string) => {
    if (!panel) return;
    setRegistrando((p) => ({ ...p, [alumnoId]: true }));
    try {
      await recuperApi.faltaAnticipada(panel.clase.id, alumnoId, panel.fechaStr);
      setRegistrado((p) => ({ ...p, [alumnoId]: true }));
      const alumno = panel.clase.inscripciones.find((i) => i.alumnoId === alumnoId)?.alumno;
      setToast(`Falta registrada para ${alumno?.nombre ?? ''}`);
      setTimeout(() => setToast(''), 2500);
      await abrirModalCandidatos(
        `Falta de ${alumno?.nombre ?? 'alumno'} — ${panel.clase.nombre}`,
        panel.clase.id, panel.fechaStr,
      );
    } catch {
      setToast('Error al registrar la falta. Inténtalo de nuevo.');
      setTimeout(() => setToast(''), 4000);
    } finally {
      setRegistrando((p) => ({ ...p, [alumnoId]: false }));
    }
  }, [panel]);

  const quitarDeClase = useCallback(async (alumnoId: string) => {
    if (!panel) return;
    const claseId = panel.clase.id;
    const alumnoNombre = panel.clase.inscripciones.find((i) => i.alumnoId === alumnoId)?.alumno?.nombre ?? 'Alumno';
    setQuitando((p) => ({ ...p, [alumnoId]: true }));
    try {
      await clasesApi.desinscribir(claseId, alumnoId);
      setClases((prev) =>
        prev.map((c) =>
          c.id !== claseId ? c : { ...c, inscripciones: c.inscripciones.map((i) => i.alumnoId === alumnoId ? { ...i, activo: false } : i) },
        ),
      );
      setPanel((prev) =>
        prev ? { ...prev, clase: { ...prev.clase, inscripciones: prev.clase.inscripciones.map((i) => i.alumnoId === alumnoId ? { ...i, activo: false } : i) } } : null,
      );
      setToast(`${alumnoNombre} quitado de la clase`);
      setTimeout(() => setToast(''), 2500);
      await abrirModalCandidatos(`Plaza liberada — ${alumnoNombre} quitado de ${panel.clase.nombre}`, claseId, panel.fechaStr);
    } catch {
      setToast('Error al quitar al alumno. Inténtalo de nuevo.');
      setTimeout(() => setToast(''), 3500);
    } finally {
      setQuitando((p) => ({ ...p, [alumnoId]: false }));
    }
  }, [panel]);

  const weeks = getCalendarWeeks(mes, año);
  const mesLabel = format(new Date(año, mes - 1), 'MMMM yyyy', { locale: es });
  const esHoy = (dia: number) => dia === hoy.getDate() && mes === hoy.getMonth() + 1 && año === hoy.getFullYear();
  const isPast = (dia: number) => { const d = new Date(año, mes - 1, dia); d.setHours(23, 59, 59); return d < hoy; };

  const vistaLabel = (() => {
    if (vista === 'mes') return mesLabel;
    const d0 = weekDays[0]; const d6 = weekDays[6];
    if (d0.getMonth() === d6.getMonth()) return `${d0.getDate()}–${d6.getDate()} ${format(d0, 'MMMM yyyy', { locale: es })}`;
    return `${format(d0, 'd MMM', { locale: es })} – ${format(d6, 'd MMM yyyy', { locale: es })}`;
  })();

  if (loading) return <div className="p-8 flex items-center justify-center h-64"><div className="spinner" /></div>;

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Calendario ── */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-black text-slate-800 capitalize">{vistaLabel}</h1>
            <p className="text-sm text-slate-400 mt-0.5">{clases.length} clases activas · Haz clic en una clase para ver detalles</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg border border-slate-200 overflow-hidden mr-2">
              {([
                { value: 'semana' as const, label: 'Semana', icon: CalendarDays },
                { value: 'mes' as const, label: 'Mes', icon: LayoutGrid },
              ]).map((v) => (
                <button key={v.value} onClick={() => setVista(v.value)}
                  className={`flex items-center gap-1 px-3 py-2 text-xs font-semibold transition-colors border-r border-slate-200 last:border-r-0 ${vista === v.value ? 'bg-[#1e83ec] text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                  <v.icon size={12} /> {v.label}
                </button>
              ))}
            </div>
            <button onClick={() => navVista(-1)} className="btn btn-secondary px-2 py-2"><ChevronLeft size={16} /></button>
            <button onClick={irAHoy} className="btn btn-secondary text-xs">Hoy</button>
            <button onClick={() => navVista(1)} className="btn btn-secondary px-2 py-2"><ChevronRight size={16} /></button>
            <button onClick={abrirModalNueva} className="btn btn-primary flex items-center gap-1.5 ml-2">
              <Plus size={15} /> Nueva clase
            </button>
          </div>
        </div>

        {/* Leyenda profesores */}
        <div className="flex flex-wrap gap-2 mb-5">
          {[...new Map(clases.map((c) => [c.profesorId, c.profesor])).values()].map((prof) => {
            const pal = getProfPalette(prof.id, profesorIds);
            return (
              <span key={prof.id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border" style={{ background: pal.bg, color: pal.text, borderColor: pal.border }}>
                <span className="w-2 h-2 rounded-full" style={{ background: pal.dot }} />
                {prof.nombre} {prof.apellidos}
              </span>
            );
          })}
        </div>

        {/* ── Vista Mes ── */}
        {vista === 'mes' && (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
            {DIAS_HEADER.map((d) => (
              <div key={d} className="py-2.5 text-center text-xs font-bold text-slate-400 uppercase tracking-wide">{d}</div>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-slate-50 last:border-b-0">
              {week.map((dia, ci) => {
                const dow = dayOfWeekForCell(ci);
                const clasesHoy = dia ? clasesDelDia(clases, dow, año, mes, dia) : [];
                const hoyFlag = dia ? esHoy(dia) : false;
                const past = dia ? isPast(dia) : false;
                return (
                  <div key={ci} className={`min-h-[96px] p-1.5 border-r border-slate-50 last:border-r-0 ${!dia ? 'bg-slate-50/40' : hoyFlag ? 'bg-blue-50/40' : ''}`}>
                    {dia && (
                      <>
                        <div className="flex justify-end mb-1">
                          <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${past && !hoyFlag ? 'text-slate-300' : !hoyFlag ? 'text-slate-600' : ''}`} style={hoyFlag ? { background: '#1e83ec', color: '#fff' } : {}}>
                            {dia}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          {clasesHoy.map((clase) => {
                            const pal = getProfPalette(clase.profesorId, profesorIds);
                            const activos = clase.inscripciones.filter((i) => i.activo).length;
                            const panelActive = panel?.clase.id === clase.id && panel?.dia === dia;
                            return (
                              <button key={clase.id} onClick={() => abrirPanel(clase, dia)} className="w-full text-left rounded px-1.5 py-1 text-[11px] leading-tight transition-all border"
                                style={{ background: panelActive ? pal.dot : pal.bg, color: panelActive ? '#fff' : pal.text, borderColor: panelActive ? pal.dot : pal.border, opacity: past && !hoyFlag ? 0.55 : 1 }}>
                                <p className="font-semibold truncate">{clase.horaInicio} {clase.nombre}</p>
                                <p className="opacity-80 truncate">{clase.profesor.nombre.split(' ')[0]} · {activos}/{clase.plazasTotal}</p>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        )}

        {/* ── Vista Semana ── */}
        {vista === 'semana' && (
          <div className="card overflow-hidden">
            <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
              {weekDays.map((d, i) => {
                const isToday = d.toDateString() === hoy.toDateString();
                return (
                  <div key={i} className={`py-2.5 text-center ${isToday ? 'bg-blue-50' : ''}`}>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{DIAS_HEADER[i]}</p>
                    <p className={`text-sm font-black mt-0.5 ${isToday ? 'text-[#1e83ec]' : 'text-slate-700'}`}>{d.getDate()}</p>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-7 divide-x divide-slate-50">
              {weekDays.map((d, i) => {
                const dow = d.getDay();
                const clasesDia = clasesDelDia(clases, dow, d.getFullYear(), d.getMonth() + 1, d.getDate());
                const isToday = d.toDateString() === hoy.toDateString();
                const past = d < hoy && !isToday;
                return (
                  <div key={i} className={`min-h-[340px] p-2 ${isToday ? 'bg-blue-50/30' : ''}`}>
                    <div className="space-y-1.5">
                      {clasesDia.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)).map((clase) => {
                        const pal = getProfPalette(clase.profesorId, profesorIds);
                        const activos = clase.inscripciones.filter((ins) => ins.activo).length;
                        const panelActive = panel?.clase.id === clase.id && panel?.dia === d.getDate();
                        return (
                          <button key={clase.id} onClick={() => abrirPanel(clase, d.getDate(), d.getMonth() + 1, d.getFullYear())} className="w-full text-left rounded-lg px-2.5 py-2 text-xs leading-snug transition-all border"
                            style={{ background: panelActive ? pal.dot : pal.bg, color: panelActive ? '#fff' : pal.text, borderColor: panelActive ? pal.dot : pal.border, opacity: past ? 0.55 : 1 }}>
                            <p className="font-bold">{clase.horaInicio}–{clase.horaFin}</p>
                            <p className="font-semibold truncate mt-0.5">{clase.nombre}</p>
                            <p className="opacity-75 truncate mt-0.5">{clase.profesor.nombre.split(' ')[0]} · {activos}/{clase.plazasTotal}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Panel lateral ── */}
      {panel && (
        <div className="w-80 shrink-0 border-l border-slate-100 bg-white overflow-y-auto flex flex-col shadow-sm">
          <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide mb-0.5 capitalize" style={{ color: '#1e83ec' }}>
                {format(new Date(panel.año, panel.mes - 1, panel.dia), "EEEE d 'de' MMMM", { locale: es })}
              </p>
              <h2 className="font-black text-slate-800 text-base leading-tight">{panel.clase.nombre}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{panel.clase.horaInicio}–{panel.clase.horaFin} · Pista {panel.clase.pista.numero}</p>
            </div>
            <button onClick={() => setPanel(null)} className="btn btn-ghost p-1 text-slate-400 shrink-0 ml-2"><X size={16} /></button>
          </div>

          {/* Profesor */}
          <div className="px-5 py-3 border-b border-slate-50">
            {(() => {
              const pal = getProfPalette(panel.clase.profesorId, profesorIds);
              return (
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0" style={{ background: pal.bg, color: pal.text }}>
                    {panel.clase.profesor.nombre[0]}{panel.clase.profesor.apellidos[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{panel.clase.profesor.nombre} {panel.clase.profesor.apellidos}</p>
                    <p className="text-xs text-slate-400">Nivel {panel.clase.nivelMin}–{panel.clase.nivelMax}</p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Alumnos */}
          <div className="px-5 py-4 flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} className="text-slate-400" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Alumnos ({panel.clase.inscripciones.filter((i) => i.activo).length}/{panel.clase.plazasTotal})
              </span>
            </div>
            {panel.clase.inscripciones.filter((i) => i.activo).length === 0 ? (
              <p className="text-sm text-slate-400 italic">Sin alumnos inscritos</p>
            ) : (
              <div className="space-y-2">
                {panel.clase.inscripciones.filter((i) => i.activo).map((insc) => {
                  const ya = registrado[insc.alumnoId];
                  const cargando = registrando[insc.alumnoId];
                  const esPasado = isPast(panel.dia);
                  return (
                    <div key={insc.id} className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-colors ${ya ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                        {insc.alumno.nombre[0]}{insc.alumno.apellidos[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">{insc.alumno.nombre} {insc.alumno.apellidos}</p>
                        <p className="text-xs text-slate-400">Niv. {insc.alumno.nivel.toFixed(1)}</p>
                      </div>
                      {ya ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 shrink-0"><AlertCircle size={12} /> Falta</span>
                      ) : esPasado ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs text-slate-300">Pasado</span>
                          <button onClick={() => setConfirmarQuitar({ alumnoId: insc.alumnoId, nombre: `${insc.alumno.nombre} ${insc.alumno.apellidos}` })} disabled={quitando[insc.alumnoId]} title="Quitar de la clase" className="p-1 rounded text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-40">
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 shrink-0">
                          {hasFaltas ? (
                            <button onClick={() => notificarFalta(insc.alumnoId)} disabled={cargando} title="Registrar falta puntual" className="text-xs font-medium px-2 py-1 rounded-md border border-slate-200 bg-white text-slate-500 hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-40">
                              {cargando ? '...' : 'Falta'}
                            </button>
                          ) : (
                            <span title="Disponible en el plan Club" className="text-xs font-medium px-2 py-1 rounded-md border border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed inline-flex items-center gap-1">
                              Falta <Lock size={10} />
                            </span>
                          )}
                          <button onClick={() => setConfirmarQuitar({ alumnoId: insc.alumnoId, nombre: `${insc.alumno.nombre} ${insc.alumno.apellidos}` })} disabled={quitando[insc.alumnoId]} title="Quitar de la clase" className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-400 hover:border-rose-300 hover:text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-40">
                            <X size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-100">
              <div className="flex items-start gap-2">
                <Clock size={13} style={{ color: '#1e83ec' }} className="mt-0.5 shrink-0" />
                <p className="text-xs text-slate-500 leading-relaxed">Notificar una falta <strong>libera la plaza</strong> y genera una recuperación pendiente.</p>
              </div>
            </div>

            {/* Lista de espera */}
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                  <Clock size={12} /> Lista de espera
                  {panel.listaEspera && panel.listaEspera.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">{panel.listaEspera.length}</span>
                  )}
                </span>
                {(panel.listaEspera?.length ?? 0) > 0 && (
                  <button onClick={() => setModalCanal({ count: panel.listaEspera?.length ?? 0, context: 'espera' })} disabled={procesandoEspera === 'notificar'}
                    className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg text-white disabled:opacity-50" style={{ background: '#1e83ec' }}>
                    {procesandoEspera === 'notificar' ? <Loader2 size={11} className="animate-spin" /> : <Bell size={11} />}
                    Notificar
                  </button>
                )}
              </div>
              {panel.cargandoEspera ? (
                <div className="py-3 flex justify-center"><Loader2 size={16} className="animate-spin text-slate-300" /></div>
              ) : (panel.listaEspera?.length ?? 0) === 0 ? (
                <p className="text-xs text-slate-400 italic">Sin alumnos en lista de espera</p>
              ) : (
                <div className="space-y-1.5">
                  {panel.listaEspera!.map((entrada) => {
                    const plazasLibres = panel.clase.plazasTotal - panel.clase.inscripciones.filter((i) => i.activo).length;
                    return (
                      <div key={entrada.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 bg-amber-50 border border-amber-200">
                        <span className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center text-[10px] font-black text-amber-900 shrink-0">{entrada.posicion}</span>
                        <span className="text-sm font-medium text-slate-700 flex-1 truncate">{entrada.alumno.nombre} {entrada.alumno.apellidos}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {plazasLibres > 0 && (
                            <button onClick={async () => {
                              setProcesandoEspera(entrada.id);
                              try {
                                await listaEsperaApi.inscribir(entrada.id);
                                const claseRefrescada = await clasesApi.get(panel.clase.id);
                                const le = await listaEsperaApi.list(panel.clase.id);
                                setClases((prev) => prev.map((c) => c.id === panel.clase.id ? claseRefrescada : c));
                                setPanel((prev) => prev ? { ...prev, clase: claseRefrescada, listaEspera: le } : null);
                                setToast('Alumno inscrito en la clase ✓');
                                setTimeout(() => setToast(''), 3500);
                              } catch (e: any) { setToast(e.message ?? 'Error al inscribir'); setTimeout(() => setToast(''), 3500); }
                              setProcesandoEspera(null);
                            }} disabled={!!procesandoEspera} title="Inscribir en clase" className="p-1 rounded text-emerald-600 hover:bg-emerald-100 disabled:opacity-40">
                              {procesandoEspera === entrada.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                            </button>
                          )}
                          <button onClick={async () => {
                            setProcesandoEspera(entrada.id + '_del');
                            try { await listaEsperaApi.remove(entrada.id); const le = await listaEsperaApi.list(panel.clase.id); setPanel((prev) => prev ? { ...prev, listaEspera: le } : null); }
                            catch { setToast('Error al eliminar'); setTimeout(() => setToast(''), 3000); }
                            setProcesandoEspera(null);
                          }} disabled={!!procesandoEspera} title="Quitar de lista" className="p-1 rounded text-red-400 hover:bg-red-50 disabled:opacity-40">
                            <UserMinus size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Añadir a espera */}
              <div className="mt-3">
                <p className="text-xs font-semibold text-slate-400 mb-1.5 uppercase">Añadir a espera</p>
                <div className="relative">
                  <UserPlus size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                  <input value={buscarEspera} onChange={(e) => setBuscarEspera(e.target.value)} placeholder="Buscar alumno..." className="w-full pl-7 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100" />
                </div>
                {buscarEspera.trim() && (() => {
                  const filtrados = todosAlumnos.filter((a) => {
                    const yaInscrito = panel.clase.inscripciones.some((i) => i.alumnoId === a.id && i.activo);
                    const yaEnEspera = panel.listaEspera?.some((e) => e.alumnoId === a.id);
                    if (yaInscrito || yaEnEspera) return false;
                    return `${a.nombre} ${a.apellidos}`.toLowerCase().includes(buscarEspera.toLowerCase());
                  }).slice(0, 5);
                  return filtrados.length > 0 ? (
                    <div className="mt-1 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                      {filtrados.map((a) => (
                        <button key={a.id} onClick={async () => {
                          setProcesandoEspera(a.id);
                          try { await listaEsperaApi.add(a.id, panel.clase.id); const le = await listaEsperaApi.list(panel.clase.id); setPanel((prev) => prev ? { ...prev, listaEspera: le } : null); setToast('Añadido a lista de espera'); setTimeout(() => setToast(''), 3000); setBuscarEspera(''); }
                          catch (ex: any) { setToast(ex.message ?? 'Error'); setTimeout(() => setToast(''), 3000); }
                          setProcesandoEspera(null);
                        }} disabled={!!procesandoEspera} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center justify-between border-b border-slate-100 last:border-0 disabled:opacity-50">
                          <span className="text-slate-700 font-medium">{a.nombre} {a.apellidos}</span>
                          {procesandoEspera === a.id ? <Loader2 size={12} className="animate-spin text-slate-400" /> : <UserPlus size={12} className="text-slate-400" />}
                        </button>
                      ))}
                    </div>
                  ) : <p className="text-xs text-slate-400 mt-1 italic">Sin resultados</p>;
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal confirmar quitar alumno ── */}
      {confirmarQuitar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0"><UserMinus size={18} className="text-rose-500" /></div>
                <h2 className="font-black text-slate-800 text-base">Quitar de la clase</h2>
              </div>
              <p className="text-sm text-slate-500">¿Seguro que quieres quitar a <strong className="text-slate-700">{confirmarQuitar.nombre}</strong> de esta clase? Esta acción elimina su inscripción permanentemente.</p>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setConfirmarQuitar(null)} className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-500 hover:bg-slate-50">Cancelar</button>
              <button onClick={() => { quitarDeClase(confirmarQuitar.alumnoId); setConfirmarQuitar(null); }} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 transition-colors">Sí, quitar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal candidatos recuperación ── */}
      {modalCandidatos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-0.5"><AlertTriangle size={16} className="text-amber-500" /><h2 className="font-black text-slate-800 text-base">Hueco disponible</h2></div>
                <p className="text-xs text-slate-500">{modalCandidatos.origen}</p>
              </div>
              <button onClick={() => setModalCandidatos(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 ml-3 shrink-0"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {!modalCandidatos.candidatos ? (
                <div className="flex items-center justify-center py-10 gap-2 text-slate-400"><Loader2 size={16} className="animate-spin" /><span className="text-sm">Buscando candidatos…</span></div>
              ) : modalCandidatos.candidatos.compatibles.length === 0 && modalCandidatos.candidatos.otros.length === 0 ? (
                <div className="text-center py-10"><CheckCircle size={32} className="text-slate-300 mx-auto mb-2" /><p className="text-sm text-slate-400">No hay alumnos con recuperaciones pendientes.</p></div>
              ) : (
                <>
                  {modalCandidatos.candidatos.compatibles.length > 0 && (
                    <div className="mb-5">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Mismo nivel (Niv. {modalCandidatos.candidatos.clase.nivelMin}–{modalCandidatos.candidatos.clase.nivelMax})</p>
                      <div className="space-y-2">
                        {modalCandidatos.candidatos.compatibles.map((c) => (
                          <label key={c.alumnoId} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${seleccionadosMod.has(c.alumnoId) ? 'border-[#1e83ec] bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                            <input type="checkbox" checked={seleccionadosMod.has(c.alumnoId)} onChange={() => toggleSelecMod(c.alumnoId)} className="mt-0.5 accent-[#1e83ec]" />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-800 text-sm">{c.nombre} {c.apellidos}</p>
                              <p className="text-xs text-slate-500">Niv. {c.nivel} · Faltó en: {c.claseOrigen}</p>
                              <p className="text-xs text-slate-400">{new Date(c.fechaOrigen).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  {modalCandidatos.candidatos.otros.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Otros niveles</p>
                      <div className="space-y-2">
                        {[...modalCandidatos.candidatos.otros].sort((a, b) => {
                          const mid = (modalCandidatos.candidatos!.clase.nivelMin + modalCandidatos.candidatos!.clase.nivelMax) / 2;
                          return Math.abs(a.nivel - mid) - Math.abs(b.nivel - mid);
                        }).map((c) => (
                          <label key={c.alumnoId} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${seleccionadosMod.has(c.alumnoId) ? 'border-slate-400 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}>
                            <input type="checkbox" checked={seleccionadosMod.has(c.alumnoId)} onChange={() => toggleSelecMod(c.alumnoId)} className="mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-slate-700 text-sm">{c.nombre} {c.apellidos}</p>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold">Niv. {c.nivel}</span>
                              </div>
                              <p className="text-xs text-slate-500">Faltó en: {c.claseOrigen}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <button onClick={() => setModalCandidatos(null)} className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-500 hover:bg-slate-50">Saltar</button>
              <button onClick={notificarSeleccionadosMod} disabled={enviandoMod || seleccionadosMod.size === 0 || !modalCandidatos.candidatos} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: '#1e83ec' }}>
                {enviandoMod ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Notificar{seleccionadosMod.size > 0 ? ` (${seleccionadosMod.size})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal canal notificación ── */}
      {modalCanal && <ModalNotificacion count={modalCanal.count} onConfirm={() => { if (modalCanal.context === 'candidatos') setModalCandidatos(null); setToast(`Notificados ${modalCanal.count} alumno(s) ✓`); setTimeout(() => setToast(''), 3500); setModalCanal(null); }} onClose={() => setModalCanal(null)} />}

      {/* ── Toast ── */}
      {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold shadow-lg" style={{ background: '#1e83ec', color: '#fff' }}><Check size={15} />{toast}</div>}

      {/* ── Modal Nueva Clase ── */}
      {modalNueva && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-black text-slate-800">{pasoNueva === 'form' ? 'Nueva clase' : 'Alumnos en lista de espera'}</h2>
                {pasoNueva === 'candidatos' && <p className="text-xs text-slate-400 mt-0.5">{candidatosEspera.length} alumno{candidatosEspera.length !== 1 ? 's' : ''} sin clase compatibles</p>}
              </div>
              <button onClick={() => setModalNueva(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            {pasoNueva === 'form' ? (
              <><div className="px-6 py-5 space-y-5">
                <div><label className="label">Nombre de la clase</label><input className="input" placeholder="ej. Iniciación Mañana" value={formClase.nombre} onChange={(e) => setFormClase((f) => ({ ...f, nombre: e.target.value }))} /></div>
                <div><label className="label">Rango de nivel</label><div className="flex items-center gap-3"><select className="input flex-1" value={formClase.nivelMin} onChange={(e) => setFormClase((f) => ({ ...f, nivelMin: parseFloat(e.target.value) }))}>{NIVELES.map((n) => <option key={n} value={n}>Niv. {n.toFixed(1)}</option>)}</select><span className="text-slate-400 text-sm font-semibold shrink-0">hasta</span><select className="input flex-1" value={formClase.nivelMax} onChange={(e) => setFormClase((f) => ({ ...f, nivelMax: parseFloat(e.target.value) }))}>{NIVELES.map((n) => <option key={n} value={n}>Niv. {n.toFixed(1)}</option>)}</select></div></div>
                <div><label className="label">Profesor</label><select className="input" value={formClase.profesorId} onChange={(e) => setFormClase((f) => ({ ...f, profesorId: e.target.value }))}>{profesores.map((p) => <option key={p.id} value={p.id}>{p.nombre} {p.apellidos}</option>)}</select></div>
                <div><label className="label">Pista</label><select className="input" value={formClase.pistaId} onChange={(e) => setFormClase((f) => ({ ...f, pistaId: e.target.value }))}>{pistas.map((p) => <option key={p.id} value={p.id}>Pista {p.numero} — {p.nombre}</option>)}</select></div>
                <div><label className="label">Días de la semana</label><div className="flex gap-1.5 flex-wrap">{DIAS_SEMANA.map((d) => { const checked = formClase.diasSemana.includes(d.value); return (<button key={d.value} type="button" onClick={() => setFormClase((f) => ({ ...f, diasSemana: checked ? f.diasSemana.filter((x) => x !== d.value) : [...f.diasSemana, d.value] }))} className="w-11 h-11 rounded-xl text-sm font-bold border-2 transition-all" style={checked ? { background: '#1e83ec', color: '#fff', borderColor: '#1e83ec' } : { background: '#f8fafc', color: '#64748b', borderColor: '#e2e8f0' }}>{d.label}</button>); })}</div></div>
                <div><label className="label">Recurrencia</label><div className="space-y-2">{[{ value: 'permanente', label: 'Permanente', desc: 'Se repite todas las semanas' }, { value: 'este_mes', label: 'Solo este mes', desc: `Hasta el ${new Date(año, mes, 0).getDate()} de ${mesLabel}` }, { value: 'hasta_fecha', label: 'Hasta una fecha', desc: '' }].map((opt) => (<label key={opt.value} className="flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all" style={formClase.recurrencia === opt.value ? { borderColor: '#1e83ec', background: '#eff6ff' } : { borderColor: '#e2e8f0', background: '#f8fafc' }}><input type="radio" name="recurrencia" value={opt.value} checked={formClase.recurrencia === opt.value} onChange={() => setFormClase((f) => ({ ...f, recurrencia: opt.value as any }))} className="mt-0.5 accent-[#1e83ec]" /><div><p className="text-sm font-semibold text-slate-700">{opt.label}</p>{opt.desc && <p className="text-xs text-slate-400">{opt.desc}</p>}</div></label>))}</div>{formClase.recurrencia === 'hasta_fecha' && <input type="date" className="input mt-2" value={formClase.fechaFin} min={new Date().toISOString().split('T')[0]} onChange={(e) => setFormClase((f) => ({ ...f, fechaFin: e.target.value }))} />}</div>
                <div><label className="label">Horario</label><div className="flex items-center gap-3"><input type="time" className="input flex-1" value={formClase.horaInicio} onChange={(e) => setFormClase((f) => ({ ...f, horaInicio: e.target.value }))} /><span className="text-slate-400 text-sm font-semibold shrink-0">a</span><input type="time" className="input flex-1" value={formClase.horaFin} onChange={(e) => setFormClase((f) => ({ ...f, horaFin: e.target.value }))} /></div></div>
                <div><label className="label">Plazas disponibles</label><div className="flex items-center gap-3"><button type="button" onClick={() => setFormClase((f) => ({ ...f, plazasTotal: Math.max(1, f.plazasTotal - 1) }))} className="w-10 h-10 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-600 font-bold text-lg hover:border-slate-300">−</button><span className="text-2xl font-black text-slate-800 w-8 text-center">{formClase.plazasTotal}</span><button type="button" onClick={() => setFormClase((f) => ({ ...f, plazasTotal: Math.min(12, f.plazasTotal + 1) }))} className="w-10 h-10 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-600 font-bold text-lg hover:border-slate-300">+</button></div></div>
                {errorClase && <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg border border-rose-100"><AlertCircle size={14} /> {errorClase}</div>}
              </div>
              <div className="flex gap-2 px-6 py-4 border-t border-slate-100">
                <button onClick={guardarClase} disabled={guardandoClase} className="btn btn-primary flex items-center gap-2 flex-1 justify-center">{guardandoClase ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}Crear clase</button>
                <button onClick={() => setModalNueva(false)} className="btn btn-secondary">Cancelar</button>
              </div></>
            ) : (
              <>
                <div className="px-6 py-5 space-y-2 max-h-[50vh] overflow-y-auto">
                  {candidatosEspera.length === 0 ? <p className="text-sm text-slate-400 italic text-center py-4">No hay alumnos en lista de espera compatibles</p> : candidatosEspera.map((a) => {
                    const sel = selEspera.has(a.id);
                    return (<label key={a.id} className="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all" style={sel ? { borderColor: '#1e83ec', background: '#eff6ff' } : { borderColor: '#e2e8f0', background: '#f8fafc' }}><input type="checkbox" checked={sel} onChange={() => setSelEspera((prev) => { const next = new Set(prev); if (next.has(a.id)) next.delete(a.id); else next.add(a.id); return next; })} className="w-4 h-4 accent-[#1e83ec]" /><div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-black text-blue-700 shrink-0">{a.nombre[0]}{a.apellidos[0]}</div><div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-800 truncate">{a.nombre} {a.apellidos}</p><p className="text-xs text-slate-400">Niv. {a.nivel.toFixed(1)} · {a.disponibilidad === 'MANANA' ? 'Mañana' : a.disponibilidad === 'TARDE' ? 'Tarde' : 'Flexible'}</p></div></label>);
                  })}
                </div>
                <div className="flex gap-2 px-6 py-4 border-t border-slate-100">
                  <button onClick={inscribirDesdeEspera} disabled={inscribiendoEspera || selEspera.size === 0} className="btn btn-primary flex items-center gap-2 flex-1 justify-center disabled:opacity-50">{inscribiendoEspera ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}{selEspera.size > 0 ? `Inscribir ${selEspera.size} alumno${selEspera.size !== 1 ? 's' : ''}` : 'Inscribir seleccionados'}</button>
                  <button onClick={() => setModalNueva(false)} className="btn btn-secondary">Saltar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
