/** Keep in sync with src/lib/ai/coachNotes.ts and src/lib/ai/coachPrefs.ts. */

export const COACH_SESSION_MINUTE_OPTIONS = [30, 45, 60, 75, 90] as const;
export const DEFAULT_COACH_SESSION_MINUTES = 60;
export const DEFAULT_COACH_EXERCISES_PER_SESSION = 6;
export const MAX_COACH_NOTES_LENGTH = 1000;
export const MIN_COACH_EXERCISES_PER_SESSION = 2;
export const MAX_COACH_EXERCISES_PER_SESSION = 8;

const CONTROL_AND_BIDI =
  // deno-lint-ignore no-control-regex
  /[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g;

const JAILBREAK_PATTERNS = [
  /\bignore (all |any )?(previous|above|prior|earlier) (instructions?|prompts?|rules?)\b/i,
  /\bsystem prompt\b/i,
  /\byou are now\b/i,
  /^\s*(system|assistant|developer)\s*:/im,
  /<\|?(im_start|im_end|endoftext)\|?>/i,
  /\bnew instructions\b/i,
  /\bdo not follow (the )?(hard rules|system)\b/i,
];

export function clampCoachSessionMinutes(value: unknown): number {
  if (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    (COACH_SESSION_MINUTE_OPTIONS as readonly number[]).includes(value)
  ) {
    return value;
  }
  return DEFAULT_COACH_SESSION_MINUTES;
}

export function clampCoachExercisesPerSession(value: unknown): number {
  if (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_COACH_EXERCISES_PER_SESSION &&
    value <= MAX_COACH_EXERCISES_PER_SESSION
  ) {
    return value;
  }
  return DEFAULT_COACH_EXERCISES_PER_SESSION;
}

export function looksLikeCoachNotesJailbreak(value: string): boolean {
  return JAILBREAK_PATTERNS.some((pattern) => pattern.test(value));
}

export function sanitizeCoachNotes(
  raw: unknown,
): { ok: true; notes: string | null } | { ok: false; reason: 'jailbreak' } {
  if (raw == null) return { ok: true, notes: null };
  if (typeof raw !== 'string') return { ok: true, notes: null };

  const normalized = raw.normalize('NFC').replace(CONTROL_AND_BIDI, ' ');
  const collapsed = normalized.replace(/\s+/g, ' ').trim();
  if (!collapsed) return { ok: true, notes: null };
  if (looksLikeCoachNotesJailbreak(collapsed)) {
    return { ok: false, reason: 'jailbreak' };
  }

  const notes = collapsed.slice(0, MAX_COACH_NOTES_LENGTH);
  if (looksLikeCoachNotesJailbreak(notes)) {
    return { ok: false, reason: 'jailbreak' };
  }
  return { ok: true, notes };
}

export function formatAthleteNotesBlock(notes: string | null): string | null {
  if (!notes) return null;
  return `ATHLETE_NOTES_UNTRUSTED: ${JSON.stringify(notes)}`;
}
