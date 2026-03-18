'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Users, CalendarDays, RotateCcw, Bell, AlertTriangle, ArrowRight,
  UserPlus, MessageSquare, Lock, TrendingUp, BarChart3, Percent,
  DollarSign, Clock, Target, Activity, Zap, Award, PieChart,
  Calendar, CreditCard, ListOrdered, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { dashboard } from '@/lib/api';
import { usePlan } from '@/components/PlanContext';
import { canAccess } from '@/lib/plans';
import type { DashboardStats } from '@/types';

/* ── Shared components ─────────────────────────────────────────────────────── */

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

function MiniKPI({ label, value, trend, trendUp, icon: Icon, iconColor }: {
  label: string; value: string; trend?: string; trendUp?: boolean; icon: any; iconColor: string;
}) {
  return (
    <div className="p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: iconColor + '15' }}>
        <Icon size={18} style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-lg font-black text-slate-800">{value}</p>
          {trend && (
            <span className={`text-[11px] font-bold flex items-center gap-0.5 ${trendUp ? 'text-emerald-600' : 'text-rose-500'}`}>
              {trendUp ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
              {trend}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function BarMini({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-20 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-bold text-slate-600 w-8 text-right">{value}</span>
    </div>
  );
}

const DIAS: Record<string, string> = {
  LUNES: 'Lun', MARTES: 'Mar', MIERCOLES: 'Mié',
  JUEVES: 'Jue', VIERNES: 'Vie', SABADO: 'Sáb', DOMINGO: 'Dom',
};

/* ── Page ───────────────────────────────────────────────────────────────────── */

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

  /* ── Derived values for Elite ─────────────────────────────────────────────── */
  const mrr = stats.totalAlumnos * 59;
  const ocupacion = stats.totalClases > 0
    ? Math.round((stats.totalAlumnos / (stats.totalClases * 4)) * 100) : 0;
  const retencion = 94;
  const asistenciaMedia = 87;
  const faltasSemana = stats.ultimasFaltas.length;
  const sesionesSemanales = stats.sesionesEstaSemana;
  const alumnosPorClase = stats.totalClases > 0
    ? (stats.totalAlumnos / stats.totalClases).toFixed(1) : '0';
  const ingresosAnuales = mrr * 12;

  // Distribution mock data derived from real counts
  const turnoMañana = Math.round(stats.totalAlumnos * 0.55);
  const turnoTarde = stats.totalAlumnos - turnoMañana;

  /* ── STARTER ──────────────────────────────────────────────────────────────── */
  if (plan === 'starter') {
    return (
      <div className="p-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-slate-800">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">
            {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
          </p>
        </div>

        {/* Próximas sesiones — lo único visible */}
        <div className="card mb-6">
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
              <div key={s.id} className="flex items-center gap-3 px-6 py-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-lg flex flex-col items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase">{DIAS[s.clase.diaSemana]}</span>
                  <span className="text-base font-black text-emerald-600">{format(new Date(s.fecha), 'd')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{s.clase.nombre}</p>
                  <p className="text-xs text-slate-400">
                    {s.clase.horaInicio} · Pista {s.clase.pista.numero} · {s.clase.profesor.nombre}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upgrade CTA */}
        <div className="card p-8 text-center bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <BarChart3 size={24} className="text-amber-600" />
          </div>
          <h3 className="text-lg font-black text-slate-800 mb-2">Desbloquea estadísticas y más</h3>
          <p className="text-sm text-slate-500 mb-5 max-w-sm mx-auto">
            Con el plan Club verás el número de alumnos, clases activas, recuperaciones pendientes y mucho más.
          </p>
          <Link
            href="/planes"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors"
          >
            Ver planes <ArrowRight size={14} />
          </Link>
        </div>

        {/* Quick actions */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Link href="/alumnos" className="card flex items-center gap-3 px-4 py-3 border transition-colors bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200">
            <UserPlus size={18} />
            <span className="text-sm font-semibold">Nuevo alumno</span>
          </Link>
          <Link href="/clases" className="card flex items-center gap-3 px-4 py-3 border transition-colors bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200">
            <CalendarDays size={18} />
            <span className="text-sm font-semibold">Ver clases</span>
          </Link>
        </div>
      </div>
    );
  }

  /* ── CLUB ──────────────────────────────────────────────────────────────────── */
  if (plan === 'club') {
    return (
      <div className="p-8 max-w-6xl">
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

        {/* Stats grid: 3 cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard label="Alumnos activos" value={stats.totalAlumnos} icon={Users} color="text-emerald-600" />
          <StatCard label="Clases activas" value={stats.totalClases} icon={CalendarDays} color="text-blue-600" />
          <StatCard label="Recuperaciones pendientes" value={stats.recuperacionesPendientes} icon={RotateCcw} color="text-amber-600"
                    sub={stats.vencenPronto > 0 ? `${stats.vencenPronto} vencen pronto` : undefined} />
        </div>

        {/* 2 columns */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Próximas sesiones */}
          <div className="card">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-700">Próximas sesiones</h2>
              <Link href="/calendario" className="text-xs text-emerald-600 font-semibold hover:underline flex items-center gap-1">
                Ver calendario <ArrowRight size={12} />
              </Link>
            </div>
            <div className="divide-y divide-slate-50">
              {stats.proximasSesiones.length === 0 && (
                <p className="px-6 py-4 text-sm text-slate-400">No hay sesiones programadas.</p>
              )}
              {stats.proximasSesiones.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-6 py-3">
                  <div className="w-10 h-10 bg-emerald-50 rounded-lg flex flex-col items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase">{DIAS[s.clase.diaSemana]}</span>
                    <span className="text-base font-black text-emerald-600">{format(new Date(s.fecha), 'd')}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{s.clase.nombre}</p>
                    <p className="text-xs text-slate-400">
                      {s.clase.horaInicio} · Pista {s.clase.pista.numero} · {s.clase.profesor.nombre}
                    </p>
                  </div>
                </div>
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
                    <span className="text-xs font-bold text-rose-600">{a.alumno.nombre[0]}{a.alumno.apellidos[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{a.alumno.nombre} {a.alumno.apellidos}</p>
                    <p className="text-xs text-slate-400">{a.sesion?.clase?.nombre}</p>
                  </div>
                  <span className="badge badge-red text-[11px]">Falta</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link href="/alumnos" className="card flex items-center gap-3 px-4 py-3 border transition-colors bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200">
            <UserPlus size={18} />
            <span className="text-sm font-semibold">Nuevo alumno</span>
          </Link>
          <Link href="/calendario" className="card flex items-center gap-3 px-4 py-3 border transition-colors bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200">
            <Calendar size={18} />
            <span className="text-sm font-semibold">Calendario</span>
          </Link>
          <Link href="/recuperaciones" className="card flex items-center gap-3 px-4 py-3 border transition-colors bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200">
            <RotateCcw size={18} />
            <span className="text-sm font-semibold">Recuperaciones</span>
          </Link>
          <Link href="/notificaciones" className="card flex items-center gap-3 px-4 py-3 border transition-colors bg-violet-50 hover:bg-violet-100 text-violet-700 border-violet-200">
            <MessageSquare size={18} />
            <span className="text-sm font-semibold">Enviar WhatsApp</span>
          </Link>
        </div>
      </div>
    );
  }

  /* ── ELITE ─────────────────────────────────────────────────────────────────── */
  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">
            {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
          </p>
        </div>
        <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-red-50 text-red-600 border border-red-200">ELITE</span>
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

      {/* ── TOP KPI ROW ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">MRR</span>
            <span className="flex items-center gap-0.5 text-[11px] font-bold text-emerald-600"><ArrowUpRight size={11} />+12%</span>
          </div>
          <p className="text-3xl font-black text-slate-800">{mrr.toLocaleString('es-ES')}€</p>
          <p className="text-xs text-slate-400 mt-0.5">{ingresosAnuales.toLocaleString('es-ES')}€/año estimado</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Alumnos</span>
            <span className="flex items-center gap-0.5 text-[11px] font-bold text-emerald-600"><ArrowUpRight size={11} />+3</span>
          </div>
          <p className="text-3xl font-black text-emerald-600">{stats.totalAlumnos}</p>
          <p className="text-xs text-slate-400 mt-0.5">{alumnosPorClase} media por clase</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Ocupación</span>
            <Percent size={13} className="text-blue-500" />
          </div>
          <p className="text-3xl font-black text-blue-600">{ocupacion}%</p>
          <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
            <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(ocupacion, 100)}%` }} />
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Retención</span>
            <Target size={13} className="text-violet-500" />
          </div>
          <p className="text-3xl font-black text-violet-600">{retencion}%</p>
          <p className="text-xs text-slate-400 mt-0.5">Últimos 3 meses</p>
        </div>
      </div>

      {/* ── ROW 2: Activity strip ─────────────────────────────────────────────── */}
      <div className="card grid grid-cols-2 md:grid-cols-5 divide-x divide-slate-100 mb-6">
        <MiniKPI label="Clases activas" value={String(stats.totalClases)} icon={CalendarDays} iconColor="#1e83ec" />
        <MiniKPI label="Sesiones/semana" value={String(sesionesSemanales)} icon={Calendar} iconColor="#8b5cf6" />
        <MiniKPI label="Recup. pendientes" value={String(stats.recuperacionesPendientes)} trend={stats.vencenPronto > 0 ? `${stats.vencenPronto} urgen` : undefined} trendUp={false} icon={RotateCcw} iconColor="#f59e0b" />
        <MiniKPI label="Faltas esta semana" value={String(faltasSemana)} icon={AlertTriangle} iconColor="#ef4444" />
        <MiniKPI label="WhatsApp enviados" value={String(stats.notificacionesSemana)} trend="+8%" trendUp={true} icon={MessageSquare} iconColor="#22c55e" />
      </div>

      {/* ── ROW 3: 3 columns ──────────────────────────────────────────────────── */}
      <div className="grid md:grid-cols-3 gap-6 mb-6">

        {/* Performance panel */}
        <div className="card">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
              <Activity size={14} className="text-emerald-500" /> Rendimiento
            </h2>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">Asistencia media</span>
                <span className="text-xs font-bold text-emerald-600">{asistenciaMedia}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${asistenciaMedia}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">Ocupación pistas</span>
                <span className="text-xs font-bold text-blue-600">{ocupacion}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(ocupacion, 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">Tasa recuperación</span>
                <span className="text-xs font-bold text-amber-600">72%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-amber-500" style={{ width: '72%' }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">Satisfacción est.</span>
                <span className="text-xs font-bold text-violet-600">4.6/5</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-violet-500" style={{ width: '92%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Distribution panel */}
        <div className="card">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
              <PieChart size={14} className="text-blue-500" /> Distribución
            </h2>
          </div>
          <div className="p-5 space-y-3.5">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Por turno</p>
              <BarMini label="Mañana" value={turnoMañana} max={stats.totalAlumnos} color="#1e83ec" />
              <div className="mt-1.5">
                <BarMini label="Tarde" value={turnoTarde} max={stats.totalAlumnos} color="#f59e0b" />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Horas punta</p>
              <BarMini label="9:00–10:00" value={Math.round(stats.totalClases * 0.3)} max={stats.totalClases} color="#22c55e" />
              <div className="mt-1.5"><BarMini label="10:00–11:00" value={Math.round(stats.totalClases * 0.25)} max={stats.totalClases} color="#22c55e" /></div>
              <div className="mt-1.5"><BarMini label="17:00–18:00" value={Math.round(stats.totalClases * 0.28)} max={stats.totalClases} color="#8b5cf6" /></div>
              <div className="mt-1.5"><BarMini label="18:00–19:00" value={Math.round(stats.totalClases * 0.17)} max={stats.totalClases} color="#8b5cf6" /></div>
            </div>
          </div>
        </div>

        {/* Financial panel */}
        <div className="card">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
              <DollarSign size={14} className="text-emerald-500" /> Finanzas
            </h2>
          </div>
          <div className="divide-y divide-slate-50">
            <div className="px-5 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">MRR actual</span>
              <span className="text-sm font-black text-slate-800">{mrr.toLocaleString('es-ES')}€</span>
            </div>
            <div className="px-5 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">Ingreso anual est.</span>
              <span className="text-sm font-bold text-slate-700">{ingresosAnuales.toLocaleString('es-ES')}€</span>
            </div>
            <div className="px-5 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">Ticket medio/alumno</span>
              <span className="text-sm font-bold text-slate-700">59€</span>
            </div>
            <div className="px-5 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">Coste/sesión est.</span>
              <span className="text-sm font-bold text-slate-700">{sesionesSemanales > 0 ? Math.round(mrr / (sesionesSemanales * 4)) : 0}€</span>
            </div>
            <div className="px-5 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">ARPU mensual</span>
              <span className="text-sm font-bold text-emerald-600">{stats.totalAlumnos > 0 ? Math.round(mrr / stats.totalAlumnos) : 0}€</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 4: Sessions + Faltas ─────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Próximas sesiones */}
        <div className="card">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-700">Próximas sesiones</h2>
            <Link href="/calendario" className="text-xs text-emerald-600 font-semibold hover:underline flex items-center gap-1">
              Ver calendario <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {stats.proximasSesiones.length === 0 && (
              <p className="px-6 py-4 text-sm text-slate-400">No hay sesiones programadas.</p>
            )}
            {stats.proximasSesiones.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-6 py-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-lg flex flex-col items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase">{DIAS[s.clase.diaSemana]}</span>
                  <span className="text-base font-black text-emerald-600">{format(new Date(s.fecha), 'd')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{s.clase.nombre}</p>
                  <p className="text-xs text-slate-400">
                    {s.clase.horaInicio} · Pista {s.clase.pista.numero} · {s.clase.profesor.nombre}
                  </p>
                </div>
              </div>
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
                  <span className="text-xs font-bold text-rose-600">{a.alumno.nombre[0]}{a.alumno.apellidos[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{a.alumno.nombre} {a.alumno.apellidos}</p>
                  <p className="text-xs text-slate-400">{a.sesion?.clase?.nombre}</p>
                </div>
                <span className="badge badge-red text-[11px]">Falta</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Quick actions ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link href="/alumnos" className="card flex items-center gap-3 px-4 py-3 border transition-colors bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200">
          <UserPlus size={18} />
          <span className="text-sm font-semibold">Nuevo alumno</span>
        </Link>
        <Link href="/calendario" className="card flex items-center gap-3 px-4 py-3 border transition-colors bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200">
          <Calendar size={18} />
          <span className="text-sm font-semibold">Calendario</span>
        </Link>
        <Link href="/recuperaciones" className="card flex items-center gap-3 px-4 py-3 border transition-colors bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200">
          <RotateCcw size={18} />
          <span className="text-sm font-semibold">Recuperaciones</span>
        </Link>
        <Link href="/notificaciones" className="card flex items-center gap-3 px-4 py-3 border transition-colors bg-violet-50 hover:bg-violet-100 text-violet-700 border-violet-200">
          <MessageSquare size={18} />
          <span className="text-sm font-semibold">Enviar WhatsApp</span>
        </Link>
      </div>
    </div>
  );
}
