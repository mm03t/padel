'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { UserPlus, Search, Pencil, Power, CheckCircle, Clock, Zap, ChevronUp, ChevronDown } from 'lucide-react';
import { alumnos as api } from '@/lib/api';
import type { Alumno, Disponibilidad, ClaseDisponible } from '@/types';

const NIVELES = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0];
const DISPONIBILIDAD_LABEL: Record<Disponibilidad, string> = {
  MANANA: 'Mañana', TARDE: 'Tarde', FLEXIBLE: 'Flexible',
};
const DISPONIBILIDAD_BADGE: Record<Disponibilidad, string> = {
  MANANA: 'badge-blue', TARDE: 'badge-purple', FLEXIBLE: 'badge-green',
};

function NivelBadge({ nivel }: { nivel: number }) {
  const color = nivel <= 1.5 ? 'badge-green' : nivel <= 2.5 ? 'badge-yellow' : nivel <= 3.5 ? 'badge-red' : 'badge-purple';
  return <span className={`badge ${color}`}>Niv. {nivel.toFixed(1)}</span>;
}

const EMPTY: Partial<Alumno> = {
  nombre: '', apellidos: '', email: '', telefono: '',
  nivel: 1.0, disponibilidad: 'FLEXIBLE', notas: '',
};

export default function AlumnosPage() {
  const [lista, setLista] = useState<Alumno[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filtroActivo, setFiltroActivo] = useState(true);
  const [sortCol, setSortCol] = useState<'alumno' | 'nivel' | 'disponibilidad' | 'clase' | 'recuperaciones'>('alumno');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [modal, setModal] = useState<{ open: boolean; data: Partial<Alumno>; editId?: string }>({
    open: false, data: EMPTY,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [clasesDisponibles, setClasesDisponibles] = useState<ClaseDisponible[]>([]);
  const [claseSeleccionada, setClaseSeleccionada] = useState<string>('auto');
  const [loadingClases, setLoadingClases] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean; detail?: string } | null>(null);

  const showToast = (msg: string, ok = true, detail?: string) => {
    setToast({ msg, ok, detail });
    setTimeout(() => setToast(null), 6000);
  };

  const cargar = () => {
    setLoading(true);
    const params: Record<string, string> = { activo: String(filtroActivo) };
    if (search) params.search = search;
    api.list(params)
      .then(setLista)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const listaSorted = [...lista].sort((a, b) => {
    let va: string | number = '';
    let vb: string | number = '';
    if (sortCol === 'alumno') { va = `${a.apellidos} ${a.nombre}`.toLowerCase(); vb = `${b.apellidos} ${b.nombre}`.toLowerCase(); }
    else if (sortCol === 'nivel') { va = a.nivel; vb = b.nivel; }
    else if (sortCol === 'disponibilidad') { va = a.disponibilidad; vb = b.disponibilidad; }
    else if (sortCol === 'clase') {
      va = (a.inscripciones?.filter((i) => i.activo).map((i) => i.clase.nombre).join('') ?? '').toLowerCase();
      vb = (b.inscripciones?.filter((i) => i.activo).map((i) => i.clase.nombre).join('') ?? '').toLowerCase();
    }
    else if (sortCol === 'recuperaciones') { va = a._count?.recuperaciones ?? 0; vb = b._count?.recuperaciones ?? 0; }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // Separar alumnos con clase de los que están en espera
  const listaConClase = listaSorted.filter((a) => !a.activo || a.inscripciones?.some((i) => i.activo));
  const sinClaseCount = filtroActivo ? listaSorted.filter((a) => a.activo && !a.inscripciones?.some((i) => i.activo)).length : 0;

  const abrirNuevo = () => {
    setModal({ open: true, data: { ...EMPTY } });
    setClaseSeleccionada('auto');
    cargarClasesDisponibles(EMPTY.nivel ?? 1.0);
  };
  const abrirEditar = (a: Alumno) => {
    setModal({ open: true, data: { ...a }, editId: a.id });
    setClasesDisponibles([]);
  };
  const cerrar = () => { setModal({ open: false, data: EMPTY }); setSaveError(''); setClasesDisponibles([]); setClaseSeleccionada('auto'); };

  const cargarClasesDisponibles = (nivel: number) => {
    setLoadingClases(true);
    api.clasesDisponibles(nivel)
      .then(setClasesDisponibles)
      .catch(() => setClasesDisponibles([]))
      .finally(() => setLoadingClases(false));
  };

  const campoNivel = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseFloat(e.target.value);
    setModal((m) => ({ ...m, data: { ...m.data, nivel: val } }));
    if (!modal.editId) {
      setClaseSeleccionada('auto');
      cargarClasesDisponibles(val);
    }
  };

  const guardar = async () => {
    setSaving(true); setSaveError('');
    try {
      if (modal.editId) {
        await api.update(modal.editId, modal.data);
        cerrar(); cargar();
      } else {
        const res = await api.create({ ...modal.data, ...(claseSeleccionada !== 'auto' ? { claseId: claseSeleccionada } : {}) });
        cerrar(); cargar();
        if (res.enEspera) {
          showToast('Alumno creado · Sin plaza disponible', false, 'Añadido a lista de espera');
        } else if (res.asignacion) {
          const a = res.asignacion;
          showToast(`Alumno creado · Asignado a ${a.nombre}`, true, `Pista ${a.pista} · ${a.dia} ${a.hora}`);
        } else {
          showToast('Alumno creado', true);
        }
      }
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActivo = async (a: Alumno) => {
    if (a.activo) {
      const res = await api.remove(a.id);
      cargar();
      if (res.asignados?.length > 0) {
        showToast(
          `${a.nombre} desactivado · ${res.plazasLiberadas} plaza(s) liberada(s)`,
          true,
          `${res.asignados.length} alumno(s) asignado(s) desde lista de espera`,
        );
      } else {
        showToast(`${a.nombre} desactivado`, true, `${res.plazasLiberadas} plaza(s) liberada(s)`);
      }
    } else {
      await api.update(a.id, { activo: true });
      cargar();
    }
  };

  const campo = (key: keyof Alumno) => (e: any) =>
    setModal((m) => ({ ...m, data: { ...m.data, [key]: e.target.value } }));

  return (
    <div className="p-8 max-w-6xl">
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-50 flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm max-w-sm animate-in fade-in slide-in-from-top-2"
          style={{ background: toast.ok ? '#1e83ec' : '#f59e0b' }}
        >
          {toast.ok ? <CheckCircle size={16} className="mt-0.5 shrink-0" /> : <Clock size={16} className="mt-0.5 shrink-0" />}
          <div>
            <p className="font-semibold leading-tight">{toast.msg}</p>
            {toast.detail && <p className="text-xs mt-0.5 opacity-90">{toast.detail}</p>}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Alumnos</h1>
          <p className="text-sm text-slate-500 mt-0.5">{lista.length} alumno(s) encontrado(s)</p>
        </div>
        <button onClick={abrirNuevo} className="btn btn-primary">
          <UserPlus size={16} /> Nuevo alumno
        </button>
      </div>

      {/* Filtros */}
      <div className="card px-4 py-3 mb-5 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-52">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Buscar por nombre o email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {([true, false] as const).map((v) => (
            <button
              key={String(v)}
              onClick={() => setFiltroActivo(v)}
              className={`btn ${filtroActivo === v ? 'btn-primary' : 'btn-secondary'}`}
            >
              {v ? 'Activos' : 'Inactivos'}
            </button>
          ))}
        </div>
      </div>

      {/* Callout sin clase */}
      {sinClaseCount > 0 && (
        <Link
          href="/lista-espera"
          className="flex items-center justify-between gap-3 mb-4 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-amber-600 shrink-0" />
            <p className="text-sm font-semibold text-amber-800">
              {sinClaseCount} alumno{sinClaseCount > 1 ? 's' : ''} sin clase asignada — en cola de espera
            </p>
          </div>
          <span className="text-xs font-semibold text-amber-600 underline">Ver lista de espera →</span>
        </Link>
      )}

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="spinner" /></div>
      ) : error ? (
        <div className="card p-6 text-rose-600 border-rose-200 bg-rose-50">{error}</div>
      ) : listaConClase.length === 0 ? (
        <div className="card p-12 text-center text-slate-400">No hay alumnos. ¡Crea el primero!</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {([
                  ['alumno',         'Alumno',        'px-5'],
                  ['nivel',          'Nivel',         'px-3'],
                  ['disponibilidad', 'Disponibilidad','px-3'],
                  ['clase',          'Clase',         'px-3'],
                  ['recuperaciones', 'Recup. pend.',  'px-3'],
                ] as const).map(([col, label, pad]) => (
                  <th
                    key={col}
                    onClick={() => toggleSort(col)}
                    className={`text-left ${pad} py-3 font-semibold text-slate-500 text-xs uppercase cursor-pointer select-none hover:text-slate-700 transition-colors`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {label}
                      {sortCol === col
                        ? sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
                        : <ChevronDown size={11} className="opacity-20" />}
                    </span>
                  </th>
                ))}
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {listaConClase.map((a) => {
                const clasesActivas = a.inscripciones?.filter((i) => i.activo) ?? [];
                const sinClase = clasesActivas.length === 0 && a.activo;
                return (
                  <tr key={a.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-800">{a.nombre} {a.apellidos}</p>
                      <p className="text-xs text-slate-400">{a.email} · {a.telefono}</p>
                    </td>
                    <td className="px-3 py-3.5"><NivelBadge nivel={a.nivel} /></td>
                    <td className="px-3 py-3.5">
                      <span className={`badge ${DISPONIBILIDAD_BADGE[a.disponibilidad]}`}>
                        {DISPONIBILIDAD_LABEL[a.disponibilidad]}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-slate-500 text-xs">
                      {sinClase
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">
                            <Clock size={10} /> Lista de espera
                          </span>
                        : clasesActivas.length > 0
                          ? clasesActivas.map((i) => i.clase.nombre).join(', ')
                          : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-3.5">
                      {a._count && a._count.recuperaciones > 0
                        ? <span className="badge badge-yellow">{a._count.recuperaciones}</span>
                        : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => abrirEditar(a)} className="btn btn-ghost p-2" title="Editar">
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => toggleActivo(a)}
                          className={`btn btn-ghost p-2 ${a.activo ? 'text-slate-400' : 'text-emerald-500'}`}
                          title={a.activo ? 'Desactivar' : 'Activar'}
                        >
                          <Power size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-black mb-5">
              {modal.editId ? 'Editar alumno' : 'Nuevo alumno'}
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Nombre</label>
                <input className="input" value={modal.data.nombre || ''} onChange={campo('nombre')} />
              </div>
              <div>
                <label className="label">Apellidos</label>
                <input className="input" value={modal.data.apellidos || ''} onChange={campo('apellidos')} />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={modal.data.email || ''} onChange={campo('email')} />
              </div>
              <div>
                <label className="label">Teléfono</label>
                <input className="input" value={modal.data.telefono || ''} onChange={campo('telefono')} />
              </div>
              <div>
                <label className="label">Nivel</label>
                <select className="input" value={modal.data.nivel || 1.0} onChange={campoNivel}>
                  {NIVELES.map((n) => (
                    <option key={n} value={n}>{n.toFixed(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Disponibilidad</label>
                <select className="input" value={modal.data.disponibilidad || 'FLEXIBLE'} onChange={campo('disponibilidad')}>
                  <option value="MANANA">Mañana</option>
                  <option value="TARDE">Tarde</option>
                  <option value="FLEXIBLE">Flexible</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Notas (opcional)</label>
                <textarea className="input h-20 resize-none" value={modal.data.notas || ''} onChange={campo('notas')} />
              </div>

              {!modal.editId && (
                <div className="col-span-2">
                  <label className="label flex items-center gap-2">
                    Clase
                    {loadingClases && <span className="spinner" style={{ width: 12, height: 12 }} />}
                  </label>

                  {/* Opción: auto */}
                  <button
                    type="button"
                    onClick={() => setClaseSeleccionada('auto')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm mb-3 transition-all ${
                      claseSeleccionada === 'auto'
                        ? 'border-[#1e83ec] bg-blue-50 text-[#1e83ec] font-semibold'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <Zap size={15} className="shrink-0" />
                    <span>Asignar automáticamente</span>
                    <span className="ml-auto text-xs opacity-60">El sistema elige la mejor plaza</span>
                  </button>

                  {loadingClases && (
                    <div className="text-xs text-slate-400 text-center py-2">Cargando clases compatibles…</div>
                  )}

                  {!loadingClases && clasesDisponibles.length === 0 && (
                    <div className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                      Sin clases compatibles con este nivel — el alumno irá a lista de espera general
                    </div>
                  )}

                  {/* Clases con plaza libre */}
                  {clasesDisponibles.filter((c) => c.plazasLibres > 0).length > 0 && (
                    <>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                        Con plaza libre
                      </p>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {clasesDisponibles
                          .filter((c) => c.plazasLibres > 0)
                          .map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setClaseSeleccionada(c.id)}
                              className={`text-left px-3 py-2.5 rounded-xl border-2 transition-all ${
                                claseSeleccionada === c.id
                                  ? 'border-[#1e83ec] bg-blue-50'
                                  : 'border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <p className="font-semibold text-slate-800 text-xs leading-tight">{c.nombre}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5">{c.dia} · {c.hora}</p>
                              <p className="text-[11px] text-slate-500">Pista {c.pista} · {c.profesor.split(' ')[0]}</p>
                              <div className="mt-1.5 flex gap-1 items-center">
                                {Array.from({ length: c.plazasTotal }).map((_, i) => (
                                  <span
                                    key={i}
                                    className={`inline-block h-2 w-2 rounded-full ${
                                      i < c.inscritos ? 'bg-slate-300' : 'bg-emerald-400'
                                    }`}
                                  />
                                ))}
                                <span className="text-[10px] text-emerald-600 font-semibold ml-1">
                                  {c.plazasLibres} libre
                                </span>
                              </div>
                            </button>
                          ))}
                      </div>
                    </>
                  )}

                  {/* Resumen selección */}
                  {claseSeleccionada !== 'auto' && (() => {
                    const c = clasesDisponibles.find((x) => x.id === claseSeleccionada);
                    if (!c) return null;
                    return (
                      <p className="text-xs mt-3 px-3 py-2 rounded-lg font-medium bg-emerald-50 text-emerald-700">
                        ✅ Plaza confirmada · Profesor: {c.profesor}
                      </p>
                    );
                  })()}
                </div>
              )}
            </div>

            {saveError && (
              <p className="mt-3 text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">{saveError}</p>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={cerrar} className="btn btn-secondary">Cancelar</button>
              <button onClick={guardar} disabled={saving} className="btn btn-primary">
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
