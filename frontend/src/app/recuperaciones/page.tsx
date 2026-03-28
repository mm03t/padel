'use client';

import { useEffect, useState } from 'react';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { RotateCcw, X, Calendar, Users, MessageCircle, CheckCircle2 } from 'lucide-react';
import { recuperaciones as api } from '@/lib/api';
import type { Recuperacion, Sesion, EstadoRecuperacion, ClaseParaRecuperar } from '@/types';
import UpgradeGate from '@/components/UpgradeGate';

const ESTADO_BADGE: Record<EstadoRecuperacion, string> = {
  PENDIENTE:   'badge-yellow',
  RESERVADA:   'badge-blue',
  CONFIRMADA:  'badge-sky',
  COMPLETADA:  'badge-green',
  VENCIDA:     'badge-gray',
  CANCELADA:   'badge-red',
};
const ESTADO_LABEL: Record<EstadoRecuperacion, string> = {
  PENDIENTE:  'Pendiente',
  RESERVADA:  'Reservada',
  CONFIRMADA: 'Confirmada ✅',
  COMPLETADA: 'Completada',
  VENCIDA:    'Vencida',
  CANCELADA:  'Cancelada',
};

const DIAS_ORDER = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
const DIA_LABEL: Record<string, string> = {
  LUNES: 'Lun', MARTES: 'Mar', MIERCOLES: 'Mié',
  JUEVES: 'Jue', VIERNES: 'Vie', SABADO: 'Sáb', DOMINGO: 'Dom',
};

function diasRestantes(fecha: string) {
  const diff = differenceInDays(new Date(fecha), new Date());
  if (diff < 0) return <span className="text-xs text-rose-500 font-semibold">Vencida</span>;
  if (diff === 0) return <span className="text-xs text-rose-500 font-semibold">Vence hoy</span>;
  if (diff <= 7) return <span className="text-xs text-amber-600 font-semibold">{diff}d restantes</span>;
  return <span className="text-xs text-slate-400">{diff}d restantes</span>;
}

export default function RecuperacionesPage() {
  return (
    <UpgradeGate feature="recuperaciones">
      <RecuperacionesContent />
    </UpgradeGate>
  );
}

