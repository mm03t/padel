'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Trash2, Mail, Phone, Trophy, Loader2, CheckCircle,
  CalendarDays, GraduationCap,
} from 'lucide-react';
import { alumnos as alumnosApi, clases as clasesApi } from '@/lib/api';
import type { Alumno, ClaseDisponible } from '@/types';

export default function ListaEsperaPage() {
  const [alumnosSinPlaza, setAlumnosSinPlaza] = useState<Alumno[]>([]);
  const [cargandoSinPlaza, setCargandoSinPlaza] = useState(true);
  const [asignandoId, setAsignandoId] = useState<string | null>(null);
  const [clasesParaAsignar, setClasesParaAsignar] = useState<ClaseDisponible[]>([]);
  const [cargandoClases, setCargandoClases] = useState(false);
  const [confirmarBorrarSP, setConfirmarBorrarSP] = useState<Alumno | null>(null);
  const [borrandoSP, setBorrandoSP] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const cargarSinPlaza = () => {
    setCargandoSinPlaza(true);
    alumnosApi.list({ activo: 'true', sinClase: 'true' })
      .then((data) =>
        setAlumnosSinPlaza([...data].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()))
      )
      .finally(() => setCargandoSinPlaza(false));
  };

  useEffect(() => { cargarSinPlaza(); }, []);

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

  const borrarAlumnoSinPlaza = async (a: Alumno) => {
    setBorrandoSP(true);
    try {
      await alumnosApi.purge(a.id);
      setAlumnosSinPlaza((prev) => prev.filter((x) => x.id !== a.id));
      setConfirmarBorrarSP(null);
      showToast(`${a.nombre} ${a.apellidos} eliminado permanentemente`);
    } catch {
      showToast('Error al eliminar el alumno');
    }
    setBorrandoSP(false);
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
        <div>
          <h1 className="text-xl font-bold text-slate-800">Lista de Espera</h1>
          <p className="text-sm text-slate-500 flex items-center gap-2">
            Alumnos sin plaza asignada
            {alumnosSinPlaza.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                {alumnosSinPlaza.length}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Lista sin plaza */}
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

                {/* Botones asignar + borrar */}
                {asignandoId !== a.id && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => iniciarAsignacion(a)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                      style={{ background: '#1e83ec' }}
                    >
                      <CheckCircle size={12} />
                      Asignar clase
                    </button>
                    <button
                      onClick={() => setConfirmarBorrarSP(a)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                      title="Eliminar permanentemente"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal confirmación borrar alumno sin plaza */}
      {confirmarBorrarSP && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-rose-600" />
              </div>
              <div>
                <h3 className="font-black text-slate-800">¿Eliminar alumno?</h3>
                <p className="text-xs text-slate-400 mt-0.5">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-5">
              Se eliminarán permanentemente todos los datos de{' '}
              <strong>{confirmarBorrarSP.nombre} {confirmarBorrarSP.apellidos}</strong>: historial, asistencias, recuperaciones y pagos.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => borrarAlumnoSinPlaza(confirmarBorrarSP)}
                disabled={borrandoSP}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 disabled:opacity-50"
              >
                {borrandoSP ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Eliminar
              </button>
              <button
                onClick={() => setConfirmarBorrarSP(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
