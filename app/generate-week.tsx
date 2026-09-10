/**
 * Full-screen AI Coach week generation — runs on mount, no cancel/back until complete.
 */

import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AiGenerateLoadingScreen } from '../src/components/ai/AiGenerateLoadingScreen';
import {
  clearPendingAiWeekGeneration,
  loadPendingAiWeekGeneration,
  matchesPendingWeekGeneration,
  savePendingAiWeekGeneration,
} from '../src/lib/ai/aiWeekGenerationRecovery';
import { executeAiWeekGeneration } from '../src/lib/ai/executeAiWeekGeneration';
import type { CoachWeekDay, CoachWeekMode } from '../src/lib/ai/coachWeek';
import { AI_WEEK_LOADING_STEPS } from '../src/lib/ai/generateAiLoadingSteps';
import { showPaywallFromOutside } from '../src/lib/subscriptions/paywallBridge';
import { checkProEntitlement } from '../src/lib/subscriptions/revenueCat';
import { useToast } from '../src/hooks/useToast';
import { supabase } from '../src/lib/supabase/client';
import { createUuid, isUuid } from '../src/lib/utils/uuid';
import { devError } from '../src/lib/utils/logger';
import { useTheme } from '../src/lib/utils/ThemeContext';

function parseString(raw: string | string[] | undefined, fallback = ''): string {
  return Array.isArray(raw) ? raw[0] ?? fallback : raw ?? fallback;
}

function parseDays(raw: string): CoachWeekDay[] {
  try {
    const parsed = JSON.parse(raw) as CoachWeekDay[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function GenerateWeekScreen() {
  const router = useRouter();
  const toast = useToast();
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const hasStartedRef = useRef(false);

  const params = useLocalSearchParams<{
    templateId: string;
    mode: string;
    weekStartDate: string;
    days: string;
    generationId?: string;
  }>();

  const templateId = parseString(params.templateId);
  const mode = (parseString(params.mode, 'auto') === 'regenerate' ? 'regenerate' : 'auto') as CoachWeekMode;
  const weekStartDate = parseString(params.weekStartDate);
  const daysRaw = parseString(params.days);
  const days = useMemo(() => parseDays(daysRaw), [daysRaw]);
  const routeGenerationId = parseString(params.generationId);

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const userId = user?.id;
        if (!userId) {
          if (!cancelled) {
            router.back();
            toast.error('Please log in');
          }
          return;
        }

        if (days.length === 0 || !templateId || !weekStartDate) {
          if (!cancelled) {
            router.back();
            toast.error('Nothing to plan this week');
          }
          return;
        }

        const paramSnapshot = { templateId, mode, weekStartDate, days };
        let idempotencyKey = isUuid(routeGenerationId) ? routeGenerationId : createUuid();
        const pending = await loadPendingAiWeekGeneration();
        if (
          pending &&
          matchesPendingWeekGeneration(pending, paramSnapshot) &&
          isUuid(pending.generationId)
        ) {
          idempotencyKey = pending.generationId;
        }

        await savePendingAiWeekGeneration({
          generationId: idempotencyKey,
          templateId,
          mode,
          weekStartDate,
          days,
          savedAt: new Date().toISOString(),
        });

        const generationInput = {
          userId,
          templateId,
          idempotencyKey,
          mode,
          weekStartDate,
          days,
        };

        let result = await executeAiWeekGeneration(generationInput);

        let hasEntitlement = false;
        if (!cancelled && !result.ok && result.code === 'paywall_required') {
          hasEntitlement = await checkProEntitlement();
          if (hasEntitlement) {
            for (let attempt = 0; attempt < 3 && !cancelled; attempt += 1) {
              await new Promise((resolve) => setTimeout(resolve, 2000));
              if (cancelled) return;
              result = await executeAiWeekGeneration(generationInput);
              if (result.ok || result.code !== 'paywall_required') break;
            }
          }
        }

        if (cancelled) return;

        await clearPendingAiWeekGeneration();
        router.back();

        if (result.ok) {
          toast.success('Your week is planned');
          return;
        }

        switch (result.code) {
          case 'paywall_required':
            if (hasEntitlement) {
              toast.info('Your subscription is still activating. Please try again in a moment.');
            } else {
              showPaywallFromOutside('generate_week');
            }
            break;
          case 'quota_exceeded':
            toast.error("You've reached this week's AI limit. Try again later.");
            break;
          case 'auth_error':
            toast.error('Session expired — please log in again to use AI generation');
            break;
          case 'forbidden':
            toast.error("This plan cannot be generated. The template is missing or isn't yours.");
            break;
          case 'ai_unavailable': {
            const reason = result.message ?? '';
            if (reason === 'commit_failed') {
              toast.error(
                "Week was generated but couldn't be saved. Try again — you won't be charged twice.",
              );
            } else if (reason === 'edge_unreachable') {
              toast.error("Couldn't reach the server. Check your connection and try again.");
            } else if (
              reason === 'validation_failed' ||
              reason.includes('too_few_exercises') ||
              reason.includes('allow_list')
            ) {
              toast.error('AI returned an invalid week plan. Please try again.');
            } else {
              toast.error('AI generation is currently unavailable. Please try again later.');
            }
            break;
          }
          case 'no_slots':
            toast.error('No exercises were added. Try again.');
            break;
          case 'unknown':
            toast.error('Failed to generate week');
            break;
          default: {
            const _exhaustive: never = result.code;
            return _exhaustive;
          }
        }
      } catch (error) {
        if (__DEV__) {
          devError('generate-week', error, { action: 'generate' });
        }
        if (!cancelled) {
          await clearPendingAiWeekGeneration();
          router.back();
          toast.error('Failed to generate week');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [templateId, mode, weekStartDate, days, routeGenerationId, router, toast]);

  return (
    <View style={styles.root}>
      <AiGenerateLoadingScreen
        dayName="your week"
        subtitle="Building your week with AI Coach"
        steps={AI_WEEK_LOADING_STEPS}
      />
    </View>
  );
}

function createStyles(colors: { background: string }) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
  });
}
