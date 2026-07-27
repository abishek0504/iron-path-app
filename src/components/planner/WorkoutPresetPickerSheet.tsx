import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { spacing, typography } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import type { WorkoutPreset } from '../../lib/supabase/queries/presets';

type Props = {
  visible: boolean;
  presets: WorkoutPreset[];
  selectedPreset: WorkoutPreset | null;
  loading?: boolean;
  applying?: boolean;
  onClose: () => void;
  onClosed?: () => void;
  onSelectPreset: (preset: WorkoutPreset) => void;
  onLoadPreset: (preset: WorkoutPreset) => void;
  onDelete: (preset: WorkoutPreset) => void;
};

export const WorkoutPresetPickerSheet: React.FC<Props> = ({
  visible,
  presets,
  selectedPreset,
  loading = false,
  applying = false,
  onClose,
  onClosed,
  onSelectPreset,
  onLoadPreset,
  onDelete,
}) => {
  const colors = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: {
          flex: 1,
          marginHorizontal: -spacing.md,
        },
        scrollContent: {
          paddingBottom: spacing.xl,
        },
        empty: {
          paddingVertical: spacing.xl,
          paddingHorizontal: spacing.lg,
          alignItems: 'center',
          gap: spacing.sm,
        },
        emptyTitle: {
          color: colors.textPrimary,
          fontSize: typography.sizes.base,
          fontWeight: typography.weights.semibold,
          textAlign: 'center',
        },
        emptySubtitle: {
          color: colors.textSecondary,
          fontSize: typography.sizes.sm,
          textAlign: 'center',
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.cardBorder,
          backgroundColor: colors.background,
          gap: spacing.sm,
        },
        rowSelected: {
          backgroundColor: colors.primarySelectedBg,
        },
        rowMain: {
          flex: 1,
        },
        rowTitle: {
          color: colors.textPrimary,
          fontSize: typography.sizes.base,
          fontWeight: typography.weights.semibold,
        },
        rowSubtitle: {
          color: colors.textSecondary,
          fontSize: typography.sizes.sm,
          marginTop: 2,
        },
        rowActions: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
        },
        loadRowButton: {
          minWidth: 52,
        },
        iconButton: {
          padding: spacing.xs,
        },
        loader: {
          paddingVertical: spacing.xl,
          alignItems: 'center',
        },
      }),
    [colors]
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onClosed={onClosed}
      title="Load from preset"
      height="70%"
    >
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : presets.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No presets yet</Text>
          <Text style={styles.emptySubtitle}>
            Save one from a workout using the bookmark icon.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {presets.map((item) => {
            const isSelected = item.id === selectedPreset?.id;
            return (
              <View key={item.id} style={[styles.row, isSelected && styles.rowSelected]}>
                <TouchableOpacity style={styles.rowMain} onPress={() => onSelectPreset(item)}>
                  <Text style={styles.rowTitle}>{item.name}</Text>
                  <Text style={styles.rowSubtitle}>
                    {item.slot_count ?? 0} exercise{(item.slot_count ?? 0) === 1 ? '' : 's'}
                  </Text>
                </TouchableOpacity>
                <View style={styles.rowActions}>
                  <Button
                    label="Load"
                    size="sm"
                    onPress={() => onLoadPreset(item)}
                    disabled={applying}
                    accessibilityLabel={`Load ${item.name}`}
                    style={styles.loadRowButton}
                  />
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => onDelete(item)}
                    accessibilityLabel={`Delete ${item.name}`}
                  >
                    <Trash2 size={18} color={colors.errorText} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </BottomSheet>
  );
};
