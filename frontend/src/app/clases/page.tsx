'use client';

import { useEffect, useState, useCallback } from 'react';
import { format, getDaysInMonth, startOfMonth, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, X, Users, AlertCircle, Check, Clock, Bell, UserPlus, CheckCircle, Loader2, UserMinus } from 'lucide-react';
import { clases as clasesApi, recuperaciones as recuperApi, listaEspera as listaEsperaApi, alumnos as alumnosApi } from '@/lib/api';
import type { Clase, DiaSemana, ListaEspera, Alumno } from '@/types';

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

function clasesDelDia(clases: Clase[], dayOfWeek: number): Clase[] {
  return clases.filter((c) => DIA_NUMERO[c.diaSemana] === dayOfWeek);
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
      setToast(`Falta registrada para ${alumno?.nombre ?? ''}. Recuperación generada.`);
      setTimeout(() => setToast(''), 4000);
    } catch {
      setToast('Error al registrar la falta. Inténtalo de nuevo.');
      setTimeout(() => setToast(''), 4000);
    } finally {
      setRegistrando((p) => ({ ...p, [alumnoId]: false }));
    }
  }, [panel]);

  // Quitar alumno de la clase y actualizar estado local inmediatamente
  const quitarDeClase = useCallback(async (alumnoId: string) => {
    if (!panel) return;
    if (!confirm('¿Quitar a este alumno de la clase? Se eliminará su inscripción.')) return;
    const claseId = panel.clase.id;
    setQuitando((p) => ({ ...p, [alumnoId]: true }));
    try {
      await clasesApi.desinscribir(claseId, alumnoId);
      // Actualizar el array global de clases
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
      // Actualizar también la clase dentro del panel
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
      const alumno = panel.clase.inscripciones.find((i) => i.alumnoId === alumnoId)?.alumno;
      setToast(`${alumno?.nombre ?? 'Alumno'} quitado de la clase.`);
      setTimeout(() => setToast(''), 3500);
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
            <h1 className="text-2xl font-black text-slate-800 capitalize">{mesLabel}</h1>
            <p className="text-sm text-slate-400 mt-0.5">{clases.length} clases activas · Haz clic en una clase para ver detalles</p>
          </div>
          <div className="flex items-center gap-2">
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
          </div>
        </div>

        {/* Leyenda profesores */}
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

        {/* Calendario */}
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
                const clasesHoy = dia ? clasesDelDia(clases, dow) : [];
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
                              title="Quitar de la clase"
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
                              className="text-xs font-medium px-2 py-1 rounded-md border border-slate-200 bg-white text-slate-500 hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-40"
                            >
                              {cargando ? '...' : 'Falta'}
                            </button>
                            <button
                              onClick={() => quitarDeClase(insc.alumnoId)}
                              disabled={quitando[insc.alumnoId]}
                              title="Quitar de la clase"
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
                    onClick={async () => {
                      setProcesandoEspera('notificar');
                      try {
                        const res = await listaEsperaApi.notificar(panel.clase.id);
                        setToast(`Notificados ${res.notificados} alumnos ✓`);
                        setTimeout(() => setToast(''), 3500);
                      } catch {
                        setToast('Error al notificar');
                        setTimeout(() => setToast(''), 3500);
                      }
                      setProcesandoEspera(null);
                    }}
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
    </div>
  );
}


