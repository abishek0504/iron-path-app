/**
 * Tokenized contains-match + relevance ranking for in-memory exercise name search.
 */

const SCORE_EXACT = 1_000_000;
const SCORE_STARTS_WITH_QUERY = 500_000;
const SCORE_STARTS_WITH_FIRST_TOKEN = 250_000;
const SCORE_ALL_WORD_PREFIXES = 100_000;
const POSITION_WEIGHT = 1_000;
const LENGTH_PENALTY = 1;

function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

function tokenize(normalizedQuery: string): string[] {
  if (!normalizedQuery) return [];
  return normalizedQuery.split(' ').filter(Boolean);
}

function nameWords(normalizedName: string): string[] {
  return normalizedName.split(/[\s\-/]+/).filter(Boolean);
}

function everyTokenIsWordPrefix(tokens: string[], words: string[]): boolean {
  return tokens.every((token) => words.some((word) => word.startsWith(token)));
}

function scoreName(normalizedName: string, normalizedQuery: string, tokens: string[]): number {
  if (normalizedName === normalizedQuery) {
    return SCORE_EXACT;
  }

  let score = 0;

  if (normalizedName.startsWith(normalizedQuery)) {
    score += SCORE_STARTS_WITH_QUERY;
  }

  const firstToken = tokens[0];
  if (firstToken && normalizedName.startsWith(firstToken)) {
    score += SCORE_STARTS_WITH_FIRST_TOKEN;
  }

  const words = nameWords(normalizedName);
  if (everyTokenIsWordPrefix(tokens, words)) {
    score += SCORE_ALL_WORD_PREFIXES;
  }

  const firstTokenIndex = firstToken ? normalizedName.indexOf(firstToken) : -1;
  if (firstTokenIndex >= 0) {
    score += Math.max(0, POSITION_WEIGHT - firstTokenIndex);
  }

  score -= normalizedName.length * LENGTH_PENALTY;

  return score;
}

/**
 * Filter exercises whose names contain every query token, ranked by relevance.
 * Empty/whitespace query returns the input list unchanged.
 */
export function searchExercisesByName<T extends { name: string }>(
  exercises: T[],
  query: string
): T[] {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) {
    return exercises;
  }

  const tokens = tokenize(normalizedQuery);
  if (tokens.length === 0) {
    return exercises;
  }

  const matched: { exercise: T; score: number; name: string }[] = [];

  for (const exercise of exercises) {
    const normalizedName = exercise.name.toLowerCase();
    const containsAll = tokens.every((token) => normalizedName.includes(token));
    if (!containsAll) continue;

    matched.push({
      exercise,
      score: scoreName(normalizedName, normalizedQuery, tokens),
      name: exercise.name,
    });
  }

  matched.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.name.localeCompare(b.name);
  });

  return matched.map((m) => m.exercise);
}
