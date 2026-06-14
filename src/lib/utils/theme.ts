/**
 * Theme constants
 * Centralized color and styling values used throughout the app
 * Based on the original theme from Archive
 */

import { Monitor, Moon, Sparkles, Sun, type LucideIcon } from 'lucide-react-native';

export const darkColors = {
  background: '#09090b', // zinc-950
  card: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
  cardBackground: 'rgba(24, 24, 27, 0.9)', // semantic alias for card
  tabBarSurface: '#18181b', // zinc-900 — opaque floating tab bar capsule
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

  /** Untrained / neutral muscle fill + body silhouette outline */
  heatmapBodyDefault: '#3f3f3f',
  heatmapBodyBorder: '#52525b',

  modalBackdropTint: 'rgba(0, 0, 0, 0.5)',
  /** FAB-style control sitting on illustration backgrounds */
  mapControlSurface: '#27272a',
  mapControlBorder: '#52525e',

  authHeroAccentBand: '#18181b',

  primarySubtleBg: 'rgba(163, 230, 53, 0.1)',
  primarySelectedBg: 'rgba(163, 230, 53, 0.2)',
  authOverlayCard: 'rgba(24, 24, 27, 0.92)',
  authTextShadow: 'rgba(0, 0, 0, 0.8)',
  dialogBackdropTint: 'rgba(0, 0, 0, 0.6)',

  /** Workout tab — ambient glows, badges, rest day, disabled CTA */
  workoutGlowPrimary: 'rgba(132, 204, 22, 0.12)',
  workoutGlowAccent: 'rgba(6, 182, 212, 0.12)',
  workoutBadgePrimaryBg: 'rgba(163, 230, 53, 0.2)',
  workoutBadgePrimaryBorder: 'rgba(163, 230, 53, 0.2)',
  workoutBadgeSecondaryBg: 'rgba(39, 39, 42, 0.4)',
  workoutBadgeSecondaryBorder: 'rgba(63, 63, 70, 0.3)',
  workoutIconTintBg: 'rgba(163, 230, 53, 0.2)',
  workoutRestIconBg: 'rgba(6, 182, 212, 0.1)',
  workoutRestTitle: '#22d3ee',
  workoutDisabledRing: '#3f3f46',
  workoutDisabledFill: 'rgba(39, 39, 42, 0.9)',
  workoutDisabledText: '#71717a',
  workoutControlSurface: 'rgba(39, 39, 42, 0.6)',
  workoutCardShadow: 'transparent',
} as const;

export const lightColors = {
  background: '#fafafa', // zinc-50
  card: 'rgba(255, 255, 255, 0.95)',
  cardBackground: 'rgba(255, 255, 255, 0.95)',
  tabBarSurface: '#ffffff',
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

  heatmapFullyRecovered: '#4ade80',
  heatmapLightFatigue: '#eab308',
  heatmapModerateFatigue: '#f97316',
  heatmapFullyFatigued: '#ef4444',

  heatmapBodyDefault: '#f4f4f5',
  heatmapBodyBorder: '#d4d4d8',

  modalBackdropTint: 'rgba(9, 9, 11, 0.4)',
  mapControlSurface: '#e4e4e7',
  mapControlBorder: '#d4d4d8',

  authHeroAccentBand: '#e4e4e7',

  primarySubtleBg: 'rgba(101, 163, 13, 0.12)',
  primarySelectedBg: 'rgba(101, 163, 13, 0.18)',
  authOverlayCard: 'rgba(255, 255, 255, 0.92)',
  authTextShadow: 'rgba(0, 0, 0, 0.55)',
  dialogBackdropTint: 'rgba(9, 9, 11, 0.5)',

  workoutGlowPrimary: 'rgba(101, 163, 13, 0.2)',
  workoutGlowAccent: 'rgba(8, 145, 178, 0.18)',
  workoutBadgePrimaryBg: 'rgba(101, 163, 13, 0.14)',
  workoutBadgePrimaryBorder: 'rgba(101, 163, 13, 0.3)',
  workoutBadgeSecondaryBg: '#f4f4f5',
  workoutBadgeSecondaryBorder: '#d4d4d8',
  workoutIconTintBg: 'rgba(101, 163, 13, 0.14)',
  workoutRestIconBg: 'rgba(8, 145, 178, 0.14)',
  workoutRestTitle: '#15803d',
  workoutDisabledRing: '#d4d4d8',
  workoutDisabledFill: '#ffffff',
  workoutDisabledText: '#52525b',
  workoutControlSurface: '#f4f4f5',
  workoutCardShadow: 'rgba(15, 23, 42, 0.08)',
} as const;

