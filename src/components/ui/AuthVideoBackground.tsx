/**
 * Full-screen background for auth screens (get-started, signup, login).
 */

import React from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import { Video, ResizeMode } from 'expo-av';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const AUTH_BACKGROUND_VIDEO = require('../../../assets/cover-video.mp4');

export function AuthVideoBackground() {
  const isIOS = Platform.OS === 'ios';

  if (!isIOS) {
    return (
      <View style={styles.container}>
        <View style={styles.base} />
        <View style={styles.accent} />
        <View style={styles.overlay} pointerEvents="none" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Video
        source={AUTH_BACKGROUND_VIDEO}
        style={styles.video}
        isMuted
        isLooping
        shouldPlay
        resizeMode={ResizeMode.COVER}
      />
      <View style={styles.overlay} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  base: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#09090b',
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
    backgroundColor: '#18181b',
    opacity: 0.5,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
});
