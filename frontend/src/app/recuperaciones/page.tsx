'use client';

import { useEffect, useState } from 'react';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { RotateCcw, X } from 'lucide-react';
import { recuperaciones as api } from '@/lib/api';
import type { Recuperacion, Sesion, EstadoRecuperacion } from '@/types';

const ESTADO_BADGE: Record<EstadoRecuperacion, string> = {
  PENDIENTE: 'badge-yellow',
  RESERVADA: 'badge-blue',
  COMPLETADA: 'badge-green',
  VENCIDA: 'badge-gray',
  CANCELADA: 'badge-red',
};
const ESTADO_LABEL: Record<EstadoRecuperacion, string> = {
  PENDIENTE: 'Pendiente', RESERVADA: 'Reservada',
  COMPLETADA: 'Completada', VENCIDA: 'Vencida', CANCELADA: 'Cancelada',
};

function diasRestantes(fecha: string) {
  const diff = differenceInDays(new Date(fecha), new Date());
  if (diff < 0) return <span className="text-xs text-rose-500 font-semibold">Vencida</span>;
  if (diff === 0) return <span className="text-xs text-rose-500 font-semibold">Vence hoy</span>;
  if (diff <= 7) return <span className="text-xs text-amber-600 font-semibold">{diff}d restantes</span>;
  return <span className="text-xs text-slate-400">{diff}d restantes</span>;
}

