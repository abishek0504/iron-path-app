/** RevenueCat entitlement identifier — must match dashboard + App Store products. */
export const ENTITLEMENT_ID = 'ironpath_pro';

export const PRODUCT_ID_MONTHLY = 'ironpath_pro_monthly';
export const PRODUCT_ID_ANNUAL = 'ironpath_pro_annual';

/** Pro subscribers: max AI day-generations per rolling 7 days (server-enforced). */
export const PRO_WEEKLY_GENERATION_CAP = 40;

/** Soft paywall: no dismiss for this many ms. */
export const SOFT_DISMISS_DELAY_MS = 4000;

/** Random event paywall: probability per qualifying event. */
export const RANDOM_PAYWALL_CHANCE = 0.5;

/** Max random paywall prompts per app session. */
export const MAX_RANDOM_PAYWALLS_PER_SESSION = 3;

/** Min ms between any paywall display (generate_ai bypasses cooldown). */
export const PAYWALL_COOLDOWN_MS = 5 * 60 * 1000;

/** Delay before app-open paywall after tabs mount. */
export const APP_OPEN_PAYWALL_DELAY_MS = 1500;
