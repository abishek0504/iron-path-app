import React, { useMemo, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { spacing, typography, type ThemeColors } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import {
  expandPlatesPerSide,
  formatPlateLine,
  type PlateBreakdown,
} from '../../lib/workout/plateCalculator';

const SCENE_HEIGHT = 148;
const COLLAR_WIDTH = 7;
const COLLAR_HEIGHT = 26;
const SHAFT_HEIGHT = 10;
const MIN_SHAFT_WIDTH = 52;
const PLATE_GAP = 1.5;
const EMPTY_SLEEVE_WIDTH = 28;
const END_CAP_WIDTH = 4;

interface PlateLook {
  fill: string;
  edge: string;
  label: string;
}

function plateLook(weight: number, unit: 'lbs' | 'kg'): PlateLook {
  if (unit === 'lbs') {
    if (weight === 45) return { fill: '#1d4ed8', edge: '#1e3a8a', label: '#ffffff' };
    if (weight === 35) return { fill: '#eab308', edge: '#a16207', label: '#18181b' };
    if (weight === 25) return { fill: '#16a34a', edge: '#14532d', label: '#ffffff' };
    if (weight === 10) return { fill: '#e4e4e7', edge: '#a1a1aa', label: '#18181b' };
    if (weight === 5) return { fill: '#a1a1aa', edge: '#52525b', label: '#18181b' };
    return { fill: '#3f3f46', edge: '#27272a', label: '#ffffff' };
  }
  if (weight === 25) return { fill: '#dc2626', edge: '#991b1b', label: '#ffffff' };
  if (weight === 20) return { fill: '#2563eb', edge: '#1e40af', label: '#ffffff' };
  if (weight === 15) return { fill: '#eab308', edge: '#a16207', label: '#18181b' };
  if (weight === 10) return { fill: '#16a34a', edge: '#14532d', label: '#ffffff' };
  if (weight === 5) return { fill: '#f4f4f5', edge: '#a1a1aa', label: '#18181b' };
  if (weight === 2.5) return { fill: '#18181b', edge: '#09090b', label: '#fafafa' };
  return { fill: '#71717a', edge: '#3f3f46', label: '#ffffff' };
}

function plateSize(weight: number, unit: 'lbs' | 'kg'): { width: number; height: number } {
  const maxPlate = unit === 'lbs' ? 45 : 25;
  const ratio = Math.min(1, weight / maxPlate);
  return {
    width: Math.round(6 + 16 * ratio),
    height: Math.round(44 + 80 * Math.sqrt(ratio)),
  };
}

interface BarbellLoadVisualProps {
  breakdown: PlateBreakdown;
}

export function BarbellLoadVisual({ breakdown }: BarbellLoadVisualProps) {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [rowWidth, setRowWidth] = useState(0);

  const innerPlates = useMemo(
    () => expandPlatesPerSide(breakdown.perSide),
    [breakdown.perSide],
  );
  const leftPlates = useMemo(() => [...innerPlates].reverse(), [innerPlates]);

  const scale = useMemo(() => {
    const platesWidth =
      innerPlates.reduce((sum, weight) => {
        return sum + plateSize(weight, breakdown.unit).width + PLATE_GAP;
      }, 0) * 2;
    const sleeves = innerPlates.length === 0 ? EMPTY_SLEEVE_WIDTH * 2 : 0;
    const natural =
      platesWidth +
      COLLAR_WIDTH * 2 +
      END_CAP_WIDTH * 2 +
      sleeves +
      MIN_SHAFT_WIDTH;
    if (rowWidth <= 0 || natural <= rowWidth) return 1;
    return rowWidth / natural;
  }, [innerPlates, breakdown.unit, rowWidth]);

  const metal = colors.textMuted;
  const collarFill = colors.textSecondary;

  const onLayout = (event: LayoutChangeEvent) => {
    setRowWidth(event.nativeEvent.layout.width);
  };

  return (
    <View accessibilityRole="image" accessibilityLabel={formatPlateLine(breakdown)}>
      <View style={styles.scene} onLayout={onLayout}>
        <View style={[styles.throughBar, { backgroundColor: metal }]} />
        <View style={styles.loadRow}>
          <View style={[styles.endCap, { backgroundColor: metal, width: END_CAP_WIDTH * scale }]} />
          {leftPlates.length === 0 ? (
            <View
              style={[
                styles.emptySleeve,
                { backgroundColor: metal, width: EMPTY_SLEEVE_WIDTH * scale },
              ]}
            />
          ) : (
            leftPlates.map((weight, index) => (
              <PlateTick
                key={`L-${index}-${weight}`}
                weight={weight}
                unit={breakdown.unit}
                scale={scale}
              />
            ))
          )}
          <View
            style={[
              styles.collar,
              {
                backgroundColor: collarFill,
                width: COLLAR_WIDTH * scale,
              },
            ]}
          />
          <View style={[styles.shaftGap, { minWidth: MIN_SHAFT_WIDTH * scale }]} />
          <View
            style={[
              styles.collar,
              {
                backgroundColor: collarFill,
                width: COLLAR_WIDTH * scale,
              },
            ]}
          />
          {innerPlates.length === 0 ? (
            <View
              style={[
                styles.emptySleeve,
                { backgroundColor: metal, width: EMPTY_SLEEVE_WIDTH * scale },
              ]}
            />
          ) : (
            innerPlates.map((weight, index) => (
              <PlateTick
                key={`R-${index}-${weight}`}
                weight={weight}
                unit={breakdown.unit}
                scale={scale}
              />
            ))
          )}
          <View style={[styles.endCap, { backgroundColor: metal, width: END_CAP_WIDTH * scale }]} />
        </View>
      </View>
      <Text
        style={[styles.caption, breakdown.leftoverPerSide > 0 ? styles.leftover : null]}
      >
        {formatPlateLine(breakdown)}
      </Text>
    </View>
  );
}

function PlateTick({
  weight,
  unit,
  scale,
}: {
  weight: number;
  unit: 'lbs' | 'kg';
  scale: number;
}) {
  const look = plateLook(weight, unit);
  const size = plateSize(weight, unit);
  const width = Math.max(5, size.width * scale);
  const showLabel = width >= 11;

  return (
    <View
      style={{
        width,
        height: size.height,
        marginHorizontal: (PLATE_GAP * scale) / 2,
        backgroundColor: look.fill,
        borderColor: look.edge,
        borderWidth: 1,
        borderRadius: 2,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      {showLabel ? (
        <Text
          style={{
            color: look.label,
            fontSize: width >= 16 ? 10 : 8,
            fontWeight: '800',
            width: size.height,
            textAlign: 'center',
            transform: [{ rotate: '-90deg' }],
          }}
          numberOfLines={1}
        >
          {weight}
        </Text>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    scene: {
      height: SCENE_HEIGHT,
      width: '100%',
      justifyContent: 'center',
    },
    throughBar: {
      position: 'absolute',
      left: 4,
      right: 4,
      height: SHAFT_HEIGHT,
      borderRadius: SHAFT_HEIGHT / 2,
      top: (SCENE_HEIGHT - SHAFT_HEIGHT) / 2,
    },
    loadRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    shaftGap: {
      flex: 1,
      maxWidth: 96,
      height: SHAFT_HEIGHT,
    },
    collar: {
      height: COLLAR_HEIGHT,
      borderRadius: 1,
    },
    endCap: {
      height: 16,
      borderRadius: 1,
    },
    emptySleeve: {
      height: 8,
      borderRadius: 2,
    },
    caption: {
      marginTop: spacing.sm,
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      lineHeight: 20,
      textAlign: 'center',
    },
    leftover: {
      color: colors.warning,
    },
  });
}
