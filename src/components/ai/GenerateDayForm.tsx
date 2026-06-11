/**
 * GenerateDayForm — pre-generation constraints sheet for "Generate with AI".
 *
 * Collects sessions per day plus optional constraints (split-day focus,
 * exercise count, intensity, muscle emphasis/avoidance, stretch count).
 * Every field defaults to "let the AI decide" so a single tap on Generate
 * still works. The day-focus options adapt to the split the user picked in
 * onboarding (`v2_profiles.preferred_training_style`).
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { spacing, borderRadius, typography, type ThemeColors } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import { getDayFocusOptions } from '../../lib/constants/trainingSplits';
import {
  DEFAULT_DAY_CONSTRAINTS,
  type DayConstraints,
} from '../../lib/ai/generateWorkoutDay';

const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Arms',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Core',
];

const EXERCISE_COUNT_OPTIONS = [2, 3, 4, 5, 6, 7, 8];
const STRETCH_COUNT_OPTIONS = [0, 1, 2, 3, 4, 5];
const MAX_SESSIONS_PER_DAY = 6;

const INTENSITY_OPTIONS: Array<{ id: DayConstraints['intensity']; label: string }> = [
  { id: 'light', label: 'Light' },
  { id: 'standard', label: 'Standard' },
  { id: 'hard', label: 'Hard' },
];

interface GenerateDayFormProps {
  visible: boolean;
  dayName: string;
  /** Stored `preferred_training_style` (split id or legacy free text). */
  splitValue: string | null | undefined;
  aiRemainingToday: number | null;
  onCancel: () => void;
  onGenerate: (sessionsPerDay: number, constraints: DayConstraints) => void;
}

