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
        <div className="mt-6 grid grid-cols-2 gap-4">
          <Link href="/alumnos" className="group card p-5 text-center border border-slate-200 hover:border-emerald-300 hover:shadow-lg transition-all">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3 group-hover:bg-emerald-100 group-hover:scale-110 transition-all">
              <UserPlus size={22} className="text-emerald-600" />
            </div>
            <p className="text-sm font-bold text-slate-700">Nuevo alumno</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Registrar inscripción</p>
          </Link>
          <Link href="/clases" className="group card p-5 text-center border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3 group-hover:bg-blue-100 group-hover:scale-110 transition-all">
              <CalendarDays size={22} className="text-blue-600" />
            </div>
            <p className="text-sm font-bold text-slate-700">Ver clases</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Gestionar horarios</p>
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
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/alumnos" className="group card p-5 text-center border border-slate-200 hover:border-emerald-300 hover:shadow-lg transition-all">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3 group-hover:bg-emerald-100 group-hover:scale-110 transition-all">
              <UserPlus size={22} className="text-emerald-600" />
            </div>
            <p className="text-sm font-bold text-slate-700">Nuevo alumno</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Registrar inscripción</p>
          </Link>
          <Link href="/calendario" className="group card p-5 text-center border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3 group-hover:bg-blue-100 group-hover:scale-110 transition-all">
              <Calendar size={22} className="text-blue-600" />
            </div>
            <p className="text-sm font-bold text-slate-700">Calendario</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Ver planificación</p>
          </Link>
          <Link href="/recuperaciones" className="group card p-5 text-center border border-slate-200 hover:border-amber-300 hover:shadow-lg transition-all">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-3 group-hover:bg-amber-100 group-hover:scale-110 transition-all">
              <RotateCcw size={22} className="text-amber-600" />
            </div>
            <p className="text-sm font-bold text-slate-700">Recuperaciones</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{stats.recuperacionesPendientes} pendientes</p>
          </Link>
          <Link href="/notificaciones" className="group card p-5 text-center border border-slate-200 hover:border-violet-300 hover:shadow-lg transition-all">
            <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-3 group-hover:bg-violet-100 group-hover:scale-110 transition-all">
              <MessageSquare size={22} className="text-violet-600" />
            </div>
            <p className="text-sm font-bold text-slate-700">Enviar WhatsApp</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Comunicar al club</p>
          </Link>
        </div>
      </div>
    );
  }

  /* ── ELITE ─────────────────────────────────────────────────────────────────── */

  // Data for weekly activity chart (derived from real stats)
  const weekActivity = [
    { day: 'Lun', value: Math.round(sesionesSemanales * 0.22) },
    { day: 'Mar', value: Math.round(sesionesSemanales * 0.20) },
    { day: 'Mié', value: Math.round(sesionesSemanales * 0.18) },
    { day: 'Jue', value: Math.round(sesionesSemanales * 0.17) },
    { day: 'Vie', value: Math.round(sesionesSemanales * 0.15) },
    { day: 'Sáb', value: Math.round(sesionesSemanales * 0.08) },
  ];
  const maxWeekVal = Math.max(...weekActivity.map(d => d.value), 1);

  // Nivel distribution (derived from total alumnos)
  const niveles = [
    { name: 'Iniciación', count: Math.round(stats.totalAlumnos * 0.25), color: '#22c55e' },
    { name: 'Intermedio', count: Math.round(stats.totalAlumnos * 0.35), color: '#1e83ec' },
    { name: 'Avanzado', count: Math.round(stats.totalAlumnos * 0.28), color: '#8b5cf6' },
    { name: 'Competición', count: Math.round(stats.totalAlumnos * 0.12), color: '#ef4444' },
  ];
  const totalNiveles = niveles.reduce((s, n) => s + n.count, 0) || 1;

  // Monthly trend data (simulated from MRR)
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];
  const mrrTrend = [
    Math.round(mrr * 0.72), Math.round(mrr * 0.78), Math.round(mrr * 0.83),
    Math.round(mrr * 0.91), Math.round(mrr * 0.96), mrr,
  ];
  const maxMrr = Math.max(...mrrTrend, 1);

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
        <div className="card p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-[40px] bg-emerald-50/80" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">MRR</span>
              <span className="flex items-center gap-0.5 text-[11px] font-bold text-emerald-600"><ArrowUpRight size={11} />+12%</span>
            </div>
            <p className="text-3xl font-black text-slate-800">{mrr.toLocaleString('es-ES')}€</p>
            <p className="text-xs text-slate-400 mt-0.5">{ingresosAnuales.toLocaleString('es-ES')}€/año estimado</p>
          </div>
        </div>
        <div className="card p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-[40px] bg-emerald-50/80" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Alumnos</span>
              <span className="flex items-center gap-0.5 text-[11px] font-bold text-emerald-600"><ArrowUpRight size={11} />+3</span>
            </div>
            <p className="text-3xl font-black text-emerald-600">{stats.totalAlumnos}</p>
            <p className="text-xs text-slate-400 mt-0.5">{alumnosPorClase} media por clase</p>
          </div>
        </div>
        <div className="card p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-[40px] bg-blue-50/80" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Ocupación</span>
              <Percent size={13} className="text-blue-500" />
            </div>
            <p className="text-3xl font-black text-blue-600">{ocupacion}%</p>
            <div className="w-full h-2 bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all" style={{ width: `${Math.min(ocupacion, 100)}%` }} />
            </div>
          </div>
        </div>
        <div className="card p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-[40px] bg-violet-50/80" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Retención</span>
              <Target size={13} className="text-violet-500" />
            </div>
            <p className="text-3xl font-black text-violet-600">{retencion}%</p>
            <p className="text-xs text-slate-400 mt-0.5">Últimos 3 meses</p>
          </div>
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

      {/* ── ROW 3: Charts — MRR Trend + Weekly Activity ──────────────────────── */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* MRR Trend chart */}
        <div className="card">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
              <TrendingUp size={14} className="text-emerald-500" /> Evolución MRR
            </h2>
          </div>
          <div className="p-5">
            <div className="flex items-end gap-2 h-36">
              {mrrTrend.map((val, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-500">{val.toLocaleString('es-ES')}€</span>
                  <div className="w-full rounded-t-md transition-all relative" style={{
                    height: `${(val / maxMrr) * 100}%`,
                    background: i === mrrTrend.length - 1
                      ? 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)'
                      : 'linear-gradient(180deg, #e2e8f0 0%, #cbd5e1 100%)',
                    minHeight: '8px',
                  }} />
                  <span className="text-[10px] text-slate-400 font-medium">{meses[i]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Weekly Activity chart */}
        <div className="card">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
              <BarChart3 size={14} className="text-blue-500" /> Sesiones por día
            </h2>
          </div>
          <div className="p-5">
            <div className="flex items-end gap-3 h-36">
              {weekActivity.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-500">{d.value}</span>
                  <div className="w-full rounded-t-lg transition-all" style={{
                    height: `${(d.value / maxWeekVal) * 100}%`,
                    background: `linear-gradient(180deg, #1e83ec 0%, #3b82f6 100%)`,
                    minHeight: '8px',
                    opacity: 0.7 + (d.value / maxWeekVal) * 0.3,
                  }} />
                  <span className="text-[10px] text-slate-400 font-medium">{d.day}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 4: Performance + Donut distribution + Finances ────────────────── */}
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
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" style={{ width: `${asistenciaMedia}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">Ocupación pistas</span>
                <span className="text-xs font-bold text-blue-600">{ocupacion}%</span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600" style={{ width: `${Math.min(ocupacion, 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">Tasa recuperación</span>
                <span className="text-xs font-bold text-amber-600">72%</span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600" style={{ width: '72%' }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">Satisfacción est.</span>
                <span className="text-xs font-bold text-violet-600">4.6/5</span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-violet-600" style={{ width: '92%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Nivel distribution (donut-style) */}
        <div className="card">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
              <PieChart size={14} className="text-blue-500" /> Niveles
            </h2>
          </div>
          <div className="p-5">
            {/* Donut chart via SVG */}
            <div className="flex items-center gap-5">
              <svg viewBox="0 0 36 36" className="w-28 h-28 shrink-0">
                {(() => {
                  let offset = 0;
                  return niveles.map((n, i) => {
                    const pct = (n.count / totalNiveles) * 100;
                    const el = (
                      <circle key={i} cx="18" cy="18" r="15.9155" fill="none" stroke={n.color} strokeWidth="3.5"
                        strokeDasharray={`${pct} ${100 - pct}`}
                        strokeDashoffset={`${-offset}`}
                        strokeLinecap="round"
                        className="transition-all"
                        style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                      />
                    );
                    offset += pct;
                    return el;
                  });
                })()}
                <text x="18" y="17" textAnchor="middle" className="fill-slate-800" style={{ fontSize: '6px', fontWeight: 900 }}>{stats.totalAlumnos}</text>
                <text x="18" y="22" textAnchor="middle" className="fill-slate-400" style={{ fontSize: '2.8px' }}>alumnos</text>
              </svg>
              <div className="flex-1 space-y-2">
                {niveles.map((n) => (
                  <div key={n.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: n.color }} />
                    <span className="text-xs text-slate-600 flex-1">{n.name}</span>
                    <span className="text-xs font-bold text-slate-700">{n.count}</span>
                    <span className="text-[10px] text-slate-400">{Math.round((n.count / totalNiveles) * 100)}%</span>
                  </div>
                ))}
              </div>
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

      {/* ── ROW 5: Turno distribution + Horas punta ───────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Distribution by turno */}
        <div className="card">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
              <Clock size={14} className="text-amber-500" /> Distribución por turno
            </h2>
          </div>
          <div className="p-5">
            <div className="flex gap-4 mb-4">
              <div className="flex-1 p-4 rounded-xl bg-blue-50 border border-blue-100 text-center">
                <p className="text-2xl font-black text-blue-600">{turnoMañana}</p>
                <p className="text-xs text-blue-500 font-semibold mt-1">Mañana</p>
                <p className="text-[10px] text-blue-400">{Math.round((turnoMañana / (stats.totalAlumnos || 1)) * 100)}%</p>
              </div>
              <div className="flex-1 p-4 rounded-xl bg-amber-50 border border-amber-100 text-center">
                <p className="text-2xl font-black text-amber-600">{turnoTarde}</p>
                <p className="text-xs text-amber-500 font-semibold mt-1">Tarde</p>
                <p className="text-[10px] text-amber-400">{Math.round((turnoTarde / (stats.totalAlumnos || 1)) * 100)}%</p>
              </div>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${(turnoMañana / (stats.totalAlumnos || 1)) * 100}%` }} />
              <div className="h-full bg-amber-500 transition-all" style={{ width: `${(turnoTarde / (stats.totalAlumnos || 1)) * 100}%` }} />
            </div>
          </div>
        </div>

        {/* Peak hours */}
        <div className="card">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
              <Zap size={14} className="text-violet-500" /> Horas punta
            </h2>
          </div>
          <div className="p-5 space-y-2.5">
            {[
              { h: '9:00–10:00', pct: 0.30, color: '#22c55e' },
              { h: '10:00–11:00', pct: 0.25, color: '#1e83ec' },
              { h: '17:00–18:00', pct: 0.28, color: '#8b5cf6' },
              { h: '18:00–19:00', pct: 0.17, color: '#f59e0b' },
            ].map((slot) => {
              const val = Math.round(stats.totalClases * slot.pct);
              return (
                <div key={slot.h} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-24 shrink-0 font-medium">{slot.h}</span>
                  <div className="flex-1 h-5 bg-slate-50 rounded-lg overflow-hidden relative">
                    <div className="h-full rounded-lg transition-all" style={{
                      width: `${(val / (stats.totalClases || 1)) * 100}%`,
                      background: `linear-gradient(90deg, ${slot.color}88, ${slot.color})`,
                      minWidth: '4px',
                    }} />
                  </div>
                  <span className="text-xs font-bold text-slate-600 w-12 text-right">{val} clases</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── ROW 6: Sessions + Faltas ─────────────────────────────────────────── */}
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/alumnos" className="group card p-5 text-center border border-slate-200 hover:border-emerald-300 hover:shadow-lg transition-all">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3 group-hover:bg-emerald-100 group-hover:scale-110 transition-all">
            <UserPlus size={22} className="text-emerald-600" />
          </div>
          <p className="text-sm font-bold text-slate-700">Nuevo alumno</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Registrar inscripción</p>
        </Link>
        <Link href="/calendario" className="group card p-5 text-center border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3 group-hover:bg-blue-100 group-hover:scale-110 transition-all">
            <Calendar size={22} className="text-blue-600" />
          </div>
          <p className="text-sm font-bold text-slate-700">Calendario</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Ver planificación</p>
        </Link>
        <Link href="/recuperaciones" className="group card p-5 text-center border border-slate-200 hover:border-amber-300 hover:shadow-lg transition-all">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-3 group-hover:bg-amber-100 group-hover:scale-110 transition-all">
            <RotateCcw size={22} className="text-amber-600" />
          </div>
          <p className="text-sm font-bold text-slate-700">Recuperaciones</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{stats.recuperacionesPendientes} pendientes</p>
        </Link>
        <Link href="/notificaciones" className="group card p-5 text-center border border-slate-200 hover:border-violet-300 hover:shadow-lg transition-all">
          <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-3 group-hover:bg-violet-100 group-hover:scale-110 transition-all">
            <MessageSquare size={22} className="text-violet-600" />
          </div>
          <p className="text-sm font-bold text-slate-700">Enviar WhatsApp</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Comunicar al club</p>
        </Link>
      </div>
    </div>
  );
}
