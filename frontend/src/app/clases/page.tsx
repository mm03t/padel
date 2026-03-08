'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays, Users, ArrowRight, ChevronRight } from 'lucide-react';
import { clases as api, sesiones as sesApi } from '@/lib/api';
import type { Clase, Sesion, DiaSemana } from '@/types';

const DIAS_ORDER: DiaSemana[] = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
const DIAS_LABEL: Record<DiaSemana, string> = {
  LUNES: 'Lunes', MARTES: 'Martes', MIERCOLES: 'Miércoles',
  JUEVES: 'Jueves', VIERNES: 'Viernes', SABADO: 'Sábado', DOMINGO: 'Domingo',
};
const NIVEL_COLOR = (min: number) =>
  min <= 1.5 ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
  : min <= 2.5 ? 'bg-blue-50 border-blue-200 text-blue-800'
  : 'bg-violet-50 border-violet-200 text-violet-800';

export default function ClasesPage() {
  const [clases, setClases] = useState<Clase[]>([]);
  const [proximas, setProximas] = useState<Sesion[]>([]);
  const [loading, setLoading] = useState(true);
  const [seleccionada, setSeleccionada] = useState<Clase | null>(null);

  useEffect(() => {
    Promise.all([
      api.list({ activa: 'true' }),
      sesApi.proximas(),
    ])
      .then(([c, s]) => { setClases(c); setProximas(s); })
      .finally(() => setLoading(false));
  }, []);

  const clasesPorDia = DIAS_ORDER.reduce<Record<string, Clase[]>>((acc, dia) => {
    acc[dia] = clases.filter((c) => c.diaSemana === dia);
    return acc;
  }, {} as Record<string, Clase[]>);

  const sesionesDeClase = (claseId: string) =>
    proximas.filter((s) => s.claseId === claseId);

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center h-64">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-800">Clases</h1>
        <p className="text-sm text-slate-500 mt-0.5">{clases.length} clases activas</p>
      </div>

      {/* Grid semanal */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
        {DIAS_ORDER.map((dia) => (
          <div key={dia}>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 text-center">
              {DIAS_LABEL[dia].slice(0, 3)}
            </p>
            <div className="space-y-2">
              {clasesPorDia[dia].length === 0 ? (
                <div className="h-14 rounded-lg border-2 border-dashed border-slate-100" />
              ) : (
                clasesPorDia[dia].map((clase) => (
                  <button
                    key={clase.id}
                    onClick={() => setSeleccionada(seleccionada?.id === clase.id ? null : clase)}
                    className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all ${NIVEL_COLOR(clase.nivelMin)} ${
                      seleccionada?.id === clase.id ? 'ring-2 ring-offset-1 ring-emerald-400' : 'hover:shadow-sm'
                    }`}
                  >
                    <p className="font-bold truncate">{clase.nombre}</p>
                    <p className="opacity-70">{clase.horaInicio}</p>
                    <p className="opacity-60 truncate">
                      {clase.inscripciones.filter((i) => i.activo).length}/{clase.plazasTotal} plazas
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Leyenda niveles */}
      <div className="flex flex-wrap gap-3 mb-8 text-xs">
        {[
          { label: 'Iniciación (1–1.5)', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
          { label: 'Intermedio (2–2.5)', color: 'bg-blue-50 border-blue-200 text-blue-800' },
          { label: 'Avanzado (3–3.5+)', color: 'bg-violet-50 border-violet-200 text-violet-800' },
        ].map((l) => (
          <span key={l.label} className={`px-3 py-1 rounded-full border font-medium ${l.color}`}>
            {l.label}
          </span>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Panel detalle clase seleccionada */}
        {seleccionada ? (
          <div className="card p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-black text-lg">{seleccionada.nombre}</h2>
                <p className="text-sm text-slate-500">
                  {DIAS_LABEL[seleccionada.diaSemana]} · {seleccionada.horaInicio}–{seleccionada.horaFin} ·{' '}
                  Pista {seleccionada.pista.numero}
                </p>
                <p className="text-sm text-slate-500">
                  Nivel {seleccionada.nivelMin}–{seleccionada.nivelMax} ·{' '}
                  {seleccionada.profesor.nombre} {seleccionada.profesor.apellidos}
                </p>
              </div>
              <button onClick={() => setSeleccionada(null)} className="btn btn-ghost text-slate-400 p-1">✕</button>
            </div>

            {/* Alumnos */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Users size={14} className="text-slate-400" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Alumnos ({seleccionada.inscripciones.filter((i) => i.activo).length}/{seleccionada.plazasTotal})
                </span>
              </div>
              <div className="space-y-1.5">
                {seleccionada.inscripciones
                  .filter((i) => i.activo)
                  .map((i) => (
                    <div key={i.id} className="flex items-center gap-2 text-sm">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                        {i.alumno.nombre[0]}
                      </div>
                      <span className="flex-1">{i.alumno.nombre} {i.alumno.apellidos}</span>
                      <span className="text-xs text-slate-400">Niv. {i.alumno.nivel.toFixed(1)}</span>
                    </div>
                  ))}
                {seleccionada.inscripciones.filter((i) => i.activo).length === 0 && (
                  <p className="text-sm text-slate-400 italic">Sin alumnos inscritos</p>
                )}
              </div>
            </div>

            {/* Próximas sesiones de esta clase */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays size={14} className="text-slate-400" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Próximas sesiones</span>
              </div>
              <div className="space-y-1.5">
                {sesionesDeClase(seleccionada.id).slice(0, 4).map((s) => (
                  <Link
                    key={s.id}
                    href={`/sesiones/${s.id}`}
                    className="flex items-center justify-between text-sm p-2 rounded-lg bg-slate-50 hover:bg-emerald-50 transition-colors group"
                  >
                    <span className="font-medium">
                      {format(new Date(s.fecha), "d 'de' MMMM", { locale: es })}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-400">{s.clase.horaInicio}</span>
                      <ChevronRight size={12} className="text-slate-300 group-hover:text-emerald-500" />
                    </div>
                  </Link>
                ))}
                {sesionesDeClase(seleccionada.id).length === 0 && (
                  <p className="text-sm text-slate-400 italic">No hay sesiones próximas</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="card p-8 flex flex-col items-center justify-center text-center text-slate-400 border-dashed">
            <CalendarDays size={32} className="mb-3 opacity-30" />
            <p className="text-sm">Selecciona una clase del horario<br />para ver sus detalles</p>
          </div>
        )}

        {/* Todas las sesiones próximas */}
        <div className="card">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-700">Sesiones esta semana</h2>
          </div>
          <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
            {proximas.slice(0, 10).map((s) => (
              <Link
                key={s.id}
                href={`/sesiones/${s.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors group"
              >
                <div className="shrink-0 w-10 h-10 bg-slate-100 rounded-lg flex flex-col items-center justify-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    {DIAS_LABEL[s.clase.diaSemana].slice(0, 3)}
                  </span>
                  <span className="text-base font-black text-slate-700">
                    {format(new Date(s.fecha), 'd')}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{s.clase.nombre}</p>
                  <p className="text-xs text-slate-400">
                    {s.clase.horaInicio} · Pista {s.clase.pista.numero}
                  </p>
                </div>
                <ArrowRight size={14} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
              </Link>
            ))}
            {proximas.length === 0 && (
              <p className="px-5 py-4 text-sm text-slate-400">No hay sesiones programadas.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
