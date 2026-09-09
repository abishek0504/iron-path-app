/**
 * Static IronPath logo mark — theme-aware vector art from assets/.
 */

import { useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useColorScheme } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  getLogoPaths,
  IRONPATH_LOADER_VIEWBOX,
  resolveLogoArtThemeId,
} from './ironpathLogoLoaderArt';
import { useTheme, useThemeMode } from '../../lib/utils/ThemeContext';

export interface IronPathLogoProps {
  size?: number;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function IronPathLogo({
  size = 72,
  style,
  accessibilityLabel = 'IronPath',
}: IronPathLogoProps) {
  const colors = useTheme();
  const { themeMode } = useThemeMode();
  const colorScheme = useColorScheme();
  const paths = useMemo(
    () => getLogoPaths(resolveLogoArtThemeId(themeMode, colorScheme), colors.primary),
    [themeMode, colorScheme, colors.primary],
  );

  return (
    <View
      style={[styles.container, { width: size, height: size }, style]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={size} height={size} viewBox={IRONPATH_LOADER_VIEWBOX}>
        {paths.map((shape) => (
          <Path key={shape.id} d={shape.d} fill={shape.fill} fillRule="nonzero" />
        ))}
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
