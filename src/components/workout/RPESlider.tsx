/**
 * RPE Slider Component
 * 
 * Interactive slider for Rate of Perceived Exertion (1-10)
 * Provides visual feedback with color gradient and qualitative labels
 * 
 * Usage:
 * <RPESlider value={8} onChange={(value) => setRpe(value)} />
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { colors, spacing, typography } from '../../lib/utils/theme';

interface RPESliderProps {
  value: number; // 1-10
  onChange: (value: number) => void;
  disabled?: boolean;
}

// Label mapping for different RPE ranges
const RPE_LABELS: Record<number, string> = {
  1: 'Warmup',
  2: 'Warmup',
  3: 'Warmup',
  4: 'Warmup',
  5: 'Warmup',
  6: 'Easy',
  7: 'Moderate',
  8: 'Hard',
  9: 'Very Hard',
  10: 'Max Effort',
};

// Color mapping for RPE zones
const RPE_COLORS: Record<string, string> = {
  warmup: '#22c55e', // Green (1-5)
  easy: '#eab308', // Yellow (6-7)
  hard: '#f97316', // Orange (8-9)
  max: '#ef4444', // Red (10)
};

function getRPEColor(rpe: number): string {
  if (rpe <= 5) return RPE_COLORS.warmup;
  if (rpe <= 7) return RPE_COLORS.easy;
  if (rpe <= 9) return RPE_COLORS.hard;
  return RPE_COLORS.max;
}

function getRPEZoneLabel(rpe: number): string {
  if (rpe <= 5) return 'Too easy to count for hypertrophy';
  if (rpe <= 7) return 'Building work capacity';
  if (rpe <= 9) return 'Hypertrophy sweet spot';
  return 'Maximal exertion - use sparingly';
}

export const RPESlider: React.FC<RPESliderProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const rpeColor = getRPEColor(value);
  const rpeLabel = RPE_LABELS[value] || 'Unknown';
  const rpeZone = getRPEZoneLabel(value);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.label}>RPE (Rate of Perceived Exertion)</Text>
        <View style={[styles.valueBox, { backgroundColor: rpeColor }]}>
          <Text style={styles.valueText}>{value}</Text>
        </View>
      </View>

      {/* Slider */}
      <Slider
        style={styles.slider}
        minimumValue={1}
        maximumValue={10}
        step={1}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={rpeColor}
        maximumTrackTintColor={colors.border}
        thumbTintColor={rpeColor}
        disabled={disabled}
      />

      {/* Labels */}
      <View style={styles.footer}>
        <Text style={[styles.labelText, { color: rpeColor, fontWeight: '600' }]}>
          {rpeLabel}
        </Text>
        <Text style={styles.descriptionText}>{rpeZone}</Text>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: RPE_COLORS.warmup }]} />
          <Text style={styles.legendText}>1-5: Warmup</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: RPE_COLORS.easy }]} />
          <Text style={styles.legendText}>6-7: Easy/Moderate</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: RPE_COLORS.hard }]} />
          <Text style={styles.legendText}>8-9: Hard</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: RPE_COLORS.max }]} />
          <Text style={styles.legendText}>10: Max</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  valueText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.background,
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
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: typography.sizes.xs,
    color: colors.textSecondary,
  },
});
