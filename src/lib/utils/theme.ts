/**
 * Theme constants
 * Centralized color and styling values used throughout the app
 * Based on the original theme from Archive
 */

export const darkColors = {
  background: '#09090b', // zinc-950
  card: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
  cardBackground: 'rgba(24, 24, 27, 0.9)', // semantic alias for card
  cardHover: 'rgba(39, 39, 42, 0.9)', // zinc-800/90 — slightly lifted for completed/hover states
  cardBorder: '#27272a', // zinc-800

  primary: '#a3e635', // lime-400
  primaryDark: '#84cc16', // lime-500

  textPrimary: '#ffffff',
  textSecondary: '#a1a1aa', // zinc-400
  textMuted: '#71717a', // zinc-500

  success: '#10b981', // green-500
  successBg: 'rgba(16, 185, 129, 0.1)', // green-500/10
  successText: '#6ee7b7', // green-300

  warning: '#f59e0b', // amber-500
  warningBg: 'rgba(245, 158, 11, 0.1)', // amber-500/10
  warningText: '#fcd34d', // amber-300

  error: '#ef4444', // red-500
  errorBg: 'rgba(239, 68, 68, 0.1)', // red-500/10
  errorText: '#fca5a5', // red-300

  border: '#27272a', // zinc-800
  borderLight: '#3f3f46', // zinc-700

  /** Cyan accents (workout tab rings, rest-day icon) */
  accentCyan: '#06b6d4',
  accentCyanBright: '#22d3ee',
  accentCyanMuted: 'rgba(6, 182, 212, 0.1)',

  /** Text / icons placed on lime primary fills */
  onPrimaryContrast: '#09090b',

  inverseActionBg: '#000000',
  shadowColor: '#000000',
  switchThumb: '#ffffff',

  overlayScrim: 'rgba(9, 9, 11, 0.92)',
  /** Between warning and error on muscle heatmaps */
  heatAccent: '#f97316',

  /** Workout-tab muscle freshness legend + shared RPE zone accents */
  heatmapFullyRecovered: '#22c55e',
  heatmapLightFatigue: '#eab308',
  heatmapModerateFatigue: '#f97316',
  heatmapFullyFatigued: '#ef4444',

  modalBackdropTint: 'rgba(0, 0, 0, 0.5)',
  /** FAB-style control sitting on illustration backgrounds */
  mapControlSurface: '#27272a',
  mapControlBorder: '#52525e',

  authHeroAccentBand: '#18181b',
} as const;

export const lightColors = {
  background: '#fafafa', // zinc-50
  card: 'rgba(255, 255, 255, 0.95)',
  cardBackground: 'rgba(255, 255, 255, 0.95)',
  cardHover: 'rgba(244, 244, 245, 0.95)', // zinc-100/95

  cardBorder: '#e4e4e7', // zinc-200

  primary: '#65a30d', // lime-700 — darker for contrast on light bg
  primaryDark: '#4d7c0f', // lime-800

  textPrimary: '#09090b', // zinc-950
  textSecondary: '#52525b', // zinc-600
  textMuted: '#a1a1aa', // zinc-400

  success: '#059669', // emerald-600
  successBg: 'rgba(5, 150, 105, 0.1)',
  successText: '#047857', // emerald-700

  warning: '#d97706', // amber-600
  warningBg: 'rgba(217, 119, 6, 0.1)',
  warningText: '#b45309', // amber-700

  error: '#dc2626', // red-600
  errorBg: 'rgba(220, 38, 38, 0.1)',
  errorText: '#b91c1c', // red-700

  border: '#e4e4e7', // zinc-200
  borderLight: '#f4f4f5', // zinc-100

  accentCyan: '#0891b2',
  accentCyanBright: '#06b6d4',
  accentCyanMuted: 'rgba(8, 145, 178, 0.12)',

  onPrimaryContrast: '#09090b',

  inverseActionBg: '#09090b',
  shadowColor: 'rgba(15, 23, 42, 0.12)',
  switchThumb: '#ffffff',

  overlayScrim: 'rgba(9, 9, 11, 0.55)',
  heatAccent: '#ea580c',

  heatmapFullyRecovered: '#16a34a',
  heatmapLightFatigue: '#ca8a04',
  heatmapModerateFatigue: '#ea580c',
  heatmapFullyFatigued: '#dc2626',

  modalBackdropTint: 'rgba(9, 9, 11, 0.4)',
  mapControlSurface: '#e4e4e7',
  mapControlBorder: '#d4d4d8',

  authHeroAccentBand: '#e4e4e7',
} as const;

export type ThemeColors = { [K in keyof typeof darkColors]: string };

/** Backward-compat alias — prefer useTheme() in components. */
export const colors = darkColors;

export function isLightTheme(colorsPick: ThemeColors): boolean {
  return colorsPick.background === lightColors.background;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** Layout constants (e.g. tab bar). Use with safe area insets for scroll padding. */
export const layout = {
  tabBarHeight: 72,
} as const;

export const borderRadius = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  full: 9999,
} as const;

export const typography = {
  sizes: {
    xs: 12,
    sm: 14,
    md: 16, // semantic alias for base; matches Tailwind text-base
    base: 16,
    lg: 18,
    xl: 24,
    '2xl': 32,
    '3xl': 42,
    '4xl': 56,
  },
  weights: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  // Reusable text style presets (spread into StyleSheet entries)
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 22,
  },
  caption: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
} as const;

