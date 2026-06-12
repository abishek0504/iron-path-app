import type { PaywallTrigger } from './paywallTriggers';

export interface PaywallBridge {
  tryRandomPaywall: (trigger: PaywallTrigger) => void;
  requestGenerateAi: (onAllowed: () => void) => void;
  showPaywall: (
    trigger: PaywallTrigger,
    options?: { onSubscribed?: () => void },
  ) => void;
}

let bridge: PaywallBridge | null = null;
let pendingOnboardingPaywall = false;

export function setPendingOnboardingPaywall(value = true): void {
  pendingOnboardingPaywall = value;
}

export function takePendingOnboardingPaywall(): boolean {
  const value = pendingOnboardingPaywall;
  pendingOnboardingPaywall = false;
  return value;
}

export function registerPaywallBridge(next: PaywallBridge | null): void {
  bridge = next;
}

export function tryRandomPaywallFromOutside(trigger: PaywallTrigger): void {
  bridge?.tryRandomPaywall(trigger);
}

export function requestGenerateAiFromOutside(onAllowed: () => void): void {
  bridge?.requestGenerateAi(onAllowed);
}

export function showPaywallFromOutside(
  trigger: PaywallTrigger,
  options?: { onSubscribed?: () => void },
): void {
  bridge?.showPaywall(trigger, options);
}
