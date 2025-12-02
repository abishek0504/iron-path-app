/**
 * Validation utilities for workout plan data structures
 */

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validate an exercise object
 */
export const validateExercise = (exercise: any, index?: number): ValidationError[] => {
  const errors: ValidationError[] = [];
  const prefix = index !== undefined ? `Exercise ${index + 1}` : 'Exercise';

  // Name validation
  if (!exercise.name || typeof exercise.name !== 'string' || exercise.name.trim() === '') {
    errors.push({
      field: 'name',
      message: `${prefix}: Exercise name is required and must be a non-empty string`
    });
  }

  // Target sets validation
  if (exercise.target_sets === undefined || exercise.target_sets === null) {
    errors.push({
      field: 'target_sets',
      message: `${prefix}: target_sets is required`
    });
  } else {
    const sets = typeof exercise.target_sets === 'string' 
      ? parseInt(exercise.target_sets) 
      : exercise.target_sets;
    if (isNaN(sets) || sets <= 0) {
      errors.push({
        field: 'target_sets',
        message: `${prefix}: target_sets must be a positive number`
      });
    }
  }

  // Target reps validation
  if (exercise.target_reps === undefined || exercise.target_reps === null) {
    errors.push({
      field: 'target_reps',
      message: `${prefix}: target_reps is required`
    });
  } else {
    // Can be number or string like "8-12"
    if (typeof exercise.target_reps === 'string') {
      const repStr = exercise.target_reps.trim();
      if (repStr.includes('-')) {
        const [min, max] = repStr.split('-').map(r => parseInt(r.trim()));
        if (isNaN(min) || isNaN(max) || min <= 0 || max <= 0 || min >= max) {
          errors.push({
            field: 'target_reps',
            message: `${prefix}: target_reps range must be valid (e.g., "8-12")`
          });
        }
      } else {
        const reps = parseInt(repStr);
        if (isNaN(reps) || reps <= 0) {
          errors.push({
            field: 'target_reps',
            message: `${prefix}: target_reps must be a positive number or range`
          });
        }
      }
    } else if (typeof exercise.target_reps === 'number') {
      if (isNaN(exercise.target_reps) || exercise.target_reps <= 0) {
        errors.push({
          field: 'target_reps',
          message: `${prefix}: target_reps must be a positive number`
        });
      }
    } else {
      errors.push({
        field: 'target_reps',
        message: `${prefix}: target_reps must be a number or string`
      });
    }
  }

  // Rest time validation (optional but if present must be valid)
  if (exercise.rest_time_sec !== undefined && exercise.rest_time_sec !== null) {
    const rest = typeof exercise.rest_time_sec === 'string'
      ? parseInt(exercise.rest_time_sec)
      : exercise.rest_time_sec;
    if (isNaN(rest) || rest < 0) {
      errors.push({
        field: 'rest_time_sec',
        message: `${prefix}: rest_time_sec must be a non-negative number`
      });
    }
  }

  // Notes is optional, no validation needed

  return errors;
};

/**
 * Normalize exercise object - set defaults for missing optional fields
 */
export const normalizeExercise = (exercise: any): any => {
  return {
    ...exercise,
    rest_time_sec: exercise.rest_time_sec !== undefined && exercise.rest_time_sec !== null
      ? (typeof exercise.rest_time_sec === 'string' ? parseInt(exercise.rest_time_sec) : exercise.rest_time_sec)
      : 60, // Default 60 seconds
    notes: exercise.notes !== undefined && exercise.notes !== null ? exercise.notes : null,
    // Ensure target_sets and target_reps are properly typed
    target_sets: typeof exercise.target_sets === 'string' 
      ? parseInt(exercise.target_sets) 
      : exercise.target_sets,
    target_reps: exercise.target_reps, // Keep as is (can be string range or number)
  };
};

/**
 * Validate full week schedule
 */
export const validateWeekSchedule = (weekSchedule: any): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!weekSchedule || typeof weekSchedule !== 'object') {
    errors.push({
      field: 'week_schedule',
      message: 'week_schedule must be an object'
    });
    return errors;
  }

  // Check all 7 days exist
  for (const day of DAYS_OF_WEEK) {
    if (!(day in weekSchedule)) {
      errors.push({
        field: day,
        message: `Missing day: ${day}`
      });
    } else {
      const dayData = weekSchedule[day];
      if (!dayData || typeof dayData !== 'object') {
        errors.push({
          field: day,
          message: `${day} must be an object`
        });
      } else if (!Array.isArray(dayData.exercises)) {
        errors.push({
          field: `${day}.exercises`,
          message: `${day}.exercises must be an array`
        });
      } else {
        // Validate each exercise in the day
        dayData.exercises.forEach((exercise: any, index: number) => {
          const exerciseErrors = validateExercise(exercise, index);
          errors.push(...exerciseErrors.map(e => ({
            field: `${day}.${e.field}`,
            message: `${day} - ${e.message}`
          })));
        });
      }
    }
  }

  return errors;
};

/**
 * Ensure all 7 days exist in week schedule, create empty arrays if missing
 */
export const ensureAllDays = (weekSchedule: any): any => {
  const normalized: any = { ...weekSchedule };

  for (const day of DAYS_OF_WEEK) {
    if (!(day in normalized)) {
      normalized[day] = { exercises: [] };
    } else if (!normalized[day] || typeof normalized[day] !== 'object') {
      normalized[day] = { exercises: [] };
    } else if (!Array.isArray(normalized[day].exercises)) {
      normalized[day].exercises = [];
    }
  }

  return normalized;
};

/**
 * Validate and normalize exercise array
 */
export const validateAndNormalizeExercises = (exercises: any[]): { 
  valid: any[];
  errors: ValidationError[];
} => {
  const errors: ValidationError[] = [];
  const valid: any[] = [];

  if (!Array.isArray(exercises)) {
    return {
      valid: [],
      errors: [{
        field: 'exercises',
        message: 'exercises must be an array'
      }]
    };
  }

  exercises.forEach((exercise, index) => {
    const exerciseErrors = validateExercise(exercise, index);
    if (exerciseErrors.length === 0) {
      valid.push(normalizeExercise(exercise));
    } else {
      errors.push(...exerciseErrors);
    }
  });

  return { valid, errors };
};

