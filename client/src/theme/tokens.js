/**
 * SupportDesk design tokens - the single source of truth for colour, radius,
 * shadow and typography.
 *
 * `tailwind.config.js` imports this file, so every Tailwind class
 * (bg-brand-500, shadow-card, rounded-card ...) resolves back to these values.
 * Never hard-code a hex value in a component; add it here instead.
 *
 * Direction: light, airy SaaS dashboard - neutral page, white cards,
 * violet/indigo primary, pastel accents (spec §62/§63).
 */

export const palette = {
  /* Primary - violet/indigo */
  brand: {
    50: '#f5f3ff',
    100: '#ede9fe',
    200: '#ddd6fe',
    300: '#c4b5fd',
    400: '#a78bfa',
    500: '#8b5cf6',
    600: '#7c3aed',
    700: '#6d28d9',
    800: '#5b21b6',
    900: '#4c1d95',
  },

  /* Neutral - page background, borders, text */
  ink: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e6ebf2',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },

  /* Semantic */
  success: {
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    500: '#10b981',
    600: '#059669',
    700: '#047857',
  },
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
  },
  danger: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
  },
  info: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
  },
  accent: {
    orange: '#fb923c',
    peach: '#fed7aa',
    mint: '#6ee7b7',
    sky: '#7dd3fc',
    lilac: '#c4b5fd',
    lemon: '#fde68a',
  },

  surface: {
    page: '#eceef3',
    shell: '#ffffff',
    card: '#ffffff',
    muted: '#f7f8fb',
    sunken: '#f1f3f8',
  },
};

/**
 * Categorical chart palette (spec §43).
 *
 * The ORDER is the accessibility mechanism, not decoration: slots are assigned
 * in sequence and never cycled, and this ordering was validated against the
 * white card surface for colour-vision-deficient separation (worst adjacent
 * pair dE 9.1) and normal-vision separation (worst adjacent pair dE 19.6).
 * Three slots sit under 3:1 contrast on white, so every chart using them ships
 * visible labels or a legend with values - never colour alone.
 *
 * Do not reorder or hand-pick from this list.
 */
export const chartColors = [
  '#2a78d6', // 1 blue
  '#eb6834', // 2 orange
  '#1baf7a', // 3 aqua
  '#eda100', // 4 yellow
  '#e87ba4', // 5 magenta
  '#008300', // 6 green
  '#4a3aa7', // 7 violet
  '#e34948', // 8 red
];

/** Recessive chrome for chart axes and gridlines. */
export const chartInk = {
  grid: '#e6ebf2',
  axis: '#cbd5e1',
  tick: '#94a3b8',
  label: '#475569',
  surface: '#ffffff',
};

export const radii = {
  card: '1.25rem',
  panel: '1.75rem',
  pill: '9999px',
};

export const shadows = {
  card: '0 1px 2px rgba(16, 24, 40, 0.04), 0 12px 32px -18px rgba(16, 24, 40, 0.24)',
  soft: '0 1px 2px rgba(16, 24, 40, 0.05)',
  raised: '0 8px 24px -8px rgba(76, 29, 149, 0.25)',
  pop: '0 20px 45px -20px rgba(15, 23, 42, 0.35)',
};

export const fonts = {
  sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
};

/** Pastel gradient behind the "Quick Overview" strip on the dashboards. */
export const gradients = {
  hero: 'linear-gradient(115deg, #ede9fe 0%, #e0f2fe 38%, #f5f3ff 62%, #ffedd5 100%)',
  brand: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
};

export const theme = { palette, chartColors, chartInk, radii, shadows, fonts, gradients };

export default theme;