export function GenerateDayForm({
  visible,
  dayName,
  splitValue,
  aiRemainingToday,
  onCancel,
  onGenerate,
}: GenerateDayFormProps) {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const focusOptions = useMemo(() => getDayFocusOptions(splitValue), [splitValue]);

  const [sessionsInput, setSessionsInput] = useState('1');
  const [dayFocus, setDayFocus] = useState<string | null>(null);
  const [exercisesPerSession, setExercisesPerSession] = useState<number | null>(null);
  const [intensity, setIntensity] = useState<DayConstraints['intensity']>('standard');
  const [emphasizeMuscles, setEmphasizeMuscles] = useState<string[]>([]);
  const [avoidMuscles, setAvoidMuscles] = useState<string[]>([]);
  const [stretchCount, setStretchCount] = useState(0);

  // Reset to "let AI decide" defaults each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setSessionsInput('1');
      setDayFocus(DEFAULT_DAY_CONSTRAINTS.dayFocus);
      setExercisesPerSession(DEFAULT_DAY_CONSTRAINTS.exercisesPerSession);
      setIntensity(DEFAULT_DAY_CONSTRAINTS.intensity);
      setEmphasizeMuscles(DEFAULT_DAY_CONSTRAINTS.emphasizeMuscles);
      setAvoidMuscles(DEFAULT_DAY_CONSTRAINTS.avoidMuscles);
      setStretchCount(DEFAULT_DAY_CONSTRAINTS.stretchCount);
    }
  }, [visible]);

  // A muscle can be emphasized or avoided, never both.
  const toggleEmphasize = (muscle: string) => {
    setEmphasizeMuscles((prev) =>
      prev.includes(muscle) ? prev.filter((m) => m !== muscle) : [...prev, muscle],
    );
    setAvoidMuscles((prev) => prev.filter((m) => m !== muscle));
  };

  const toggleAvoid = (muscle: string) => {
    setAvoidMuscles((prev) =>
      prev.includes(muscle) ? prev.filter((m) => m !== muscle) : [...prev, muscle],
    );
    setEmphasizeMuscles((prev) => prev.filter((m) => m !== muscle));
  };

  const handleGenerate = () => {
    const parsed = parseInt(sessionsInput, 10);
    const sessionsPerDay = Math.min(
      MAX_SESSIONS_PER_DAY,
      Math.max(0, Number.isNaN(parsed) ? 1 : parsed),
    );
    onGenerate(sessionsPerDay, {
      dayFocus,
      exercisesPerSession,
      intensity,
      emphasizeMuscles,
      avoidMuscles,
      stretchCount,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.title}>Generate {dayName}</Text>
            {aiRemainingToday != null && (
              <Text style={styles.quota}>
                {aiRemainingToday > 0
                  ? `${aiRemainingToday} AI generation${aiRemainingToday === 1 ? '' : 's'} left today`
                  : 'Daily AI limit reached — try again tomorrow'}
              </Text>
            )}

            <Text style={styles.sectionLabel}>Sessions</Text>
            <Text style={styles.sectionHint}>
              0 = rest day. 1–6 = workout sessions (e.g. morning + evening = 2).
            </Text>
            <TextInput
              style={styles.sessionsInput}
              value={sessionsInput}
              onChangeText={(t) => setSessionsInput(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor={colors.textMuted}
              maxLength={1}
            />

            <Text style={styles.sectionLabel}>Day focus</Text>
            <View style={styles.chipGroup}>
              <Chip
                label="Let AI decide"
                selected={dayFocus === null}
                onPress={() => setDayFocus(null)}
                styles={styles}
              />
              {focusOptions.map((option) => (
                <Chip
                  key={option}
                  label={option}
                  selected={dayFocus === option}
                  onPress={() => setDayFocus(option)}
                  styles={styles}
                />
              ))}
            </View>

            <Text style={styles.sectionLabel}>Exercises per session</Text>
            <View style={styles.chipGroup}>
              <Chip
                label="Auto"
                selected={exercisesPerSession === null}
                onPress={() => setExercisesPerSession(null)}
                styles={styles}
              />
              {EXERCISE_COUNT_OPTIONS.map((count) => (
                <Chip
                  key={count}
                  label={String(count)}
                  selected={exercisesPerSession === count}
                  onPress={() => setExercisesPerSession(count)}
                  styles={styles}
                />
              ))}
            </View>

            <Text style={styles.sectionLabel}>Intensity</Text>
            <View style={styles.chipGroup}>
              {INTENSITY_OPTIONS.map((option) => (
                <Chip
                  key={option.id}
                  label={option.label}
                  selected={intensity === option.id}
                  onPress={() => setIntensity(option.id)}
                  styles={styles}
                />
              ))}
            </View>

            <Text style={styles.sectionLabel}>Emphasize muscles</Text>
            <Text style={styles.sectionHint}>Optional — bias exercise selection toward these.</Text>
            <View style={styles.chipGroup}>
              {MUSCLE_GROUPS.map((muscle) => (
                <Chip
                  key={muscle}
                  label={muscle}
                  selected={emphasizeMuscles.includes(muscle)}
                  onPress={() => toggleEmphasize(muscle)}
                  styles={styles}
                />
              ))}
            </View>

            <Text style={styles.sectionLabel}>Avoid muscles</Text>
            <Text style={styles.sectionHint}>Optional — sore or injured areas to skip.</Text>
            <View style={styles.chipGroup}>
              {MUSCLE_GROUPS.map((muscle) => (
                <Chip
                  key={muscle}
                  label={muscle}
                  selected={avoidMuscles.includes(muscle)}
                  onPress={() => toggleAvoid(muscle)}
                  styles={styles}
                />
              ))}
            </View>

            <Text style={styles.sectionLabel}>Stretches</Text>
            <Text style={styles.sectionHint}>Stretch support is rolling out — may be skipped for now.</Text>
            <View style={styles.chipGroup}>
              {STRETCH_COUNT_OPTIONS.map((count) => (
                <Chip
                  key={count}
                  label={String(count)}
                  selected={stretchCount === count}
                  onPress={() => setStretchCount(count)}
                  styles={styles}
                />
              ))}
            </View>

            <View style={styles.buttons}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={onCancel}
              >
                <Text style={styles.buttonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button} onPress={handleGenerate}>
                <Text style={styles.buttonText}>Generate</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Chip({
  label,
  selected,
  onPress,
  styles,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: spacing.xl,
      width: '100%',
      maxWidth: 400,
      maxHeight: '85%',
    },
    title: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.semibold,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    quota: {
      fontSize: typography.sizes.sm,
      color: colors.primary,
      marginBottom: spacing.sm,
    },
    sectionLabel: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textPrimary,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    sectionHint: {
      fontSize: typography.sizes.xs,
      color: colors.textMuted,
      marginBottom: spacing.xs,
    },
    sessionsInput: {
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: borderRadius.md,
      backgroundColor: colors.background,
      color: colors.textPrimary,
      fontSize: typography.sizes.lg,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      minWidth: 72,
      alignSelf: 'flex-start',
    },
    chipGroup: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
    },
    chipTextSelected: {
      color: colors.background,
      fontWeight: typography.weights.semibold,
    },
    buttons: {
      flexDirection: 'row',
      gap: spacing.sm,
      justifyContent: 'flex-end',
      marginTop: spacing.lg,
    },
    button: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: colors.primary,
    },
    buttonSecondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    buttonText: {
      color: colors.onPrimaryContrast,
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
    },
    buttonTextSecondary: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
    },
  });
}
