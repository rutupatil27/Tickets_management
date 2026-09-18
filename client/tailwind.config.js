import { fonts, gradients, palette, radii, shadows } from './src/theme/tokens.js';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: palette.brand,
        ink: palette.ink,
        success: palette.success,
        warning: palette.warning,
        danger: palette.danger,
        info: palette.info,
        accent: palette.accent,
        surface: palette.surface,
      },
      fontFamily: {
        sans: fonts.sans,
      },
      borderRadius: {
        card: radii.card,
        panel: radii.panel,
      },
      boxShadow: {
        card: shadows.card,
        soft: shadows.soft,
        raised: shadows.raised,
        pop: shadows.pop,
      },
      backgroundImage: {
        hero: gradients.hero,
        brand: gradients.brand,
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'typing-dot': {
          '0%, 60%, 100%': { transform: 'translateY(0)', opacity: '0.45' },
          '30%': { transform: 'translateY(-3px)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.18s ease-out',
        'slide-up': 'slide-up 0.22s ease-out',
        shimmer: 'shimmer 1.6s infinite',
        'typing-dot': 'typing-dot 1.2s infinite',
      },
    },
  },
  plugins: [],
};
