'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { usePlan } from '@/components/PlanContext';
import Sidebar from '@/components/Sidebar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { plan } = usePlan();

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

  // App with sidebar
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
