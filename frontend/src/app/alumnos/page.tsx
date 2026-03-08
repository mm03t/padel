'use client';

import { useEffect, useState } from 'react';
import { UserPlus, Search, Pencil, Power } from 'lucide-react';
import { alumnos as api } from '@/lib/api';
import type { Alumno, Disponibilidad } from '@/types';

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
  const [modal, setModal] = useState<{ open: boolean; data: Partial<Alumno>; editId?: string }>({
    open: false, data: EMPTY,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const cargar = () => {
    setLoading(true);
    api.list({ activo: String(filtroActivo), ...(search ? { search } : {}) })
      .then(setLista)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, [search, filtroActivo]);

  const abrirNuevo = () => setModal({ open: true, data: { ...EMPTY } });
  const abrirEditar = (a: Alumno) => setModal({ open: true, data: { ...a }, editId: a.id });
  const cerrar = () => { setModal({ open: false, data: EMPTY }); setSaveError(''); };

  const guardar = async () => {
    setSaving(true); setSaveError('');
    try {
      if (modal.editId) {
        await api.update(modal.editId, modal.data);
      } else {
        await api.create(modal.data);
      }
      cerrar(); cargar();
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActivo = async (a: Alumno) => {
    await api.update(a.id, { activo: !a.activo });
    cargar();
  };

  const campo = (key: keyof Alumno) => (e: any) =>
    setModal((m) => ({ ...m, data: { ...m.data, [key]: e.target.value } }));

  return (
    <div className="p-8 max-w-6xl">
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
          {[true, false].map((v) => (
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

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="spinner" /></div>
      ) : error ? (
        <div className="card p-6 text-rose-600 border-rose-200 bg-rose-50">{error}</div>
      ) : lista.length === 0 ? (
        <div className="card p-12 text-center text-slate-400">No hay alumnos. ¡Crea el primero!</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-5 py-3 font-semibold text-slate-500 text-xs uppercase">Alumno</th>
                <th className="text-left px-3 py-3 font-semibold text-slate-500 text-xs uppercase">Nivel</th>
                <th className="text-left px-3 py-3 font-semibold text-slate-500 text-xs uppercase">Disponibilidad</th>
                <th className="text-left px-3 py-3 font-semibold text-slate-500 text-xs uppercase">Clase</th>
                <th className="text-left px-3 py-3 font-semibold text-slate-500 text-xs uppercase">Recup. pend.</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {lista.map((a) => (
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
                    {a.inscripciones && a.inscripciones.length > 0
                      ? a.inscripciones.filter((i) => i.activo).map((i) => i.clase.nombre).join(', ')
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
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
                <select className="input" value={modal.data.nivel || 1.0} onChange={campo('nivel')}>
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
