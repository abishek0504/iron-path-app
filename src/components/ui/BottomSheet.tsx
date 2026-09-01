/**
 * Bottom Sheet component
 * Reusable bottom sheet with animations
 * Prevents modal-in-modal issues by being managed globally
 */

import React, { createContext, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  type KeyboardEvent,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { spacing, borderRadius } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';

type BottomSheetCloseFn = () => void;
const BottomSheetCloseContext = createContext<BottomSheetCloseFn | null>(null);

/** Animated close for buttons rendered inside BottomSheet content (e.g. custom headers). */
export function useBottomSheetClose(): BottomSheetCloseFn {
  const close = useContext(BottomSheetCloseContext);
  return close ?? (() => {});
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/** Minimum touch height for the draggable top chrome (iOS HIG). */
const DRAG_ZONE_MIN_HEIGHT = 48;
/** Distance (px) the user must drag down before the sheet commits to dismiss on release. */
const SWIPE_DISMISS_DISTANCE = 80;
/** Downward velocity (px/s) at which a flick alone dismisses, regardless of distance. */
const SWIPE_DISMISS_VELOCITY = 800;

const ENTER_DURATION_MS = 300;
const EXIT_DURATION_MS = 280;
const DRAG_SNAP_BACK_DURATION_MS = 180;
/** Velocity (px/s) above which we treat the release as a flick. */
const FLICK_VELOCITY_THRESHOLD = 500;

const ENTER_EASING = Easing.out(Easing.cubic);
const EXIT_EASING = Easing.in(Easing.cubic);

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onClosed?: () => void; // Called after exit animation completes
  title?: string;
  children: React.ReactNode;
  height?: number | string; // number for pixels, string for percentage
  /** Shift the sheet above the software keyboard (for sheets with text inputs). */
  avoidKeyboard?: boolean;
}

export type BottomSheetHandle = {
  requestClose: () => void;
};

export const BottomSheet = forwardRef<BottomSheetHandle, BottomSheetProps>(function BottomSheet({
  visible,
  onClose,
  onClosed,
  title,
  children,
  height = '80%',
  avoidKeyboard = false,
}, ref) {
  const colors = useTheme();
  const slideOffset = useSharedValue(SCREEN_HEIGHT);
  const dragOffset = useSharedValue(0);
  const keyboardOffset = useSharedValue(0);
  const isAnimatingCloseRef = useRef(false);
  const mountedRef = useRef(true);
  const [isMounted, setIsMounted] = useState(visible);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelAnimation(slideOffset);
      cancelAnimation(dragOffset);
      cancelAnimation(keyboardOffset);
    };
  }, [slideOffset, dragOffset, keyboardOffset]);

  const finishExitAnimation = useCallback(() => {
    if (!mountedRef.current) return;
    isAnimatingCloseRef.current = false;
    setIsMounted(false);
    onClosed?.();
  }, [onClosed]);

  const completeGestureDismiss = useCallback(() => {
    if (!mountedRef.current) return;
    isAnimatingCloseRef.current = true;
    onClose();
    finishExitAnimation();
  }, [onClose, finishExitAnimation]);

  const handleAnimatedCloseComplete = useCallback(() => {
    if (!mountedRef.current) return;
    isAnimatingCloseRef.current = false;
    onClose();
    finishExitAnimation();
  }, [onClose, finishExitAnimation]);

  const resetAnimatingClose = useCallback(() => {
    if (!mountedRef.current) return;
    isAnimatingCloseRef.current = false;
  }, []);

  const animateClose = useCallback(() => {
    if (isAnimatingCloseRef.current) return;
    isAnimatingCloseRef.current = true;
    cancelAnimation(slideOffset);
    cancelAnimation(dragOffset);
    dragOffset.value = 0;
    slideOffset.value = withTiming(
      SCREEN_HEIGHT,
      { duration: EXIT_DURATION_MS, easing: EXIT_EASING },
      (finished) => {
        if (finished) {
          runOnJS(handleAnimatedCloseComplete)();
        } else {
          runOnJS(resetAnimatingClose)();
        }
      }
    );
  }, [slideOffset, dragOffset, handleAnimatedCloseComplete, resetAnimatingClose]);

  useImperativeHandle(ref, () => ({ requestClose: animateClose }), [animateClose]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([8, Infinity])
        .failOffsetX([-20, 20])
        .onUpdate((event) => {
          if (event.translationY >= 0) {
            dragOffset.value = event.translationY;
          }
        })
        .onEnd((event) => {
          const shouldDismiss =
            event.translationY > SWIPE_DISMISS_DISTANCE ||
            event.velocityY > SWIPE_DISMISS_VELOCITY;

          if (shouldDismiss) {
            const draggedY = event.translationY;
            const remaining = SCREEN_HEIGHT - draggedY;
            cancelAnimation(dragOffset);
            cancelAnimation(slideOffset);
            dragOffset.value = 0;
            slideOffset.value = draggedY;

            const releaseVelocity =
              event.velocityY > 120
                ? event.velocityY
                : Math.max(remaining * 2.5, 900);
            const duration = Math.min(
              280,
              Math.max(100, (remaining / releaseVelocity) * 1000)
            );
            const easing =
              event.velocityY > FLICK_VELOCITY_THRESHOLD
                ? Easing.out(Easing.quad)
                : Easing.linear;

            slideOffset.value = withTiming(
              SCREEN_HEIGHT,
              { duration, easing },
              (finished) => {
                if (finished) {
                  runOnJS(completeGestureDismiss)();
                }
              }
            );
          } else {
            dragOffset.value = withTiming(0, { duration: DRAG_SNAP_BACK_DURATION_MS });
          }
        }),
    [completeGestureDismiss, dragOffset, slideOffset]
  );

  // Mount when becoming visible
  useEffect(() => {
    if (visible && !isMounted) {
      setIsMounted(true);
    }
  }, [visible, isMounted]);

  // Run enter animation when opening; handle external visible=false (programmatic close)
  useEffect(() => {
    if (!isMounted) return;

    if (visible) {
      isAnimatingCloseRef.current = false;
      cancelAnimation(slideOffset);
      cancelAnimation(dragOffset);
      slideOffset.value = SCREEN_HEIGHT;
      dragOffset.value = 0;

      slideOffset.value = withTiming(0, {
        duration: ENTER_DURATION_MS,
        easing: ENTER_EASING,
      });
    } else if (!isAnimatingCloseRef.current) {
      // Parent set visible=false without our animateClose (e.g. programmatic close).
      isAnimatingCloseRef.current = true;
      cancelAnimation(slideOffset);
      cancelAnimation(dragOffset);
      dragOffset.value = 0;
      slideOffset.value = withTiming(
        SCREEN_HEIGHT,
        { duration: EXIT_DURATION_MS, easing: EXIT_EASING },
        (finished) => {
          if (finished) {
            runOnJS(finishExitAnimation)();
          } else {
            runOnJS(resetAnimatingClose)();
          }
        }
      );
    }
  }, [
    visible,
    isMounted,
    slideOffset,
    dragOffset,
    finishExitAnimation,
    resetAnimatingClose,
  ]);

  useEffect(() => {
    if (!avoidKeyboard) return;

    const animateKeyboardOffset = (toValue: number, duration?: number) => {
      keyboardOffset.value = withTiming(toValue, { duration: duration ?? 250 });
    };

    const onKeyboardShow = (event: KeyboardEvent) => {
      animateKeyboardOffset(event.endCoordinates.height, event.duration);
    };

    const onKeyboardHide = (event: KeyboardEvent) => {
      animateKeyboardOffset(0, event.duration);
    };

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, onKeyboardShow);
    const hideSub = Keyboard.addListener(hideEvent, onKeyboardHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [avoidKeyboard, keyboardOffset]);

  useEffect(() => {
    if (!visible) {
      keyboardOffset.value = 0;
    }
  }, [visible, keyboardOffset]);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: avoidKeyboard
          ? slideOffset.value + dragOffset.value - keyboardOffset.value
          : slideOffset.value + dragOffset.value,
      },
    ],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => {
    const sheetY = slideOffset.value + dragOffset.value;
    return {
      opacity: interpolate(sheetY, [0, SCREEN_HEIGHT], [1, 0], Extrapolation.CLAMP),
    };
  });

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.modalBackdropTint,
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderBottomWidth: 0,
      shadowColor: colors.shadowColor,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 10,
    },
    dragZone: {
      minHeight: DRAG_ZONE_MIN_HEIGHT,
    },
    dragHandleContainer: {
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
      alignItems: 'center',
    },
    dragHandle: {
      width: 44,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.cardBorder,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
      flex: 1,
    },
    closeButton: {
      padding: spacing.xs,
    },
    content: {
      flex: 1,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
    },
  }), [colors]);

  const sheetHeight = typeof height === 'string'
    ? SCREEN_HEIGHT * (parseFloat(height) / 100)
    : height;

  return (
    <Modal
      visible={isMounted}
      transparent
      animationType="none"
      onRequestClose={animateClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.container}>
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={animateClose}>
          <Animated.View style={[styles.backdrop, backdropAnimatedStyle]} />
        </TouchableWithoutFeedback>

        {/* Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            { height: sheetHeight },
            sheetAnimatedStyle,
          ]}
        >
          {/* Top chrome: handle + title row — dedicated swipe-to-dismiss surface */}
          <GestureDetector gesture={panGesture}>
            <View style={styles.dragZone} collapsable={false}>
              <View style={styles.dragHandleContainer}>
                <View style={styles.dragHandle} />
              </View>

              {title && (
                <View style={styles.header}>
                  <Text style={styles.title}>{title}</Text>
                  <TouchableOpacity
                    onPress={animateClose}
                    style={styles.closeButton}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </GestureDetector>

          {/* Content */}
          <BottomSheetCloseContext.Provider value={animateClose}>
            <View style={styles.content}>{children}</View>
          </BottomSheetCloseContext.Provider>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
});
