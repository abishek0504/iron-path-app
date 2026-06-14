import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { borderRadius, type ThemeColors } from '../../lib/utils/theme';

const PREVIEW_HEIGHT_RATIO = 160 / 120;

interface ThemePreviewMiniProps {
  colors: ThemeColors;
  width?: number;
}

export function ThemePreviewMini({ colors, width = 120 }: ThemePreviewMiniProps) {
  const height = width * PREVIEW_HEIGHT_RATIO;
  const styles = useMemo(() => createStyles(colors, width, height), [colors, width, height]);

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <View style={styles.gearDot} />
      </View>

      <View style={styles.statCard}>
        <View style={styles.statBarShort} />
        <View style={styles.statBarLong} />
      </View>

      <View style={styles.statCard}>
        <View style={styles.statBarShort} />
      </View>

      <View style={styles.tabBarCapsule}>
        <View style={styles.tabDotActive} />
        <View style={styles.tabDot} />
        <View style={styles.tabDot} />
        <View style={styles.tabDot} />
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors, width: number, height: number) {
  const scale = width / 120;

  return StyleSheet.create({
    root: {
      width,
      height,
      backgroundColor: colors.background,
      borderRadius: borderRadius.sm * scale,
      padding: 8 * scale,
      overflow: 'hidden',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6 * scale,
    },
    headerTitle: {
      fontSize: 8 * scale,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    gearDot: {
      width: 6 * scale,
      height: 6 * scale,
      borderRadius: 3 * scale,
      backgroundColor: colors.textMuted,
    },
    statCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 4 * scale,
      padding: 5 * scale,
      marginBottom: 4 * scale,
      gap: 3 * scale,
    },
    statBarShort: {
      width: '45%',
      height: 3 * scale,
      borderRadius: 2 * scale,
      backgroundColor: colors.textSecondary,
      opacity: 0.55,
    },
    statBarLong: {
      width: '70%',
      height: 3 * scale,
      borderRadius: 2 * scale,
      backgroundColor: colors.textMuted,
      opacity: 0.45,
    },
    tabBarCapsule: {
      position: 'absolute',
      left: 8 * scale,
      right: 8 * scale,
      bottom: 8 * scale,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6 * scale,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 10 * scale,
      paddingVertical: 4 * scale,
      paddingHorizontal: 8 * scale,
    },
    tabDotActive: {
      width: 5 * scale,
      height: 5 * scale,
      borderRadius: 2.5 * scale,
      backgroundColor: colors.primary,
    },
    tabDot: {
      width: 4 * scale,
      height: 4 * scale,
      borderRadius: 2 * scale,
      backgroundColor: colors.textMuted,
      opacity: 0.5,
    },
  });
}
