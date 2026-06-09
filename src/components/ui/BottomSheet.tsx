/**
 * Bottom Sheet component
 * Reusable bottom sheet with animations
 * Prevents modal-in-modal issues by being managed globally
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  PanResponder,
} from 'react-native';
import { X } from 'lucide-react-native';
import { spacing, borderRadius } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Distance (px) the user must drag down before the sheet commits to dismiss on release.
 * Lower threshold makes it easier to close; we balance with a velocity check below to
 * also support a "flick" gesture without long drags.
 */
const SWIPE_DISMISS_DISTANCE = 100;
/** Downward velocity (px/ms) at which a flick alone dismisses, regardless of distance. */
const SWIPE_DISMISS_VELOCITY = 0.6;

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onClosed?: () => void; // Called after exit animation completes
  title?: string;
  children: React.ReactNode;
  height?: number | string; // number for pixels, string for percentage
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  onClosed,
  title,
  children,
  height = '80%',
}) => {
  const colors = useTheme();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const dragOffset = useRef(new Animated.Value(0)).current;
  const [isMounted, setIsMounted] = useState(visible);

  /**
   * Swipe-down dismiss. We restrict capture to clearly downward gestures so we don't
   * fight inner ScrollViews; we also reject pure vertical jitter under a 6px threshold
   * to keep tap interactions inside the sheet content responsive.
   */
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        return gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (gestureState.dy >= 0) {
          dragOffset.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const shouldDismiss =
          gestureState.dy > SWIPE_DISMISS_DISTANCE || gestureState.vy > SWIPE_DISMISS_VELOCITY;
        if (shouldDismiss) {
          dragOffset.setValue(0);
          onClose();
        } else {
          Animated.spring(dragOffset, {
            toValue: 0,
            tension: 60,
            friction: 9,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragOffset, {
          toValue: 0,
          tension: 60,
          friction: 9,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  // Mount when becoming visible
  useEffect(() => {
    if (visible && !isMounted) {
      setIsMounted(true);
    }
  }, [visible, isMounted]);

  // Run enter/exit animations while mounted
  useEffect(() => {
    if (!isMounted) return;

    if (visible) {
      // Reset starting positions for enter animation
      slideAnim.setValue(SCREEN_HEIGHT);
      backdropOpacity.setValue(0);
      dragOffset.setValue(0);

      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsMounted(false);
        // Call onClosed callback after exit animation completes
        if (onClosed) {
          onClosed();
        }
      });
    }
  }, [visible, isMounted, slideAnim, backdropOpacity, dragOffset, onClosed]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderBottomWidth: 0,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 10,
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
      paddingTop: spacing.lg,
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
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: backdropOpacity,
              },
            ]}
          />
        </TouchableWithoutFeedback>

        {/* Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            {
              height: sheetHeight,
              transform: [
                {
                  translateY: Animated.add(slideAnim, dragOffset),
                },
              ],
            },
          ]}
        >
          {/* Drag handle: visual affordance + dedicated gesture surface so the user can
              always swipe-to-dismiss even when the sheet body has its own scroll view. */}
          <View style={styles.dragHandleContainer} {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />
          </View>

          {/* Header */}
          {title && (
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Content */}
          <View style={styles.content}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
};
