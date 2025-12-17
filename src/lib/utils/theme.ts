/**
 * Theme constants
 * Centralized color and styling values used throughout the app
 * Based on the original theme from Archive
 */

export const colors = {
  // Backgrounds
  background: '#09090b', // zinc-950
  card: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
  cardBorder: '#27272a', // zinc-800
  
  // Primary accent
  primary: '#a3e635', // lime-400
  primaryDark: '#84cc16', // lime-500
  
  // Text
  textPrimary: '#ffffff',
  textSecondary: '#a1a1aa', // zinc-400
  textMuted: '#71717a', // zinc-500
  
  // States
  error: '#ef4444', // red-500
  errorBg: 'rgba(239, 68, 68, 0.1)', // red-500/10
  errorText: '#fca5a5', // red-300
  
  // Borders
  border: '#27272a', // zinc-800
  borderLight: '#3f3f46', // zinc-700
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
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
    base: 16,
    lg: 18,
    xl: 24,
    '2xl': 32,
    '3xl': 42,
  },
  weights: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
} as const;

