'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, CheckCircle2, XCircle, RefreshCw, Save, AlertTriangle, CheckCircle } from 'lucide-react';
import { sesiones as api } from '@/lib/api';
import type { Sesion, EstadoAsistencia } from '@/types';

const ESTADOS: { key: EstadoAsistencia; label: string; icon: any; color: string; active: string }[] = [
  {
    key: 'PRESENTE',
    label: 'Presente',
    icon: CheckCircle2,
    color: 'border-slate-200 text-slate-500 hover:border-emerald-300 hover:bg-emerald-50',
    active: 'border-emerald-500 bg-emerald-50 text-emerald-700',
  },
  {
    key: 'FALTA',
    label: 'Falta',
    icon: XCircle,
    color: 'border-slate-200 text-slate-500 hover:border-rose-300 hover:bg-rose-50',
    active: 'border-rose-500 bg-rose-50 text-rose-700',
  },
  {
    key: 'RECUPERACION',
    label: 'Recuperación',
    icon: RefreshCw,
    color: 'border-slate-200 text-slate-500 hover:border-amber-300 hover:bg-amber-50',
    active: 'border-amber-500 bg-amber-50 text-amber-700',
  },
];

export default function SesionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [estados, setEstados] = useState<Record<string, EstadoAsistencia>>({});
  const [saving, setSaving] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; recuperacionesGeneradas: number; mensaje: string } | null>(null);

  useEffect(() => {
    api.get(id)
      .then((s) => {
        setSesion(s);
        // Inicializar estados: asistencia ya registrada o PRESENTE por defecto
        const init: Record<string, EstadoAsistencia> = {};
        s.clase.inscripciones.forEach((i) => {
          const asist = s.asistencias.find((a) => a.alumnoId === i.alumnoId);
          init[i.alumnoId] = asist ? asist.estado : 'PRESENTE';
        });
        setEstados(init);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const setEstado = (alumnoId: string, estado: EstadoAsistencia) =>
    setEstados((prev) => ({ ...prev, [alumnoId]: estado }));

  const guardar = async () => {
    if (!sesion) return;
    setSaving(true);
    try {
      const asistencias = Object.entries(estados).map(([alumnoId, estado]) => ({ alumnoId, estado }));
      const res = await api.marcarAsistencia(id, asistencias);
      setResultado(res);
      // Recargar sesión para reflejar estado COMPLETADA
      const updated = await api.get(id);
      setSesion(updated);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><div className="spinner" /></div>;
  if (error) return <div className="p-8 card text-rose-600 border-rose-200 bg-rose-50 p-6">{error}</div>;
  if (!sesion) return null;

  const alumnos = sesion.clase.inscripciones.filter((i) => i.activo);
  const yaCompletada = sesion.estado === 'COMPLETADA';
  const faltas = Object.values(estados).filter((e) => e === 'FALTA').length;

  return (
    <div className="p-8 max-w-2xl">
      {/* Back */}
      <button onClick={() => router.back()} className="btn btn-ghost mb-5 -ml-1 text-slate-500">
        <ArrowLeft size={15} /> Volver
      </button>

      {/* Header sesión */}
      <div className="card p-5 mb-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-800">{sesion.clase.nombre}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {format(new Date(sesion.fecha), "EEEE d 'de' MMMM · HH:mm", { locale: es })}
            </p>
            <p className="text-sm text-slate-500">
              Pista {sesion.clase.pista.numero} ·{' '}
              {sesion.clase.profesor.nombre} {sesion.clase.profesor.apellidos}
            </p>
            <p className="text-sm text-slate-500">
              Nivel {sesion.clase.nivelMin}–{sesion.clase.nivelMax}
            </p>
          </div>
          <div>
            <span className={`badge ${
              yaCompletada ? 'badge-green' :
              sesion.estado === 'EN_CURSO' ? 'badge-yellow' : 'badge-gray'
            }`}>
              {yaCompletada ? <span className="flex items-center gap-1"><CheckCircle size={11} /> Completada</span> : sesion.estado}
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          {alumnos.length} alumnos inscritos
        </p>
      </div>

      {/* Resultado guardado */}
      {resultado && (
        <div className={`rounded-xl p-4 mb-5 flex items-start gap-3 ${
          resultado.recuperacionesGeneradas > 0
            ? 'bg-amber-50 border border-amber-200'
            : 'bg-emerald-50 border border-emerald-200'
        }`}>
          <CheckCircle2 size={18} className={resultado.recuperacionesGeneradas > 0 ? 'text-amber-600' : 'text-emerald-600'} />
          <div>
            <p className={`text-sm font-semibold ${resultado.recuperacionesGeneradas > 0 ? 'text-amber-800' : 'text-emerald-800'}`}>
              {resultado.mensaje}
            </p>
            {resultado.recuperacionesGeneradas > 0 && (
              <p className="text-xs text-amber-600 mt-0.5">
                Las recuperaciones aparecen en la sección "Recuperaciones" automáticamente.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Lista de alumnos con botones de asistencia */}
      <div className="card overflow-hidden mb-5">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex justify-between text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <span>Alumno</span>
          <span>Asistencia</span>
        </div>
        <div className="divide-y divide-slate-50">
          {alumnos.map(({ alumno }) => (
            <div key={alumno.id} className="flex items-center justify-between px-5 py-3.5 gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-sm font-bold text-slate-600">
                  {alumno.nombre[0]}{alumno.apellidos[0]}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{alumno.nombre} {alumno.apellidos}</p>
                  <p className="text-xs text-slate-400">Niv. {alumno.nivel.toFixed(1)}</p>
                </div>
              </div>

              {/* Botones estado */}
              <div className="flex gap-1.5 shrink-0">
                {ESTADOS.map(({ key, label, icon: Icon, color, active }) => {
                  const isActive = estados[alumno.id] === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setEstado(alumno.id, key)}
                      disabled={yaCompletada}
                      title={label}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                        isActive ? active : color
                      } ${yaCompletada ? 'opacity-60 cursor-default' : ''}`}
                    >
                      <Icon size={13} />
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Resumen + botón guardar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">
          {faltas > 0 ? (
            <span className="text-amber-600 font-semibold flex items-center gap-1.5">
              <AlertTriangle size={14} /> {faltas} falta(s) — se generarán {faltas} recuperación(es)
            </span>
          ) : (
            <span className="text-emerald-600 font-medium flex items-center gap-1.5"><CheckCircle size={14} /> Sin faltas</span>
          )}
        </div>
        <button
          onClick={guardar}
          disabled={saving || yaCompletada}
          className={`btn ${yaCompletada ? 'btn-secondary' : 'btn-primary'}`}
        >
          {saving ? (
            'Guardando…'
          ) : yaCompletada ? (
            <span className="flex items-center gap-1"><CheckCircle size={14} /> Asistencia guardada</span>
          ) : (
            <><Save size={15} /> Guardar asistencia</>
          )}
        </button>
      </div>
    </div>
  );
}
