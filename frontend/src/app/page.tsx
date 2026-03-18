'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Users, CalendarDays, RotateCcw, Bell, AlertTriangle, ArrowRight, UserPlus, ClipboardList, MessageSquare } from 'lucide-react';
import { dashboard } from '@/lib/api';
import type { DashboardStats } from '@/types';

function StatCard({
  label, value, sub, icon: Icon, color,
}: { label: string; value: number | string; sub?: string; icon: any; color: string }) {
  return (
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
          <p className={`text-4xl font-black mt-1 ${color}`}>{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color === 'text-emerald-600' ? 'bg-emerald-50' : color === 'text-blue-600' ? 'bg-blue-50' : color === 'text-amber-600' ? 'bg-amber-50' : 'bg-rose-50'}`}>
          <Icon size={22} className={color} />
        </div>
      </div>
    </div>
  );
}

const DIAS: Record<string, string> = {
  LUNES: 'Lun', MARTES: 'Mar', MIERCOLES: 'Mié',
  JUEVES: 'Jue', VIERNES: 'Vie', SABADO: 'Sáb', DOMINGO: 'Dom',
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    dashboard.stats()
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="p-8">
        <div className="card p-6 border-rose-200 bg-rose-50 text-rose-700">
          <p className="font-semibold">No se pudo conectar con la API</p>
          <p className="text-sm mt-1">{error}</p>
          <p className="text-xs mt-2 text-rose-500">Asegúrate de que el backend está corriendo en el puerto 3003</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-black text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
        </p>
      </div>

      {/* Alerta recuperaciones */}
      {stats.vencenPronto > 0 && (
        <div className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
          <AlertTriangle size={18} className="shrink-0" />
          <p className="text-sm font-medium">
            <strong>{stats.vencenPronto}</strong> recuperación(es) vencen en menos de 7 días.{' '}
            <Link href="/recuperaciones" className="underline">Gestionar ahora →</Link>
          </p>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
        <StatCard label="Alumnos activos"          value={stats.totalAlumnos}             icon={Users}       color="text-emerald-600" />
        <StatCard label="Clases activas"            value={stats.totalClases}              icon={CalendarDays} color="text-blue-600" />
        <StatCard label="Recuperaciones pendientes" value={stats.recuperacionesPendientes}  icon={RotateCcw}   color="text-amber-600"
                  sub={stats.vencenPronto > 0 ? `${stats.vencenPronto} vencen pronto` : undefined} />
        <StatCard label="WhatsApp esta semana"      value={stats.notificacionesSemana}     icon={Bell}        color="text-rose-600" />
      </div>

      {/* 2 columnas: próximas sesiones + últimas faltas */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Próximas sesiones */}
        <div className="card">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-700">Próximas sesiones</h2>
            <Link href="/clases" className="text-xs text-emerald-600 font-semibold hover:underline flex items-center gap-1">
              Ver clases <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {stats.proximasSesiones.length === 0 && (
              <p className="px-6 py-4 text-sm text-slate-400">No hay sesiones programadas.</p>
            )}
            {stats.proximasSesiones.map((s) => (
              <Link
                key={s.id}
                href={`/sesiones/${s.id}`}
                className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50 transition-colors group"
              >
                <div className="w-10 h-10 bg-emerald-50 rounded-lg flex flex-col items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase">
                    {DIAS[s.clase.diaSemana]}
                  </span>
                  <span className="text-base font-black text-emerald-600">
                    {format(new Date(s.fecha), 'd')}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{s.clase.nombre}</p>
                  <p className="text-xs text-slate-400">
                    {s.clase.horaInicio} · Pista {s.clase.pista.numero} ·{' '}
                    {s.clase.profesor.nombre}
                  </p>
                </div>
                <ArrowRight size={14} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
              </Link>
            ))}
          </div>
        </div>

        {/* Últimas faltas */}
        <div className="card">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-700">Últimas faltas</h2>
            <Link href="/recuperaciones" className="text-xs text-emerald-600 font-semibold hover:underline flex items-center gap-1">
              Ver recuperaciones <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {stats.ultimasFaltas.length === 0 && (
              <p className="px-6 py-4 text-sm text-slate-400">Sin faltas recientes.</p>
            )}
            {stats.ultimasFaltas.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-6 py-3">
                <div className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-rose-600">
                    {a.alumno.nombre[0]}{a.alumno.apellidos[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {a.alumno.nombre} {a.alumno.apellidos}
                  </p>
                  <p className="text-xs text-slate-400">{a.sesion?.clase?.nombre}</p>
                </div>
                <span className="badge badge-red text-[11px]">Falta</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Accesos rápidos */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: '/alumnos',       label: 'Nuevo alumno',    Icon: UserPlus,      color: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200' },
          { href: '/clases',        label: 'Ver clases',      Icon: CalendarDays,  color: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200' },
          { href: '/recuperaciones',label: 'Recuperaciones',  Icon: RotateCcw,     color: 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200' },
          { href: '/notificaciones',label: 'Enviar WhatsApp', Icon: MessageSquare, color: 'bg-violet-50 hover:bg-violet-100 text-violet-700 border-violet-200' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`card flex items-center gap-3 px-4 py-3 border transition-colors ${item.color}`}
          >
            <item.Icon size={18} />
            <span className="text-sm font-semibold">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
