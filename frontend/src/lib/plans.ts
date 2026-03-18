// ─── Plan definitions for the SaaS demo ────────────────────────────────────

export type PlanId = 'starter' | 'club' | 'elite';

export interface PlanDef {
  id: PlanId;
  name: string;
  price: number;
  tagline: string;
  color: string;       // accent hex
  colorLight: string;  // bg tint
  badge: string;       // short label for banner
  features: string[];
  extras: string;
  soporte: string;
}

export const PLANS: Record<PlanId, PlanDef> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 39,
    tagline: 'Para empezar sin complicaciones',
    color: '#22c55e',
    colorLight: '#f0fdf4',
    badge: 'Starter',
    features: [
      'Gestión de clientes',
      'Clases y horarios',
      'Niveles de jugadores',
      'Control de asistencia',
      'Notificaciones email',
    ],
    extras: 'WhatsApp +20€/mes',
    soporte: 'Email',
  },
  club: {
    id: 'club',
    name: 'Club',
    price: 59,
    tagline: 'Gestión completa sin caos',
    color: '#f59e0b',
    colorLight: '#fffbeb',
    badge: 'Club ⭐',
    features: [
      'Gestión de clientes',
      'Clases y horarios',
      'Niveles de jugadores',
      'Control de asistencia',
      'Notificaciones email',
      'Recuperación de clases',
      'Asignación automática',
      'Control de pagos',
      'Vista diaria del club',
    ],
    extras: 'WhatsApp +10€/mes',
    soporte: 'Prioritario',
  },
  elite: {
    id: 'elite',
    name: 'Elite',
    price: 79,
    tagline: 'Para clubs avanzados y en crecimiento',
    color: '#ef4444',
    colorLight: '#fef2f2',
    badge: 'Elite',
    features: [
      'Gestión de clientes',
      'Clases y horarios',
      'Niveles de jugadores',
      'Control de asistencia',
      'Notificaciones email',
      'Recuperación de clases',
      'Asignación automática',
      'Control de pagos',
      'Vista diaria del club',
      'Automatizaciones avanzadas',
      'Reporting avanzado',
      'Multi-club',
      'Integraciones (API)',
      'Personalización (branding)',
    ],
    extras: 'WhatsApp incluido',
    soporte: 'Premium',
  },
};

// Which nav routes are available per plan
export const NAV_ACCESS: Record<PlanId, string[]> = {
  starter: ['/', '/alumnos', '/calendario', '/clases', '/lista-espera'],
  club:    ['/', '/alumnos', '/calendario', '/clases', '/lista-espera', '/recuperaciones', '/notificaciones', '/pistas'],
  elite:   ['/', '/alumnos', '/calendario', '/clases', '/lista-espera', '/recuperaciones', '/notificaciones', '/pistas'],
};

// Feature keys locked per plan
export const FEATURE_LOCKS: Record<string, PlanId> = {
  recuperaciones: 'club',
  pagos: 'club',
  notificaciones: 'club',
  vistadiaria: 'club',
  faltas: 'club',
  automatizaciones: 'elite',
  reporting: 'elite',
  multiclub: 'elite',
  branding: 'elite',
  api: 'elite',
};

export function canAccess(plan: PlanId, feature: string): boolean {
  const minPlan = FEATURE_LOCKS[feature];
  if (!minPlan) return true;
  const order: PlanId[] = ['starter', 'club', 'elite'];
  return order.indexOf(plan) >= order.indexOf(minPlan);
}
