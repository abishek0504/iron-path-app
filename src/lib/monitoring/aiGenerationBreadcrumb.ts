/**
 * Dev-safe Sentry breadcrumbs for AI generation (no PII).
 */

export async function addAiGenerationBreadcrumb(
  data: Record<string, string | number | boolean | null | undefined>,
): Promise<void> {
  try {
    const Sentry = await import('@sentry/react-native');
    Sentry.addBreadcrumb({
      category: 'ai-generate',
      message: String(data.action ?? 'ai-generate'),
      level: 'info',
      data: Object.fromEntries(
        Object.entries(data).filter(([, value]) => value !== undefined),
      ),
    });
  } catch {
    // Sentry optional
  }
}
