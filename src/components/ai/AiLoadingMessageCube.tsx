/**
 * Rotating loading messages — vertical slide crossfade between lines.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
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
  const progress = useSharedValue(0);
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
    progress.value = 0;
    isAnimatingRef.current = false;
  }, [messages.length, progress]);

  const runTransition = useCallback(() => {
    if (messages.length <= 1 || isAnimatingRef.current) return;
    isAnimatingRef.current = true;

    if (reduceMotion) {
      commitNextMessage();
      return;
    }

    progress.value = 0;
    progress.value = withTiming(
      1,
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
  }, [commitNextMessage, flipMs, messages.length, progress, reduceMotion]);

  useEffect(() => {
    if (messages.length <= 1) return;
    const id = setInterval(runTransition, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, messages.length, runTransition]);

  const outgoingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4, 1], [1, 0.3, 0]),
    transform: [
      {
        translateY: interpolate(
          progress.value,
          [0, 1],
          [0, -AI_LOADING_MESSAGE_FACE_HEIGHT * 0.35],
        ),
      },
    ],
  }));

  const incomingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4, 1], [0, 0.7, 1]),
    transform: [
      {
        translateY: interpolate(
          progress.value,
          [0, 1],
          [AI_LOADING_MESSAGE_FACE_HEIGHT * 0.35, 0],
        ),
      },
    ],
  }));

  return (
    <View
      style={styles.clip}
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      accessibilityLabel={currentMessage}
    >
      <View style={styles.viewport}>
        <Animated.View style={[styles.face, outgoingStyle]}>
          <Text style={styles.message}>{currentMessage}</Text>
        </Animated.View>
        <Animated.View style={[styles.face, styles.incomingFace, incomingStyle]}>
          <Text style={styles.message}>{nextMessage}</Text>
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
    viewport: {
      width: '100%',
      height: AI_LOADING_MESSAGE_FACE_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    face: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: AI_LOADING_MESSAGE_FACE_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    incomingFace: {
      top: 0,
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
