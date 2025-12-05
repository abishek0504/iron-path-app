/**
 * Coverage Analysis Module
 * 
 * Analyzes movement pattern coverage in workout plans and recent workout logs
 * to identify imbalances and suggest improvements.
 */

import type { MovementPattern } from './movementPatterns';
import { inferMovementPattern } from './movementPatterns';

export interface PatternCoverage {
  pattern: MovementPattern;
  setsThisWeek: number;
  setsLastWeek: number;
  setsLastTwoWeeks: number;
  lastWorkedDate: Date | null;
  isUnderServed: boolean;
  isOverServed: boolean;
}

export interface CoverageAnalysisResult {
  patternCoverage: Map<MovementPattern, PatternCoverage>;
  underServedPatterns: MovementPattern[];
  overServedPatterns: MovementPattern[];
  recommendations: string[];
}

/**
 * Analyzes movement pattern coverage for a week schedule and recent workout logs.
 * 
 * @param weekSchedule - The week schedule object with exercises per day
 * @param recentLogs - Recent workout logs (last 2-3 weeks) to analyze historical coverage
 * @returns Coverage analysis with pattern counts and recommendations
 */
export const analyzeCoverage = (
  weekSchedule: any,
  recentLogs: Array<{
    exercise_name: string;
    performed_at: string;
    weight: number;
    reps: number;
  }> = []
): CoverageAnalysisResult => {
  const patternCoverage = new Map<MovementPattern, PatternCoverage>();
  const allPatterns: MovementPattern[] = [
    'squat',
    'hinge',
    'lunge',
    'push_vert',
    'push_horiz',
    'pull_vert',
    'pull_horiz',
    'carry',
  ];

  // Initialize coverage for all patterns
  allPatterns.forEach((pattern) => {
    patternCoverage.set(pattern, {
      pattern,
      setsThisWeek: 0,
      setsLastWeek: 0,
      setsLastTwoWeeks: 0,
      lastWorkedDate: null,
      isUnderServed: false,
      isOverServed: false,
    });
  });

  // Count sets in current week schedule
  if (weekSchedule) {
    const days = Object.keys(weekSchedule);
    days.forEach((day) => {
      const dayData = weekSchedule[day];
      if (dayData?.exercises && Array.isArray(dayData.exercises)) {
        dayData.exercises.forEach((ex: any) => {
          const pattern = ex.movement_pattern 
            ? (ex.movement_pattern as MovementPattern)
            : inferMovementPattern(ex.name);
          
          if (pattern) {
            const coverage = patternCoverage.get(pattern);
            if (coverage) {
              const sets = ex.target_sets || (Array.isArray(ex.sets) ? ex.sets.length : 0);
              coverage.setsThisWeek += sets;
            }
          }
        });
      }
    });
  }

  // Analyze recent logs for historical coverage
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const logsByPattern = new Map<MovementPattern, Array<{ performed_at: Date }>>();

  recentLogs.forEach((log) => {
    const pattern = inferMovementPattern(log.exercise_name);
    if (pattern) {
      const logs = logsByPattern.get(pattern) || [];
      logs.push({
        performed_at: new Date(log.performed_at),
      });
      logsByPattern.set(pattern, logs);
    }
  });

  // Count sets in recent weeks and find last worked date
  logsByPattern.forEach((logs, pattern) => {
    const coverage = patternCoverage.get(pattern);
    if (coverage) {
      let lastWeekCount = 0;
      let lastTwoWeeksCount = 0;
      let lastWorked: Date | null = null;

      logs.forEach((log) => {
        const logDate = log.performed_at;
        if (logDate > oneWeekAgo) {
          lastWeekCount++;
        }
        if (logDate > twoWeeksAgo) {
          lastTwoWeeksCount++;
        }
        if (!lastWorked || logDate > lastWorked) {
          lastWorked = logDate;
        }
      });

      coverage.setsLastWeek = lastWeekCount;
      coverage.setsLastTwoWeeks = lastTwoWeeksCount;
      coverage.lastWorkedDate = lastWorked;
    }
  });

  // Identify under-served and over-served patterns
  // Under-served: < 3 sets per week for a pattern
  // Over-served: > 15 sets per week for a pattern (or > 2x average)
  const totalSets = Array.from(patternCoverage.values()).reduce(
    (sum, cov) => sum + cov.setsThisWeek,
    0
  );
  const averageSets = totalSets / allPatterns.length;

  const underServedPatterns: MovementPattern[] = [];
  const overServedPatterns: MovementPattern[] = [];

  patternCoverage.forEach((coverage, pattern) => {
    if (coverage.setsThisWeek < 3 && pattern !== null) {
      coverage.isUnderServed = true;
      underServedPatterns.push(pattern);
    }
    if (coverage.setsThisWeek > 15 || coverage.setsThisWeek > averageSets * 2) {
      coverage.isOverServed = true;
      if (pattern !== null) {
        overServedPatterns.push(pattern);
      }
    }
  });

  // Generate recommendations
  const recommendations: string[] = [];

  if (underServedPatterns.length > 0) {
    const patterns = underServedPatterns
      .map((p) => p?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()))
      .join(', ');
    recommendations.push(
      `Consider adding exercises for: ${patterns}. These movement patterns have fewer than 3 sets this week.`
    );
  }

  if (overServedPatterns.length > 0) {
    const patterns = overServedPatterns
      .map((p) => p?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()))
      .join(', ');
    recommendations.push(
      `High volume detected for: ${patterns}. Consider reducing sets or adding variety.`
    );
  }

  // Check for missing essential patterns
  const essentialPatterns: MovementPattern[] = ['squat', 'hinge', 'push_horiz', 'pull_horiz'];
  const missingEssential = essentialPatterns.filter(
    (pattern) => !patternCoverage.get(pattern)?.setsThisWeek
  );

  if (missingEssential.length > 0) {
    const patterns = missingEssential
      .map((p) => p?.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()))
      .join(', ');
    recommendations.push(
      `Missing essential movement patterns: ${patterns}. Consider adding at least one exercise for each.`
    );
  }

  return {
    patternCoverage,
    underServedPatterns,
    overServedPatterns,
    recommendations,
  };
};

/**
 * Gets a summary string of coverage analysis for display in UI
 */
export const getCoverageSummary = (analysis: CoverageAnalysisResult): string => {
  const parts: string[] = [];

  if (analysis.underServedPatterns.length > 0) {
    parts.push(`Low: ${analysis.underServedPatterns.length} patterns`);
  }

  if (analysis.overServedPatterns.length > 0) {
    parts.push(`High: ${analysis.overServedPatterns.length} patterns`);
  }

  if (parts.length === 0) {
    return 'Balanced coverage';
  }

  return parts.join(' · ');
};