export const pinkColors = {
  background: '#fff1f2', // rose-50
  card: 'rgba(255, 255, 255, 0.95)',
  cardBackground: 'rgba(255, 255, 255, 0.95)',
  tabBarSurface: '#ffffff',
  cardHover: 'rgba(255, 228, 230, 0.95)', // rose-100
  cardBorder: '#fecdd3', // pink-200

  primary: '#ec4899', // pink-500
  primaryDark: '#db2777', // pink-600

  textPrimary: '#881337', // pink-900
  textSecondary: '#be185d', // pink-700
  textMuted: '#f472b6', // pink-400

  success: '#059669', // emerald-600
  successBg: 'rgba(5, 150, 105, 0.1)',
  successText: '#047857', // emerald-700

  warning: '#d97706', // amber-600
  warningBg: 'rgba(217, 119, 6, 0.1)',
  warningText: '#b45309', // amber-700

  error: '#dc2626', // red-600
  errorBg: 'rgba(220, 38, 38, 0.1)',
  errorText: '#b91c1c', // red-700

  border: '#fecdd3', // pink-200
  borderLight: '#ffe4e6', // rose-100

  accentCyan: '#c026d3', // fuchsia-600
  accentCyanBright: '#d946ef', // fuchsia-500
  accentCyanMuted: 'rgba(192, 38, 211, 0.12)',

  onPrimaryContrast: '#ffffff',

  inverseActionBg: '#881337',
  shadowColor: 'rgba(136, 19, 55, 0.12)',
  switchThumb: '#ffffff',

  overlayScrim: 'rgba(136, 19, 55, 0.55)',
  heatAccent: '#ea580c',

  heatmapFullyRecovered: '#f472b6',
  heatmapLightFatigue: '#fbbf24',
  heatmapModerateFatigue: '#fb923c',
  heatmapFullyFatigued: '#f87171',

  heatmapBodyDefault: '#fff1f2',
  heatmapBodyBorder: '#fecdd3',

  modalBackdropTint: 'rgba(136, 19, 55, 0.4)',
  mapControlSurface: '#fecdd3',
  mapControlBorder: '#fda4af',

  authHeroAccentBand: '#fecdd3',

  primarySubtleBg: 'rgba(236, 72, 153, 0.12)',
  primarySelectedBg: 'rgba(236, 72, 153, 0.2)',
  authOverlayCard: 'rgba(255, 255, 255, 0.92)',
  authTextShadow: 'rgba(136, 19, 55, 0.5)',
  dialogBackdropTint: 'rgba(136, 19, 55, 0.5)',

  workoutGlowPrimary: 'rgba(236, 72, 153, 0.24)',
  workoutGlowAccent: 'rgba(192, 38, 211, 0.16)',
  workoutBadgePrimaryBg: 'rgba(236, 72, 153, 0.14)',
  workoutBadgePrimaryBorder: 'rgba(236, 72, 153, 0.32)',
  workoutBadgeSecondaryBg: '#ffe4e6',
  workoutBadgeSecondaryBorder: '#fecdd3',
  workoutIconTintBg: 'rgba(236, 72, 153, 0.14)',
  workoutRestIconBg: 'rgba(236, 72, 153, 0.14)',
  workoutRestTitle: '#db2777',
  workoutDisabledRing: '#fda4af',
  workoutDisabledFill: '#ffffff',
  workoutDisabledText: '#9d174d',
  workoutControlSurface: '#ffe4e6',
  workoutCardShadow: 'rgba(136, 19, 55, 0.1)',
} as const;

export type ThemeColors = { [K in keyof typeof darkColors]: string };

export type ThemeOptionId = 'dark' | 'light' | 'system' | 'pink';

export interface ThemeOption {
  id: ThemeOptionId;
  label: string;
  description: string;
  icon: LucideIcon;
  colors: ThemeColors | null;
}

export const THEME_OPTIONS: readonly ThemeOption[] = [
  {
    id: 'dark',
    label: 'Dark',
    description: 'Deep zinc with lime accents',
    icon: Moon,
    colors: darkColors,
  },
  {
    id: 'light',
    label: 'Light',
    description: 'Clean white with green accents',
    icon: Sun,
    colors: lightColors,
  },
  {
    id: 'system',
    label: 'System',
    description: 'Matches your device',
    icon: Monitor,
    colors: null,
  },
  {
    id: 'pink',
    label: 'Pink',
    description: 'Soft blush with rose accents',
    icon: Sparkles,
    colors: pinkColors,
  },
] as const;

export function getThemeLabel(mode: ThemeOptionId): string {
  return THEME_OPTIONS.find((option) => option.id === mode)?.label ?? 'Dark';
}

/** Backward-compat alias — prefer useTheme() in components. */
export const colors = darkColors;

export function isLightTheme(colorsPick: ThemeColors): boolean {
  return (
    colorsPick.background === lightColors.background ||
    colorsPick.background === pinkColors.background
  );
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

