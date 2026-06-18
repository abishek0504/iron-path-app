/**
 * Full-screen background for auth screens (get-started).
 * Loops a compressed bundled workout b-roll with a themed gradient fallback underneath.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTheme } from '../../lib/utils/ThemeContext';
import { type ThemeColors } from '../../lib/utils/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const AUTH_BACKGROUND_VIDEO = require('../../../assets/cover-video.mp4');

export function AuthVideoBackground() {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const player = useVideoPlayer(AUTH_BACKGROUND_VIDEO, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
    videoPlayer.keepScreenOnWhilePlaying = false;
    videoPlayer.play();
  });

  return (
    <View style={styles.container}>
      <View style={styles.base} />
      <View style={styles.accent} />
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
        surfaceType="textureView"
      />
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
