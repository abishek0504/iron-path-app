import { estimateExerciseDuration } from './timeEstimation';

/**
 * Smart Compression: Adjusts workout volume to fit within duration_target_min.
 * This is a deterministic post-processing step that runs after volume templates
 * and progression, but before saving the plan.
 */

export interface CompressionInput {
  exercises: any[];
  durationTargetMin: number | null; // Target duration in minutes
}

export interface CompressionResult {
  exercises: any[];
  estimatedDurationSec: number;
  wasCompressed: boolean;
  compressionActions: string[];
}

/**
 * Estimates total duration for a day's exercises (in seconds).
 */
export const estimateDayDuration = (exercises: any[]): number => {
  if (!Array.isArray(exercises) || exercises.length === 0) return 0;
  let total = 0;

  exercises.forEach((ex: any, idx: number) => {
    const sets = Array.isArray(ex.sets) ? ex.sets : [];
    const isTimed = sets.some((s: any) => s.duration != null);

    if (isTimed) {
      sets.forEach((s: any) => {
        const duration = typeof s.duration === 'number' ? s.duration : 0;
        const rest = typeof s.rest_time_sec === 'number' ? s.rest_time_sec : ex.rest_time_sec || 0;
        total += duration + rest;
      });
    } else {
      const targetSets =
        typeof ex.target_sets === 'number' && ex.target_sets > 0
          ? ex.target_sets
          : sets.length > 0
          ? sets.length
          : 3;
      const targetReps =
        typeof ex.target_reps === 'number'
          ? ex.target_reps
          : typeof sets[0]?.reps === 'number'
          ? sets[0].reps
          : 8;

      const estimation = estimateExerciseDuration({
        targetSets,
        targetReps,
        movementPattern: ex.movement_pattern || null,
        tempoCategory: ex.tempo_category || null,
        setupBufferSec: ex.setup_buffer_sec || null,
        isUnilateral: ex.is_unilateral || false,
        positionIndex: idx,
      });

      const restPerSet =
        typeof ex.rest_time_sec === 'number'
          ? ex.rest_time_sec
          : typeof sets[0]?.rest_time_sec === 'number'
          ? sets[0].rest_time_sec
          : 60;

      total += estimation.estimatedDurationSec + restPerSet * targetSets;
    }
  });

  return total;
};

/**
 * Infers exercise tier from name and metadata.
 * Returns 1 (compound), 2 (accessory), 3 (prehab/mobility), or 0 (unknown).
 */
const inferTier = (exercise: any): number => {
  const name = (exercise.name || '').toLowerCase();
  
  // Tier 1: Primary compounds (squat, deadlift, bench, row, press, pull-up)
  if (
    name.includes('squat') ||
    name.includes('deadlift') ||
    name.includes('bench') ||
    name.includes('row') ||
    name.includes('press') && (name.includes('overhead') || name.includes('shoulder')) ||
    name.includes('pull') && (name.includes('up') || name.includes('down'))
  ) {
    return 1;
  }
  
  // Tier 3: Prehab/mobility/core
  if (
    name.includes('stretch') ||
    name.includes('mobility') ||
    name.includes('warm') ||
    name.includes('cool') ||
    name.includes('plank') ||
    name.includes('crunch') ||
    name.includes('core')
  ) {
    return 3;
  }
  
  // Tier 2: Accessories (everything else that's not Tier 1 or 3)
  return 2;
};

/**
 * Applies Smart Compression to a day's exercises.
 * Strategies (in order):
 * 1. Reduce rest times (up to 20% reduction)
 * 2. Reduce sets on Tier 2/3 exercises (remove 1 set, minimum 2 sets)
 * 3. Remove Tier 3 exercises entirely
 * 4. Reduce sets on Tier 1 exercises (remove 1 set, minimum 3 sets)
 * 5. Remove Tier 2 exercises (keep only Tier 1)
 */
