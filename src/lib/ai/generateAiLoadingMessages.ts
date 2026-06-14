/**
 * Rotating copy for the AI generate loading screen.
 */

const FUNNY_MESSAGES = [
  'Throwing weights around…',
  'Negotiating with your muscles…',
  'Teaching the barbell manners…',
  'Convincing your glutes to show up…',
  'Bribing the dumbbells to cooperate…',
  'Asking your joints how they feel today…',
  'Whispering sweet nothings to the squat rack…',
  'Calculating how sore you will be tomorrow…',
];

const REASSURING_MESSAGES = [
  'Please wait while we build your personalized workout.',
  'Matching exercises to your split and recovery.',
  'Balancing volume, intensity, and muscle coverage.',
  'Selecting movements that fit your experience level.',
  'Almost there — tailoring sets and reps for you.',
  'Building a plan you can actually stick to.',
  'Putting the finishing touches on your session.',
  'Crafting something worth showing up for.',
];

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

/** Funny + reassuring lines, shuffled once per screen mount. */
export function getShuffledAiLoadingMessages(): string[] {
  return shuffle([...FUNNY_MESSAGES, ...REASSURING_MESSAGES]);
}

export const AI_LOADING_MESSAGE_ROTATE_MS = 2500;
export const AI_LOADING_MESSAGE_FLIP_MS = 600;
export const AI_LOADING_MESSAGE_FACE_HEIGHT = 72;
