'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  RotateCcw,
  MessageCircle,
} from 'lucide-react';

const nav = [
  { href: '/',                label: 'Dashboard',       icon: LayoutDashboard },
  { href: '/alumnos',         label: 'Alumnos',         icon: Users },
  { href: '/clases',          label: 'Clases',          icon: CalendarDays },
  { href: '/recuperaciones',  label: 'Recuperaciones',  icon: RotateCcw },
  { href: '/notificaciones',  label: 'WhatsApp',        icon: MessageCircle },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-slate-900 text-white flex flex-col shrink-0 h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-700/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-500 rounded-lg flex items-center justify-center text-lg font-black">
            🎾
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">Academia Pádel</p>
            <p className="text-xs text-slate-400">Panel de gestión</p>
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 p-3 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon size={17} strokeWidth={2} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-700/60">
        <p className="text-xs text-slate-500">MVP v1.0 · 2026</p>
      </div>
    </aside>
  );
}
