import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { spacing, typography, borderRadius, type ThemeColors } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';

interface RIRSliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

const RIR_LABELS: Record<number, string> = {
  0: 'No reps left',
  1: 'One in reserve',
  2: 'Two in reserve',
  3: 'Three in reserve',
  4: 'Four in reserve',
  5: 'Easy reserve',
};

function getRIRColor(rir: number, c: ThemeColors): string {
  if (rir <= 1) return c.heatmapFullyFatigued;
  if (rir <= 2) return c.heatmapModerateFatigue;
  if (rir <= 3) return c.heatmapLightFatigue;
  return c.heatmapFullyRecovered;
}

function getRIRZoneLabel(rir: number): string {
  if (rir <= 1) return 'Near failure';
  if (rir <= 3) return 'Hypertrophy sweet spot';
  return 'Too easy to count for hypertrophy';
}

export const RIRSlider: React.FC<RIRSliderProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const colors = useTheme();
  const rirColor = getRIRColor(value, colors);
  const rirLabel = RIR_LABELS[value] || 'Unknown';
  const rirZone = getRIRZoneLabel(value);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      paddingVertical: spacing.md,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    label: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium,
      color: colors.textSecondary,
    },
    valueBox: {
      minWidth: 40,
      height: 32,
      borderRadius: borderRadius.sm,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
    },
    valueText: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.bold,
      color: colors.onPrimaryContrast,
    },
    slider: {
      width: '100%',
      height: 40,
    },
    footer: {
      marginTop: spacing.xs,
      gap: spacing.xs,
    },
    labelText: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
    },
    descriptionText: {
      fontSize: typography.sizes.sm,
      color: colors.textMuted,
      fontStyle: 'italic',
    },
  }), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>RIR (Reps in Reserve)</Text>
        <View style={[styles.valueBox, { backgroundColor: rirColor }]}>
          <Text style={styles.valueText}>{value}</Text>
        </View>
      </View>

      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={5}
        step={1}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={rirColor}
        maximumTrackTintColor={colors.border}
        thumbTintColor={rirColor}
        disabled={disabled}
      />

      <View style={styles.footer}>
        <Text style={[styles.labelText, { color: rirColor }]}>{rirLabel}</Text>
        <Text style={styles.descriptionText}>{rirZone}</Text>
      </View>
    </View>
  );
};
