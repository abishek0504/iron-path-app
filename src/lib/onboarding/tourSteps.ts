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
  /** Fixed chrome (tab bar, settings) should not be scrolled into view. */
  fixed?: boolean;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'tabs-overview',
    targetId: 'tour.tabs.bar',
    tab: 'index',
    title: 'Four places to work from',
    body: 'Workout is today. Plan is your week. Progress is history. Dashboard holds stats and settings.',
    placement: 'auto',
    fixed: true,
  },
  {
    id: 'plan-a-day',
    targetId: 'tour.plan.daySelector',
    tab: 'planner',
    title: 'Plan any day of the week',
    body: 'Each day holds its own workouts. You can add sessions or change exercises here before you train.',
    placement: 'auto',
  },
  {
    id: 'generate-ai',
    targetId: 'tour.plan.aiCoach',
    tab: 'planner',
    title: 'AI Coach and Generate with AI',
    body: 'Pro unlocks AI Coach — it plans every training day each week from your split. Generate with AI still builds a single day when you want an override.',
    placement: 'auto',
    fallbackTargetId: 'tour.plan.generateAi',
  },
  {
    id: 'workout-start',
    targetId: 'tour.workout.start',
    tab: 'index',
    title: "Today's session",
    body: "This card is today's workout. Start begins logging. You can leave and pick up later.",
    placement: 'auto',
    fallbackTargetId: 'tour.workout.card',
  },
  {
    id: 'dashboard-settings',
    targetId: 'tour.dashboard.settings',
    tab: 'dashboard',
    title: 'Dashboard and settings',
    body: 'The body map and weekly stats live here. Settings is how you manage your profile, Health, and IronPath Pro (AI Coach).',
    placement: 'auto',
    fixed: true,
    fallbackTargetId: 'tour.dashboard.heatmap',
  },
];

export const TOUR_STEP_COUNT = TOUR_STEPS.length;
