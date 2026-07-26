export type TourTabRoute = 'index' | 'planner' | 'progress' | 'dashboard';

export type TourTooltipPlacement = 'top' | 'bottom' | 'auto';

export interface TourStep {
  id: string;
  targetId: string;
  tab: TourTabRoute;
  title: string;
  body: string;
  placement: TourTooltipPlacement;
  fallbackTargetId?: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'tabs-overview',
    targetId: 'tour.tabs.bar',
    tab: 'index',
    title: 'Welcome to IronPath',
    body: 'Four areas: Workout for daily training, Plan to build your program, Progress for history, and Dashboard for stats and settings.',
    placement: 'auto',
  },
  {
    id: 'plan-day-selector',
    targetId: 'tour.plan.daySelector',
    tab: 'planner',
    title: 'Your weekly plan',
    body: 'Your week is organized by day — tap a day to view and edit its workouts.',
    placement: 'auto',
  },
  {
    id: 'plan-add-workout',
    targetId: 'tour.plan.addWorkout',
    tab: 'planner',
    title: 'Add workouts',
    body: 'Add one or more workouts to any day of the week.',
    placement: 'auto',
  },
  {
    id: 'plan-generate-ai',
    targetId: 'tour.plan.generateAi',
    tab: 'planner',
    title: 'Generate with AI',
    body: 'Build a full day instantly. IronPath Pro unlocks unlimited AI generation.',
    placement: 'auto',
  },
  {
    id: 'workout-start',
    targetId: 'tour.workout.start',
    tab: 'index',
    title: "Today's workout",
    body: "See what's scheduled for today, then tap Start to begin — come back anytime to continue where you left off.",
    placement: 'auto',
    fallbackTargetId: 'tour.workout.card',
  },
  {
    id: 'progress-toggle',
    targetId: 'tour.progress.viewToggle',
    tab: 'progress',
    title: 'Training history',
    body: 'Browse your completed sessions by week or month. Tap any day for details.',
    placement: 'auto',
  },
  {
    id: 'dashboard-heatmap',
    targetId: 'tour.dashboard.heatmap',
    tab: 'dashboard',
    title: 'Muscle status',
    body: "See muscle freshness and what you've trained recently on the body map.",
    placement: 'auto',
  },
  {
    id: 'dashboard-stats',
    targetId: 'tour.dashboard.stats',
    tab: 'dashboard',
    title: 'Track your progress',
    body: 'Monitor your weekly goal and training streak to stay consistent.',
    placement: 'auto',
  },
  {
    id: 'dashboard-settings',
    targetId: 'tour.dashboard.settings',
    tab: 'dashboard',
    title: 'Settings & Pro',
    body: 'Profile, reminders, Apple Health, and IronPath Pro all live here.',
    placement: 'auto',
  },
];

export const TOUR_STEP_COUNT = TOUR_STEPS.length;
