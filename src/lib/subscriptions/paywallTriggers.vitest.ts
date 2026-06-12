import { describe, it, expect } from 'vitest';
import {
  createPaywallSessionState,
  shouldShowPaywall,
} from './paywallTriggers';

describe('paywallTriggers', () => {
  it('skips all triggers when isPro', () => {
    const { show } = shouldShowPaywall({
      trigger: 'generate_ai',
      isPro: true,
      state: createPaywallSessionState(),
      nowMs: 0,
      randomRoll: 0,
    });
    expect(show).toBe(false);
  });

  it('always shows generate_ai for non-pro', () => {
    const { show } = shouldShowPaywall({
      trigger: 'generate_ai',
      isPro: false,
      state: createPaywallSessionState(),
      nowMs: 1000,
      randomRoll: 0.99,
    });
    expect(show).toBe(true);
  });

  it('app_open shows once per session', () => {
    const s0 = createPaywallSessionState();
    const first = shouldShowPaywall({
      trigger: 'app_open',
      isPro: false,
      state: s0,
      nowMs: 0,
      randomRoll: 0,
    });
    expect(first.show).toBe(true);
    const second = shouldShowPaywall({
      trigger: 'app_open',
      isPro: false,
      state: first.nextState,
      nowMs: 5000,
      randomRoll: 0,
    });
    expect(second.show).toBe(false);
  });

  it('random trigger respects roll and session cap', () => {
    let state = createPaywallSessionState();
    const miss = shouldShowPaywall({
      trigger: 'finish_workout',
      isPro: false,
      state,
      nowMs: 0,
      randomRoll: 0.99,
    });
    expect(miss.show).toBe(false);

    const hit = shouldShowPaywall({
      trigger: 'finish_workout',
      isPro: false,
      state,
      nowMs: 0,
      randomRoll: 0.1,
    });
    expect(hit.show).toBe(true);
    state = hit.nextState;
  });
});
