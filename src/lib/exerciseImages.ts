import type { ImageSourcePropType } from 'react-native';

// React Native requires static require() calls, so images are mapped explicitly
// by master-exercise name rather than derived from slugs at runtime.
const EXERCISE_IMAGES: Record<string, ImageSourcePropType> = {
  'Arnold Press': require('../../assets/exercises/arnold-press.jpg'),
  'Bench Press (Barbell)': require('../../assets/exercises/bench-press-barbell.jpg'),
  'Bent Over Row (Barbell)': require('../../assets/exercises/bent-over-row-barbell.jpg'),
  'Bicep Curl (Barbell/Dumbbell)': require('../../assets/exercises/bicep-curl-barbell-dumbbell.jpg'),
  'Bulgarian Split Squat': require('../../assets/exercises/bulgarian-split-squat.jpg'),
  'Calf Raise': require('../../assets/exercises/calf-raise.jpg'),
  'Chin Up (Supinated)': require('../../assets/exercises/chin-up-supinated.jpg'),
  'Cossack Squat': require('../../assets/exercises/cossack-squat.jpg'),
  'Deadlift (Conventional)': require('../../assets/exercises/deadlift-conventional.jpg'),
  'Diamond Push Up': require('../../assets/exercises/diamond-push-up.jpg'),
  Dip: require('../../assets/exercises/dip.jpg'),
  'Dumbbell Fly': require('../../assets/exercises/dumbbell-fly.jpg'),
  'Face Pull': require('../../assets/exercises/face-pull.jpg'),
  "Farmer's Walk": require('../../assets/exercises/farmers-walk.jpg'),
  'Front Squat': require('../../assets/exercises/front-squat.jpg'),
  'Hammer Curl': require('../../assets/exercises/hammer-curl.jpg'),
  'Hanging Knee Raise': require('../../assets/exercises/hanging-knee-raise.jpg'),
  'Hanging Leg Raise': require('../../assets/exercises/hanging-leg-raise.jpg'),
  'Hip Thrust': require('../../assets/exercises/hip-thrust.jpg'),
  'Incline Dumbbell Press': require('../../assets/exercises/incline-dumbbell-press.jpg'),
  'L-Sit': require('../../assets/exercises/l-sit.jpg'),
  'Lat Pulldown': require('../../assets/exercises/lat-pulldown.jpg'),
  'Lateral Raise': require('../../assets/exercises/lateral-raise.jpg'),
  'Leg Curl (Seated/Lying)': require('../../assets/exercises/leg-curl-seated-lying.jpg'),
  'Leg Extension': require('../../assets/exercises/leg-extension.jpg'),
  'Leg Press': require('../../assets/exercises/leg-press.jpg'),
  'Nordic Curl': require('../../assets/exercises/nordic-curl.jpg'),
  'Overhead Press': require('../../assets/exercises/overhead-press.jpg'),
  'Overhead Tricep Extension': require('../../assets/exercises/overhead-tricep-extension.jpg'),
  'Pike Push Up': require('../../assets/exercises/pike-push-up.jpg'),
  'Pistol Squat': require('../../assets/exercises/pistol-squat.jpg'),
  'Pull Up': require('../../assets/exercises/pull-up.jpg'),
  'Pull Up (Overhand)': require('../../assets/exercises/pull-up-overhand.jpg'),
  'Pull Up (Wide Grip)': require('../../assets/exercises/pull-up-wide-grip.jpg'),
  'Push Up': require('../../assets/exercises/push-up.jpg'),
  'Reverse Nordic Curl': require('../../assets/exercises/reverse-nordic-curl.jpg'),
  'Romanian Deadlift (RDL)': require('../../assets/exercises/romanian-deadlift-rdl.jpg'),
  'Seated Cable Row': require('../../assets/exercises/seated-cable-row.jpg'),
  'Side Plank': require('../../assets/exercises/side-plank.jpg'),
  Skullcrusher: require('../../assets/exercises/skullcrusher.jpg'),
  'Squat (Barbell)': require('../../assets/exercises/squat-barbell.jpg'),
  'Superman Hold': require('../../assets/exercises/superman-hold.jpg'),
  'Tricep Pushdown': require('../../assets/exercises/tricep-pushdown.jpg'),
  'V-Sit': require('../../assets/exercises/v-sit.jpg'),
  'Walking Lunge': require('../../assets/exercises/walking-lunge.jpg'),
};

/**
 * Returns the bundled anatomical illustration for a master exercise,
 * or null for exercises without one (e.g. user custom exercises).
 */
export function getExerciseImage(exerciseName: string): ImageSourcePropType | null {
  return EXERCISE_IMAGES[exerciseName] ?? null;
}