export default function RecuperacionesPage() {
  const [lista, setLista] = useState<Recuperacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<EstadoRecuperacion | ''>('PENDIENTE');
  const [modalRecup, setModalRecup] = useState<Recuperacion | null>(null);
  const [sesionesDisp, setSesionesDisp] = useState<Sesion[]>([]);
  const [loadingDisp, setLoadingDisp] = useState(false);
  const [asignando, setAsignando] = useState(false);
  const [exito, setExito] = useState('');

  const cargar = () => {
    setLoading(true);
    api.list(filtro ? { estado: filtro } : {})
      .then(setLista)
      .finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, [filtro]);

  const abrirAsignar = async (r: Recuperacion) => {
    setModalRecup(r);
    setLoadingDisp(true);
    const sesiones = await api.sesionesDisponibles(r.id);
    setSesionesDisp(sesiones);
    setLoadingDisp(false);
  };

  const reservar = async (sesionId: string) => {
    if (!modalRecup) return;
    setAsignando(true);
    await api.reservar(modalRecup.id, sesionId);
    setExito('¡Recuperación reservada! El alumno puede acudir a la sesión.');
    setModalRecup(null);
    cargar();
    setAsignando(false);
    setTimeout(() => setExito(''), 4000);
  };

  const cancelar = async (id: string) => {
    if (!confirm('¿Cancelar esta recuperación?')) return;
    await api.cancelar(id);
    cargar();
  };

  const pendientes = lista.filter((r) => r.estado === 'PENDIENTE').length;
  const vencenPronto = lista.filter(
    (r) => r.estado === 'PENDIENTE' && differenceInDays(new Date(r.expiraEn), new Date()) <= 7,
  ).length;

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-800">Recuperaciones</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Gestión de faltas y recuperaciones de clase
        </p>
      </div>

      {/* Stats rápidos */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Pendientes', value: pendientes, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Vencen pronto', value: vencenPronto, color: 'text-rose-600', bg: 'bg-rose-50' },
          { label: 'Total', value: lista.length, color: 'text-slate-600', bg: 'bg-slate-50' },
        ].map((s) => (
          <div key={s.label} className={`card p-4 ${s.bg} border-0`}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{s.label}</p>
            <p className={`text-3xl font-black mt-0.5 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {exito && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
          ✓ {exito}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-5">
        {([['', 'Todas'], ['PENDIENTE', 'Pendientes'], ['RESERVADA', 'Reservadas'], ['COMPLETADA', 'Completadas'], ['CANCELADA', 'Canceladas']] as [string, string][]).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFiltro(v as any)}
            className={`btn ${filtro === v ? 'btn-primary' : 'btn-secondary'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner" /></div>
      ) : lista.length === 0 ? (
        <div className="card p-12 text-center text-slate-400">
          <RotateCcw size={32} className="mx-auto mb-3 opacity-20" />
          No hay recuperaciones con este filtro.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Alumno</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Clase origen</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Recupera en</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Expira</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Estado</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {lista.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-semibold">{r.alumno.nombre} {r.alumno.apellidos}</p>
                    <p className="text-xs text-slate-400">Niv. {r.alumno.nivel.toFixed(1)}</p>
                  </td>
                  <td className="px-3 py-3.5">
                    <p className="font-medium">{r.sesionOrigen.clase.nombre}</p>
                    <p className="text-xs text-slate-400">
                      {format(new Date(r.sesionOrigen.fecha), "d MMM", { locale: es })}
                    </p>
                  </td>
                  <td className="px-3 py-3.5">
                    {r.sesionRecuperacion ? (
                      <div>
                        <p className="text-sm font-medium text-blue-700">{r.sesionRecuperacion.clase.nombre}</p>
                        <p className="text-xs text-slate-400">
                          {format(new Date(r.sesionRecuperacion.fecha), "d MMM · HH:mm", { locale: es })}
                        </p>
                      </div>
                    ) : (
                      <span className="text-slate-300 text-xs">Sin asignar</span>
                    )}
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="text-xs">{format(new Date(r.expiraEn), "d MMM", { locale: es })}</div>
                    {diasRestantes(r.expiraEn)}
                  </td>
                  <td className="px-3 py-3.5">
                    <span className={`badge ${ESTADO_BADGE[r.estado]}`}>
                      {ESTADO_LABEL[r.estado]}
                    </span>
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="flex gap-1 justify-end">
                      {r.estado === 'PENDIENTE' && (
                        <button
                          onClick={() => abrirAsignar(r)}
                          className="btn btn-secondary text-xs px-3 py-1.5"
                        >
                          Asignar clase
                        </button>
                      )}
                      {(r.estado === 'PENDIENTE' || r.estado === 'RESERVADA') && (
                        <button
                          onClick={() => cancelar(r.id)}
                          className="btn btn-ghost p-2 text-slate-400"
                          title="Cancelar"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal asignar sesión */}
      {modalRecup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-black">Asignar clase de recuperación</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {modalRecup.alumno.nombre} {modalRecup.alumno.apellidos} — Niv. {modalRecup.alumno.nivel.toFixed(1)}
                </p>
              </div>
              <button onClick={() => setModalRecup(null)} className="btn btn-ghost p-1 text-slate-400">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4 bg-slate-50 px-3 py-2 rounded-lg">
              Clases compatibles con nivel {modalRecup.alumno.nivel.toFixed(1)} ± 0.5 con plazas disponibles:
            </p>

            {loadingDisp ? (
              <div className="flex justify-center py-6"><div className="spinner" /></div>
            ) : sesionesDisp.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">
                No hay sesiones con plazas disponibles para el nivel de este alumno.
              </p>
            ) : (
              <div className="space-y-2">
                {sesionesDisp.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => reservar(s.id)}
                    disabled={asignando}
                    className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold">{s.clase.nombre}</p>
                        <p className="text-sm text-slate-500">
                          {format(new Date(s.fecha), "EEEE d 'de' MMMM · HH:mm", { locale: es })}
                        </p>
                        <p className="text-xs text-slate-400">
                          Pista {s.clase.pista.numero} ·{' '}
                          {s.clase.profesor.nombre} {s.clase.profesor.apellidos} ·{' '}
                          Nivel {s.clase.nivelMin}–{s.clase.nivelMax}
                        </p>
                      </div>
                      <span className="badge badge-green text-xs shrink-0 ml-2">
                        Plaza libre
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
