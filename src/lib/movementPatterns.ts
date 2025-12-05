/**
 * Movement Pattern Heuristic Tagging
 * 
 * Infers movement patterns from exercise names using keyword matching.
 * Based on functional movement patterns in strength training:
 * - squat: knee-dominant lower body (squats, leg press)
 * - hinge: hip-dominant lower body (deadlifts, RDLs, hip thrusts)
 * - lunge: single-leg lower body (lunges, step-ups, split squats)
 * - push_vert: vertical push (overhead press, shoulder press)
 * - push_horiz: horizontal push (bench press, push-ups, dips)
 * - pull_vert: vertical pull (pull-ups, chin-ups, lat pulldown)
 * - pull_horiz: horizontal pull (rows, face pulls)
 * - carry: loaded carries (farmer's walk, suitcase carry)
 */

export type MovementPattern =
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'push_vert'
  | 'push_horiz'
  | 'pull_vert'
  | 'pull_horiz'
  | 'carry'
  | null;

/**
 * Infers movement pattern from exercise name using keyword matching.
 * Returns null if pattern cannot be determined.
 */
export const inferMovementPattern = (exerciseName: string | null | undefined): MovementPattern => {
  if (!exerciseName) return null;

  const name = exerciseName.toLowerCase().trim();

  // Hinge patterns (hip-dominant) - check before squat to catch RDLs, etc.
  if (
    name.includes('deadlift') ||
    name.includes('rdl') ||
    name.includes('romanian') ||
    name.includes('hip thrust') ||
    name.includes('hip thrust') ||
    name.includes('good morning') ||
    name.includes('hyperextension') ||
    name.includes('back extension')
  ) {
    return 'hinge';
  }

  // Squat patterns (knee-dominant)
  if (
    name.includes('squat') ||
    name.includes('leg press') ||
    name.includes('hack squat') ||
    name.includes('goblet squat') ||
    name.includes('front squat') ||
    name.includes('back squat')
  ) {
    return 'squat';
  }

  // Lunge patterns (single-leg)
  if (
    name.includes('lunge') ||
    name.includes('step up') ||
    name.includes('step-up') ||
    name.includes('split squat') ||
    name.includes('bulgarian') ||
    name.includes('pistol squat') ||
    name.includes('single leg')
  ) {
    return 'lunge';
  }

  // Vertical pull (pull-ups, lat pulldown)
  if (
    name.includes('pull up') ||
    name.includes('pull-up') ||
    name.includes('pullup') ||
    name.includes('chin up') ||
    name.includes('chin-up') ||
    name.includes('lat pulldown') ||
    name.includes('lat pull-down') ||
    name.includes('lat pull down') ||
    name.includes('pull down') ||
    name.includes('pulldown')
  ) {
    return 'pull_vert';
  }

  // Horizontal pull (rows)
  if (
    name.includes('row') ||
    name.includes('face pull') ||
    name.includes('cable row') ||
    name.includes('barbell row') ||
    name.includes('dumbbell row') ||
    name.includes('t-bar row')
  ) {
    // Exclude upright row (shoulder exercise, not a pull)
    if (name.includes('upright row')) {
      return 'push_vert'; // Upright row is more of a vertical push
    }
    return 'pull_horiz';
  }

  // Vertical push (overhead press)
  if (
    name.includes('overhead press') ||
    name.includes('ohp') ||
    name.includes('shoulder press') ||
    name.includes('military press') ||
    name.includes('push press') ||
    name.includes('arnold press') ||
    name.includes('upright row') ||
    name.includes('lateral raise') ||
    name.includes('front raise')
  ) {
    return 'push_vert';
  }

  // Horizontal push (bench press, push-ups, dips)
  if (
    name.includes('bench') ||
    name.includes('push up') ||
    name.includes('push-up') ||
    name.includes('pushup') ||
    name.includes('dip') ||
    name.includes('chest press') ||
    name.includes('pec fly') ||
    name.includes('pec flye') ||
    name.includes('chest fly')
  ) {
    return 'push_horiz';
  }

  // Carry patterns
  if (
    name.includes('carry') ||
    name.includes('walk') ||
    name.includes('suitcase') ||
    name.includes('farmer')
  ) {
    return 'carry';
  }

  // Default: cannot determine pattern
  return null;
};

/**
 * Gets human-readable label for a movement pattern
 */
export const getMovementPatternLabel = (pattern: MovementPattern): string => {
  if (!pattern) return 'Unknown';
  
  const labels: Record<string, string> = {
    squat: 'Squat',
    hinge: 'Hinge',
    lunge: 'Lunge',
    push_vert: 'Vertical Push',
    push_horiz: 'Horizontal Push',
    pull_vert: 'Vertical Pull',
    pull_horiz: 'Horizontal Pull',
    carry: 'Carry',
  };
  
  return labels[pattern] || 'Unknown';
};

/**
 * Gets all movement patterns (for UI dropdowns, etc.)
 */
export const getAllMovementPatterns = (): MovementPattern[] => {
  return [
    'squat',
    'hinge',
    'lunge',
    'push_vert',
    'push_horiz',
    'pull_vert',
    'pull_horiz',
    'carry',
  ];
};

