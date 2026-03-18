'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { PlanId, PlanDef } from '@/lib/plans';
import { PLANS } from '@/lib/plans';

interface PlanContextType {
  plan: PlanId | null;
  planDef: PlanDef | null;
  setPlan: (p: PlanId) => void;
  clearPlan: () => void;
}

const PlanContext = createContext<PlanContextType>({
  plan: null,
  planDef: null,
  setPlan: () => {},
  clearPlan: () => {},
});

export function PlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlanState] = useState<PlanId | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('demo_plan') as PlanId | null;
    if (stored && PLANS[stored]) setPlanState(stored);
    setLoaded(true);
  }, []);

  const setPlan = (p: PlanId) => {
    setPlanState(p);
    localStorage.setItem('demo_plan', p);
  };

  const clearPlan = () => {
    setPlanState(null);
    localStorage.removeItem('demo_plan');
  };

  if (!loaded) return null; // avoid hydration mismatch

  return (
    <PlanContext.Provider value={{ plan, planDef: plan ? PLANS[plan] : null, setPlan, clearPlan }}>
      {children}
    </PlanContext.Provider>
  );
}

export const usePlan = () => useContext(PlanContext);
