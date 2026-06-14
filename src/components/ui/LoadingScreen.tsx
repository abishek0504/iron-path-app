/**
 * Full-screen loading state with the logo outline loader.
 */

import { useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LogoEdgeLoader, type LogoEdgeLoaderSize, type LogoEdgeLoaderVariant } from './LogoEdgeLoader';
import { layout, spacing, typography, type ThemeColors } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';

export interface LoadingScreenChrome {
  /** Height of a header row rendered above this loader (e.g. TabHeader). */
  top?: number;
  /** Height of bottom UI overlaying the pane (defaults to tab bar). */
  bottom?: number;
}

export interface LoadingScreenProps {
  message?: string;
  size?: LogoEdgeLoaderSize;
  variant?: LogoEdgeLoaderVariant;
  style?: ViewStyle;
  /**
   * Shift the loader so it sits at the visual center of the device screen,
   * compensating for headers above and the tab bar below.
   */
  centerInViewport?: boolean;
  /** Override chrome heights when centerInViewport is true. */
  chrome?: LoadingScreenChrome;
}

function getTabBarOverlayHeight(bottomInset: number): number {
  return layout.tabBarHeight + Math.max(bottomInset, spacing.md);
}

function getViewportOffsetY(
  insets: { top: number; bottom: number },
  chrome: LoadingScreenChrome,
): number {
  const topChrome = chrome.top ?? 0;
  const bottomChrome = chrome.bottom ?? getTabBarOverlayHeight(insets.bottom);
  return -((insets.top + topChrome) / 2 + bottomChrome / 2);
}

export function LoadingScreen({
  message,
  size = 'xlarge',
  variant = 'brand',
  style,
  centerInViewport = false,
  chrome = {},
}: LoadingScreenProps) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const offsetY = centerInViewport ? getViewportOffsetY(insets, chrome) : 0;

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.centeredContent, { transform: [{ translateY: offsetY }] }]}>
        <LogoEdgeLoader size={size} variant={variant} />
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    centeredContent: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.lg,
      paddingHorizontal: spacing.lg,
    },
    message: {
      color: colors.textSecondary,
      fontSize: typography.sizes.md,
      textAlign: 'center',
    },
  });
}
