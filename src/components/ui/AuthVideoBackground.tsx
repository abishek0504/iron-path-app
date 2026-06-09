/**
 * Full-screen background for auth screens (get-started, signup, login).
 *
 * NOTE: Previously this rendered a bundled 40MB MP4 on iOS. That asset has
 * been removed from the binary to keep the IPA lean. We now use the same
 * static gradient backdrop on both platforms. If a video is desired in the
 * future, host it remotely (Supabase Storage / CDN) and stream via uri.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../../lib/utils/ThemeContext';
import { type ThemeColors } from '../../lib/utils/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export function AuthVideoBackground() {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.base} />
      <View style={styles.accent} />
      <View style={styles.overlay} pointerEvents="none" />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      ...StyleSheet.absoluteFillObject,
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
    },
    base: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.background,
    },
    accent: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: SCREEN_HEIGHT * 0.4,
      backgroundColor: colors.authHeroAccentBand,
      opacity: 0.45,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.modalBackdropTint,
    },
  });
}
