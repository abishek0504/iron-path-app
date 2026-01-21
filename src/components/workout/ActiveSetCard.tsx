/**
 * Active Set Card Component
 * 
 * Displays a single set during active workout with swipe-to-complete functionality
 * 
 * Features:
 * - Swipe right to mark complete with target values
 * - Tap to expand and edit values
 * - Optimistic UI updates
 * - Visual feedback for completion state
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Check, Edit2 } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography } from '../../lib/utils/theme';
import { RPESlider } from './RPESlider';

export interface SetData {
  id: string;
  set_number: number;
  reps?: number;
  weight?: number;
  duration_sec?: number;
  rpe?: number;
  rir?: number;
  completed?: boolean;
}

interface ActiveSetCardProps {
  set: SetData;
  mode: 'reps' | 'timed';
  onComplete: (setId: string, values: {
    reps?: number;
    weight?: number;
    duration_sec?: number;
    rpe?: number;
  }) => void;
  onUpdate: (setId: string, values: Partial<SetData>) => void;
  useImperial: boolean;
}

export const ActiveSetCard: React.FC<ActiveSetCardProps> = ({
  set,
  mode,
  onComplete,
  onUpdate,
  useImperial,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [editedWeight, setEditedWeight] = useState(set.weight?.toString() || '');
  const [editedReps, setEditedReps] = useState(set.reps?.toString() || '');
  const [editedDuration, setEditedDuration] = useState(set.duration_sec?.toString() || '');
  const [editedRPE, setEditedRPE] = useState(set.rpe || 7);

  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  const weightUnit = useImperial ? 'lbs' : 'kg';

  // Handle swipe to complete
  const handleSwipeComplete = () => {
    onComplete(set.id, {
      reps: set.reps,
      weight: set.weight,
      duration_sec: set.duration_sec,
      rpe: set.rpe || 7,
    });
  };

  // Swipe gesture
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      // Only allow right swipe
      if (event.translationX > 0) {
        translateX.value = event.translationX;
      }
    })
    .onEnd((event) => {
      const threshold = 100; // Swipe threshold in pixels
      if (event.translationX > threshold && !set.completed) {
        // Complete animation
        translateX.value = withTiming(400, { duration: 200 });
        opacity.value = withTiming(0, { duration: 200 }, () => {
          runOnJS(handleSwipeComplete)();
        });
      } else {
        // Reset
        translateX.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
      opacity: opacity.value,
    };
  });

  const handleSaveEdits = () => {
    const updatedValues: Partial<SetData> = {
      rpe: editedRPE,
    };

    if (mode === 'reps') {
      updatedValues.weight = editedWeight ? parseFloat(editedWeight) : undefined;
      updatedValues.reps = editedReps ? parseInt(editedReps, 10) : undefined;
    } else {
      updatedValues.duration_sec = editedDuration ? parseInt(editedDuration, 10) : undefined;
    }

    onUpdate(set.id, updatedValues);
    setExpanded(false);
  };

  // Collapsed view
  const renderCollapsed = () => {
    let summary = `Set ${set.set_number}: `;
    
    if (mode === 'reps') {
      summary += set.weight ? `${set.weight} ${weightUnit}` : '—';
      summary += ' × ';
      summary += set.reps ? `${set.reps} reps` : '—';
    } else {
      summary += set.duration_sec ? `${set.duration_sec}s` : '—';
    }
    
    if (set.rpe) {
      summary += ` @ RPE ${set.rpe}`;
    }

    return (
      <TouchableOpacity
        onPress={() => setExpanded(true)}
        style={[
          styles.collapsedContainer,
          set.completed && styles.completedContainer,
        ]}
        disabled={set.completed}
      >
        <View style={styles.collapsedContent}>
          <Text style={[
            styles.summaryText,
            set.completed && styles.completedText,
          ]}>
            {summary}
          </Text>
          {!set.completed && (
            <Edit2 size={16} color={colors.textMuted} />
          )}
          {set.completed && (
            <View style={styles.completedBadge}>
              <Check size={16} color={colors.background} />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Expanded view
  const renderExpanded = () => {
    return (
      <View style={styles.expandedContainer}>
        <View style={styles.expandedHeader}>
          <Text style={styles.setNumberText}>Set {set.set_number}</Text>
          <TouchableOpacity onPress={() => setExpanded(false)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Input fields */}
        {mode === 'reps' ? (
          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Weight ({weightUnit})</Text>
              <TextInput
                style={styles.input}
                value={editedWeight}
                onChangeText={setEditedWeight}
                keyboardType="decimal-pad"
                placeholder="135"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Reps</Text>
              <TextInput
                style={styles.input}
                value={editedReps}
                onChangeText={setEditedReps}
                keyboardType="number-pad"
                placeholder="10"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
        ) : (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Duration (seconds)</Text>
            <TextInput
              style={styles.input}
              value={editedDuration}
              onChangeText={setEditedDuration}
              keyboardType="number-pad"
              placeholder="60"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        )}

        {/* RPE Slider */}
        <RPESlider value={editedRPE} onChange={setEditedRPE} />

        {/* Save button */}
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSaveEdits}
        >
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (expanded) {
    return renderExpanded();
  }

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.cardContainer, animatedStyle]}>
        {renderCollapsed()}
        {!set.completed && (
          <View style={styles.swipeIndicator}>
            <Text style={styles.swipeText}>Swipe →</Text>
          </View>
        )}
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: spacing.sm,
  },
  collapsedContainer: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  completedContainer: {
    backgroundColor: colors.cardHover,
    opacity: 0.7,
  },
  collapsedContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryText: {
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  completedBadge: {
    backgroundColor: colors.success,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeIndicator: {
    position: 'absolute',
    right: spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    opacity: 0.3,
  },
  swipeText: {
    fontSize: typography.sizes.sm,
    color: colors.success,
    fontWeight: typography.weights.semibold,
  },
  expandedContainer: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  expandedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  setNumberText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  cancelText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.background,
  },
});
