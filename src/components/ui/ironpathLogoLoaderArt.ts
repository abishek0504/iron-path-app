/**
 * Vector art from theme-specific IronPath logo SVGs in assets/
 * (logo shapes only — card backgrounds omitted so art works on any screen bg)
 *
 * - dark:  assets/ironpath_logo_loader_whole_fade.svg
 * - light: assets/ironpath_white_theme_loader_fade_corrected.svg
 * - pink:  assets/ironpath_pink_theme_loader_fade_corrected.svg
 */

import type { ThemeMode } from '../../lib/utils/ThemeContext';

export const IRONPATH_LOADER_VIEWBOX = '0 0 1024 1024';

export type LogoArtThemeId = 'dark' | 'light' | 'pink';

export type LogoPathShape = {
  id: string;
  d: string;
  fill: string;
};

const ACCENT_FILL = '#a3e635';

const ACCENT_SHAPE_IDS = new Set(['shape-06-bottom-p', 'shape-10-top-p']);

const LOGO_SHAPE_GEOMETRY = [
  {
    id: 'shape-01-top-i',
    d: 'M 370.73 280.91 L 482.60 280.91 L 426.26 478.52 L 315.20 479.34 Z',
  },
  {
    id: 'shape-02-left-inner',
    d: 'M 254.78 419.73 L 282.54 419.73 L 237.63 564.26 L 209.86 564.26 Z',
  },
  {
    id: 'shape-03-left-mid',
    d: 'M 213.13 430.34 L 240.89 429.52 L 205.78 543.03 L 178.83 543.03 Z',
  },
  {
    id: 'shape-04-left-outer',
    d: 'M 169.03 460.56 L 193.53 460.56 L 176.38 516.90 L 151.07 516.90 Z',
  },
  {
    id: 'shape-05-bottom-i',
    d: 'M 306.22 508.73 L 418.09 508.73 L 352.77 739.01 L 241.71 739.01 Z',
  },
  {
    id: 'shape-06-bottom-p',
    d: 'M 507.10 739.01 L 399.31 739.01 L 465.45 506.28 L 766.78 506.28 L 749.63 562.63 L 730.85 574.88 L 713.70 583.04 L 687.57 591.21 L 665.52 594.48 L 549.56 594.48 Z',
  },
  {
    id: 'shape-07-right-inner',
    d: 'M 759.43 558.55 L 798.62 431.97 L 824.75 431.16 L 785.56 557.73 Z',
  },
  {
    id: 'shape-08-right-mid',
    d: 'M 799.44 544.66 L 828.02 453.21 L 852.52 453.21 L 823.94 544.66 Z',
  },
  {
    id: 'shape-09-right-outer',
    d: 'M 841.08 520.98 L 853.33 481.79 L 872.93 481.79 L 861.50 520.17 Z',
  },
  {
    id: 'shape-10-top-p',
    d: 'M 526.70 280.91 L 716.15 280.91 L 739.01 284.17 L 759.43 290.70 L 789.64 308.67 L 805.97 325.00 L 815.77 339.70 L 825.57 362.56 L 829.65 383.80 L 829.65 405.03 L 827.20 422.99 L 792.91 424.63 L 775.76 479.34 L 693.28 479.34 L 702.26 466.27 L 709.61 449.94 L 712.88 435.24 L 712.88 422.18 L 706.35 401.76 L 691.65 387.06 L 672.87 380.53 L 498.12 380.53 Z',
  },
] as const;

const THEME_MARK_FILLS: Record<LogoArtThemeId, string> = {
  dark: '#f5f5f0',
  light: '#09090b',
  pink: '#ff2ea6',
};

export function resolveLogoArtThemeId(
  themeMode: ThemeMode,
  colorScheme: 'light' | 'dark' | null | undefined,
): LogoArtThemeId {
  if (themeMode === 'pink') return 'pink';
  if (themeMode === 'light') return 'light';
  if (themeMode === 'dark') return 'dark';
  return colorScheme === 'light' ? 'light' : 'dark';
}

export function getLogoPaths(themeId: LogoArtThemeId): LogoPathShape[] {
  const markFill = THEME_MARK_FILLS[themeId];

  return LOGO_SHAPE_GEOMETRY.map((shape) => ({
    id: shape.id,
    d: shape.d,
    fill: ACCENT_SHAPE_IDS.has(shape.id) ? ACCENT_FILL : markFill,
  }));
}

/** Monochrome logo for primary buttons and other high-contrast surfaces. */
export function getMonochromeLogoPaths(fill: string): LogoPathShape[] {
  return LOGO_SHAPE_GEOMETRY.map((shape) => ({
    id: shape.id,
    d: shape.d,
    fill,
  }));
}

/** @deprecated Use getLogoPaths('dark') — kept for any external imports */
export const IRONPATH_LOADER_PATHS = getLogoPaths('dark');

/** Matches SVG: ironpathWholeFade 1.8s ease-in-out */
export const IRONPATH_LOADER_FADE_DURATION_MS = 1800;
export const IRONPATH_LOADER_FADE_MIN_OPACITY = 0.35;
export const IRONPATH_LOADER_FADE_MAX_OPACITY = 1;
