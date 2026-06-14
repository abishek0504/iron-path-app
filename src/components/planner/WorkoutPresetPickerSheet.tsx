import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Pencil, Trash2 } from 'lucide-react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { spacing, borderRadius, typography } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import type { WorkoutPreset } from '../../lib/supabase/queries/presets';

type Props = {
  visible: boolean;
  presets: WorkoutPreset[];
  loading?: boolean;
  onClose: () => void;
  onSelect: (preset: WorkoutPreset) => void;
  onRename: (preset: WorkoutPreset) => void;
  onDelete: (preset: WorkoutPreset) => void;
};

export const WorkoutPresetPickerSheet: React.FC<Props> = ({
  visible,
  presets,
  loading = false,
  onClose,
  onSelect,
  onRename,
  onDelete,
}) => {
  const colors = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: {
          flex: 1,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.lg,
        },
        empty: {
          paddingVertical: spacing.xl,
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
          borderBottomWidth: 1,
          borderBottomColor: colors.cardBorder,
          gap: spacing.sm,
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
    <BottomSheet visible={visible} onClose={onClose} title="Load from preset" height="70%">
      <View style={styles.content}>
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
          <FlatList
            data={presets}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <TouchableOpacity style={styles.rowMain} onPress={() => onSelect(item)}>
                  <Text style={styles.rowTitle}>{item.name}</Text>
                  <Text style={styles.rowSubtitle}>
                    {item.slot_count ?? 0} exercise{(item.slot_count ?? 0) === 1 ? '' : 's'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => onRename(item)}
                  accessibilityLabel={`Rename ${item.name}`}
                >
                  <Pencil size={18} color={colors.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => onDelete(item)}
                  accessibilityLabel={`Delete ${item.name}`}
                >
                  <Trash2 size={18} color={colors.errorText} />
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>
    </BottomSheet>
  );
};
