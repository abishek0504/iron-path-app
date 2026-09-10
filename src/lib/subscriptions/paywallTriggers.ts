import {
  MAX_RANDOM_PAYWALLS_PER_SESSION,
  PAYWALL_COOLDOWN_MS,
  RANDOM_PAYWALL_CHANCE,
} from './constants';

export type PaywallTrigger =
  | 'app_open'
  | 'generate_ai'
  | 'generate_week'
  | 'finish_workout'
  | 'add_exercise'
  | 'onboarding_complete';

export interface PaywallSessionState {
  appOpenShown: boolean;
  randomPromptsThisSession: number;
  lastShownAt: number | null;
}

export function createPaywallSessionState(): PaywallSessionState {
  return {
    appOpenShown: false,
    randomPromptsThisSession: 0,
    lastShownAt: null,
  };
}

export function isRandomPaywallTrigger(trigger: PaywallTrigger): boolean {
  return (
    trigger === 'finish_workout' ||
    trigger === 'add_exercise' ||
    trigger === 'onboarding_complete'
  );
}

export function shouldShowPaywall(args: {
  trigger: PaywallTrigger;
  isPro: boolean;
  state: PaywallSessionState;
  nowMs: number;
  randomRoll: number;
}): { show: boolean; nextState: PaywallSessionState } {
  const { trigger, isPro, nowMs, randomRoll } = args;
  const state = { ...args.state };

  if (isPro) {
    return { show: false, nextState: state };
  }

  if (trigger === 'app_open') {
    if (state.appOpenShown) {
      return { show: false, nextState: state };
    }
    state.appOpenShown = true;
    state.lastShownAt = nowMs;
    return { show: true, nextState: state };
  }

  if (trigger === 'generate_ai' || trigger === 'generate_week') {
    state.lastShownAt = nowMs;
    return { show: true, nextState: state };
  }

  if (isRandomPaywallTrigger(trigger)) {
    if (state.randomPromptsThisSession >= MAX_RANDOM_PAYWALLS_PER_SESSION) {
      return { show: false, nextState: state };
    }
    if (
      state.lastShownAt != null &&
      nowMs - state.lastShownAt < PAYWALL_COOLDOWN_MS
    ) {
      return { show: false, nextState: state };
    }
    if (randomRoll >= RANDOM_PAYWALL_CHANCE) {
      return { show: false, nextState: state };
    }
    state.randomPromptsThisSession += 1;
    state.lastShownAt = nowMs;
    return { show: true, nextState: state };
  }

  return { show: false, nextState: state };
}

export function headlineForTrigger(trigger: PaywallTrigger): string {
  switch (trigger) {
    case 'app_open':
      return 'AI Coach plans your week';
    case 'generate_ai':
      return 'Let AI Coach plan this day';
    case 'generate_week':
      return 'Let AI Coach plan your full week';
    case 'finish_workout':
      return 'Let AI Coach plan your next session';
    case 'add_exercise':
      return 'AI Coach builds better workouts';
    case 'onboarding_complete':
      return 'Turn on AI Coach for your week';
    default:
      return 'AI Coach plans your week';
  }
}
