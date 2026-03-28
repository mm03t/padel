'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePlan } from '@/components/PlanContext';
import { PLANS } from '@/lib/plans';
import Sidebar from '@/components/Sidebar';
import { ArrowRight, Menu, ChevronRight } from 'lucide-react';

const PAGE_TITLES: Record<string, string> = {
  '/':               'Dashboard',
  '/alumnos':        'Alumnos',
  '/calendario':     'Calendario',
  '/clases':         'Clases',
  '/lista-espera':   'Lista de Espera',
  '/recuperaciones': 'Recuperaciones',
  '/pistas':         'Pistas',
  '/sesiones':       'Sesiones',
  '/notificaciones': 'Notificaciones',
  '/planes':         'Planes',
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const base = '/' + pathname.split('/')[1];
  return PAGE_TITLES[base] ?? 'Panel';
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { plan, planDef } = usePlan();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isPlanes = pathname === '/planes';
  const pageTitle = getPageTitle(pathname);

  useEffect(() => {
    if (!plan && !isPlanes) {
      router.replace('/planes');
    }
  }, [plan, isPlanes, router]);

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  if (isPlanes) return <>{children}</>;
  if (!plan) return null;

  const nextPlan = plan === 'starter' ? PLANS.club : plan === 'club' ? PLANS.elite : null;

  return (
    <div className="lk-wrapper">
      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Right column: topbar + content */}
      <div className="lk-content-col">

        {/* ── Topbar ── */}
        <header className="lk-topbar">
          <div className="lk-topbar-inner">

            {/* Left: hamburger + breadcrumb */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lk-topbar-btn lg:hidden shrink-0"
                aria-label="Abrir menú"
              >
                <Menu size={20} />
              </button>

              {/* Page breadcrumb */}
              <div className="flex items-center gap-1.5 text-sm min-w-0">
                <span className="text-[#9097a7] hidden sm:block">Academia Pádel</span>
                <ChevronRight size={13} className="text-[#c8cdd5] hidden sm:block shrink-0" />
                <span
                  className="font-bold uppercase tracking-wide text-[13px] truncate"
                  style={{ color: 'var(--lk-text-dark)' }}
                >
                  {pageTitle}
                </span>
              </div>
            </div>

            {/* Right: plan badge + upgrade + avatar */}
            <div className="flex items-center gap-2 shrink-0">

              {/* Plan badge */}
              <div
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{
                  background: planDef!.color + '15',
                  color: planDef!.color,
                  border: `1px solid ${planDef!.color}28`,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: planDef!.color }}
                />
                DEMO · Plan {planDef!.badge}
                <span className="opacity-60 font-normal">· {planDef!.price}€/mes</span>
              </div>

              {/* Upgrade button */}
              {nextPlan && (
                <Link
                  href="/planes"
                  className="hidden md:flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                  style={{
                    background: nextPlan.color + '14',
                    color: nextPlan.color,
                    border: `1px solid ${nextPlan.color}28`,
                  }}
                >
                  Upgrade a {nextPlan.badge}
                  <ArrowRight size={11} />
                </Link>
              )}

              {/* Avatar */}
              <button className="lk-topbar-btn" title="Perfil">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
                  style={{ background: '#ff6c2f' }}
                >
                  AP
                </div>
              </button>
            </div>
          </div>
        </header>

        {/* ── Contenido ── */}
        <main className="lk-main-content">
          {children}
        </main>

      </div>
    </div>
  );
}