export const applySmartCompression = (input: CompressionInput): CompressionResult => {
  const { exercises, durationTargetMin } = input;
  
  if (!durationTargetMin || durationTargetMin <= 0) {
    const estimated = estimateDayDuration(exercises);
    return {
      exercises,
      estimatedDurationSec: estimated,
      wasCompressed: false,
      compressionActions: [],
    };
  }

  const targetSec = durationTargetMin * 60;
  let currentExercises = [...exercises];
  let estimated = estimateDayDuration(currentExercises);
  const actions: string[] = [];
  let wasCompressed = false;

  // If already under target, no compression needed
  if (estimated <= targetSec) {
    return {
      exercises: currentExercises,
      estimatedDurationSec: estimated,
      wasCompressed: false,
      compressionActions: [],
    };
  }

  if (__DEV__) {
    console.log('[smartCompression] Starting compression', {
      targetMin: durationTargetMin,
      targetSec,
      estimatedSec: estimated,
      estimatedMin: Math.round(estimated / 60),
      exerciseCount: currentExercises.length,
    });
  }

  // Strategy 1: Reduce rest times (up to 20% reduction)
  if (estimated > targetSec) {
    const reductionFactor = 0.8; // 20% reduction
    currentExercises = currentExercises.map((ex) => {
      const sets = Array.isArray(ex.sets) ? [...ex.sets] : [];
      const newRest = Math.max(30, Math.round((ex.rest_time_sec || 60) * reductionFactor));
      
      if (sets.length > 0) {
        sets.forEach((set: any) => {
          if (set.rest_time_sec != null) {
            set.rest_time_sec = Math.max(30, Math.round(set.rest_time_sec * reductionFactor));
          }
        });
      }
      
      return {
        ...ex,
        rest_time_sec: newRest,
        sets: sets.length > 0 ? sets : ex.sets,
      };
    });
    
    estimated = estimateDayDuration(currentExercises);
    if (estimated <= targetSec) {
      actions.push('Reduced rest times by 20%');
      wasCompressed = true;
      return { exercises: currentExercises, estimatedDurationSec: estimated, wasCompressed, compressionActions: actions };
    }
    actions.push('Reduced rest times by 20%');
    wasCompressed = true;
  }

  // Strategy 2: Reduce sets on Tier 2/3 exercises
  if (estimated > targetSec) {
    currentExercises = currentExercises.map((ex) => {
      const tier = inferTier(ex);
      if (tier === 2 || tier === 3) {
        const currentSets = ex.target_sets || (Array.isArray(ex.sets) ? ex.sets.length : 3);
        if (currentSets > 2) {
          const newSets = currentSets - 1;
          const sets = Array.isArray(ex.sets) ? ex.sets.slice(0, newSets) : [];
          return {
            ...ex,
            target_sets: newSets,
            sets: sets.length > 0 ? sets : ex.sets,
          };
        }
      }
      return ex;
    });
    
    estimated = estimateDayDuration(currentExercises);
    if (estimated <= targetSec) {
      actions.push('Reduced sets on Tier 2/3 exercises');
      wasCompressed = true;
      return { exercises: currentExercises, estimatedDurationSec: estimated, wasCompressed, compressionActions: actions };
    }
    actions.push('Reduced sets on Tier 2/3 exercises');
    wasCompressed = true;
  }

  // Strategy 3: Remove Tier 3 exercises
  if (estimated > targetSec) {
    const beforeCount = currentExercises.length;
    currentExercises = currentExercises.filter((ex) => inferTier(ex) !== 3);
    const removed = beforeCount - currentExercises.length;
    
    if (removed > 0) {
      estimated = estimateDayDuration(currentExercises);
      actions.push(`Removed ${removed} Tier 3 exercise(s)`);
      wasCompressed = true;
      
      if (estimated <= targetSec) {
        return { exercises: currentExercises, estimatedDurationSec: estimated, wasCompressed, compressionActions: actions };
      }
    }
  }

  // Strategy 4: Reduce sets on Tier 1 exercises (minimum 3 sets)
  if (estimated > targetSec) {
    currentExercises = currentExercises.map((ex) => {
      const tier = inferTier(ex);
      if (tier === 1) {
        const currentSets = ex.target_sets || (Array.isArray(ex.sets) ? ex.sets.length : 3);
        if (currentSets > 3) {
          const newSets = currentSets - 1;
          const sets = Array.isArray(ex.sets) ? ex.sets.slice(0, newSets) : [];
          return {
            ...ex,
            target_sets: newSets,
            sets: sets.length > 0 ? sets : ex.sets,
          };
        }
      }
      return ex;
    });
    
    estimated = estimateDayDuration(currentExercises);
    if (estimated <= targetSec) {
      actions.push('Reduced sets on Tier 1 exercises');
      wasCompressed = true;
      return { exercises: currentExercises, estimatedDurationSec: estimated, wasCompressed, compressionActions: actions };
    }
    actions.push('Reduced sets on Tier 1 exercises');
    wasCompressed = true;
  }

  // Strategy 5: Remove Tier 2 exercises (keep only Tier 1)
  if (estimated > targetSec) {
    const beforeCount = currentExercises.length;
    currentExercises = currentExercises.filter((ex) => inferTier(ex) === 1);
    const removed = beforeCount - currentExercises.length;
    
    if (removed > 0) {
      estimated = estimateDayDuration(currentExercises);
      actions.push(`Removed ${removed} Tier 2 exercise(s)`);
      wasCompressed = true;
    }
  }

  if (__DEV__) {
    console.log('[smartCompression] Compression complete', {
      finalEstimatedSec: estimated,
      finalEstimatedMin: Math.round(estimated / 60),
      targetMin: durationTargetMin,
      actions,
      wasCompressed,
    });
  }

  return {
    exercises: currentExercises,
    estimatedDurationSec: estimated,
    wasCompressed,
    compressionActions: actions,
  };
};

