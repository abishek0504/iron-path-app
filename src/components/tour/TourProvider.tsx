import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { usePaywall } from '../paywall/PaywallProvider';
import { useTourStore } from '../../stores/tourStore';
import { useUserStore } from '../../stores/userStore';
import { updateUserProfile } from '../../lib/supabase/queries/users';
import { TOUR_STEPS, TOUR_STEP_COUNT } from '../../lib/onboarding/tourSteps';
import { hapticSelection } from '../../lib/utils/haptics';
import { devLog } from '../../lib/utils/logger';
import { TourOverlay } from './TourOverlay';
import {
  TourTargetRegistryProvider,
  useTourTargets,
  type TourTargetMeasurement,
} from './TourTarget';

const TAB_ROUTE_PREFIX = '/(tabs)';
const MEASURE_RETRY_MS = 150;
const MEASURE_MAX_RETRIES = 8;

function tabHref(tab: (typeof TOUR_STEPS)[number]['tab']): string {
  if (tab === 'index') {
    return TAB_ROUTE_PREFIX;
  }
  return `${TAB_ROUTE_PREFIX}/${tab}`;
}

function TourOrchestrator({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { measureTarget } = useTourTargets();
  const { showPaywall } = usePaywall();
  const profile = useUserStore((s) => s.profile);
  const updateProfile = useUserStore((s) => s.updateProfile);

  const isActive = useTourStore((s) => s.isActive);
  const currentStepIndex = useTourStore((s) => s.currentStepIndex);
  const setStepIndex = useTourStore((s) => s.setStepIndex);
  const endTour = useTourStore((s) => s.endTour);

  const [targetRect, setTargetRect] = useState<TourTargetMeasurement | null>(null);
  const measureTokenRef = useRef(0);

  const currentStep = TOUR_STEPS[currentStepIndex] ?? null;

  const persistTourCompletion = useCallback(async () => {
    const userId = profile?.id;
    const completedAt = new Date().toISOString();
    updateProfile({ app_tour_completed_at: completedAt });
    if (userId) {
      await updateUserProfile(userId, { app_tour_completed_at: completedAt });
    }
  }, [profile?.id, updateProfile]);

  const finishTour = useCallback(
    async (reason: 'complete' | 'skip') => {
      if (__DEV__) {
        devLog('app-tour', { action: 'finishTour', reason, stepIndex: currentStepIndex });
      }
      endTour();
      setTargetRect(null);
      await persistTourCompletion();
      showPaywall('onboarding_complete');
    },
    [currentStepIndex, endTour, persistTourCompletion, showPaywall],
  );

  const measureStepTarget = useCallback(
    async (stepIndex: number): Promise<TourTargetMeasurement | null> => {
      const step = TOUR_STEPS[stepIndex];
      if (!step) return null;

      const primary = await measureTarget(step.targetId);
      if (primary) return primary;
      if (step.fallbackTargetId) {
        return measureTarget(step.fallbackTargetId);
      }
      return null;
    },
    [measureTarget],
  );

  useEffect(() => {
    if (!isActive || !currentStep) {
      setTargetRect(null);
      return;
    }

    const token = ++measureTokenRef.current;
    setTargetRect(null);
    router.navigate(tabHref(currentStep.tab) as never);

    let cancelled = false;
    let attempt = 0;

    const runMeasure = async () => {
      while (!cancelled && attempt < MEASURE_MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, MEASURE_RETRY_MS));
        const rect = await measureStepTarget(currentStepIndex);
        if (cancelled || token !== measureTokenRef.current) {
          return;
        }
        if (rect) {
          setTargetRect(rect);
          if (__DEV__) {
            devLog('app-tour', {
              action: 'measureStep',
              stepIndex: currentStepIndex,
              stepId: currentStep.id,
              tab: currentStep.tab,
              rect,
            });
          }
          return;
        }
        attempt += 1;
      }

      if (!cancelled && token === measureTokenRef.current) {
        setTargetRect(null);
        if (__DEV__) {
          devLog('app-tour', {
            action: 'measureStepFailed',
            stepIndex: currentStepIndex,
            stepId: currentStep.id,
          });
        }
      }
    };

    void runMeasure();

    return () => {
      cancelled = true;
    };
  }, [currentStep, currentStepIndex, isActive, measureStepTarget, router]);

  const handleNext = useCallback(() => {
    hapticSelection();
    if (currentStepIndex >= TOUR_STEP_COUNT - 1) {
      void finishTour('complete');
      return;
    }
    setStepIndex(currentStepIndex + 1);
  }, [currentStepIndex, finishTour, setStepIndex]);

  const handleSkip = useCallback(() => {
    hapticSelection();
    void finishTour('skip');
  }, [finishTour]);

  return (
    <>
      {children}
      {isActive && currentStep ? (
        <TourOverlay
          visible
          step={currentStep}
          stepIndex={currentStepIndex}
          stepCount={TOUR_STEP_COUNT}
          targetRect={targetRect}
          onNext={handleNext}
          onSkip={handleSkip}
        />
      ) : null}
    </>
  );
}

export function TourProvider({ children }: { children: ReactNode }) {
  return (
    <TourTargetRegistryProvider>
      <TourOrchestrator>{children}</TourOrchestrator>
    </TourTargetRegistryProvider>
  );
}
