import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Optional crash reporting. Set `EXPO_PUBLIC_SENTRY_DSN` in EAS env (or `extra.sentryDsn` in app config).
 * Safe to call on every native platform; no-ops on web or when DSN absent.
 */
export function initSentry(): void {
  if (Platform.OS === 'web') return;
  const dsn =
    (Constants.expoConfig?.extra as { sentryDsn?: string } | undefined)?.sentryDsn ??
    process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  void import('@sentry/react-native')
    .then((Sentry) => {
      Sentry.init({
        dsn,
        enableAutoSessionTracking: true,
        tracesSampleRate: __DEV__ ? 0 : 0.15,
        beforeBreadcrumb(breadcrumb) {
          if (breadcrumb.data?.email) delete breadcrumb.data.email;
          return breadcrumb;
        },
      });
    })
    .catch(() => undefined);
}
