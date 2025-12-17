/**
 * Exercise Store (Zustand)
 * Manages exercise search state and selected exercises
 */

import { create } from 'zustand';
import { devLog } from '../lib/utils/logger';

export interface Exercise {
  id: string;
  name: string;
  description?: string;
  density_score: number;
  primary_muscles: string[];
  implicit_hits: Record<string, number>;
  is_unilateral: boolean;
  setup_buffer_sec: number;
  avg_time_per_set_sec: number;
  is_timed: boolean;
  equipment_needed?: string[];
  movement_pattern?: string;
}

interface ExerciseState {
  searchQuery: string;
  selectedExercises: Exercise[];
  isLoading: boolean;
  
  // Actions
  setSearchQuery: (query: string) => void;
  setSelectedExercises: (exercises: Exercise[]) => void;
  addSelectedExercise: (exercise: Exercise) => void;
  removeSelectedExercise: (exerciseId: string) => void;
  clearSelection: () => void;
}

export const useExerciseStore = create<ExerciseState>((set) => ({
  searchQuery: '',
  selectedExercises: [],
  isLoading: false,
  
  setSearchQuery: (query) => {
    if (__DEV__) {
      devLog('exercise-store', { 
        action: 'setSearchQuery', 
        queryLength: query.length 
      });
    }
    set({ searchQuery: query });
  },
  
  setSelectedExercises: (exercises) => {
    if (__DEV__) {
      devLog('exercise-store', { 
        action: 'setSelectedExercises', 
        count: exercises.length 
      });
    }
    set({ selectedExercises: exercises });
  },
  
  addSelectedExercise: (exercise) => {
    if (__DEV__) {
      devLog('exercise-store', { 
        action: 'addSelectedExercise', 
        exerciseId: exercise.id,
        exerciseName: exercise.name 
      });
    }
    set((state) => ({
      selectedExercises: [...state.selectedExercises, exercise],
    }));
  },
  
  removeSelectedExercise: (exerciseId) => {
    if (__DEV__) {
      devLog('exercise-store', { 
        action: 'removeSelectedExercise', 
        exerciseId 
      });
    }
    set((state) => ({
      selectedExercises: state.selectedExercises.filter((e) => e.id !== exerciseId),
    }));
  },
  
  clearSelection: () => {
    if (__DEV__) {
      devLog('exercise-store', { action: 'clearSelection' });
    }
    set({ selectedExercises: [], searchQuery: '' });
  },
}));

