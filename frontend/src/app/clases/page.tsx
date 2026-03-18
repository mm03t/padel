'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Search, Filter, Users, Trophy, Clock, Trash2, ChevronDown, ChevronUp,
  Plus, X, AlertCircle, CheckCircle, Loader2, UserPlus, Sun, Moon, Blend,
  Check, UserMinus,
} from 'lucide-react';
import {
  clases as clasesApi, alumnos as alumnosApi,
  profesores as profesoresApi, pistas as pistasApi,
} from '@/lib/api';
import type { Clase, DiaSemana, Profesor, Pista, Alumno } from '@/types';
import { usePlan } from '@/components/PlanContext';

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const DIA_LABEL: Record<string, string> = {
  LUNES: 'Lunes', MARTES: 'Martes', MIERCOLES: 'Miércoles',
  JUEVES: 'Jueves', VIERNES: 'Viernes', SABADO: 'Sábado', DOMINGO: 'Domingo',
};
const DIA_ORDEN = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
const NIVELES = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0];

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

function getTurno(hora: string): 'mañana' | 'tarde' {
  return parseInt(hora.split(':')[0], 10) < 14 ? 'mañana' : 'tarde';
}

/* ── Component ───────────────────────────────────────────────────────────── */

export default function ClasesPage() {
  const { plan } = usePlan();
  const [clases, setClases] = useState<Clase[]>([]);
  const [todosAlumnos, setTodosAlumnos] = useState<Alumno[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  // Filters
  const [busqueda, setBusqueda] = useState('');
  const [filtroProfesor, setFiltroProfesor] = useState('');
  const [filtroNivel, setFiltroNivel] = useState('');
  const [filtroTurno, setFiltroTurno] = useState<'' | 'mañana' | 'tarde'>('');

  // Expand
  const [expandido, setExpandido] = useState<Set<string>>(new Set());

  // Student management
  const [buscarAlumno, setBuscarAlumno] = useState<Record<string, string>>({});
  const [inscribiendo, setInscribiendo] = useState<Record<string, boolean>>({});
  const [quitandoAlumno, setQuitandoAlumno] = useState<Record<string, boolean>>({});
  const [confirmarQuitar, setConfirmarQuitar] = useState<{ claseId: string; alumnoId: string; nombre: string } | null>(null);

  // Delete modal
  const [confirmarEliminar, setConfirmarEliminar] = useState<Clase | null>(null);
  const [eliminando, setEliminando] = useState(false);

  // Nueva clase modal
  const DIAS_SEMANA: { value: DiaSemana; label: string }[] = [
    { value: 'LUNES', label: 'Lun' }, { value: 'MARTES', label: 'Mar' },
    { value: 'MIERCOLES', label: 'Mié' }, { value: 'JUEVES', label: 'Jue' },
    { value: 'VIERNES', label: 'Vie' }, { value: 'SABADO', label: 'Sáb' },
    { value: 'DOMINGO', label: 'Dom' },
  ];
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

  useEffect(() => {
    clasesApi.list({ activa: 'true' }).then(setClases).finally(() => setLoading(false));
    alumnosApi.list({ activo: 'true' }).then(setTodosAlumnos);
  }, []);

  const profesorIds = [...new Set(clases.map((c) => c.profesorId))];
  const profesoresUnicos = [...new Map(clases.map((c) => [c.profesorId, c.profesor])).values()];

  /* ── Filtered + sorted ── */
  const clasesFiltradas = clases.filter((c) => {
    if (busqueda) {
      const q = busqueda.toLowerCase();
      const matchNombre = c.nombre.toLowerCase().includes(q);
      const matchProf = `${c.profesor.nombre} ${c.profesor.apellidos}`.toLowerCase().includes(q);
      const matchAlumno = c.inscripciones.some((i) => i.activo && `${i.alumno.nombre} ${i.alumno.apellidos}`.toLowerCase().includes(q));
      if (!matchNombre && !matchProf && !matchAlumno) return false;
    }
    if (filtroProfesor && c.profesorId !== filtroProfesor) return false;
    if (filtroNivel) {
      const n = parseFloat(filtroNivel);
      if (n < c.nivelMin || n > c.nivelMax) return false;
    }
    if (filtroTurno && getTurno(c.horaInicio) !== filtroTurno) return false;
    return true;
  }).sort((a, b) => DIA_ORDEN.indexOf(a.diaSemana) - DIA_ORDEN.indexOf(b.diaSemana) || a.horaInicio.localeCompare(b.horaInicio));

  const hayFiltros = !!(busqueda || filtroProfesor || filtroNivel || filtroTurno);

  const toggleExpand = (id: string) => {
    setExpandido((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  /* ── Student management ── */
  const quitarAlumno = async (claseId: string, alumnoId: string) => {
    const key = `${claseId}_${alumnoId}`;
    setQuitandoAlumno((p) => ({ ...p, [key]: true }));
    try {
      await clasesApi.desinscribir(claseId, alumnoId);
      setClases((prev) =>
        prev.map((c) =>
          c.id !== claseId ? c : { ...c, inscripciones: c.inscripciones.map((i) => i.alumnoId === alumnoId ? { ...i, activo: false } : i) },
        ),
      );
      setToast('Alumno quitado de la clase ✓');
      setTimeout(() => setToast(''), 2500);
    } catch {
      setToast('Error al quitar al alumno');
      setTimeout(() => setToast(''), 3000);
    }
    setQuitandoAlumno((p) => ({ ...p, [key]: false }));
  };

  const inscribirAlumno = async (claseId: string, alumnoId: string) => {
    const key = `${claseId}_${alumnoId}`;
    setInscribiendo((p) => ({ ...p, [key]: true }));
    try {
      await clasesApi.inscribir(claseId, alumnoId);
      const updated = await clasesApi.get(claseId);
      setClases((prev) => prev.map((c) => c.id === claseId ? updated : c));
      setBuscarAlumno((p) => ({ ...p, [claseId]: '' }));
      setToast('Alumno inscrito en la clase ✓');
      setTimeout(() => setToast(''), 2500);
    } catch (e: any) {
      setToast(e.message ?? 'Error al inscribir');
      setTimeout(() => setToast(''), 3000);
    }
    setInscribiendo((p) => ({ ...p, [key]: false }));
  };

  /* ── Delete ── */
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
    if (!confirmarEliminar) return;
    setEliminando(true);
    try {
      if (tipo === 'definitiva') {
        await clasesApi.purge(confirmarEliminar.id);
        setClases((prev) => prev.filter((c) => c.id !== confirmarEliminar.id));
      } else {
        const fechaFin = tipo === 'semana' ? getFinSemana() : getFinMes();
        const updated = await clasesApi.update(confirmarEliminar.id, { fechaFin: fechaFin.toISOString() } as any);
        setClases((prev) => prev.map((c) => c.id === updated.id ? { ...c, fechaFin: updated.fechaFin } : c));
      }
      setConfirmarEliminar(null);
      const label = tipo === 'semana' ? 'hasta esta semana' : tipo === 'mes' ? 'hasta fin de mes' : 'definitivamente';
      setToast(`Clase eliminada ${label} ✓`);
      setTimeout(() => setToast(''), 3000);
    } catch {
      setToast('Error al eliminar la clase');
      setTimeout(() => setToast(''), 3000);
    }
    setEliminando(false);
  };

  /* ── Nueva clase ── */
  const hoy = new Date();
  const mesActual = hoy.getMonth() + 1;
  const añoActual = hoy.getFullYear();
  const mesLabel = format(new Date(añoActual, mesActual - 1), 'MMMM yyyy', { locale: es });

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
          ? new Date(añoActual, mesActual, 0).toISOString()
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

  if (loading) return <div className="p-8 flex items-center justify-center h-64"><div className="spinner" /></div>;

  const totalAlumnos = new Set(clases.flatMap((c) => c.inscripciones.filter((i) => i.activo).map((i) => i.alumnoId))).size;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Clases</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {clases.length} clases activas · {totalAlumnos} alumnos inscritos
          </p>
        </div>
        <button onClick={abrirModalNueva} className="btn btn-primary flex items-center gap-1.5">
          <Plus size={15} /> Nueva clase
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="card px-4 py-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Total clases</p>
          <p className="text-2xl font-black text-slate-800 mt-0.5">{clases.length}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1"><Sun size={11} /> Mañana</p>
          <p className="text-2xl font-black text-amber-600 mt-0.5">{clases.filter((c) => getTurno(c.horaInicio) === 'mañana').length}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1"><Moon size={11} /> Tarde</p>
          <p className="text-2xl font-black text-indigo-600 mt-0.5">{clases.filter((c) => getTurno(c.horaInicio) === 'tarde').length}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Profesores</p>
          <p className="text-2xl font-black text-emerald-600 mt-0.5">{profesoresUnicos.length}</p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="card px-4 py-3 mb-5 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar clase, profesor o alumno..."
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100" />
        </div>
        <select value={filtroProfesor} onChange={(e) => setFiltroProfesor(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100">
          <option value="">Todos los profesores</option>
          {profesoresUnicos.map((p) => <option key={p.id} value={p.id}>{p.nombre} {p.apellidos}</option>)}
        </select>
        <select value={filtroNivel} onChange={(e) => setFiltroNivel(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100">
          <option value="">Todos los niveles</option>
          {NIVELES.map((n) => <option key={n} value={n}>Nivel {n.toFixed(1)}</option>)}
        </select>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {[
            { value: '' as const, label: 'Todos', icon: Blend },
            { value: 'mañana' as const, label: 'Mañana', icon: Sun },
            { value: 'tarde' as const, label: 'Tarde', icon: Moon },
          ].map((t) => (
            <button key={t.value} onClick={() => setFiltroTurno(t.value)}
              className={`flex items-center gap-1 px-3 py-2 text-xs font-semibold transition-colors border-r border-slate-200 last:border-r-0 ${filtroTurno === t.value ? 'bg-[#1e83ec] text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
              <t.icon size={12} /> {t.label}
            </button>
          ))}
        </div>
        {hayFiltros && (
          <button onClick={() => { setBusqueda(''); setFiltroProfesor(''); setFiltroNivel(''); setFiltroTurno(''); }}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600 flex items-center gap-1">
            <X size={12} /> Limpiar
          </button>
        )}
      </div>

      {/* Resultados */}
      {clasesFiltradas.length === 0 ? (
        <div className="card px-6 py-12 text-center">
          <Filter size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No se encontraron clases</p>
          <p className="text-sm text-slate-400 mt-1">{hayFiltros ? 'Prueba con otros filtros' : 'Crea tu primera clase'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clasesFiltradas.map((c) => {
            const pal = getProfPalette(c.profesorId, profesorIds);
            const activos = c.inscripciones.filter((i) => i.activo);
            const abierto = expandido.has(c.id);
            const turno = getTurno(c.horaInicio);
            const plazasLibres = c.plazasTotal - activos.length;
            const searchText = buscarAlumno[c.id] ?? '';
            return (
              <div key={c.id} className="card overflow-hidden transition-shadow hover:shadow-md">
                {/* Row principal */}
                <div className="flex items-center gap-4 px-5 py-4 cursor-pointer" onClick={() => toggleExpand(c.id)}>
                  {/* Dot + Nombre */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: pal.bg, borderColor: pal.border }}>
                      <span className="text-sm font-black" style={{ color: pal.text }}>{c.nombre.slice(0, 2).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-800 text-sm truncate">{c.nombre}</h3>
                      <p className="text-xs text-slate-400">{DIA_LABEL[c.diaSemana]} · {c.horaInicio}–{c.horaFin}
                        {c.fechaFin && <span className="ml-1.5 text-amber-500">· Hasta {format(new Date(c.fechaFin), 'd MMM', { locale: es })}</span>}
                      </p>
                    </div>
                  </div>

                  {/* Turno badge */}
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${turno === 'mañana' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'}`}>
                    {turno === 'mañana' ? <Sun size={10} /> : <Moon size={10} />}
                    {turno === 'mañana' ? 'Mañana' : 'Tarde'}
                  </span>

                  {/* Profesor */}
                  <div className="flex items-center gap-2 shrink-0 w-36">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0" style={{ background: pal.bg, color: pal.text }}>
                      {c.profesor.nombre[0]}{c.profesor.apellidos[0]}
                    </div>
                    <span className="text-xs font-medium text-slate-600 truncate">{c.profesor.nombre} {c.profesor.apellidos}</span>
                  </div>

                  {/* Nivel */}
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 shrink-0">
                    <Trophy size={10} /> {c.nivelMin}–{c.nivelMax}
                  </span>

                  {/* Plazas */}
                  <div className="flex items-center gap-1.5 shrink-0 w-16 justify-center">
                    <Users size={13} className="text-slate-400" />
                    <span className={`text-sm font-bold ${activos.length >= c.plazasTotal ? 'text-rose-500' : activos.length >= c.plazasTotal * 0.75 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {activos.length}/{c.plazasTotal}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); setConfirmarEliminar(c); }} className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors" title="Eliminar">
                      <Trash2 size={14} />
                    </button>
                    {abierto ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-300" />}
                  </div>
                </div>

                {/* Expandido: gestión de alumnos */}
                {abierto && (
                  <div className="px-5 pb-5 pt-0 border-t border-slate-100">
                    <div className="flex items-center justify-between mt-3 mb-3">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                        Alumnos inscritos ({activos.length}/{c.plazasTotal})
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Clock size={11} />
                        <span>Pista {c.pista.numero} — {c.pista.nombre}</span>
                      </div>
                    </div>
                    {activos.length === 0 ? (
                      <p className="text-sm text-slate-400 italic py-2">Sin alumnos inscritos</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {activos.map((insc) => {
                          const key = `${c.id}_${insc.alumnoId}`;
                          const removiendo = quitandoAlumno[key];
                          return (
                            <div key={insc.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-100 group">
                              <div className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                                {insc.alumno.nombre[0]}{insc.alumno.apellidos[0]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-700 truncate">{insc.alumno.nombre} {insc.alumno.apellidos}</p>
                                <p className="text-xs text-slate-400">Niv. {insc.alumno.nivel.toFixed(1)}</p>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); setConfirmarQuitar({ claseId: c.id, alumnoId: insc.alumnoId, nombre: `${insc.alumno.nombre} ${insc.alumno.apellidos}` }); }}
                                disabled={removiendo}
                                title="Quitar de la clase"
                                className="p-1.5 rounded-md text-slate-300 opacity-0 group-hover:opacity-100 hover:text-rose-500 hover:bg-rose-50 transition-all disabled:opacity-40 shrink-0"
                              >
                                {removiendo ? <Loader2 size={13} className="animate-spin" /> : <UserMinus size={13} />}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {plazasLibres > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                          <UserPlus size={11} /> Añadir alumno ({plazasLibres} plaza{plazasLibres !== 1 ? 's' : ''} libre{plazasLibres !== 1 ? 's' : ''})
                        </p>
                        <div className="relative">
                          <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                          <input value={searchText} onChange={(e) => setBuscarAlumno((p) => ({ ...p, [c.id]: e.target.value }))}
                            onClick={(e) => e.stopPropagation()} placeholder="Buscar alumno por nombre..."
                            className="w-full pl-7 pr-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100" />
                        </div>
                        {searchText.trim() && (() => {
                          const yaInscritos = new Set(c.inscripciones.filter((i) => i.activo).map((i) => i.alumnoId));
                          const filtrados = todosAlumnos.filter((a) => {
                            if (yaInscritos.has(a.id)) return false;
                            return `${a.nombre} ${a.apellidos}`.toLowerCase().includes(searchText.toLowerCase());
                          }).slice(0, 6);
                          return filtrados.length > 0 ? (
                            <div className="mt-1 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                              {filtrados.map((a) => {
                                const key = `${c.id}_${a.id}`;
                                const adding = inscribiendo[key];
                                return (
                                  <button key={a.id} onClick={(e) => { e.stopPropagation(); inscribirAlumno(c.id, a.id); }} disabled={adding}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 flex items-center justify-between border-b border-slate-100 last:border-0 disabled:opacity-50">
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
                                        {a.nombre[0]}{a.apellidos[0]}
                                      </div>
                                      <span className="text-slate-700 font-medium">{a.nombre} {a.apellidos}</span>
                                      <span className="text-slate-400">Niv. {a.nivel.toFixed(1)}</span>
                                    </div>
                                    {adding ? <Loader2 size={12} className="animate-spin text-slate-400" /> : <UserPlus size={12} className="text-emerald-500" />}
                                  </button>
                                );
                              })}
                            </div>
                          ) : <p className="text-xs text-slate-400 mt-1 italic">Sin resultados</p>;
                        })()}
                      </div>
                    )}
                    {plazasLibres <= 0 && (
                      <p className="text-xs text-amber-600 font-medium mt-2 flex items-center gap-1">
                        <AlertCircle size={11} /> Clase completa — no hay plazas disponibles
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal Confirmar Quitar Alumno ── */}
      {confirmarQuitar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0"><UserMinus size={18} className="text-rose-500" /></div>
                <h2 className="font-black text-slate-800 text-base">Quitar de la clase</h2>
              </div>
              <p className="text-sm text-slate-500">¿Seguro que quieres quitar a <strong className="text-slate-700">{confirmarQuitar.nombre}</strong> de esta clase?</p>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setConfirmarQuitar(null)} className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-500 hover:bg-slate-50">Cancelar</button>
              <button onClick={() => { quitarAlumno(confirmarQuitar.claseId, confirmarQuitar.alumnoId); setConfirmarQuitar(null); }} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 transition-colors">Sí, quitar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Eliminar Clase ── */}
      {confirmarEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0"><Trash2 size={18} className="text-rose-500" /></div>
                <div>
                  <h2 className="font-black text-slate-800 text-base">Eliminar clase</h2>
                  <p className="text-xs text-slate-400">{confirmarEliminar.nombre} — {DIA_LABEL[confirmarEliminar.diaSemana]}</p>
                </div>
              </div>
              <p className="text-sm text-slate-500 mb-4">¿Hasta cuándo quieres eliminar esta clase?</p>
              <div className="space-y-2">
                <button onClick={() => eliminarClase('semana')} disabled={eliminando} className="w-full text-left px-4 py-3 rounded-xl border-2 border-slate-200 hover:border-amber-300 hover:bg-amber-50 transition-colors">
                  <p className="text-sm font-semibold text-slate-700">Hasta esta semana</p>
                  <p className="text-xs text-slate-400">Se mantiene hasta el domingo</p>
                </button>
                <button onClick={() => eliminarClase('mes')} disabled={eliminando} className="w-full text-left px-4 py-3 rounded-xl border-2 border-slate-200 hover:border-orange-300 hover:bg-orange-50 transition-colors">
                  <p className="text-sm font-semibold text-slate-700">Hasta fin de mes</p>
                  <p className="text-xs text-slate-400">Se mantiene hasta final de {mesLabel}</p>
                </button>
                <button onClick={() => eliminarClase('definitiva')} disabled={eliminando} className="w-full text-left px-4 py-3 rounded-xl border-2 border-rose-200 hover:border-rose-400 hover:bg-rose-50 transition-colors">
                  <p className="text-sm font-bold text-rose-600">Eliminar definitivamente</p>
                  <p className="text-xs text-slate-400">Se borra toda la información de la clase</p>
                </button>
              </div>
            </div>
            <div className="px-6 py-3 border-t border-slate-100 flex justify-end">
              <button onClick={() => setConfirmarEliminar(null)} disabled={eliminando} className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-500 hover:bg-slate-50">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

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
              <>
                <div className="px-6 py-5 space-y-5">
                  <div><label className="label">Nombre de la clase</label><input className="input" placeholder="ej. Iniciación Mañana" value={formClase.nombre} onChange={(e) => setFormClase((f) => ({ ...f, nombre: e.target.value }))} /></div>
                  <div><label className="label">Rango de nivel</label><div className="flex items-center gap-3"><select className="input flex-1" value={formClase.nivelMin} onChange={(e) => setFormClase((f) => ({ ...f, nivelMin: parseFloat(e.target.value) }))}>{NIVELES.map((n) => <option key={n} value={n}>Niv. {n.toFixed(1)}</option>)}</select><span className="text-slate-400 text-sm font-semibold shrink-0">hasta</span><select className="input flex-1" value={formClase.nivelMax} onChange={(e) => setFormClase((f) => ({ ...f, nivelMax: parseFloat(e.target.value) }))}>{NIVELES.map((n) => <option key={n} value={n}>Niv. {n.toFixed(1)}</option>)}</select></div></div>
                  <div><label className="label">Profesor</label><select className="input" value={formClase.profesorId} onChange={(e) => setFormClase((f) => ({ ...f, profesorId: e.target.value }))}>{profesores.map((p) => <option key={p.id} value={p.id}>{p.nombre} {p.apellidos}</option>)}</select></div>
                  <div><label className="label">Pista</label><select className="input" value={formClase.pistaId} onChange={(e) => setFormClase((f) => ({ ...f, pistaId: e.target.value }))}>{pistas.map((p) => <option key={p.id} value={p.id}>Pista {p.numero} — {p.nombre}</option>)}</select></div>
                  <div><label className="label">Días de la semana</label><div className="flex gap-1.5 flex-wrap">{DIAS_SEMANA.map((d) => { const checked = formClase.diasSemana.includes(d.value); return (<button key={d.value} type="button" onClick={() => setFormClase((f) => ({ ...f, diasSemana: checked ? f.diasSemana.filter((x) => x !== d.value) : [...f.diasSemana, d.value] }))} className="w-11 h-11 rounded-xl text-sm font-bold border-2 transition-all" style={checked ? { background: '#1e83ec', color: '#fff', borderColor: '#1e83ec' } : { background: '#f8fafc', color: '#64748b', borderColor: '#e2e8f0' }}>{d.label}</button>); })}</div></div>
                  <div><label className="label">Recurrencia</label><div className="space-y-2">{[{ value: 'permanente', label: 'Permanente', desc: 'Se repite todas las semanas' }, { value: 'este_mes', label: 'Solo este mes', desc: `Hasta el ${new Date(añoActual, mesActual, 0).getDate()} de ${mesLabel}` }, { value: 'hasta_fecha', label: 'Hasta una fecha', desc: '' }].map((opt) => (<label key={opt.value} className="flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all" style={formClase.recurrencia === opt.value ? { borderColor: '#1e83ec', background: '#eff6ff' } : { borderColor: '#e2e8f0', background: '#f8fafc' }}><input type="radio" name="recurrencia" value={opt.value} checked={formClase.recurrencia === opt.value} onChange={() => setFormClase((f) => ({ ...f, recurrencia: opt.value as any }))} className="mt-0.5 accent-[#1e83ec]" /><div><p className="text-sm font-semibold text-slate-700">{opt.label}</p>{opt.desc && <p className="text-xs text-slate-400">{opt.desc}</p>}</div></label>))}</div>{formClase.recurrencia === 'hasta_fecha' && <input type="date" className="input mt-2" value={formClase.fechaFin} min={new Date().toISOString().split('T')[0]} onChange={(e) => setFormClase((f) => ({ ...f, fechaFin: e.target.value }))} />}</div>
                  <div><label className="label">Horario</label><div className="flex items-center gap-3"><input type="time" className="input flex-1" value={formClase.horaInicio} onChange={(e) => setFormClase((f) => ({ ...f, horaInicio: e.target.value }))} /><span className="text-slate-400 text-sm font-semibold shrink-0">a</span><input type="time" className="input flex-1" value={formClase.horaFin} onChange={(e) => setFormClase((f) => ({ ...f, horaFin: e.target.value }))} /></div></div>
                  <div><label className="label">Plazas disponibles</label><div className="flex items-center gap-3"><button type="button" onClick={() => setFormClase((f) => ({ ...f, plazasTotal: Math.max(1, f.plazasTotal - 1) }))} className="w-10 h-10 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-600 font-bold text-lg hover:border-slate-300">−</button><span className="text-2xl font-black text-slate-800 w-8 text-center">{formClase.plazasTotal}</span><button type="button" onClick={() => setFormClase((f) => ({ ...f, plazasTotal: Math.min(12, f.plazasTotal + 1) }))} className="w-10 h-10 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-600 font-bold text-lg hover:border-slate-300">+</button></div></div>
                  {errorClase && <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg border border-rose-100"><AlertCircle size={14} /> {errorClase}</div>}
                </div>
                <div className="flex gap-2 px-6 py-4 border-t border-slate-100">
                  <button onClick={guardarClase} disabled={guardandoClase} className="btn btn-primary flex items-center gap-2 flex-1 justify-center">{guardandoClase ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}Crear clase</button>
                  <button onClick={() => setModalNueva(false)} className="btn btn-secondary">Cancelar</button>
                </div>
              </>
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

      {/* ── Toast ── */}
      {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold shadow-lg" style={{ background: '#1e83ec', color: '#fff' }}><Check size={15} />{toast}</div>}
    </div>
  );
}
