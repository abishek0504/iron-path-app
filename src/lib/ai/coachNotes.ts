import { MAX_COACH_NOTES_LENGTH } from './coachPrefs';

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

export type CoachNotesSanitizeResult =
  | { ok: true; notes: string | null }
  | { ok: false; reason: 'jailbreak' };

export function looksLikeCoachNotesJailbreak(value: string): boolean {
  return JAILBREAK_PATTERNS.some((pattern) => pattern.test(value));
}

export function sanitizeCoachNotes(raw: unknown): CoachNotesSanitizeResult {
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
