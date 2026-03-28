import type { Metadata } from 'next';
import './globals.css';
import { PlanProvider } from '@/components/PlanContext';
import AppShell from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'Academia Pádel · Gestión',
  description: 'Sistema de gestión para academia de pádel — alumnos, clases y recuperaciones',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">
        <PlanProvider>
          <AppShell>{children}</AppShell>
        </PlanProvider>
      </body>
    </html>
  );
}
