import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import {
  THEME_OPTIONS,
  darkColors,
  lightColors,
  borderRadius,
  spacing,
  typography,
  type ThemeColors,
  type ThemeOptionId,
} from '../src/lib/utils/theme';
import { useTheme, useThemeMode } from '../src/lib/utils/ThemeContext';
import { ThemePreviewMini } from '../src/components/settings/ThemePreviewMini';

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

export default function AppearanceScreen() {
  const colors = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const systemScheme = useColorScheme();
  const { themeMode, setThemeMode } = useThemeMode();

  const tileWidth = useMemo(() => {
    const horizontalPadding = spacing.lg * 2;
    const columnGap = spacing.md;
    return (screenWidth - horizontalPadding - columnGap * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
  }, [screenWidth]);

  const previewWidth = tileWidth - PREVIEW_BORDER_WIDTH * 2;

  const selectedOption =
    THEME_OPTIONS.find((option) => option.id === themeMode) ?? THEME_OPTIONS[0];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Appearance</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionLabel}>Theme</Text>

        <View style={styles.grid}>
          {THEME_OPTIONS.map((option) => {
            const isSelected = themeMode === option.id;
            const previewColors = resolvePreviewColors(option.id, systemScheme);

            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.tile, { width: tileWidth }]}
                onPress={() => setThemeMode(option.id)}
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
                  <ThemePreviewMini colors={previewColors} width={previewWidth} />
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

        <Text style={styles.description}>{selectedOption.description}</Text>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.semibold,
      color: colors.textPrimary,
    },
    headerSpacer: {
      width: 40,
    },
    content: {
      flex: 1,
      padding: spacing.lg,
      justifyContent: 'center',
      gap: spacing.md,
    },
    sectionLabel: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginLeft: spacing.xs,
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
