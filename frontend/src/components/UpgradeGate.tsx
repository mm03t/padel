'use client';

import { useRouter } from 'next/navigation';
import { Lock, ArrowRight } from 'lucide-react';
import { usePlan } from '@/components/PlanContext';
import { FEATURE_LOCKS, PLANS } from '@/lib/plans';
import type { PlanId } from '@/lib/plans';

interface Props {
  feature: keyof typeof FEATURE_LOCKS;
  children: React.ReactNode;
}

const ORDER: PlanId[] = ['starter', 'club', 'elite'];

export default function UpgradeGate({ feature, children }: Props) {
  const { plan } = usePlan();
  const router = useRouter();

  if (!plan) return null;

  const minPlan = FEATURE_LOCKS[feature];
  const currentIdx = ORDER.indexOf(plan);
  const requiredIdx = ORDER.indexOf(minPlan);

  if (currentIdx >= requiredIdx) return <>{children}</>;

  const target = PLANS[minPlan];

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-5">
        <div
          className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: target.color + '18' }}
        >
          <Lock size={28} style={{ color: target.color }} />
        </div>
        <h2 className="text-xl font-bold text-slate-800">
          Funcionalidad no disponible
        </h2>
        <p className="text-slate-500 text-sm leading-relaxed">
          <strong>{feature.charAt(0).toUpperCase() + feature.slice(1)}</strong> está disponible
          a partir del plan <strong style={{ color: target.color }}>{target.badge}</strong>.
        </p>
        <button
          onClick={() => router.push('/planes')}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-white text-sm font-semibold transition-transform hover:scale-105"
          style={{ background: target.color }}
        >
          Ver planes <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
