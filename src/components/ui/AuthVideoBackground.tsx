/**
 * Full-screen background for auth screens (get-started).
 * Loops a compressed bundled workout b-roll with a themed gradient fallback underneath.
 */

import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTheme } from '../../lib/utils/ThemeContext';
import { type ThemeColors } from '../../lib/utils/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const AUTH_BACKGROUND_VIDEO = require('../../../assets/cover-video.mp4');

function safePlayerCall(run: () => void): void {
  try {
    run();
  } catch {
    // expo-video native object can already be released on unmount
  }
}

export function AuthVideoBackground() {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isFocused = useIsFocused();

  const player = useVideoPlayer(AUTH_BACKGROUND_VIDEO, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
    videoPlayer.keepScreenOnWhilePlaying = false;
    safePlayerCall(() => videoPlayer.play());
  });

  useEffect(() => {
    if (isFocused) {
      safePlayerCall(() => player.play());
    } else {
      safePlayerCall(() => player.pause());
    }
  }, [isFocused, player]);

  useEffect(() => {
    return () => {
      safePlayerCall(() => player.pause());
    };
  }, [player]);

  return (
    <View style={styles.container}>
      <View style={styles.base} />
      <View style={styles.accent} />
      {isFocused ? (
        <VideoView
          player={player}
          style={styles.video}
          contentFit="cover"
          nativeControls={false}
          {...(Platform.OS === 'android' ? { surfaceType: 'textureView' as const } : {})}
        />
      ) : null}
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
    video: {
      ...StyleSheet.absoluteFillObject,
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
