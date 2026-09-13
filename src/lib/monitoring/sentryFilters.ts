export const NON_FULLY_BLOCKED_APP_HANG_TYPE = 'App Hang Non Fully Blocked';

export type SentryExceptionLike = {
  type?: string | null;
};

export type SentryEventLike = {
  exception?: {
    values?: SentryExceptionLike[];
  } | null;
};

/** Drops iOS keyboard/system-UI false positives; keeps fully-blocked and fatal hangs. */
export function shouldDropSentryEvent(event: SentryEventLike): boolean {
  return event.exception?.values?.[0]?.type === NON_FULLY_BLOCKED_APP_HANG_TYPE;
}
