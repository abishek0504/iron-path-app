/**
 * IronPath logo loader — theme-aware fade animation from assets/*_loader_fade*.svg
 */

import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View, useColorScheme, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { G, Path } from 'react-native-svg';
import {
  getLogoPaths,
  getMonochromeLogoPaths,
  IRONPATH_LOADER_FADE_DURATION_MS,
  IRONPATH_LOADER_FADE_MAX_OPACITY,
  IRONPATH_LOADER_FADE_MIN_OPACITY,
  IRONPATH_LOADER_VIEWBOX,
  resolveLogoArtThemeId,
} from './ironpathLogoLoaderArt';
import { useTheme, useThemeMode } from '../../lib/utils/ThemeContext';

const AnimatedG = Animated.createAnimatedComponent(G);

const SIZE_MAP = {
  small: 24,
  medium: 48,
  large: 72,
  xlarge: 120,
} as const;

const HALF_FADE_MS = IRONPATH_LOADER_FADE_DURATION_MS / 2;

export type LogoEdgeLoaderSize = keyof typeof SIZE_MAP;
export type LogoEdgeLoaderVariant = 'brand' | 'inverted';

export interface LogoEdgeLoaderProps {
  size?: LogoEdgeLoaderSize;
  /** Monochrome mark using onPrimaryContrast — for loaders on primary buttons. */
  variant?: LogoEdgeLoaderVariant;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

export function LogoEdgeLoader({
  size = 'medium',
  variant = 'brand',
  accessibilityLabel = 'Loading',
  style,
}: LogoEdgeLoaderProps) {
  const colors = useTheme();
  const { themeMode } = useThemeMode();
  const colorScheme = useColorScheme();
  const box = SIZE_MAP[size];
  const [reduceMotion, setReduceMotion] = useState(false);
  const fade = useSharedValue(IRONPATH_LOADER_FADE_MIN_OPACITY);

  const paths = useMemo(() => {
    if (variant === 'inverted') {
      return getMonochromeLogoPaths(colors.onPrimaryContrast);
    }
    return getLogoPaths(resolveLogoArtThemeId(themeMode, colorScheme));
  }, [variant, colors.onPrimaryContrast, themeMode, colorScheme]);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      fade.value = (IRONPATH_LOADER_FADE_MIN_OPACITY + IRONPATH_LOADER_FADE_MAX_OPACITY) / 2;
      return;
    }

    fade.value = IRONPATH_LOADER_FADE_MIN_OPACITY;
    fade.value = withRepeat(
      withSequence(
        withTiming(IRONPATH_LOADER_FADE_MAX_OPACITY, {
          duration: HALF_FADE_MS,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(IRONPATH_LOADER_FADE_MIN_OPACITY, {
          duration: HALF_FADE_MS,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      false,
    );
  }, [reduceMotion, fade]);

  const animatedGroupProps = useAnimatedProps(() => ({
    opacity: fade.value,
  }));

  return (
    <View
      style={[styles.container, { width: box, height: box }, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: true }}
    >
      <Svg width={box} height={box} viewBox={IRONPATH_LOADER_VIEWBOX}>
        <AnimatedG animatedProps={animatedGroupProps}>
          {paths.map((shape) => (
            <Path key={shape.id} d={shape.d} fill={shape.fill} fillRule="nonzero" />
          ))}
        </AnimatedG>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
