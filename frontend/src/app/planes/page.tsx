'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePlan } from '@/components/PlanContext';
import { PLANS, PlanId } from '@/lib/plans';
import {
  Check, X, Dumbbell, Sparkles, Crown, Zap, Shield, MessageCircle,
  Users, CalendarDays, Trophy, ClipboardCheck, Mail, RotateCcw, Bot,
  CreditCard, BarChart3, Building2, Puzzle, Palette, Headphones,
  ChevronDown,
} from 'lucide-react';

const PLAN_ORDER: PlanId[] = ['starter', 'club', 'elite'];

const ICON_MAP: Record<string, any> = {
  'Gestión de clientes': Users,
  'Clases y horarios': CalendarDays,
  'Niveles de jugadores': Trophy,
  'Control de asistencia': ClipboardCheck,
  'Notificaciones email': Mail,
  'Recuperación de clases': RotateCcw,
  'Asignación automática': Bot,
  'Control de pagos': CreditCard,
  'Vista diaria del club': CalendarDays,
  'Automatizaciones avanzadas': Zap,
  'Reporting avanzado': BarChart3,
  'Multi-club': Building2,
  'Integraciones (API)': Puzzle,
  'Personalización (branding)': Palette,
};

const FEATURE_DESC: Record<string, string> = {
  'Gestión de clientes': 'Alta, baja y edición de alumnos. Ficha completa con datos de contacto, nivel y estado de pago.',
  'Clases y horarios': 'Crea clases con día, hora, pista y profesor. Gestiona el horario completo de tu academia.',
  'Niveles de jugadores': 'Clasifica a tus alumnos por nivel (Iniciación, Intermedio, Avanzado, Competición) para organizar grupos.',
  'Control de asistencia': 'Registra asistencia y faltas por sesión. Historial completo de cada alumno.',
  'Notificaciones email': 'Envía avisos automáticos por email a alumnos y familias sobre cambios, cancelaciones o recordatorios.',
  'Recuperación de clases': 'Genera recuperaciones automáticas cuando un alumno falta. Control de vencimientos y reubicación.',
  'Asignación automática': 'El sistema sugiere la mejor clase disponible al inscribir un nuevo alumno según nivel y horario.',
  'Control de pagos': 'Registra pagos mensuales, controla morosos y consulta el estado financiero de cada alumno.',
  'Vista diaria del club': 'Panel visual con todas las clases del día, ocupación de pistas y actividad en tiempo real.',
  'Automatizaciones avanzadas': 'Reglas automáticas: listas de espera, reasignaciones, alertas de capacidad y más.',
  'Reporting avanzado': 'Estadísticas detalladas: ocupación, retención, ingresos, asistencia, tendencias y exportación a Excel.',
  'Multi-club': 'Gestiona varias sedes desde un único panel. Datos separados por club con vista consolidada.',
  'Integraciones (API)': 'API REST para conectar con tu web, CRM, pasarela de pagos u otras herramientas externas.',
  'Personalización (branding)': 'Logo, colores y dominio propio. Emails y portal de alumnos con tu imagen corporativa.',
};

const PLAN_ICONS: Record<PlanId, any> = {
  starter: Sparkles,
  club: Crown,
  elite: Shield,
};

// All features in order for comparison table
const ALL_FEATURES = [
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
];

export default function PlanesPage() {
  const router = useRouter();
  const { setPlan } = usePlan();
  const [expanded, setExpanded] = useState<string | null>(null);

  const elegir = (id: PlanId) => {
    setPlan(id);
    router.push('/');
  };

  const toggle = (feat: string) => {
    setExpanded(expanded === feat ? null : feat);
  };

  return (
    <div className="planes-page">
      {/* Decorative background */}
      <div className="planes-bg" />

      <div className="planes-container">
        {/* Hero */}
        <header className="planes-header">
          <div className="planes-logo">
            <div className="planes-logo-icon">
              <Dumbbell size={28} strokeWidth={2.5} />
            </div>
          </div>
          <h1 className="planes-title">
            Elige el plan para tu club
          </h1>
          <p className="planes-subtitle">
            Gestiona tu academia de pádel como un profesional.<br />
            Sin permanencia · Cancela cuando quieras · Soporte incluido
          </p>
        </header>

        {/* Cards */}
        <div className="planes-grid">
          {PLAN_ORDER.map((planId) => {
            const p = PLANS[planId];
            const PlanIcon = PLAN_ICONS[planId];
            const isPopular = planId === 'club';

            return (
              <div
                key={planId}
                className={`plan-card ${isPopular ? 'plan-card--popular' : ''}`}
                style={{ '--plan-color': p.color, '--plan-light': p.colorLight } as any}
              >
                {isPopular && (
                  <div className="plan-popular-badge">
                    <Crown size={12} /> Más contratado
                  </div>
                )}

                <div className="plan-card-header">
                  <div className="plan-icon-wrap" style={{ background: p.colorLight }}>
                    <PlanIcon size={22} style={{ color: p.color }} />
                  </div>
                  <h2 className="plan-name" style={{ color: p.color }}>{p.name}</h2>
                  <div className="plan-price">
                    <span className="plan-price-amount">{p.price}</span>
                    <span className="plan-price-unit">€/mes</span>
                  </div>
                  <p className="plan-tagline">{p.tagline}</p>
                </div>

                <div className="plan-card-body">
                  <ul className="plan-features">
                    {ALL_FEATURES.map((feat) => {
                      const has = p.features.includes(feat);
                      const FeatIcon = ICON_MAP[feat] || Check;
                      const isExpanded = expanded === feat;
                      const desc = FEATURE_DESC[feat];
                      return (
                        <li key={feat} className={`plan-feat-wrap ${has ? '' : 'plan-feat-wrap--disabled'}`}>
                          <button
                            type="button"
                            onClick={() => desc && toggle(feat)}
                            className={`plan-feat ${has ? '' : 'plan-feat--disabled'}`}
                            style={{ cursor: desc ? 'pointer' : 'default' }}
                          >
                            {has ? (
                              <FeatIcon size={14} style={{ color: p.color }} />
                            ) : (
                              <X size={14} className="plan-feat-x" />
                            )}
                            <span className="flex-1 text-left">{feat}</span>
                            {desc && (
                              <ChevronDown size={12} className={`plan-feat-chevron ${isExpanded ? 'plan-feat-chevron--open' : ''}`} />
                            )}
                          </button>
                          {isExpanded && desc && (
                            <p className="plan-feat-desc">{desc}</p>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  {/* WhatsApp */}
                  <div className="plan-extra">
                    <MessageCircle size={14} />
                    <span>WhatsApp: <strong>{p.extras.replace('WhatsApp ', '')}</strong></span>
                  </div>

                  {/* Soporte */}
                  <div className="plan-support">
                    <Headphones size={14} />
                    <span>Soporte {p.soporte}</span>
                  </div>
                </div>

                <button
                  onClick={() => elegir(planId)}
                  className="plan-cta"
                  style={{ background: p.color }}
                >
                  Probar {p.name}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <footer className="planes-footer">
          <p>Demo interactiva · Selecciona un plan para explorar las funcionalidades del panel</p>
        </footer>
      </div>
    </div>
  );
}
