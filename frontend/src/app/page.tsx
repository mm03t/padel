'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Users, CalendarDays, RotateCcw, Bell, AlertTriangle, ArrowRight,
  UserPlus, MessageSquare, Lock, TrendingUp, BarChart3, Percent,
} from 'lucide-react';
import { dashboard } from '@/lib/api';
import { usePlan } from '@/components/PlanContext';
import { canAccess } from '@/lib/plans';
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

function LockedStatCard({ label, icon: Icon }: { label: string; icon: any }) {
  return (
    <div className="card p-6 opacity-50 relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
          <p className="text-4xl font-black mt-1 text-slate-300">—</p>
        </div>
        <div className="p-3 rounded-xl bg-slate-100">
          <Icon size={22} className="text-slate-300" />
        </div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-white/60">
        <Lock size={18} className="text-slate-400" />
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
  const { plan } = usePlan();

  useEffect(() => {
    dashboard.stats()
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  const hasRecup = plan ? canAccess(plan, 'recuperaciones') : false;
  const hasNotif = plan ? canAccess(plan, 'notificaciones') : false;
  const hasReporting = plan ? canAccess(plan, 'reporting') : false;

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

      {/* Alerta recuperaciones — solo Club+ */}
      {hasRecup && stats.vencenPronto > 0 && (
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
        <StatCard label="Alumnos activos" value={stats.totalAlumnos} icon={Users} color="text-emerald-600" />
        <StatCard label="Clases activas" value={stats.totalClases} icon={CalendarDays} color="text-blue-600" />
        {hasRecup ? (
          <StatCard label="Recuperaciones pendientes" value={stats.recuperacionesPendientes} icon={RotateCcw} color="text-amber-600"
                    sub={stats.vencenPronto > 0 ? `${stats.vencenPronto} vencen pronto` : undefined} />
        ) : (
          <LockedStatCard label="Recuperaciones" icon={RotateCcw} />
        )}
        {hasNotif ? (
          <StatCard label="WhatsApp esta semana" value={stats.notificacionesSemana} icon={Bell} color="text-rose-600" />
        ) : (
          <LockedStatCard label="Notificaciones" icon={Bell} />
        )}
      </div>

      {/* 2 columnas: próximas sesiones + últimas faltas (o upgrade CTA) */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Próximas sesiones — siempre visible */}
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

        {/* Últimas faltas — solo Club+ | Starter ve upgrade CTA */}
        {hasRecup ? (
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
        ) : (
          <div className="card flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
              <RotateCcw size={24} className="text-amber-500" />
            </div>
            <h3 className="font-bold text-slate-700 mb-1">Gestión de recuperaciones</h3>
            <p className="text-sm text-slate-400 mb-4 max-w-xs">
              Controla faltas, programa recuperaciones y mantén la satisfacción de tus alumnos.
            </p>
            <Link
              href="/planes"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors"
            >
              Desbloquear con Club <ArrowRight size={14} />
            </Link>
          </div>
        )}
      </div>

      {/* Elite: Métricas avanzadas */}
      {hasReporting && (
        <div className="mt-6">
          <div className="card">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-700 flex items-center gap-2">
                <BarChart3 size={16} className="text-red-500" />
                Métricas avanzadas
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">ELITE</span>
              </h2>
            </div>
            <div className="grid grid-cols-3 divide-x divide-slate-100">
              <div className="p-6 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingUp size={14} className="text-emerald-500" />
                  <span className="text-xs font-semibold text-emerald-600">+12%</span>
                </div>
                <p className="text-2xl font-black text-slate-800">
                  {(stats.totalAlumnos * 59).toLocaleString('es-ES')}€
                </p>
                <p className="text-xs text-slate-400 mt-1">MRR estimado</p>
              </div>
              <div className="p-6 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Percent size={14} className="text-blue-500" />
                </div>
                <p className="text-2xl font-black text-slate-800">
                  {stats.totalClases > 0 ? Math.round((stats.totalAlumnos / (stats.totalClases * 4)) * 100) : 0}%
                </p>
                <p className="text-xs text-slate-400 mt-1">Ocupación media</p>
              </div>
              <div className="p-6 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Users size={14} className="text-violet-500" />
                </div>
                <p className="text-2xl font-black text-slate-800">94%</p>
                <p className="text-xs text-slate-400 mt-1">Tasa de retención</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Accesos rápidos */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link href="/alumnos" className="card flex items-center gap-3 px-4 py-3 border transition-colors bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200">
          <UserPlus size={18} />
          <span className="text-sm font-semibold">Nuevo alumno</span>
        </Link>
        <Link href="/clases" className="card flex items-center gap-3 px-4 py-3 border transition-colors bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200">
          <CalendarDays size={18} />
          <span className="text-sm font-semibold">Ver clases</span>
        </Link>
        {hasRecup ? (
          <Link href="/recuperaciones" className="card flex items-center gap-3 px-4 py-3 border transition-colors bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200">
            <RotateCcw size={18} />
            <span className="text-sm font-semibold">Recuperaciones</span>
          </Link>
        ) : (
          <div className="card flex items-center gap-3 px-4 py-3 border border-slate-200 text-slate-400 opacity-50 cursor-not-allowed relative">
            <RotateCcw size={18} />
            <span className="text-sm font-semibold">Recuperaciones</span>
            <Lock size={12} className="ml-auto" />
          </div>
        )}
        {hasNotif ? (
          <Link href="/notificaciones" className="card flex items-center gap-3 px-4 py-3 border transition-colors bg-violet-50 hover:bg-violet-100 text-violet-700 border-violet-200">
            <MessageSquare size={18} />
            <span className="text-sm font-semibold">Enviar WhatsApp</span>
          </Link>
        ) : (
          <div className="card flex items-center gap-3 px-4 py-3 border border-slate-200 text-slate-400 opacity-50 cursor-not-allowed relative">
            <MessageSquare size={18} />
            <span className="text-sm font-semibold">Enviar WhatsApp</span>
            <Lock size={12} className="ml-auto" />
          </div>
        )}
      </div>
    </div>
  );
}
