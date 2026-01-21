/**
 * Workout Heatmap
 * High-performance muscle visualization using Skia
 * Displays muscle freshness from v2_muscle_freshness table
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, spacing, typography } from '../../lib/utils/theme';
import { BodyHeatmap } from '../visualizations/BodyHeatmap';
import { supabase } from '../../lib/supabase/client';

interface WorkoutHeatmapProps {
  userId: string;
}

export const WorkoutHeatmap: React.FC<WorkoutHeatmapProps> = ({ userId }) => {
  const [loading, setLoading] = useState(true);
  const [freshnessData, setFreshnessData] = useState<Record<string, number>>({});

  useEffect(() => {
    loadMuscleFreshness();
  }, [userId]);

  const loadMuscleFreshness = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('v2_muscle_freshness')
        .select('muscle_key, freshness')
        .eq('user_id', userId);

      if (error) throw error;

      const freshnessMap: Record<string, number> = {};
      for (const row of data || []) {
        freshnessMap[row.muscle_key] = row.freshness || 100;
      }

      setFreshnessData(freshnessMap);
    } catch (error) {
      console.error('Error loading muscle freshness:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Muscle Freshness</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading muscle data...</Text>
        </View>
      </View>
    );
  }

  if (Object.keys(freshnessData).length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Muscle Freshness</Text>
        <Text style={styles.emptyText}>
          No muscle data yet. Complete a workout to see your muscle freshness.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Muscle Freshness</Text>
      <Text style={styles.subtitle}>
        Visual representation of recovery state across all 28 muscles
      </Text>
      
      {/* Skia-powered body heatmap */}
      <View style={styles.heatmapContainer}>
        <BodyHeatmap freshnessData={freshnessData} />
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
          <Text style={styles.legendText}>81-100%: Fully Recovered</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#eab308' }]} />
          <Text style={styles.legendText}>61-80%: Light Fatigue</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#f97316' }]} />
          <Text style={styles.legendText}>31-60%: Moderate Fatigue</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
          <Text style={styles.legendText}>0-30%: Fully Fatigued</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.sizes.sm,
    color: colors.textMuted,
  },
  emptyText: {
    fontSize: typography.sizes.base,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  heatmapContainer: {
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  legend: {
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  legendText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
});