function RecuperacionesContent() {
  const [tab, setTab] = useState<'recuperaciones' | 'disponibles'>('recuperaciones');

  // ── tab recuperaciones ─────────────────────────────────────────────────────
  const [lista, setLista] = useState<Recuperacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<EstadoRecuperacion | ''>('PENDIENTE');
  const [modalRecup, setModalRecup] = useState<Recuperacion | null>(null);
  const [sesionesDisp, setSesionesDisp] = useState<Sesion[]>([]);
  const [loadingDisp, setLoadingDisp] = useState(false);
  const [asignando, setAsignando] = useState(false);
  const [exito, setExito] = useState('');

  // ── tab clases disponibles ────────────────────────────────────────────────
  const [clasesDisp, setClasesDisp] = useState<ClaseParaRecuperar[]>([]);
  const [loadingClases, setLoadingClases] = useState(false);
  const [filtroDia, setFiltroDia] = useState<string>('');
  const [asignandoCandidato, setAsignandoCandidato] = useState<string | null>(null);

  // ── modal de confirmación ───────────────────────────────────────────────
  const [confirm, setConfirm] = useState<{
    titulo: string;
    alumno: string;
    clase: string;
    telefono?: string;
    onConfirm: () => void;
  } | null>(null);

  const cargar = () => {
    setLoading(true);
    api.list(filtro ? { estado: filtro } : {})
      .then(setLista)
      .finally(() => setLoading(false));
  };

  const cargarClasesDisp = () => {
    setLoadingClases(true);
    api.clasesDisponibles()
      .then(setClasesDisp)
      .finally(() => setLoadingClases(false));
  };

  useEffect(() => { cargar(); }, [filtro]);
  useEffect(() => { if (tab === 'disponibles') cargarClasesDisp(); }, [tab]);

  const abrirAsignar = async (r: Recuperacion) => {
    setModalRecup(r);
    setLoadingDisp(true);
    const sesiones = await api.sesionesDisponibles(r.id);
    setSesionesDisp(sesiones);
    setLoadingDisp(false);
  };

  const reservar = async (sesionId: string) => {
    if (!modalRecup) return;
    const s = sesionesDisp.find((x) => x.id === sesionId);
    setConfirm({
      titulo: 'Confirmar recuperación',
      alumno: `${modalRecup.alumno.nombre} ${modalRecup.alumno.apellidos}`,
      clase: s ? `${s.clase.nombre} · ${format(new Date(s.fecha), "EEEE d 'de' MMMM · HH:mm", { locale: es })}` : 'Clase asignada',
      telefono: modalRecup.alumno.telefono ?? undefined,
      onConfirm: async () => {
        setConfirm(null);
        setAsignando(true);
        const res = await api.reservar(modalRecup.id, sesionId) as any;
        if (res?.notificacion?.enviada) {
          setExito('¡Recuperación reservada! WhatsApp enviado al alumno.');
        } else if (res?.notificacion?.error) {
          setExito(`¡Recuperación reservada! No se pudo enviar WhatsApp: ${res.notificacion.error}`);
        } else {
          setExito('¡Recuperación reservada! El alumno puede acudir a la sesión.');
        }
        setModalRecup(null);
        cargar();
        if (tab === 'disponibles') cargarClasesDisp();
        setAsignando(false);
        setTimeout(() => setExito(''), 4000);
      },
    });
  };

  const cancelar = async (id: string) => {
    if (!confirm('¿Cancelar esta recuperación?')) return;
    await api.cancelar(id);
    cargar();
  };

  const asignarDesdeClase = (recuperacionId: string, claseId: string, claseNombre: string, alumnoNombre: string, telefono?: string) => {
    setConfirm({
      titulo: 'Confirmar recuperación',
      alumno: alumnoNombre,
      clase: claseNombre,
      telefono,
      onConfirm: async () => {
        setConfirm(null);
        setAsignandoCandidato(recuperacionId);
        try {
          const res = await api.reservarDesdeClase(recuperacionId, claseId) as any;
          if (res?.notificacion?.enviada) {
            setExito('¡Recuperación asignada! WhatsApp enviado al alumno.');
          } else {
            setExito('¡Recuperación asignada! El alumno puede acudir a la clase.');
          }
          cargar();
          cargarClasesDisp();
          setTimeout(() => setExito(''), 4000);
        } finally {
          setAsignandoCandidato(null);
        }
      },
    });
  };

  const pendientes = lista.filter((r) => r.estado === 'PENDIENTE').length;
  const vencenPronto = lista.filter(
    (r) => r.estado === 'PENDIENTE' && differenceInDays(new Date(r.expiraEn), new Date()) <= 7,
  ).length;

  // Clases disponibles filtradas
  const clasesFiltradas = clasesDisp
    .filter((c) => !filtroDia || c.diaSemana === filtroDia)
    .sort((a, b) => DIAS_ORDER.indexOf(a.diaSemana) - DIAS_ORDER.indexOf(b.diaSemana) || a.horaInicio.localeCompare(b.horaInicio));

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-800">Recuperaciones</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gestión de faltas y recuperaciones de clase</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1 w-fit">
        {([
          ['recuperaciones', 'Recuperaciones', RotateCcw],
          ['disponibles', 'Clases disponibles', Calendar],
        ] as [string, string, any][]).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={14} />
            {label}
            {key === 'recuperaciones' && pendientes > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-amber-900">
                {pendientes}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: Recuperaciones ─────────────────────────────────────────────── */}
      {tab === 'recuperaciones' && (
        <>
          {/* Stats */}
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
              <button key={v} onClick={() => setFiltro(v as any)} className={`btn ${filtro === v ? 'btn-primary' : 'btn-secondary'}`}>
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
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
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
                        <p className="text-xs text-slate-400">{format(new Date(r.sesionOrigen.fecha), "d MMM", { locale: es })}</p>
                      </td>
                      <td className="px-3 py-3.5">
                        {r.sesionRecuperacion ? (
                          <div>
                            <p className="text-sm font-medium text-blue-700">{r.sesionRecuperacion.clase.nombre}</p>
                            <p className="text-xs text-slate-400">{format(new Date(r.sesionRecuperacion.fecha), "d MMM · HH:mm", { locale: es })}</p>
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
                        <span className={`badge ${ESTADO_BADGE[r.estado]}`}>{ESTADO_LABEL[r.estado]}</span>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex gap-1 justify-end">
                          {r.estado === 'PENDIENTE' && (
                            <button onClick={() => abrirAsignar(r)} className="btn btn-secondary text-xs px-3 py-1.5">
                              Asignar clase
                            </button>
                          )}
                          {(r.estado === 'PENDIENTE' || r.estado === 'RESERVADA') && (
                            <button onClick={() => cancelar(r.id)} className="btn btn-ghost p-2 text-slate-400" title="Cancelar">
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
            </div>
          )}
        </>
      )}

      {/* ── TAB: Clases disponibles ──────────────────────────────────────────── */}
      {tab === 'disponibles' && (
        <>
          <div className="flex flex-wrap gap-2 mb-5 items-center">
            <p className="text-sm text-slate-500 mr-1">Día:</p>
            <button
              onClick={() => setFiltroDia('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${filtroDia === '' ? 'border-[#1e83ec] bg-blue-50 text-[#1e83ec]' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
            >
              Todos
            </button>
            {DIAS_ORDER.slice(0, 5).map((d) => (
              <button
                key={d}
                onClick={() => setFiltroDia(filtroDia === d ? '' : d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${filtroDia === d ? 'border-[#1e83ec] bg-blue-50 text-[#1e83ec]' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
              >
                {DIA_LABEL[d]}
              </button>
            ))}
          </div>

          {loadingClases ? (
            <div className="flex justify-center py-12"><div className="spinner" /></div>
          ) : clasesFiltradas.length === 0 ? (
            <div className="card p-12 text-center text-slate-400">
              <Calendar size={32} className="mx-auto mb-3 opacity-20" />
              No hay clases con plazas libres.
            </div>
          ) : (
            <div className="space-y-6">
              {DIAS_ORDER.filter((d) => clasesFiltradas.some((c) => c.diaSemana === d)).map((dia) => (
                <div key={dia}>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">
                    {dia.charAt(0) + dia.slice(1).toLowerCase()}
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {clasesFiltradas.filter((c) => c.diaSemana === dia).map((c) => (
                      <div key={c.id} className="card p-4">
                        {/* Cabecera clase */}
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-bold text-slate-800">{c.nombre}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {c.horaInicio} – {c.horaFin} · Pista {c.pista?.numero} · Niv. {c.nivelMin}–{c.nivelMax}
                            </p>
                            <p className="text-xs text-slate-400">{c.profesor?.nombre} {c.profesor?.apellidos}</p>
                          </div>
                          <span className={`shrink-0 ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${c.plazasLibres === 1 ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                            {c.plazasLibres} libre{c.plazasLibres > 1 ? 's' : ''}
                          </span>
                        </div>

                        {/* Barra de ocupación */}
                        <div className="flex items-center gap-1 mb-3">
                          {Array.from({ length: c.plazasTotal }).map((_, i) => (
                            <span
                              key={i}
                              className={`inline-block h-1.5 rounded-full flex-1 ${i < (c.plazasTotal - c.plazasLibres) ? 'bg-slate-200' : 'bg-emerald-400'}`}
                            />
                          ))}
                        </div>

                        {/* Candidatos para recuperar */}
                        {c.candidatos.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic">Sin alumnos pendientes compatibles</p>
                        ) : (
                          <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                              <Users size={10} />
                              {c.candidatos.length} alumno{c.candidatos.length > 1 ? 's' : ''} puede{c.candidatos.length > 1 ? 'n' : ''} recuperar aquí
                            </p>
                            <div className="space-y-1.5">
                              {c.candidatos.map((cand) => (
                                <div key={cand.alumnoId} className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                  <div>
                                    <p className="text-xs font-semibold text-slate-800">
                                      {cand.nombre} {cand.apellidos}
                                    </p>
                                    <p className="text-[10px] text-slate-500">
                                      Niv. {cand.nivel.toFixed(1)}
                                      {cand.totalPendientes > 1 && (
                                        <span className="ml-1.5 text-amber-700 font-semibold">
                                          · {cand.totalPendientes} pendientes
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => asignarDesdeClase(cand.recuperacionId, c.id, c.nombre, `${cand.nombre} ${cand.apellidos}`, cand.telefono)}
                                    disabled={asignandoCandidato === cand.recuperacionId}
                                    className="shrink-0 ml-2 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-sky-600 hover:bg-sky-700 text-white transition-colors disabled:opacity-50"
                                  >
                                    {asignandoCandidato === cand.recuperacionId ? '...' : 'Asignar'}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
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
                    className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-sky-300 hover:bg-sky-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold">{s.clase.nombre}</p>
                        <p className="text-sm text-slate-500">
                          {format(new Date(s.fecha), "EEEE d 'de' MMMM · HH:mm", { locale: es })}
                        </p>
                        <p className="text-xs text-slate-400">
                          Pista {s.clase.pista.numero} · {s.clase.profesor.nombre} {s.clase.profesor.apellidos} · Nivel {s.clase.nivelMin}–{s.clase.nivelMax}
                        </p>
                      </div>
                      <span className="badge badge-green text-xs shrink-0 ml-2">Plaza libre</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Modal de confirmación */}
      {confirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="card w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
                <CheckCircle2 size={20} className="text-sky-600" />
              </div>
              <div>
                <h3 className="font-black text-slate-800 text-base leading-tight">{confirm.titulo}</h3>
                <p className="text-sm text-slate-500 mt-0.5">Revisa los datos antes de confirmar</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400 font-medium">Alumno</span>
                <span className="font-bold text-slate-800">{confirm.alumno}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400 font-medium">Clase</span>
                <span className="font-bold text-slate-800 text-right max-w-[60%]">{confirm.clase}</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 bg-green-50 border border-green-100 rounded-xl px-4 py-3 mb-6">
              <MessageCircle size={15} className="text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-green-800">Se enviará un WhatsApp al alumno</p>
                {confirm.telefono ? (
                  <p className="text-[11px] text-green-700 mt-0.5">Al número {confirm.telefono} con los detalles de la recuperación</p>
                ) : (
                  <p className="text-[11px] text-amber-700 mt-0.5 font-semibold">⚠️ El alumno no tiene teléfono registrado — no se enviará mensaje</p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 btn btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={confirm.onConfirm}
                className="flex-1 btn btn-primary"
              >
                Confirmar asignación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

