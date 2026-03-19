'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  ClipboardList,
  RotateCcw,
  ListOrdered,
  Dumbbell,
  ArrowLeftRight,
  Lock,
  MessageSquare,
  MapPin,
  Menu,
  X,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { usePlan } from '@/components/PlanContext';
import { NAV_ACCESS } from '@/lib/plans';

const nav = [
  { href: '/',               label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/alumnos',        label: 'Alumnos',        icon: Users },
  { href: '/calendario',     label: 'Calendario',     icon: CalendarDays },
  { href: '/clases',         label: 'Clases',         icon: ClipboardList },
  { href: '/lista-espera',   label: 'Lista espera',   icon: ListOrdered },
  { href: '/recuperaciones', label: 'Recuperaciones', icon: RotateCcw },
  { href: '/notificaciones', label: 'Notificaciones', icon: MessageSquare },
  { href: '/pistas',         label: 'Vista diaria',   icon: MapPin },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { plan, planDef, clearPlan } = usePlan();
  const [open, setOpen] = useState(false);

  const allowed = plan ? NAV_ACCESS[plan] : [];

  // Close sidebar on route change (mobile)
  useEffect(() => { setOpen(false); }, [pathname]);

  const cambiarPlan = () => {
    clearPlan();
    router.push('/planes');
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-700/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#1e83ec' }}>
            <Dumbbell size={18} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">Academia Pádel</p>
            <p className="text-xs text-slate-400">Panel de gestión</p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="lg:hidden text-slate-400 hover:text-white p-1">
          <X size={20} />
        </button>
      </div>

      {/* Plan badge */}
      {planDef && (
        <div className="px-4 pt-4 pb-2">
          <div
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold"
            style={{ background: planDef.color + '18', color: planDef.color, border: `1px solid ${planDef.color}30` }}
          >
            <span>Plan {planDef.badge}</span>
            <span>{planDef.price}€/mes</span>
          </div>
        </div>
      )}

      {/* Navegación */}
      <nav className="flex-1 p-3 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          const locked = !allowed.includes(href);
          return (
            <Link
              key={href}
              href={locked ? '#' : href}
              onClick={locked ? (e) => e.preventDefault() : undefined}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                locked
                  ? 'text-slate-600 cursor-not-allowed opacity-50'
                  : active
                    ? 'text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
              style={active && !locked ? { background: '#1e83ec' } : {}}
              title={locked ? `Disponible desde el plan Club` : undefined}
            >
              <Icon size={17} strokeWidth={2} />
              {label}
              {locked && <Lock size={12} className="ml-auto text-slate-600" />}
            </Link>
          );
        })}
      </nav>

      {/* Cambiar plan */}
      <div className="px-3 pb-2">
        <button
          onClick={cambiarPlan}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors border border-slate-700/50"
        >
          <ArrowLeftRight size={13} />
          Cambiar plan
        </button>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-700/60">
        <p className="text-xs text-slate-500">SaaS Demo · 2026</p>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-lg bg-slate-900 text-white shadow-lg"
        aria-label="Abrir menú"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar — mobile: slide-in overlay, desktop: fixed column */}
      <aside className={`
        fixed lg:relative z-50 lg:z-auto
        w-64 lg:w-60 bg-slate-900 text-white flex flex-col shrink-0 h-full
        transition-transform duration-200 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {sidebarContent}
      </aside>
    </>
  );
}
