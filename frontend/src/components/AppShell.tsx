'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { usePlan } from '@/components/PlanContext';
import { PLANS } from '@/lib/plans';
import Sidebar from '@/components/Sidebar';
import { ArrowRight } from 'lucide-react';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { plan, planDef } = usePlan();

  const isPlanes = pathname === '/planes';

  // If no plan selected and not on /planes, redirect to /planes
  useEffect(() => {
    if (!plan && !isPlanes) {
      router.replace('/planes');
    }
  }, [plan, isPlanes, router]);

  // Planes page: full-screen, no sidebar
  if (isPlanes) {
    return <>{children}</>;
  }

  // No plan yet: show nothing while redirecting
  if (!plan) return null;

  // Next plan up for upgrade CTA
  const nextPlan = plan === 'starter' ? PLANS.club : plan === 'club' ? PLANS.elite : null;

  // App with sidebar
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Plan indicator banner */}
        <div
          className="flex items-center justify-between px-6 py-2 text-xs font-semibold shrink-0"
          style={{ background: planDef!.color + '10', borderBottom: `1px solid ${planDef!.color}20` }}
        >
          <div className="flex items-center gap-2">
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: planDef!.color + '20', color: planDef!.color }}
            >
              DEMO
            </span>
            <span style={{ color: planDef!.color }}>
              Plan {planDef!.badge}
              <span className="text-slate-400 font-normal"> · {planDef!.price}€/mes</span>
            </span>
          </div>
          {nextPlan && (
            <Link
              href="/planes"
              className="flex items-center gap-1 transition-colors hover:opacity-80"
              style={{ color: nextPlan.color }}
            >
              Upgrade a {nextPlan.badge} <ArrowRight size={11} />
            </Link>
          )}
        </div>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
