'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MessageCircle, Send, Users, RefreshCw, Check } from 'lucide-react';
import { notificaciones as api } from '@/lib/api';
import type { PlazaLibre, Alumno } from '@/types';
import UpgradeGate from '@/components/UpgradeGate';

export default function NotificacionesPage() {
  return (
    <UpgradeGate feature="notificaciones">
      <NotificacionesContent />
    </UpgradeGate>
  );
}

function NotificacionesContent() {
  const [plazas, setPlazas] = useState<PlazaLibre[] | null>(null);
  const [detectando, setDetectando] = useState(false);
  const [seleccionada, setSeleccionada] = useState<PlazaLibre | null>(null);
  const [alumnosSeleccionados, setAlumnosSeleccionados] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ enviadas: number; simulado: boolean; mensaje: string } | null>(null);

  const detectar = async () => {
    setDetectando(true);
    setPlazas(null);
    setSeleccionada(null);
    setResultado(null);
    try {
      const data = await api.detectarPlazas();
      setPlazas(data);
    } finally {
      setDetectando(false);
    }
  };

  const seleccionarPlaza = (p: PlazaLibre) => {
    setSeleccionada(p);
    setAlumnosSeleccionados(new Set(p.alumnosCompatibles.map((a) => a.id)));
    setResultado(null);
  };

  const toggleAlumno = (id: string) => {
    setAlumnosSeleccionados((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const enviar = async () => {
    if (!seleccionada) return;
    setEnviando(true);
    try {
      const res = await api.enviarLote(
        seleccionada.sesion.id,
        Array.from(alumnosSeleccionados),
      );
      setResultado(res);
    } finally {
      setEnviando(false);
    }
  };

  const mensajePreview = seleccionada
    ? `🎾 *Plaza libre disponible*

Clase: Nivel ${seleccionada.sesion.nivel}
📅 ${format(new Date(seleccionada.sesion.fecha), "EEEE d 'de' MMMM", { locale: es })}
⏰ ${seleccionada.sesion.horaInicio}
🏟️ Pista ${seleccionada.sesion.pista}

¿Quieres reservar esta plaza? Responde *SI* para confirmar.

_Academia de Pádel 🎾_`
    : '';

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-800">WhatsApp · Plazas libres</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Detecta plazas libres y avisa por WhatsApp solo a los alumnos compatibles
        </p>
      </div>

      {/* Cómo funciona */}
      <div className="card p-5 mb-6 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-100">
        <h3 className="font-bold text-emerald-800 mb-2 text-sm">¿Cómo funciona?</h3>
        <div className="grid grid-cols-4 gap-4 text-xs text-emerald-700">
          {[
            { n: '1', t: 'Detectar', d: 'El sistema busca sesiones con plazas libres' },
            { n: '2', t: 'Filtrar', d: 'Encuentra alumnos compatibles por nivel y horario' },
            { n: '3', t: 'Seleccionar', d: 'Elige a quién enviar el aviso' },
            { n: '4', t: 'Enviar', d: 'WhatsApp automático al instante' },
          ].map((s) => (
            <div key={s.n} className="flex items-start gap-2">
              <span className="w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold shrink-0">
                {s.n}
              </span>
              <div>
                <p className="font-semibold">{s.t}</p>
                <p className="text-emerald-600 mt-0.5">{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Botón detectar */}
      <div className="mb-6">
        <button onClick={detectar} disabled={detectando} className="btn btn-primary">
          <RefreshCw size={15} className={detectando ? 'animate-spin' : ''} />
          {detectando ? 'Detectando…' : 'Detectar plazas libres'}
        </button>
      </div>

      {plazas !== null && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Lista de sesiones con plazas */}
          <div>
            <h2 className="font-bold text-slate-700 mb-3">
              Sesiones con plazas libres ({plazas.length})
            </h2>
            {plazas.length === 0 ? (
              <div className="card p-8 text-center text-slate-400">
                <Check size={32} className="mx-auto mb-2 text-emerald-400" />
                <p className="text-sm">¡Todas las sesiones están completas!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {plazas.map((p) => (
                  <button
                    key={p.sesion.id}
                    onClick={() => seleccionarPlaza(p)}
                    className={`w-full text-left card p-4 transition-all ${
                      seleccionada?.sesion.id === p.sesion.id
                        ? 'border-emerald-400 ring-2 ring-emerald-100'
                        : 'hover:border-emerald-200'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-sm">{p.sesion.clase}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {format(new Date(p.sesion.fecha), "EEEE d MMM · HH:mm", { locale: es })} ·{' '}
                          Pista {p.sesion.pista}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Nivel {p.sesion.nivel} · {p.sesion.profesor}
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <span className="badge badge-yellow">
                          {p.plazasLibres} plaza{p.plazasLibres !== 1 ? 's' : ''} libre{p.plazasLibres !== 1 ? 's' : ''}
                        </span>
                        <p className="text-xs text-slate-400 mt-1">
                          <Users size={10} className="inline mr-0.5" />
                          {p.alumnosCompatibles.length} compatibles
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Panel derecho: alumnos + preview + enviar */}
          {seleccionada ? (
            <div className="space-y-4">
              {/* Alumnos compatibles */}
              <div className="card p-4">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                  <Users size={15} className="text-slate-400" />
                  Alumnos compatibles ({seleccionada.alumnosCompatibles.length})
                </h3>
                <p className="text-xs text-slate-400 mb-3">
                  Filtrados por: nivel {seleccionada.sesion.nivel} ± 0.5 y disponibilidad horaria
                </p>
                {seleccionada.alumnosCompatibles.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">
                    No hay alumnos compatibles disponibles.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {seleccionada.alumnosCompatibles.map((a: Alumno) => (
                      <label
                        key={a.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={alumnosSeleccionados.has(a.id)}
                          onChange={() => toggleAlumno(a.id)}
                          className="accent-emerald-500 w-4 h-4"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">{a.nombre} {a.apellidos}</span>
                          <span className="text-xs text-slate-400 ml-2">Niv. {a.nivel.toFixed(1)}</span>
                        </div>
                        <span className="text-xs text-slate-400">{a.telefono}</span>
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setAlumnosSeleccionados(new Set(seleccionada.alumnosCompatibles.map((a: Alumno) => a.id)))}
                    className="btn btn-ghost text-xs"
                  >
                    Seleccionar todos
                  </button>
                  <button
                    onClick={() => setAlumnosSeleccionados(new Set())}
                    className="btn btn-ghost text-xs text-slate-400"
                  >
                    Ninguno
                  </button>
                </div>
              </div>

              {/* Vista previa del mensaje */}
              <div className="card p-4">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                  <MessageCircle size={15} className="text-slate-400" />
                  Mensaje WhatsApp
                </h3>
                <div className="bg-slate-50 rounded-xl p-4 text-sm whitespace-pre-wrap text-slate-700 font-mono text-xs leading-relaxed">
                  {mensajePreview}
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  * En producción se envía vía Twilio. En modo demo se simula el envío.
                </p>
              </div>

              {/* Resultado envío */}
              {resultado && (
                <div className={`rounded-xl p-4 flex items-start gap-3 ${
                  resultado.simulado ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'
                }`}>
                  <Check size={18} className={resultado.simulado ? 'text-amber-600' : 'text-emerald-600'} />
                  <div>
                    <p className={`text-sm font-semibold ${resultado.simulado ? 'text-amber-800' : 'text-emerald-800'}`}>
                      {resultado.mensaje}
                    </p>
                    {resultado.simulado && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        Para envíos reales: configura TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN en el backend.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Botón enviar */}
              <button
                onClick={enviar}
                disabled={enviando || alumnosSeleccionados.size === 0}
                className="btn btn-primary w-full justify-center py-3 text-base"
              >
                {enviando ? (
                  'Enviando…'
                ) : (
                  <>
                    <Send size={16} />
                    Enviar WhatsApp a {alumnosSeleccionados.size} alumno(s)
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="card p-8 flex flex-col items-center justify-center text-center text-slate-400 border-dashed">
              <MessageCircle size={32} className="mb-3 opacity-20" />
              <p className="text-sm">Selecciona una sesión con plazas libres<br />para ver los alumnos compatibles</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
