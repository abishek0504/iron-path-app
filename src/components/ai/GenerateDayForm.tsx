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
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { spacing, borderRadius, typography, type ThemeColors } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import { getDayFocusOptions } from '../../lib/constants/trainingSplits';
import {
  DEFAULT_DAY_CONSTRAINTS,
  type DayConstraints,
} from '../../lib/ai/generateWorkoutDay';
import { Chip } from '../ui/Chip';
import { Button } from '../ui/Button';
import { BottomSheet } from '../ui/BottomSheet';

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

const SESSION_COUNT_OPTIONS = [0, 1, 2, 3, 4, 5, 6];
const EXERCISE_COUNT_OPTIONS = [2, 3, 4, 5, 6, 7, 8];
const STRETCH_COUNT_OPTIONS = [0, 1, 2, 3, 4, 5];
const MAX_SESSIONS_PER_DAY = 6;
const SHEET_HEIGHT_PERCENT = '85%';

const INTENSITY_OPTIONS: { id: DayConstraints['intensity']; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'standard', label: 'Standard' },
  { id: 'hard', label: 'Hard' },
];

interface GenerateDayFormProps {
  visible: boolean;
  dayName: string;
  /** Stored `preferred_training_style` (split id or legacy free text). */
  splitValue: string | null | undefined;
  onCancel: () => void;
  onGenerate: (sessionsPerDay: number, constraints: DayConstraints) => void;
}

export function GenerateDayForm({
  visible,
  dayName,
  splitValue,
  onCancel,
  onGenerate,
}: GenerateDayFormProps) {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const focusOptions = useMemo(() => getDayFocusOptions(splitValue), [splitValue]);

  const [sessionsPerDay, setSessionsPerDay] = useState(1);
  const [dayFocus, setDayFocus] = useState<string | null>(null);
  const [exercisesPerSession, setExercisesPerSession] = useState<number | null>(null);
  const [intensity, setIntensity] = useState<DayConstraints['intensity']>('standard');
  const [emphasizeMuscles, setEmphasizeMuscles] = useState<string[]>([]);
  const [avoidMuscles, setAvoidMuscles] = useState<string[]>([]);
  const [stretchCount, setStretchCount] = useState(0);

  // Reset to "let AI decide" defaults each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setSessionsPerDay(1);
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
    const clampedSessions = Math.min(
      MAX_SESSIONS_PER_DAY,
      Math.max(0, sessionsPerDay),
    );
    onGenerate(clampedSessions, {
      dayFocus,
      exercisesPerSession,
      intensity,
      emphasizeMuscles,
      avoidMuscles,
      stretchCount,
    });
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onCancel}
      title={`Generate ${dayName}`}
      height={SHEET_HEIGHT_PERCENT}
    >
      <View style={styles.body}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.subtitle}>
            Defaults let AI decide — tap Generate anytime, or tune options below.
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Session</Text>

            <Text style={styles.fieldLabel}>Sessions</Text>
            <Text style={styles.fieldHint}>
              0 = rest day. 1–6 = workout sessions (e.g. morning + evening = 2).
            </Text>
            <View style={styles.chipGroup}>
              {SESSION_COUNT_OPTIONS.map((count) => (
                <Chip
                  key={count}
                  label={String(count)}
                  selected={sessionsPerDay === count}
                  onPress={() => setSessionsPerDay(count)}
                />
              ))}
            </View>

            <Text style={styles.fieldLabel}>Exercises per session</Text>
            <View style={styles.chipGroup}>
              <Chip
                label="Auto"
                selected={exercisesPerSession === null}
                onPress={() => setExercisesPerSession(null)}
              />
              {EXERCISE_COUNT_OPTIONS.map((count) => (
                <Chip
                  key={count}
                  label={String(count)}
                  selected={exercisesPerSession === count}
                  onPress={() => setExercisesPerSession(count)}
                />
              ))}
            </View>

            <Text style={styles.fieldLabel}>Intensity</Text>
            <View style={styles.chipGroup}>
              {INTENSITY_OPTIONS.map((option) => (
                <Chip
                  key={option.id}
                  label={option.label}
                  selected={intensity === option.id}
                  onPress={() => setIntensity(option.id)}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Focus</Text>
            <Text style={styles.fieldLabel}>Day focus</Text>
            <View style={styles.chipGroup}>
              <Chip
                label="Let AI decide"
                selected={dayFocus === null}
                onPress={() => setDayFocus(null)}
              />
              {focusOptions.map((option) => (
                <Chip
                  key={option}
                  label={option}
                  selected={dayFocus === option}
                  onPress={() => setDayFocus(option)}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Muscles</Text>

            <Text style={styles.fieldLabel}>Emphasize</Text>
            <Text style={styles.fieldHint}>Optional — bias exercise selection toward these.</Text>
            <View style={styles.chipGroup}>
              {MUSCLE_GROUPS.map((muscle) => (
                <Chip
                  key={muscle}
                  label={muscle}
                  selected={emphasizeMuscles.includes(muscle)}
                  onPress={() => toggleEmphasize(muscle)}
                />
              ))}
            </View>

            <Text style={styles.fieldLabel}>Avoid</Text>
            <Text style={styles.fieldHint}>Optional — sore or injured areas to skip.</Text>
            <View style={styles.chipGroup}>
              {MUSCLE_GROUPS.map((muscle) => (
                <Chip
                  key={muscle}
                  label={muscle}
                  selected={avoidMuscles.includes(muscle)}
                  onPress={() => toggleAvoid(muscle)}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Finish</Text>
            <Text style={styles.fieldLabel}>Stretches</Text>
            <Text style={styles.fieldHint}>
              Appended after strength work — matched to muscles trained that session.
            </Text>
            <View style={styles.chipGroup}>
              {STRETCH_COUNT_OPTIONS.map((count) => (
                <Chip
                  key={count}
                  label={String(count)}
                  selected={stretchCount === count}
                  onPress={() => setStretchCount(count)}
                />
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button label="Generate" size="md" onPress={handleGenerate} fullWidth />
        </View>
      </View>
    </BottomSheet>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    body: {
      flex: 1,
      gap: spacing.md,
      paddingBottom: spacing.md,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: spacing.sm,
      gap: spacing.md,
    },
    subtitle: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    section: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: spacing.md,
      gap: spacing.xs,
    },
    sectionTitle: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.bold,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    fieldLabel: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textPrimary,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    fieldHint: {
      fontSize: typography.sizes.xs,
      color: colors.textMuted,
      marginBottom: spacing.xs,
    },
    chipGroup: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    footer: {
      gap: spacing.sm,
    },
  });
}
