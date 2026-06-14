/**
 * Full-screen AI workout generation — runs on mount, no cancel/back until complete.
 */

import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AiGenerateLoadingScreen } from '../src/components/ai/AiGenerateLoadingScreen';
import { executeAiDayGeneration } from '../src/lib/ai/executeAiDayGeneration';
import {
  DEFAULT_DAY_CONSTRAINTS,
  type DayConstraints,
} from '../src/lib/ai/generateWorkoutDay';
import { showPaywallFromOutside } from '../src/lib/subscriptions/paywallBridge';
import { useToast } from '../src/hooks/useToast';
import { useUserStore } from '../src/stores/userStore';
import { supabase } from '../src/lib/supabase/client';
import { devError } from '../src/lib/utils/logger';
import { useTheme } from '../src/lib/utils/ThemeContext';

function parseConstraints(raw: string | string[] | undefined): DayConstraints {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return DEFAULT_DAY_CONSTRAINTS;
  try {
    return JSON.parse(value) as DayConstraints;
  } catch {
    return DEFAULT_DAY_CONSTRAINTS;
  }
}

function parseString(raw: string | string[] | undefined, fallback = ''): string {
  return Array.isArray(raw) ? raw[0] ?? fallback : raw ?? fallback;
}

function parseIntParam(raw: string | string[] | undefined, fallback = 0): number {
  const value = parseString(raw);
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function GenerateAiScreen() {
  const router = useRouter();
  const toast = useToast();
  const profile = useUserStore((state) => state.profile);
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const hasStartedRef = useRef(false);

  const params = useLocalSearchParams<{
    templateId: string;
    dayId: string;
    dayName: string;
    dayIndex: string;
    sessionsPerDay: string;
    constraints?: string;
  }>();

  const templateId = parseString(params.templateId);
  const dayId = parseString(params.dayId);
  const dayName = parseString(params.dayName, 'your day');
  const dayIndex = parseIntParam(params.dayIndex);
  const sessionsPerDay = parseIntParam(params.sessionsPerDay);
  const constraintsRaw = parseString(params.constraints);
  const constraints = useMemo(() => parseConstraints(constraintsRaw), [constraintsRaw]);

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

        const result = await executeAiDayGeneration({
          userId,
          templateId,
          dayId,
          dayName,
          dayIndex,
          sessionsPerDay,
          constraints,
          profile,
        });

        if (cancelled) return;

        router.back();

        if (result.ok) {
          if (result.outcome === 'rest_day') {
            toast.success(`${result.dayName} set as rest day`);
          } else {
            toast.success(`${result.dayName} generated`);
          }
          return;
        }

        switch (result.code) {
          case 'paywall_required':
            showPaywallFromOutside('generate_ai');
            break;
          case 'quota_exceeded':
            toast.error("You've reached this week's AI limit. Try again later.");
            break;
          case 'auth_error':
            toast.error('Session expired — please log in again to use AI generation');
            break;
          case 'ai_unavailable': {
            const reason = result.message ?? '';
            if (reason.includes('quota') || reason.includes('HTTP 429')) {
              toast.error("You've reached this week's AI limit. Try again later.");
            } else if (
              reason.startsWith('session_count_mismatch') ||
              reason.startsWith('too_few_exercises') ||
              reason === 'allow_list_validation_failed'
            ) {
              toast.error('AI returned an invalid workout plan. Please try again.');
            } else {
              toast.error('AI generation is currently unavailable. Please try again later.');
            }
            break;
          }
          case 'no_slots':
            toast.error('No exercises were added. Check the console for details.');
            break;
          default:
            toast.error('Failed to generate week');
            break;
        }
      } catch (error) {
        if (__DEV__) {
          devError('generate-ai', error, { action: 'generate' });
        }
        if (!cancelled) {
          router.back();
          toast.error('Failed to generate week');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    templateId,
    dayId,
    dayName,
    dayIndex,
    sessionsPerDay,
    constraintsRaw,
    profile,
    router,
    toast,
  ]);

  return (
    <View style={styles.root}>
      <AiGenerateLoadingScreen dayName={dayName} />
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
