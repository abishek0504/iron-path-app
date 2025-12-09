/**
 * Equipment filtering utilities
 * Filters exercises based on user's available equipment
 */

/**
 * Normalize equipment name for comparison (handles variations)
 */
const normalizeEquipmentName = (name: string): string => {
  return name.toLowerCase().trim();
};

/**
 * Check if an exercise's equipment requirements are satisfied by user's available equipment
 * @param exerciseEquipment - Array of equipment needed for the exercise (from equipment_needed field)
 * @param userEquipment - Array of equipment user has available (from equipment_access field)
 * @returns true if user has all required equipment, false otherwise
 */
export const exerciseMatchesEquipment = (
  exerciseEquipment: string[] | null | undefined,
  userEquipment: (string | { name: string; weights?: any[] })[] | null | undefined
): boolean => {
  // If exercise has no equipment requirements, it's bodyweight - always available
  if (!exerciseEquipment || exerciseEquipment.length === 0) {
    return true;
  }

  // If userEquipment is null or undefined, assume full gym access
  if (userEquipment === null || userEquipment === undefined) {
    return true;
  }

  // If userEquipment is an empty array, user has selected "bodyweight only"
  // Exercise requires equipment, so it's not available
  if (userEquipment.length === 0) {
    return false;
  }

  // Extract equipment names from user's equipment (handles both string and object formats)
  const userEquipmentNames = userEquipment.map(eq => {
    if (typeof eq === 'string') {
      return normalizeEquipmentName(eq);
    } else if (eq && typeof eq === 'object' && 'name' in eq) {
      return normalizeEquipmentName(eq.name);
    }
    return '';
  }).filter(Boolean);

  // Normalize exercise equipment requirements
  const normalizedExerciseEquipment = exerciseEquipment.map(normalizeEquipmentName);

  // Check if all exercise equipment requirements are met
  // Exercise needs ALL listed equipment, so we check that every required equipment is in user's list
  return normalizedExerciseEquipment.every(reqEq => {
    // Check exact match first
    if (userEquipmentNames.includes(reqEq)) {
      return true;
    }

    // Check for partial matches (e.g., "Dumbbells" matches "Dumbbells" with weights)
    // This handles cases where equipment might be stored with additional info
    return userEquipmentNames.some(userEq => {
      return userEq.includes(reqEq) || reqEq.includes(userEq);
    });
  });
};

/**
 * Filter exercises by user's available equipment
 * @param exercises - Array of exercises with equipment_needed field
 * @param userEquipment - Array of equipment user has available (empty array = bodyweight only, null/undefined = full gym)
 * @returns Filtered array of exercises that match user's equipment
 */
export const filterExercisesByEquipment = <T extends { equipment_needed?: string[] | null }>(
  exercises: T[],
  userEquipment: (string | { name: string; weights?: any[] })[] | null | undefined
): T[] => {
  if (!exercises || exercises.length === 0) {
    return [];
  }

  // If userEquipment is null or undefined, assume full gym access - return all exercises
  if (userEquipment === null || userEquipment === undefined) {
    return exercises;
  }

  // If userEquipment is an empty array, user has selected "bodyweight only"
  // Only return exercises with no equipment requirements
  if (userEquipment.length === 0) {
    return exercises.filter(exercise => {
      const equipmentNeeded = exercise.equipment_needed;
      return !equipmentNeeded || equipmentNeeded.length === 0;
    });
  }

  // User has specific equipment - filter exercises that match
  return exercises.filter(exercise => 
    exerciseMatchesEquipment(exercise.equipment_needed, userEquipment)
  );
};

/**
 * Get equipment preset configurations
 */
export const EQUIPMENT_PRESETS = {
  'Bodyweight Only': {
    description: 'No equipment needed - bodyweight exercises only',
    equipment: [] // Empty means bodyweight only
  },
  'Free Weights': {
    description: 'Dumbbells, kettlebells, and resistance bands',
    equipment: [
      'Dumbbells',
      'Kettlebells',
      'Medicine Balls',
      'Handle Bands',
      'Mini Loop Bands',
      'Loop Bands'
    ]
  },
  'Home Gym Basic': {
    description: 'Free weights, pull-up bar, and bench',
    equipment: [
      'Dumbbells',
      'Kettlebells',
      'Medicine Balls',
      'Pull Up Bar',
      'Flat Bench',
      'Handle Bands',
      'Mini Loop Bands',
      'Loop Bands'
    ]
  },
  'Full Gym': {
    description: 'Complete gym with all equipment',
    equipment: 'all' // Special marker for all equipment
  }
};

/**
 * Check if equipment list represents bodyweight only
 */
export const isBodyweightOnly = (
  equipment: (string | { name: string; weights?: any[] })[] | null | undefined
): boolean => {
  if (!equipment || equipment.length === 0) {
    return true;
  }
  return false;
};

