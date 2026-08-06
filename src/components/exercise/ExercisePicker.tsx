/**
 * Exercise Picker
 * Bottom sheet component for selecting exercises
 * Reusable across all tabs
 * Uses 5 min cache to reduce DB egress when picker is reopened.
 */

import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Check, Search, X } from 'lucide-react-native';
import { useUIStore } from '../../stores/uiStore';
import { spacing, borderRadius, type ThemeColors } from '../../lib/utils/theme';
import { LogoEdgeLoader } from '../ui/LogoEdgeLoader';
import { Button } from '../ui/Button';
import { useTheme } from '../../lib/utils/ThemeContext';
import { devLog, devError } from '../../lib/utils/logger';
import { searchExercisesByName } from '../../lib/exercises/searchExercises';
import { getBundledMasterExercises } from '../../data/bundledCatalog';
import type { Exercise } from '../../types/exercisePicker';

let exerciseCache: Exercise[] | null = null;

function loadExercisesCached(): Exercise[] {
  if (exerciseCache) return exerciseCache;

  const mapped: Exercise[] = getBundledMasterExercises().map((ex) => ({
    id: ex.id,
    name: ex.name,
    description: ex.description,
    density_score: ex.density_score ?? 0,
    primary_muscles: ex.primary_muscles ?? [],
    implicit_hits: ex.implicit_hits ?? {},
    is_unilateral: ex.is_unilateral ?? false,
    setup_buffer_sec: ex.setup_buffer_sec ?? 0,
    avg_time_per_set_sec: ex.avg_time_per_set_sec ?? 0,
    is_timed: ex.is_timed ?? false,
    equipment_needed: ex.equipment_needed,
    movement_pattern: ex.movement_pattern,
  }));

  exerciseCache = mapped;
  return mapped;
}

interface ExercisePickerProps {
  onSelect?: (exercise: Exercise) => void;
  /** Multi-select mode: tap to toggle, confirm with the footer button. */
  onSelectMultiple?: (exercises: Exercise[]) => void;
  multiSelect?: boolean;
}

export const ExercisePicker: React.FC<ExercisePickerProps> = ({
  onSelect,
  onSelectMultiple,
  multiSelect = false,
}) => {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const closeBottomSheet = useUIStore((state) => state.closeBottomSheet);
  const showToast = useUIStore((state) => state.showToast);

  useEffect(() => {
    loadExercises();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load catalog once when picker opens
  }, []);

  useEffect(() => {
    filterExercises();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filterExercises closes over searchQuery and exercises
  }, [searchQuery, exercises]);

  const loadExercises = async () => {
    if (__DEV__) {
      devLog('exercise-picker', { action: 'loadExercises' });
    }

    setLoading(true);
    try {
      const mappedExercises = loadExercisesCached();
      setExercises(mappedExercises);
      setFilteredExercises(mappedExercises);

      if (__DEV__) {
        devLog('exercise-picker', {
          action: 'loadExercises_result',
          count: mappedExercises.length,
        });
      }
    } catch (error) {
      if (__DEV__) {
        devError('exercise-picker', error);
      }
      showToast('Failed to load exercises', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filterExercises = () => {
    const filtered = searchExercisesByName(exercises, searchQuery);
    setFilteredExercises(filtered);

    if (__DEV__) {
      const query = searchQuery.toLowerCase().trim();
      devLog('exercise-picker', {
        action: 'filterExercises',
        queryLength: query.length,
        resultCount: filtered.length,
      });
    }
  };

  const handleSelect = (exercise: Exercise) => {
    if (__DEV__) {
      devLog('exercise-picker', { 
        action: 'handleSelect', 
        exerciseId: exercise.id,
        exerciseName: exercise.name 
      });
    }

    if (multiSelect) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(exercise.id)) {
          next.delete(exercise.id);
        } else {
          next.add(exercise.id);
        }
        return next;
      });
      return;
    }

    if (onSelect) {
      onSelect(exercise);
    }

    closeBottomSheet();
  };

  const handleConfirmMultiple = () => {
    const selected = exercises.filter((ex) => selectedIds.has(ex.id));
    if (__DEV__) {
      devLog('exercise-picker', { action: 'confirmMultiple', count: selected.length });
    }
    if (onSelectMultiple) {
      onSelectMultiple(selected);
    }
    closeBottomSheet();
  };

  const renderExercise = ({ item }: { item: Exercise }) => {
    const isSelected = multiSelect && selectedIds.has(item.id);
    return (
      <TouchableOpacity
        style={[styles.exerciseItem, isSelected && styles.exerciseItemSelected]}
        onPress={() => handleSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.exerciseRow}>
          <View style={styles.exerciseContent}>
            <Text style={styles.exerciseName}>{item.name}</Text>
            {item.description && (
              <Text style={styles.exerciseDescription} numberOfLines={2}>
                {item.description}
              </Text>
            )}
            <View style={styles.exerciseMeta}>
              <Text style={styles.metaText}>
                Density: {item.density_score.toFixed(1)}
              </Text>
              {item.primary_muscles.length > 0 && (
                <Text style={styles.metaText}>
                  {item.primary_muscles.slice(0, 3).join(', ')}
                </Text>
              )}
            </View>
          </View>
          {isSelected && <Check size={20} color={colors.primary} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <Search size={20} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search exercises..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <X size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <LogoEdgeLoader size="xlarge" />
        </View>
      ) : (
        <FlatList
          data={filteredExercises}
          keyExtractor={(item) => item.id}
          renderItem={renderExercise}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No exercises found</Text>
            </View>
          }
        />
      )}

      {multiSelect && (
        <Button
          label={
            selectedIds.size === 0
              ? 'Select exercises'
              : `Add ${selectedIds.size} exercise${selectedIds.size === 1 ? '' : 's'}`
          }
          onPress={handleConfirmMultiple}
          disabled={selectedIds.size === 0}
          fullWidth
          style={styles.confirmButton}
        />
      )}
    </View>
  );
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: spacing.lg,
  },
  exerciseItem: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  exerciseItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  exerciseContent: {
    flex: 1,
    gap: spacing.xs,
  },
  confirmButton: {
    marginTop: spacing.sm,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  exerciseDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  exerciseMeta: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  metaText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  });
}

