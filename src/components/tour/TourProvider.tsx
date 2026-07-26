import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePaywall } from '../paywall/PaywallProvider';
import { useTourStore } from '../../stores/tourStore';
import { useUserStore } from '../../stores/userStore';
import { updateUserProfile } from '../../lib/supabase/queries/users';
import { TOUR_STEPS, TOUR_STEP_COUNT } from '../../lib/onboarding/tourSteps';
import { hapticSelection } from '../../lib/utils/haptics';
import { spacing } from '../../lib/utils/theme';
import { devLog } from '../../lib/utils/logger';
import { TourOverlay } from './TourOverlay';
import {
  TourTargetRegistryProvider,
  useTourTargets,
  type TourTargetMeasurement,
} from './TourTarget';
import { TourScrollRegistryProvider, useTourScroll } from './TourScroll';

const TAB_ROUTE_PREFIX = '/(tabs)';
const MEASURE_RETRY_MS = 150;
const MEASURE_MAX_RETRIES = 8;
const SCROLL_SETTLE_MS = 350;
/** Reserved space below target for tooltip when deciding if scroll is needed. */
const TOOLTIP_RESERVED_BELOW = 200;
const TOOLTIP_RESERVED_ABOVE = 180;

function tabHref(tab: (typeof TOUR_STEPS)[number]['tab']): string {
  if (tab === 'index') {
    return TAB_ROUTE_PREFIX;
  }
  return `${TAB_ROUTE_PREFIX}/${tab}`;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function TourOrchestrator({ children }: { children: ReactNode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { measureTarget } = useTourTargets();
  const { getScrollController } = useTourScroll();
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

  const scrollTargetIntoView = useCallback(
    async (
      tab: (typeof TOUR_STEPS)[number]['tab'],
      rect: TourTargetMeasurement,
    ): Promise<{ scrolled: boolean; rect: TourTargetMeasurement }> => {
      const controller = getScrollController(tab);
      if (!controller) {
        return { scrolled: false, rect };
      }

      const { height: screenHeight } = Dimensions.get('window');
      const visibleTop = insets.top + spacing.lg + TOOLTIP_RESERVED_ABOVE * 0.35;
      const visibleBottom = screenHeight - insets.bottom - TOOLTIP_RESERVED_BELOW;

      let delta = 0;
      if (rect.y < visibleTop) {
        delta = rect.y - visibleTop;
      } else if (rect.y + rect.height > visibleBottom) {
        delta = rect.y + rect.height - visibleBottom;
      }

      if (Math.abs(delta) < 8) {
        return { scrolled: false, rect };
      }

      const nextY = controller.getScrollY() + delta;
      controller.scrollToY(nextY, true);
      await delay(SCROLL_SETTLE_MS);
      return { scrolled: true, rect };
    },
    [getScrollController, insets.bottom, insets.top],
  );

  useEffect(() => {
    if (!isActive || !currentStep) {
      setTargetRect(null);
      return;
    }

    const token = ++measureTokenRef.current;
    // Keep prior spotlight until the new measure succeeds (no blank flash).
    router.navigate(tabHref(currentStep.tab) as never);

    let cancelled = false;
    let attempt = 0;

    const runMeasure = async () => {
      while (!cancelled && attempt < MEASURE_MAX_RETRIES) {
        await delay(MEASURE_RETRY_MS);
        let rect = await measureStepTarget(currentStepIndex);
        if (cancelled || token !== measureTokenRef.current) {
          return;
        }
        if (rect) {
          const beforeScroll = rect;
          const scrollResult = await scrollTargetIntoView(currentStep.tab, rect);
          if (cancelled || token !== measureTokenRef.current) {
            return;
          }

          if (scrollResult.scrolled) {
            const remeasured = await measureStepTarget(currentStepIndex);
            if (cancelled || token !== measureTokenRef.current) {
              return;
            }
            if (remeasured) {
              rect = remeasured;
            }
          }

          setTargetRect(rect);
          if (__DEV__) {
            const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
            devLog('app-tour', {
              action: 'measureStep',
              stepIndex: currentStepIndex,
              stepId: currentStep.id,
              tab: currentStep.tab,
              scrolled: scrollResult.scrolled,
              rect,
              beforeScroll,
              window: { width: screenWidth, height: screenHeight },
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
  }, [currentStep, currentStepIndex, isActive, measureStepTarget, router, scrollTargetIntoView]);

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
      <TourScrollRegistryProvider>
        <TourOrchestrator>{children}</TourOrchestrator>
      </TourScrollRegistryProvider>
    </TourTargetRegistryProvider>
  );
}
