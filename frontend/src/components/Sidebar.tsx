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
  X,
} from 'lucide-react';
import { usePlan } from '@/components/PlanContext';
import { NAV_ACCESS } from '@/lib/plans';

const nav = [
  { href: '/',               label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/alumnos',        label: 'Alumnos',        icon: Users },
  { href: '/calendario',     label: 'Calendario',     icon: CalendarDays },
  { href: '/clases',         label: 'Clases',         icon: ClipboardList },
  { href: '/lista-espera',   label: 'Lista espera',   icon: ListOrdered },
  { href: '/recuperaciones', label: 'Recuperaciones', icon: RotateCcw },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { plan, planDef, clearPlan } = usePlan();

  const allowed = plan ? NAV_ACCESS[plan] : [];

  const cambiarPlan = () => {
    clearPlan();
    router.push('/planes');
  };

  return (
    <aside
      className={`
        lk-sidebar
        fixed lg:relative z-50 lg:z-auto
        transition-transform duration-200 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
    >
      {/* ── Logo Box ── */}
      <div className="lk-logo-box">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: '#ff6c2f' }}
          >
            <Dumbbell size={18} className="text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight text-white font-play truncate">
              Academia Pádel
            </p>
            <p className="text-[11px]" style={{ color: '#9097a7' }}>
              Panel de gestión
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden p-1 rounded transition-colors"
          style={{ color: '#9097a7' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#9097a7')}
          aria-label="Cerrar menú"
        >
          <X size={18} />
        </button>
      </div>

      {/* ── Navigation ── */}
      <div className="flex-1 overflow-y-auto py-2">
        <p className="lk-menu-label">Navegación</p>
        <ul>
          {nav.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            const locked = !allowed.includes(href);
            return (
              <li key={href}>
                <Link
                  href={locked ? '#' : href}
                  onClick={locked ? (e) => e.preventDefault() : undefined}
                  className={`lk-nav-link ${active && !locked ? 'lk-nav-link--active' : ''} ${locked ? 'lk-nav-link--locked' : ''}`}
                  title={locked ? 'Disponible desde el plan Club' : undefined}
                >
                  <span className="lk-nav-icon shrink-0">
                    <Icon size={17} strokeWidth={1.8} />
                  </span>
                  <span className="lk-nav-text">{label}</span>
                  {locked && (
                    <Lock size={11} className="ml-auto shrink-0" style={{ color: '#4a5568' }} />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── Plan footer ── */}
      {planDef && (
        <div className="px-4 py-3" style={{ borderTop: '1px solid #2f3944' }}>
          <div
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold mb-2"
            style={{
              background: planDef.color + '18',
              color: planDef.color,
              border: `1px solid ${planDef.color}30`,
            }}
          >
            <span>Plan {planDef.badge}</span>
            <span className="font-normal opacity-75">{planDef.price}€/mes</span>
          </div>
          <button
            onClick={cambiarPlan}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
            style={{ color: '#9097a7' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = '#fff';
              (e.currentTarget as HTMLButtonElement).style.background = '#2f3944';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = '#9097a7';
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            <ArrowLeftRight size={12} />
            Cambiar plan
          </button>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="px-5 py-3" style={{ borderTop: '1px solid #2f3944' }}>
        <p className="text-[11px]" style={{ color: '#5d7186' }}>
          <span className="lk-footer-text">SaaS Demo · 2026</span>
        </p>
      </div>
    </aside>
  );
}

