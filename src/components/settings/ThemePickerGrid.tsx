import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import {
  THEME_OPTIONS,
  darkColors,
  lightColors,
  borderRadius,
  spacing,
  typography,
  type ThemeColors,
  type ThemeOptionId,
} from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import { ThemePreviewMini } from './ThemePreviewMini';

const GRID_COLUMNS = 2;
const PREVIEW_BORDER_WIDTH = 2;

function resolvePreviewColors(
  optionId: ThemeOptionId,
  systemScheme: ReturnType<typeof useColorScheme>,
): ThemeColors {
  const option = THEME_OPTIONS.find((entry) => entry.id === optionId);
  if (option?.colors) {
    return option.colors;
  }
  return systemScheme === 'light' ? lightColors : darkColors;
}

interface ThemePickerGridProps {
  selectedMode: ThemeOptionId;
  onSelect: (mode: ThemeOptionId) => void;
  showDescription?: boolean;
}

export function ThemePickerGrid({
  selectedMode,
  onSelect,
  showDescription = true,
}: ThemePickerGridProps) {
  const colors = useTheme();
  const systemScheme = useColorScheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [gridWidth, setGridWidth] = useState(0);

  const tileWidth = useMemo(() => {
    if (gridWidth <= 0) return 0;
    const columnGap = spacing.md;
    return (gridWidth - columnGap * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
  }, [gridWidth]);

  const previewWidth = tileWidth - PREVIEW_BORDER_WIDTH * 2;

  const selectedOption =
    THEME_OPTIONS.find((option) => option.id === selectedMode) ?? THEME_OPTIONS[0];

  return (
    <View style={styles.root}>
      <View
        style={styles.grid}
        onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}
      >
        {THEME_OPTIONS.map((option) => {
          const isSelected = selectedMode === option.id;
          const previewColors = resolvePreviewColors(option.id, systemScheme);

          return (
            <TouchableOpacity
              key={option.id}
              style={[styles.tile, tileWidth > 0 && { width: tileWidth }]}
              onPress={() => onSelect(option.id)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`${option.label} theme`}
              accessibilityState={{ selected: isSelected }}
            >
              <View
                style={[
                  styles.previewFrame,
                  isSelected && {
                    borderColor: colors.primary,
                    borderWidth: PREVIEW_BORDER_WIDTH,
                  },
                ]}
              >
                {tileWidth > 0 ? (
                  <ThemePreviewMini colors={previewColors} width={previewWidth} />
                ) : null}
              </View>
              <Text
                style={[
                  styles.tileLabel,
                  isSelected && styles.tileLabelSelected,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {showDescription ? (
        <Text style={styles.description}>{selectedOption.description}</Text>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      gap: spacing.md,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    tile: {
      alignItems: 'center',
      gap: spacing.sm,
    },
    previewFrame: {
      borderRadius: borderRadius.md,
      borderWidth: PREVIEW_BORDER_WIDTH,
      borderColor: 'transparent',
      overflow: 'hidden',
    },
    tileLabel: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.normal,
      color: colors.textMuted,
    },
    tileLabelSelected: {
      fontWeight: typography.weights.semibold,
      color: colors.primary,
    },
    description: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      marginLeft: spacing.xs,
      textAlign: 'center',
    },
  });
}
