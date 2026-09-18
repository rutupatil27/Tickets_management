/**
 * Status / priority / availability visual language (spec §63).
 * Components read from here so a colour is only ever defined once.
 */
import {
  AVAILABILITY,
  TICKET_PRIORITY,
  TICKET_STATUS,
} from '../utils/constants.js';

export const STATUS_STYLES = {
  [TICKET_STATUS.OPEN]: {
    badge: 'bg-info-50 text-info-700 ring-1 ring-inset ring-info-200',
    dot: 'bg-info-500',
    bar: 'bg-info-500',
    hex: '#3b82f6',
  },
  [TICKET_STATUS.WAITING_FOR_AGENT]: {
    badge: 'bg-warning-50 text-warning-700 ring-1 ring-inset ring-warning-200',
    dot: 'bg-warning-500',
    bar: 'bg-warning-500',
    hex: '#f59e0b',
  },
  [TICKET_STATUS.ASSIGNED]: {
    badge: 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200',
    dot: 'bg-brand-500',
    bar: 'bg-brand-500',
    hex: '#8b5cf6',
  },
  [TICKET_STATUS.IN_PROGRESS]: {
    badge: 'bg-brand-100 text-brand-800 ring-1 ring-inset ring-brand-300',
    dot: 'bg-brand-600',
    bar: 'bg-brand-600',
    hex: '#7c3aed',
  },
  [TICKET_STATUS.WAITING_FOR_CUSTOMER]: {
    badge: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200',
    dot: 'bg-accent-orange',
    bar: 'bg-accent-orange',
    hex: '#fb923c',
  },
  [TICKET_STATUS.RESOLVED]: {
    badge: 'bg-success-50 text-success-700 ring-1 ring-inset ring-success-200',
    dot: 'bg-success-500',
    bar: 'bg-success-500',
    hex: '#10b981',
  },
  [TICKET_STATUS.CLOSED]: {
    badge: 'bg-ink-100 text-ink-600 ring-1 ring-inset ring-ink-200',
    dot: 'bg-ink-400',
    bar: 'bg-ink-400',
    hex: '#94a3b8',
  },
  [TICKET_STATUS.REOPENED]: {
    badge: 'bg-danger-50 text-danger-700 ring-1 ring-inset ring-danger-200',
    dot: 'bg-danger-500',
    bar: 'bg-danger-500',
    hex: '#ef4444',
  },
};

export const PRIORITY_STYLES = {
  [TICKET_PRIORITY.LOW]: {
    badge: 'bg-ink-100 text-ink-600 ring-1 ring-inset ring-ink-200',
    dot: 'bg-ink-400',
    hex: '#94a3b8',
  },
  [TICKET_PRIORITY.MEDIUM]: {
    badge: 'bg-info-50 text-info-700 ring-1 ring-inset ring-info-200',
    dot: 'bg-info-500',
    hex: '#3b82f6',
  },
  [TICKET_PRIORITY.HIGH]: {
    badge: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200',
    dot: 'bg-accent-orange',
    hex: '#fb923c',
  },
  [TICKET_PRIORITY.URGENT]: {
    badge: 'bg-danger-50 text-danger-700 ring-1 ring-inset ring-danger-200',
    dot: 'bg-danger-500',
    hex: '#ef4444',
  },
};

export const AVAILABILITY_STYLES = {
  [AVAILABILITY.AVAILABLE]: {
    badge: 'bg-success-50 text-success-700 ring-1 ring-inset ring-success-200',
    dot: 'bg-success-500',
    hex: '#10b981',
  },
  [AVAILABILITY.BUSY]: {
    badge: 'bg-warning-50 text-warning-700 ring-1 ring-inset ring-warning-200',
    dot: 'bg-warning-500',
    hex: '#f59e0b',
  },
  [AVAILABILITY.OFFLINE]: {
    badge: 'bg-ink-100 text-ink-500 ring-1 ring-inset ring-ink-200',
    dot: 'bg-ink-400',
    hex: '#94a3b8',
  },
};

export const ROLE_STYLES = {
  customer: 'bg-info-50 text-info-700 ring-1 ring-inset ring-info-200',
  agent: 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200',
  admin: 'bg-danger-50 text-danger-700 ring-1 ring-inset ring-danger-200',
};

const FALLBACK = {
  badge: 'bg-ink-100 text-ink-600 ring-1 ring-inset ring-ink-200',
  dot: 'bg-ink-400',
  bar: 'bg-ink-400',
  hex: '#94a3b8',
};

export const statusStyle = (status) => STATUS_STYLES[status] ?? FALLBACK;
export const priorityStyle = (priority) => PRIORITY_STYLES[priority] ?? FALLBACK;
export const availabilityStyle = (availability) => AVAILABILITY_STYLES[availability] ?? FALLBACK;
export const roleStyle = (role) => ROLE_STYLES[role] ?? FALLBACK.badge;

/** Deterministic pastel for avatar fallbacks, derived from the user's name. */
const AVATAR_TONES = [
  'bg-brand-100 text-brand-700',
  'bg-info-100 text-info-700',
  'bg-success-100 text-success-700',
  'bg-warning-100 text-warning-700',
  'bg-danger-100 text-danger-700',
  'bg-ink-200 text-ink-700',
];

export function avatarTone(seed = '') {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 997;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}
