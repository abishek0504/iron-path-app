/**
 * Exercise Picker
 * Bottom sheet component for selecting exercises
 * Reusable across all tabs
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Search, X } from 'lucide-react-native';
import { supabase } from '../../lib/supabase/client';
import { useExerciseStore } from '../../stores/exerciseStore';
import { useUIStore } from '../../stores/uiStore';
import { colors, spacing, borderRadius } from '../../lib/utils/theme';
import { devLog, devError } from '../../lib/utils/logger';
import type { Exercise } from '../../stores/exerciseStore';

interface ExercisePickerProps {
  onSelect?: (exercise: Exercise) => void;
  multiSelect?: boolean;
}

export const ExercisePicker: React.FC<ExercisePickerProps> = ({
  onSelect,
  multiSelect = false,
}) => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const searchQuery = useExerciseStore((state) => state.searchQuery);
  const setSearchQuery = useExerciseStore((state) => state.setSearchQuery);
  const closeBottomSheet = useUIStore((state) => state.closeBottomSheet);
  const showToast = useUIStore((state) => state.showToast);

  useEffect(() => {
    loadExercises();
  }, []);

  useEffect(() => {
    filterExercises();
  }, [searchQuery, exercises]);

  const loadExercises = async () => {
    if (__DEV__) {
      devLog('exercise-picker', { action: 'loadExercises' });
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('v2_exercises')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        if (__DEV__) {
          devError('exercise-picker', error);
        }
        showToast('Failed to load exercises', 'error');
        return;
      }

      const mappedExercises: Exercise[] = (data || []).map((ex) => ({
        id: ex.id,
        name: ex.name,
        description: ex.description,
        density_score: ex.density_score,
        primary_muscles: ex.primary_muscles,
        implicit_hits: ex.implicit_hits,
        is_unilateral: ex.is_unilateral,
        setup_buffer_sec: ex.setup_buffer_sec,
        avg_time_per_set_sec: ex.avg_time_per_set_sec,
        is_timed: ex.is_timed,
        equipment_needed: ex.equipment_needed,
        movement_pattern: ex.movement_pattern,
      }));

      setExercises(mappedExercises);
      setFilteredExercises(mappedExercises);

      if (__DEV__) {
        devLog('exercise-picker', { 
          action: 'loadExercises_result', 
          count: mappedExercises.length 
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
    if (!searchQuery.trim()) {
      setFilteredExercises(exercises);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = exercises.filter((ex) =>
      ex.name.toLowerCase().includes(query)
    );

    setFilteredExercises(filtered);

    if (__DEV__) {
      devLog('exercise-picker', { 
        action: 'filterExercises', 
        queryLength: query.length,
        resultCount: filtered.length 
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

    if (onSelect) {
      onSelect(exercise);
    }

    if (!multiSelect) {
      closeBottomSheet();
    }
  };

  const renderExercise = ({ item }: { item: Exercise }) => (
    <TouchableOpacity
      style={styles.exerciseItem}
      onPress={() => handleSelect(item)}
      activeOpacity={0.7}
    >
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
    </TouchableOpacity>
  );

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
          <ActivityIndicator size="large" color={colors.primary} />
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
    </View>
  );
};

const styles = StyleSheet.create({
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
  exerciseContent: {
    gap: spacing.xs,
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

