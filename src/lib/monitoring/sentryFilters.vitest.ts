import { describe, expect, it } from 'vitest';
import { shouldDropSentryEvent } from './sentryFilters';

describe('shouldDropSentryEvent', () => {
  it('drops App Hang Non Fully Blocked', () => {
    expect(
      shouldDropSentryEvent({
        exception: { values: [{ type: 'App Hang Non Fully Blocked' }] },
      }),
    ).toBe(true);
  });

  it('keeps fully-blocked and fatal hangs', () => {
    expect(
      shouldDropSentryEvent({
        exception: { values: [{ type: 'App Hang Fully Blocked' }] },
      }),
    ).toBe(false);
    expect(
      shouldDropSentryEvent({
        exception: { values: [{ type: 'Fatal App Hang Fully Blocked' }] },
      }),
    ).toBe(false);
    expect(
      shouldDropSentryEvent({
        exception: { values: [{ type: 'Fatal App Hang Non Fully Blocked' }] },
      }),
    ).toBe(false);
  });

  it('keeps non-hang exceptions and empty events', () => {
    expect(
      shouldDropSentryEvent({
        exception: { values: [{ type: 'TypeError' }] },
      }),
    ).toBe(false);
    expect(shouldDropSentryEvent({})).toBe(false);
    expect(shouldDropSentryEvent({ exception: { values: [] } })).toBe(false);
  });
});
