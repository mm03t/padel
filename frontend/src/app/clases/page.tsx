'use client';

import { useEffect, useState, useCallback } from 'react';
import { format, getDaysInMonth, startOfMonth, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, X, Users, AlertCircle, Check, Clock, Bell, UserPlus, CheckCircle, Loader2, UserMinus, AlertTriangle, Send, Plus, Trash2, List, CalendarDays, Trophy } from 'lucide-react';
import { clases as clasesApi, recuperaciones as recuperApi, listaEspera as listaEsperaApi, alumnos as alumnosApi, notificaciones as notifApi, profesores as profesoresApi, pistas as pistasApi } from '@/lib/api';
import type { Clase, DiaSemana, ListaEspera, Alumno, CandidatosHueco, Profesor, Pista } from '@/types';
import ModalNotificacion from '@/components/ModalNotificacion';

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

export default function ClasesPage() {
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [año, setAño] = useState(hoy.getFullYear());
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
    { value: 'LUNES',     label: 'Lun' },
    { value: 'MARTES',    label: 'Mar' },
    { value: 'MIERCOLES', label: 'Mié' },
    { value: 'JUEVES',    label: 'Jue' },
    { value: 'VIERNES',   label: 'Vie' },
    { value: 'SABADO',    label: 'Sáb' },
    { value: 'DOMINGO',   label: 'Dom' },
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

  // ── Vista listado + eliminar clase ────────────────────────────────────────
  const [vista, setVista] = useState<'calendario' | 'listado'>('calendario');
  const [confirmarEliminarClase, setConfirmarEliminarClase] = useState<Clase | null>(null);
  const [eliminandoClase, setEliminandoClase] = useState(false);

  const getFinSemana = () => {
    const hoy = new Date();
    const dia = hoy.getDay();
    const diasHastaDomingo = dia === 0 ? 0 : 7 - dia;
    const fin = new Date(hoy);
    fin.setDate(hoy.getDate() + diasHastaDomingo);
    fin.setHours(23, 59, 59, 999);
    return fin;
  };

  const getFinMes = () => {
    const hoy = new Date();
    return new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999);
  };

  const eliminarClase = async (tipo: 'semana' | 'mes' | 'definitiva') => {
    if (!confirmarEliminarClase) return;
    setEliminandoClase(true);
    try {
      if (tipo === 'definitiva') {
        await clasesApi.purge(confirmarEliminarClase.id);
        setClases((prev) => prev.filter((c) => c.id !== confirmarEliminarClase.id));
      } else {
        const fechaFin = tipo === 'semana' ? getFinSemana() : getFinMes();
        const updated = await clasesApi.update(confirmarEliminarClase.id, { fechaFin: fechaFin.toISOString() } as any);
        setClases((prev) => prev.map((c) => c.id === updated.id ? { ...c, fechaFin: updated.fechaFin } : c));
      }
      setConfirmarEliminarClase(null);
      const label = tipo === 'semana' ? 'hasta esta semana' : tipo === 'mes' ? 'hasta fin de mes' : 'definitivamente';
      setToast(`Clase eliminada ${label} ✓`);
      setTimeout(() => setToast(''), 3000);
    } catch {
      setToast('Error al eliminar la clase');
      setTimeout(() => setToast(''), 3000);
    }
    setEliminandoClase(false);
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
      // --- Buscar candidatos de lista de espera ---
      const esMañana = (h: string) => parseInt(h.split(':')[0], 10) < 14;
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
    if (selEspera.size === 0 || clasesCreadas.length === 0) {
      setModalNueva(false);
      return;
    }
    setInscribiendoEspera(true);
    const alumnoIds = Array.from(selEspera);
    const clase = clasesCreadas[0]; // primera clase creada como destino principal
    let inscritos = 0;
    for (const alumnoId of alumnoIds) {
      if (inscritos >= clase.plazasTotal) break;
      try {
        await clasesApi.inscribir(clase.id, alumnoId);
        inscritos++;
      } catch { /* plaza llena o error: continuar */ }
    }
    const updated = await clasesApi.list({ activa: 'true' });
    setClases(updated);
    setModalNueva(false);
    const n = formClase.diasSemana.length;
    setToast(`${n === 1 ? 'Clase creada' : `${n} clases creadas`} · ${inscritos} alumno(s) inscrito(s) ✓`);
    setTimeout(() => setToast(''), 3500);
    setInscribiendoEspera(false);
  };

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

  useEffect(() => {
    clasesApi.list({ activa: 'true' })
      .then(setClases)
      .finally(() => setLoading(false));
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

  const abrirPanel = (clase: Clase, dia: number) => {
    const fechaStr = `${año}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    setPanel({ clase, dia, mes, año, fechaStr, listaEspera: undefined, cargandoEspera: true });
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
        panel.clase.id,
        panel.fechaStr,
      );
    } catch {
      setToast('Error al registrar la falta. Inténtalo de nuevo.');
      setTimeout(() => setToast(''), 4000);
    } finally {
      setRegistrando((p) => ({ ...p, [alumnoId]: false }));
    }
  }, [panel]);

  // Quitar alumno de la clase y abrir modal de recuperaciones
  const quitarDeClase = useCallback(async (alumnoId: string) => {
    if (!panel) return;
    const claseId = panel.clase.id;
    const alumnoNombre = panel.clase.inscripciones.find((i) => i.alumnoId === alumnoId)?.alumno?.nombre ?? 'Alumno';
    setQuitando((p) => ({ ...p, [alumnoId]: true }));
    try {
      await clasesApi.desinscribir(claseId, alumnoId);
      setClases((prev) =>
        prev.map((c) =>
          c.id !== claseId ? c : {
            ...c,
            inscripciones: c.inscripciones.map((i) =>
              i.alumnoId === alumnoId ? { ...i, activo: false } : i,
            ),
          },
        ),
      );
      setPanel((prev) =>
        prev ? {
          ...prev,
          clase: {
            ...prev.clase,
            inscripciones: prev.clase.inscripciones.map((i) =>
              i.alumnoId === alumnoId ? { ...i, activo: false } : i,
            ),
          },
        } : null,
      );
      setToast(`${alumnoNombre} quitado de la clase`);
      setTimeout(() => setToast(''), 2500);
      await abrirModalCandidatos(
        `Plaza liberada — ${alumnoNombre} quitado de ${panel.clase.nombre}`,
        claseId,
        panel.fechaStr,
      );
    } catch {
      setToast('Error al quitar al alumno. Inténtalo de nuevo.');
      setTimeout(() => setToast(''), 3500);
    } finally {
      setQuitando((p) => ({ ...p, [alumnoId]: false }));
    }
  }, [panel]);

  const weeks = getCalendarWeeks(mes, año);
  const mesLabel = format(new Date(año, mes - 1), 'MMMM yyyy', { locale: es });

  const esHoy = (dia: number) =>
    dia === hoy.getDate() && mes === hoy.getMonth() + 1 && año === hoy.getFullYear();

  const isPast = (dia: number) => {
    const d = new Date(año, mes - 1, dia);
    d.setHours(23, 59, 59);
    return d < hoy;
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Calendario ── */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-black text-slate-800 capitalize">
              {vista === 'calendario' ? mesLabel : 'Listado de clases'}
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">{clases.length} clases activas · {vista === 'calendario' ? 'Haz clic en una clase para ver detalles' : 'Gestiona y elimina clases'}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle vista */}
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              <button
                onClick={() => setVista('calendario')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${
                  vista === 'calendario' ? 'bg-[#1e83ec] text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                <CalendarDays size={13} /> Calendario
              </button>
              <button
                onClick={() => setVista('listado')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors border-l border-slate-200 ${
                  vista === 'listado' ? 'bg-[#1e83ec] text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                <List size={13} /> Listado
              </button>
            </div>
            {vista === 'calendario' && (
              <>
                <button onClick={() => navMes(-1)} className="btn btn-secondary px-2 py-2">
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => { setMes(hoy.getMonth() + 1); setAño(hoy.getFullYear()); }}
                  className="btn btn-secondary text-xs"
                >
                  Hoy
                </button>
                <button onClick={() => navMes(1)} className="btn btn-secondary px-2 py-2">
                  <ChevronRight size={16} />
                </button>
              </>
            )}
            <button onClick={abrirModalNueva} className="btn btn-primary flex items-center gap-1.5 ml-2">
              <Plus size={15} /> Nueva clase
            </button>
          </div>
        </div>

        {/* ── Listado ── */}
        {vista === 'listado' && (
          <div className="card overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Clase</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Horario</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Profesor</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Nivel</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Plazas</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Fin</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[...clases].sort((a, b) => {
                  const dias = ['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO','DOMINGO'];
                  return dias.indexOf(a.diaSemana) - dias.indexOf(b.diaSemana) || a.horaInicio.localeCompare(b.horaInicio);
                }).map((c) => {
                  const pal = getProfPalette(c.profesorId, profesorIds);
                  const activos = c.inscripciones.filter((i) => i.activo).length;
                  const DIA_LABEL: Record<string, string> = { LUNES:'Lun', MARTES:'Mar', MIERCOLES:'Mié', JUEVES:'Jue', VIERNES:'Vie', SABADO:'Sáb', DOMINGO:'Dom' };
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: pal.dot }} />
                          <span className="font-semibold text-slate-800">{c.nombre}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        <span className="font-medium">{DIA_LABEL[c.diaSemana]}</span> · {c.horaInicio}–{c.horaFin}
                      </td>
                      <td className="px-3 py-3 text-slate-500 text-xs">
                        {c.profesor.nombre} {c.profesor.apellidos}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          <Trophy size={10} /> {c.nivelMin}–{c.nivelMax}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-xs font-semibold ${
                          activos >= c.plazasTotal ? 'text-red-500' : activos >= c.plazasTotal * 0.75 ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                          {activos}/{c.plazasTotal}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-400">
                        {c.fechaFin
                          ? <span className="text-amber-600 font-medium">{format(new Date(c.fechaFin), 'd MMM yy', { locale: es })}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => setConfirmarEliminarClase(c)}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                          title="Eliminar clase"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Leyenda profesores */}
        {vista === 'calendario' && (
        <div className="flex flex-wrap gap-2 mb-5">
          {[...new Map(clases.map((c) => [c.profesorId, c.profesor])).values()].map((prof) => {
            const pal = getProfPalette(prof.id, profesorIds);
            return (
              <span
                key={prof.id}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border"
                style={{ background: pal.bg, color: pal.text, borderColor: pal.border }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: pal.dot }} />
                {prof.nombre} {prof.apellidos}
              </span>
            );
          })}
        </div>
        )}

        {/* Calendario */}
        {vista === 'calendario' && (
        <div className="card overflow-hidden">
          {/* Cabecera días semana */}
          <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
            {DIAS_HEADER.map((d) => (
              <div key={d} className="py-2.5 text-center text-xs font-bold text-slate-400 uppercase tracking-wide">
                {d}
              </div>
            ))}
          </div>

          {/* Semanas */}
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-slate-50 last:border-b-0">
              {week.map((dia, ci) => {
                const dow = dayOfWeekForCell(ci);
                const clasesHoy = dia ? clasesDelDia(clases, dow, año, mes, dia) : [];
                const hoyFlag = dia ? esHoy(dia) : false;
                const past = dia ? isPast(dia) : false;

                return (
                  <div
                    key={ci}
                    className={`min-h-[96px] p-1.5 border-r border-slate-50 last:border-r-0 ${
                      !dia ? 'bg-slate-50/40' : hoyFlag ? 'bg-blue-50/40' : ''
                    }`}
                  >
                    {dia && (
                      <>
                        <div className="flex justify-end mb-1">
                          <span
                            className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                              past && !hoyFlag ? 'text-slate-300' : !hoyFlag ? 'text-slate-600' : ''
                            }`}
                            style={hoyFlag ? { background: '#1e83ec', color: '#fff' } : {}}
                          >
                            {dia}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          {clasesHoy.map((clase) => {
                            const pal = getProfPalette(clase.profesorId, profesorIds);
                            const activos = clase.inscripciones.filter((i) => i.activo).length;
                            const panelActive = panel?.clase.id === clase.id && panel?.dia === dia;
                            return (
                              <button
                                key={clase.id}
                                onClick={() => abrirPanel(clase, dia)}
                                className="w-full text-left rounded px-1.5 py-1 text-[11px] leading-tight transition-all border"
                                style={{
                                  background: panelActive ? pal.dot : pal.bg,
                                  color: panelActive ? '#fff' : pal.text,
                                  borderColor: panelActive ? pal.dot : pal.border,
                                  opacity: past && !hoyFlag ? 0.55 : 1,
                                }}
                              >
                                <p className="font-semibold truncate">{clase.horaInicio} {clase.nombre}</p>
                                <p className="opacity-80 truncate">
                                  {clase.profesor.nombre.split(' ')[0]} · {activos}/{clase.plazasTotal}
                                </p>
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
      </div>

      {/* ── Panel lateral ── */}
      {panel && (
        <div className="w-80 shrink-0 border-l border-slate-100 bg-white overflow-y-auto flex flex-col shadow-sm">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide mb-0.5 capitalize" style={{ color: '#1e83ec' }}>
                {format(new Date(panel.año, panel.mes - 1, panel.dia), "EEEE d 'de' MMMM", { locale: es })}
              </p>
              <h2 className="font-black text-slate-800 text-base leading-tight">{panel.clase.nombre}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {panel.clase.horaInicio}–{panel.clase.horaFin} · Pista {panel.clase.pista.numero}
              </p>
            </div>
            <button onClick={() => setPanel(null)} className="btn btn-ghost p-1 text-slate-400 shrink-0 ml-2">
              <X size={16} />
            </button>
          </div>

          {/* Profesor chip */}
          <div className="px-5 py-3 border-b border-slate-50">
            {(() => {
              const pal = getProfPalette(panel.clase.profesorId, profesorIds);
              return (
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0"
                    style={{ background: pal.bg, color: pal.text }}
                  >
                    {panel.clase.profesor.nombre[0]}{panel.clase.profesor.apellidos[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      {panel.clase.profesor.nombre} {panel.clase.profesor.apellidos}
                    </p>
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
                {panel.clase.inscripciones
                  .filter((i) => i.activo)
                  .map((insc) => {
                    const ya = registrado[insc.alumnoId];
                    const cargando = registrando[insc.alumnoId];
                    const esPasado = isPast(panel.dia);

                    return (
                      <div
                        key={insc.id}
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-colors ${
                          ya ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'
                        }`}
                      >
                        <div className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                          {insc.alumno.nombre[0]}{insc.alumno.apellidos[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-700 truncate">
                            {insc.alumno.nombre} {insc.alumno.apellidos}
                          </p>
                          <p className="text-xs text-slate-400">Niv. {insc.alumno.nivel.toFixed(1)}</p>
                        </div>
                        {ya ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 shrink-0">
                            <AlertCircle size={12} /> Falta
                          </span>
                        ) : esPasado ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-xs text-slate-300">Pasado</span>
                            <button
                              onClick={() => quitarDeClase(insc.alumnoId)}
                              disabled={quitando[insc.alumnoId]}
                              title="Quitar de la clase (baja permanente)"
                              className="p-1 rounded text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-40"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => notificarFalta(insc.alumnoId)}
                              disabled={cargando}
                              title="Registrar falta puntual — genera recuperación"
                              className="text-xs font-medium px-2 py-1 rounded-md border border-slate-200 bg-white text-slate-500 hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-40"
                            >
                              {cargando ? '...' : 'Falta'}
                            </button>
                            <button
                              onClick={() => quitarDeClase(insc.alumnoId)}
                              disabled={quitando[insc.alumnoId]}
                              title="Quitar de la clase (baja permanente)"
                              className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-400 hover:border-rose-300 hover:text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-40"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Info box */}
            <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-100">
              <div className="flex items-start gap-2">
                <Clock size={13} style={{ color: '#1e83ec' }} className="mt-0.5 shrink-0" />
                <p className="text-xs text-slate-500 leading-relaxed">
                  Notificar una falta <strong>libera la plaza</strong> y genera una recuperación pendiente para el alumno.
                </p>
              </div>
            </div>

            {/* Lista de espera */}
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                  <Clock size={12} /> Lista de espera
                  {panel.listaEspera && panel.listaEspera.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                      {panel.listaEspera.length}
                    </span>
                  )}
                </span>
                {(panel.listaEspera?.length ?? 0) > 0 && (
                  <button
                    onClick={() => setModalCanal({ count: panel.listaEspera?.length ?? 0, context: 'espera' })}
                    disabled={procesandoEspera === 'notificar'}
                    className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg text-white disabled:opacity-50"
                    style={{ background: '#1e83ec' }}
                  >
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
                        <span className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center text-[10px] font-black text-amber-900 shrink-0">
                          {entrada.posicion}
                        </span>
                        <span className="text-sm font-medium text-slate-700 flex-1 truncate">
                          {entrada.alumno.nombre} {entrada.alumno.apellidos}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {plazasLibres > 0 && (
                            <button
                              onClick={async () => {
                                setProcesandoEspera(entrada.id);
                                try {
                                  await listaEsperaApi.inscribir(entrada.id);
                                  const claseRefrescada = await clasesApi.get(panel.clase.id);
                                  const le = await listaEsperaApi.list(panel.clase.id);
                                  setClases((prev) => prev.map((c) => c.id === panel.clase.id ? claseRefrescada : c));
                                  setPanel((prev) => prev ? { ...prev, clase: claseRefrescada, listaEspera: le } : null);
                                  setToast('Alumno inscrito en la clase ✓');
                                  setTimeout(() => setToast(''), 3500);
                                } catch (e: any) {
                                  setToast(e.message ?? 'Error al inscribir');
                                  setTimeout(() => setToast(''), 3500);
                                }
                                setProcesandoEspera(null);
                              }}
                              disabled={!!procesandoEspera}
                              title="Inscribir en clase"
                              className="p-1 rounded text-emerald-600 hover:bg-emerald-100 disabled:opacity-40"
                            >
                              {procesandoEspera === entrada.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              setProcesandoEspera(entrada.id + '_del');
                              try {
                                await listaEsperaApi.remove(entrada.id);
                                const le = await listaEsperaApi.list(panel.clase.id);
                                setPanel((prev) => prev ? { ...prev, listaEspera: le } : null);
                              } catch {
                                setToast('Error al eliminar');
                                setTimeout(() => setToast(''), 3000);
                              }
                              setProcesandoEspera(null);
                            }}
                            disabled={!!procesandoEspera}
                            title="Quitar de lista"
                            className="p-1 rounded text-red-400 hover:bg-red-50 disabled:opacity-40"
                          >
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
                  <input
                    value={buscarEspera}
                    onChange={(e) => setBuscarEspera(e.target.value)}
                    placeholder="Buscar alumno..."
                    className="w-full pl-7 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                {buscarEspera.trim() && (() => {
                  const filtrados = todosAlumnos.filter((a) => {
                    const yaInscrito = panel.clase.inscripciones.some((i) => i.alumnoId === a.id && i.activo);
                    const yaEnEspera = panel.listaEspera?.some((e) => e.alumnoId === a.id);
                    if (yaInscrito || yaEnEspera) return false;
                    const q = buscarEspera.toLowerCase();
                    return `${a.nombre} ${a.apellidos}`.toLowerCase().includes(q);
                  }).slice(0, 5);
                  return filtrados.length > 0 ? (
                    <div className="mt-1 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                      {filtrados.map((a) => (
                        <button
                          key={a.id}
                          onClick={async () => {
                            setProcesandoEspera(a.id);
                            try {
                              await listaEsperaApi.add(a.id, panel.clase.id);
                              const le = await listaEsperaApi.list(panel.clase.id);
                              setPanel((prev) => prev ? { ...prev, listaEspera: le } : null);
                              setToast('Añadido a lista de espera');
                              setTimeout(() => setToast(''), 3000);
                              setBuscarEspera('');
                            } catch (ex: any) {
                              setToast(ex.message ?? 'Error');
                              setTimeout(() => setToast(''), 3000);
                            }
                            setProcesandoEspera(null);
                          }}
                          disabled={!!procesandoEspera}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center justify-between border-b border-slate-100 last:border-0 disabled:opacity-50"
                        >
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

      {/* ── Modal candidatos recuperación ── */}
      {modalCandidatos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <AlertTriangle size={16} className="text-amber-500" />
                  <h2 className="font-black text-slate-800 text-base">Hueco disponible</h2>
                </div>
                <p className="text-xs text-slate-500">{modalCandidatos.origen}</p>
              </div>
              <button onClick={() => setModalCandidatos(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 ml-3 shrink-0">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {!modalCandidatos.candidatos ? (
                <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">Buscando candidatos…</span>
                </div>
              ) : modalCandidatos.candidatos.compatibles.length === 0 && modalCandidatos.candidatos.otros.length === 0 ? (
                <div className="text-center py-10">
                  <CheckCircle size={32} className="text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No hay alumnos con recuperaciones pendientes.</p>
                </div>
              ) : (
                <>
                  {/* Compatibles por nivel */}
                  {modalCandidatos.candidatos.compatibles.length > 0 && (
                    <div className="mb-5">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                        Mismo nivel (Niv. {modalCandidatos.candidatos.clase.nivelMin}–{modalCandidatos.candidatos.clase.nivelMax})
                      </p>
                      <div className="space-y-2">
                        {modalCandidatos.candidatos.compatibles.map((c) => (
                          <label
                            key={c.alumnoId}
                            className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                              seleccionadosMod.has(c.alumnoId)
                                ? 'border-[#1e83ec] bg-blue-50'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={seleccionadosMod.has(c.alumnoId)}
                              onChange={() => toggleSelecMod(c.alumnoId)}
                              className="mt-0.5 accent-[#1e83ec]"
                            />
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

                  {/* Otros niveles — ordenados por distancia de nivel */}
                  {modalCandidatos.candidatos.otros.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">
                        Otros niveles <span className="normal-case font-normal">(pueden unirse si hay hueco)</span>
                      </p>
                      <div className="space-y-2">
                        {[...modalCandidatos.candidatos.otros]
                          .sort((a, b) => {
                            const mid = (modalCandidatos.candidatos!.clase.nivelMin + modalCandidatos.candidatos!.clase.nivelMax) / 2;
                            return Math.abs(a.nivel - mid) - Math.abs(b.nivel - mid);
                          })
                          .map((c) => (
                            <label
                              key={c.alumnoId}
                              className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                seleccionadosMod.has(c.alumnoId)
                                  ? 'border-slate-400 bg-slate-50'
                                  : 'border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={seleccionadosMod.has(c.alumnoId)}
                                onChange={() => toggleSelecMod(c.alumnoId)}
                                className="mt-0.5"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-slate-700 text-sm">{c.nombre} {c.apellidos}</p>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold">Niv. {c.nivel}</span>
                                </div>
                                <p className="text-xs text-slate-500">Faltó en: {c.claseOrigen}</p>
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
                onClick={() => setModalCandidatos(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-500 hover:bg-slate-50"
              >
                Saltar
              </button>
              <button
                onClick={notificarSeleccionadosMod}
                disabled={enviandoMod || seleccionadosMod.size === 0 || !modalCandidatos.candidatos}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: '#1e83ec' }}
              >
                {enviandoMod ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Notificar{seleccionadosMod.size > 0 ? ` (${seleccionadosMod.size})` : ''}
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
            if (modalCanal.context === 'candidatos') setModalCandidatos(null);
            setToast(`Notificados ${modalCanal.count} alumno(s) ✓`);
            setTimeout(() => setToast(''), 3500);
            setModalCanal(null);
          }}
          onClose={() => setModalCanal(null)}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold shadow-lg"
          style={{ background: '#1e83ec', color: '#fff' }}
        >
          <Check size={15} />
          {toast}
        </div>
      )}

      {/* ── Modal Nueva Clase ── */}
      {modalNueva && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-black text-slate-800">
                  {pasoNueva === 'form' ? 'Nueva clase' : 'Alumnos en lista de espera'}
                </h2>
                {pasoNueva === 'candidatos' && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {candidatosEspera.length} alumno{candidatosEspera.length !== 1 ? 's' : ''} sin clase compatibles con este horario y nivel
                  </p>
                )}
              </div>
              <button onClick={() => setModalNueva(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                <X size={16} />
              </button>
            </div>

            {pasoNueva === 'form' ? (
            <><div className="px-6 py-5 space-y-5">
              {/* Nombre */}
              <div>
                <label className="label">Nombre de la clase</label>
                <input
                  className="input"
                  placeholder="ej. Iniciación Mañana"
                  value={formClase.nombre}
                  onChange={(e) => setFormClase((f) => ({ ...f, nombre: e.target.value }))}
                />
              </div>

              {/* Niveles */}
              <div>
                <label className="label">Rango de nivel</label>
                <div className="flex items-center gap-3">
                  <select
                    className="input flex-1"
                    value={formClase.nivelMin}
                    onChange={(e) => setFormClase((f) => ({ ...f, nivelMin: parseFloat(e.target.value) }))}
                  >
                    {NIVELES.map((n) => <option key={n} value={n}>Niv. {n.toFixed(1)}</option>)}
                  </select>
                  <span className="text-slate-400 text-sm font-semibold shrink-0">hasta</span>
                  <select
                    className="input flex-1"
                    value={formClase.nivelMax}
                    onChange={(e) => setFormClase((f) => ({ ...f, nivelMax: parseFloat(e.target.value) }))}
                  >
                    {NIVELES.map((n) => <option key={n} value={n}>Niv. {n.toFixed(1)}</option>)}
                  </select>
                </div>
              </div>

              {/* Profesor */}
              <div>
                <label className="label">Profesor</label>
                <select
                  className="input"
                  value={formClase.profesorId}
                  onChange={(e) => setFormClase((f) => ({ ...f, profesorId: e.target.value }))}
                >
                  {profesores.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre} {p.apellidos}</option>
                  ))}
                </select>
              </div>

              {/* Pista */}
              <div>
                <label className="label">Pista</label>
                <select
                  className="input"
                  value={formClase.pistaId}
                  onChange={(e) => setFormClase((f) => ({ ...f, pistaId: e.target.value }))}
                >
                  {pistas.map((p) => (
                    <option key={p.id} value={p.id}>Pista {p.numero} — {p.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Días de la semana — multi selección */}
              <div>
                <label className="label">Días de la semana</label>
                <div className="flex gap-1.5 flex-wrap">
                  {DIAS_SEMANA.map((d) => {
                    const checked = formClase.diasSemana.includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => setFormClase((f) => ({
                          ...f,
                          diasSemana: checked
                            ? f.diasSemana.filter((x) => x !== d.value)
                            : [...f.diasSemana, d.value],
                        }))}
                        className="w-11 h-11 rounded-xl text-sm font-bold border-2 transition-all"
                        style={checked
                          ? { background: '#1e83ec', color: '#fff', borderColor: '#1e83ec' }
                          : { background: '#f8fafc', color: '#64748b', borderColor: '#e2e8f0' }}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
                {formClase.diasSemana.length > 1 && (
                  <p className="text-xs text-slate-400 mt-1.5">
                    Se crearán {formClase.diasSemana.length} clases independientes con el mismo horario.
                  </p>
                )}
              </div>

              {/* Recurrencia */}
              <div>
                <label className="label">Recurrencia</label>
                <div className="space-y-2">
                  {[
                    { value: 'permanente', label: 'Permanente', desc: 'Se repite todas las semanas indefinidamente' },
                    { value: 'este_mes', label: 'Solo este mes', desc: `Hasta el ${new Date(año, mes, 0).getDate()} de ${mesLabel}` },
                    { value: 'hasta_fecha', label: 'Hasta una fecha', desc: '' },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className="flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all"
                      style={formClase.recurrencia === opt.value
                        ? { borderColor: '#1e83ec', background: '#eff6ff' }
                        : { borderColor: '#e2e8f0', background: '#f8fafc' }}
                    >
                      <input
                        type="radio"
                        name="recurrencia"
                        value={opt.value}
                        checked={formClase.recurrencia === opt.value}
                        onChange={() => setFormClase((f) => ({ ...f, recurrencia: opt.value as any }))}
                        className="mt-0.5 accent-[#1e83ec]"
                      />
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{opt.label}</p>
                        {opt.desc && <p className="text-xs text-slate-400">{opt.desc}</p>}
                      </div>
                    </label>
                  ))}
                </div>
                {formClase.recurrencia === 'hasta_fecha' && (
                  <input
                    type="date"
                    className="input mt-2"
                    value={formClase.fechaFin}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setFormClase((f) => ({ ...f, fechaFin: e.target.value }))}
                  />
                )}
              </div>

              {/* Horario */}
              <div>
                <label className="label">Horario</label>
                <div className="flex items-center gap-3">
                  <input
                    type="time"
                    className="input flex-1"
                    value={formClase.horaInicio}
                    onChange={(e) => setFormClase((f) => ({ ...f, horaInicio: e.target.value }))}
                  />
                  <span className="text-slate-400 text-sm font-semibold shrink-0">a</span>
                  <input
                    type="time"
                    className="input flex-1"
                    value={formClase.horaFin}
                    onChange={(e) => setFormClase((f) => ({ ...f, horaFin: e.target.value }))}
                  />
                </div>
              </div>

              {/* Plazas */}
              <div>
                <label className="label">Plazas disponibles</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setFormClase((f) => ({ ...f, plazasTotal: Math.max(1, f.plazasTotal - 1) }))}
                    className="w-10 h-10 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-600 font-bold text-lg hover:border-slate-300"
                  >−</button>
                  <span className="text-2xl font-black text-slate-800 w-8 text-center">{formClase.plazasTotal}</span>
                  <button
                    type="button"
                    onClick={() => setFormClase((f) => ({ ...f, plazasTotal: Math.min(12, f.plazasTotal + 1) }))}
                    className="w-10 h-10 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-600 font-bold text-lg hover:border-slate-300"
                  >+</button>
                </div>
              </div>

              {/* Error */}
              {errorClase && (
                <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg border border-rose-100">
                  <AlertCircle size={14} /> {errorClase}
                </div>
              )}
            </div>

            {/* Footer paso 1 */}
            <div className="flex gap-2 px-6 py-4 border-t border-slate-100">
              <button
                onClick={guardarClase}
                disabled={guardandoClase}
                className="btn btn-primary flex items-center gap-2 flex-1 justify-center"
              >
                {guardandoClase ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                Crear clase
              </button>
              <button onClick={() => setModalNueva(false)} className="btn btn-secondary">
                Cancelar
              </button>
            </div>
            </>) : (
            <>
              {/* Paso 2 — candidatos de lista de espera */}
              <div className="px-6 py-5 space-y-2 max-h-[50vh] overflow-y-auto">
                {candidatosEspera.length === 0 ? (
                  <p className="text-sm text-slate-400 italic text-center py-4">No hay alumnos en lista de espera compatibles</p>
                ) : candidatosEspera.map((a) => {
                  const sel = selEspera.has(a.id);
                  return (
                    <label
                      key={a.id}
                      className="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all"
                      style={sel ? { borderColor: '#1e83ec', background: '#eff6ff' } : { borderColor: '#e2e8f0', background: '#f8fafc' }}
                    >
                      <input
                        type="checkbox"
                        checked={sel}
                        onChange={() => setSelEspera((prev) => {
                          const next = new Set(prev);
                          if (next.has(a.id)) next.delete(a.id); else next.add(a.id);
                          return next;
                        })}
                        className="w-4 h-4 accent-[#1e83ec]"
                      />
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-black text-blue-700 shrink-0">
                        {a.nombre[0]}{a.apellidos[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{a.nombre} {a.apellidos}</p>
                        <p className="text-xs text-slate-400">Niv. {a.nivel.toFixed(1)} · {a.disponibilidad === 'MANANA' ? 'Mañana' : a.disponibilidad === 'TARDE' ? 'Tarde' : 'Flexible'}</p>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Info plazas */}
              {clasesCreadas.length > 0 && selEspera.size > clasesCreadas[0].plazasTotal && (
                <div className="mx-6 mb-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
                  <AlertCircle size={13} />
                  Solo hay {clasesCreadas[0].plazasTotal} plaza{clasesCreadas[0].plazasTotal !== 1 ? 's' : ''}. Los primeros {clasesCreadas[0].plazasTotal} seleccionados serán inscritos; el resto irá a lista de espera.
                </div>
              )}

              {/* Footer paso 2 */}
              <div className="flex gap-2 px-6 py-4 border-t border-slate-100">
                <button
                  onClick={inscribirDesdeEspera}
                  disabled={inscribiendoEspera || selEspera.size === 0}
                  className="btn btn-primary flex items-center gap-2 flex-1 justify-center disabled:opacity-50"
                >
                  {inscribiendoEspera ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
                  {selEspera.size > 0 ? `Inscribir ${selEspera.size} alumno${selEspera.size !== 1 ? 's' : ''}` : 'Inscribir seleccionados'}
                </button>
                <button onClick={() => setModalNueva(false)} className="btn btn-secondary">
                  Saltar
                </button>
              </div>
            </>
            )}
          </div>
        </div>
      )}

      {/* ── Modal eliminar clase ── */}
      {confirmarEliminarClase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-rose-600" />
              </div>
              <div>
                <h3 className="font-black text-slate-800">Eliminar clase</h3>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">{confirmarEliminarClase.nombre}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-5">¿Hasta cuándo quieres eliminar esta clase?</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => eliminarClase('semana')}
                disabled={eliminandoClase}
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 hover:border-amber-300 hover:bg-amber-50 disabled:opacity-50 transition-colors text-left"
              >
                <span className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0 text-amber-700 text-xs font-black">1s</span>
                <div>
                  <p className="font-bold">Esta semana</p>
                  <p className="text-xs text-slate-400">La clase finaliza el próximo domingo</p>
                </div>
              </button>
              <button
                onClick={() => eliminarClase('mes')}
                disabled={eliminandoClase}
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50 transition-colors text-left"
              >
                <span className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-blue-700 text-xs font-black">1m</span>
                <div>
                  <p className="font-bold">Este mes</p>
                  <p className="text-xs text-slate-400">La clase finaliza el último día del mes</p>
                </div>
              </button>
              <button
                onClick={() => eliminarClase('definitiva')}
                disabled={eliminandoClase}
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-50 transition-colors text-left"
              >
                {eliminandoClase
                  ? <Loader2 size={14} className="animate-spin ml-1.5" />
                  : <span className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center shrink-0"><Trash2 size={13} className="text-rose-600" /></span>
                }
                <div>
                  <p className="font-bold">Definitivamente</p>
                  <p className="text-xs text-rose-400">Elimina la clase y todos sus datos</p>
                </div>
              </button>
            </div>
            <button
              onClick={() => setConfirmarEliminarClase(null)}
              className="mt-3 w-full py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-500 hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


