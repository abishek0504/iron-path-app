/**
 * Whole-message 90° cube turn — next line on top face spins down into view.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  AI_LOADING_MESSAGE_FACE_HEIGHT,
  AI_LOADING_MESSAGE_FLIP_MS,
  AI_LOADING_MESSAGE_ROTATE_MS,
} from '../../lib/ai/generateAiLoadingMessages';
import { spacing, typography, type ThemeColors } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';

const CUBE_PERSPECTIVE = 1200;

const preserve3dStyle = { transformStyle: 'preserve-3d' } as ViewStyle;
const hiddenBackfaceStyle = { backfaceVisibility: 'hidden' } as ViewStyle;

export interface AiLoadingMessageCubeProps {
  messages: string[];
  intervalMs?: number;
  flipMs?: number;
}

export function AiLoadingMessageCube({
  messages,
  intervalMs = AI_LOADING_MESSAGE_ROTATE_MS,
  flipMs = AI_LOADING_MESSAGE_FLIP_MS,
}: AiLoadingMessageCubeProps) {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const rotation = useSharedValue(0);
  const isAnimatingRef = useRef(false);

  const currentMessage = messages[index] ?? messages[0] ?? '';
  const nextMessage =
    messages.length > 1 ? messages[(index + 1) % messages.length] ?? currentMessage : currentMessage;

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

  const commitNextMessage = useCallback(() => {
    if (messages.length <= 1) return;
    setIndex((prev) => (prev + 1) % messages.length);
    rotation.value = 0;
    isAnimatingRef.current = false;
  }, [messages.length, rotation]);

  const runFlip = useCallback(() => {
    if (messages.length <= 1 || isAnimatingRef.current) return;
    isAnimatingRef.current = true;

    if (reduceMotion) {
      commitNextMessage();
      return;
    }

    rotation.value = 0;
    rotation.value = withTiming(
      90,
      { duration: flipMs, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(commitNextMessage)();
        } else {
          runOnJS(() => {
            isAnimatingRef.current = false;
          })();
        }
      },
    );
  }, [commitNextMessage, flipMs, messages.length, reduceMotion, rotation]);

  useEffect(() => {
    if (messages.length <= 1) return;
    const id = setInterval(runFlip, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, messages.length, runFlip]);

  const cubeStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: CUBE_PERSPECTIVE }, { rotateX: `${rotation.value}deg` }],
  }));

  const frontFaceStyle = useAnimatedStyle(() => ({
    opacity: rotation.value < 45 ? 1 : 0,
  }));

  const topFaceStyle = useAnimatedStyle(() => ({
    opacity: rotation.value >= 45 ? 1 : 0,
  }));

  return (
    <View
      style={styles.clip}
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      accessibilityLabel={currentMessage}
    >
      <View style={styles.perspective}>
        <Animated.View style={[styles.cube, preserve3dStyle, cubeStyle]}>
          <Animated.View style={[styles.face, styles.frontFace, hiddenBackfaceStyle, frontFaceStyle]}>
            <Text style={styles.message}>{currentMessage}</Text>
          </Animated.View>
          <Animated.View style={[styles.face, styles.topFace, hiddenBackfaceStyle, topFaceStyle]}>
            <Text style={styles.message}>{nextMessage}</Text>
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    clip: {
      minHeight: AI_LOADING_MESSAGE_FACE_HEIGHT,
      width: '100%',
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
    },
    perspective: {
      width: '100%',
      height: AI_LOADING_MESSAGE_FACE_HEIGHT,
      transform: [{ perspective: CUBE_PERSPECTIVE }],
    },
    cube: {
      width: '100%',
      height: AI_LOADING_MESSAGE_FACE_HEIGHT,
    },
    face: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: AI_LOADING_MESSAGE_FACE_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    frontFace: {
      top: 0,
    },
    topFace: {
      top: 0,
      transform: [
        { translateY: -AI_LOADING_MESSAGE_FACE_HEIGHT / 2 },
        { rotateX: '-90deg' },
        { translateY: AI_LOADING_MESSAGE_FACE_HEIGHT / 2 },
      ],
    },
    message: {
      color: colors.textPrimary,
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.medium,
      textAlign: 'center',
      lineHeight: 28,
    },
  });
}
