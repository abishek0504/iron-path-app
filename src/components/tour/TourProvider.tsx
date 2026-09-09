import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { InteractionManager, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePaywall } from '../paywall/PaywallProvider';
import { useTourStore } from '../../stores/tourStore';
import { useUserStore } from '../../stores/userStore';
import { updateUserProfile } from '../../lib/supabase/queries/users';
import { clearTourPersistence } from '../../lib/onboarding/tourBridge';
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
const TARGET_TIMEOUT_MS = 1600;
const TOOLTIP_RESERVED_BELOW = 200;
const TOOLTIP_RESERVED_ABOVE = 180;
const PAYWALL_AFTER_TOUR_MS = 450;

function tabHref(tab: (typeof TOUR_STEPS)[number]['tab']): string {
  if (tab === 'index') {
    return TAB_ROUTE_PREFIX;
  }
  return `${TAB_ROUTE_PREFIX}/${tab}`;
}

function TourOrchestrator({ children }: { children: ReactNode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { measureTarget, waitForTarget } = useTourTargets();
  const { getScrollController } = useTourScroll();
  const { showPaywall } = usePaywall();
  const profile = useUserStore((s) => s.profile);
  const updateProfile = useUserStore((s) => s.updateProfile);

  const isActive = useTourStore((s) => s.isActive);
  const currentStepIndex = useTourStore((s) => s.currentStepIndex);
  const setStepIndex = useTourStore((s) => s.setStepIndex);
  const endTour = useTourStore((s) => s.endTour);

  const [displayedStepIndex, setDisplayedStepIndex] = useState(currentStepIndex);
  const [targetRect, setTargetRect] = useState<TourTargetMeasurement | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const measureTokenRef = useRef(0);

  const currentStep = TOUR_STEPS[currentStepIndex] ?? null;
  const displayedStep = TOUR_STEPS[displayedStepIndex] ?? currentStep;

  const persistTourCompletion = useCallback(async () => {
    const userId = profile?.id;
    const completedAt = new Date().toISOString();
    updateProfile({ app_tour_completed_at: completedAt });
    await clearTourPersistence();
    if (userId) {
      await updateUserProfile(userId, { app_tour_completed_at: completedAt });
    }
  }, [profile?.id, updateProfile]);

  const finishTour = useCallback(
    async (reason: 'complete' | 'skip') => {
      if (__DEV__) {
        devLog('app-tour', { action: 'finishTour', reason, stepIndex: currentStepIndex });
      }
      setTooltipVisible(false);
      setTargetRect(null);
      endTour();
      await persistTourCompletion();
      setTimeout(() => {
        showPaywall('onboarding_complete');
      }, PAYWALL_AFTER_TOUR_MS);
    },
    [currentStepIndex, endTour, persistTourCompletion, showPaywall],
  );

  const measureStepTarget = useCallback(
    async (stepIndex: number): Promise<TourTargetMeasurement | null> => {
      const step = TOUR_STEPS[stepIndex];
      if (!step) return null;

      await waitForTarget(step.targetId, TARGET_TIMEOUT_MS);
      const primary = await measureTarget(step.targetId);
      if (primary) return primary;
      if (step.fallbackTargetId) {
        await waitForTarget(step.fallbackTargetId, TARGET_TIMEOUT_MS);
        return measureTarget(step.fallbackTargetId);
      }
      return null;
    },
    [measureTarget, waitForTarget],
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
      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => resolve());
      });
      return { scrolled: true, rect };
    },
    [getScrollController, insets.bottom, insets.top, screenHeight],
  );

  useEffect(() => {
    if (!isActive || !currentStep) {
      setTargetRect(null);
      setTooltipVisible(false);
      return;
    }

    const token = ++measureTokenRef.current;
    setTooltipVisible(false);
    setTargetRect(null);
    router.navigate(tabHref(currentStep.tab) as never);

    let cancelled = false;

    const runMeasure = async () => {
      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => resolve());
      });
      if (cancelled || token !== measureTokenRef.current) return;

      let rect = await measureStepTarget(currentStepIndex);
      if (cancelled || token !== measureTokenRef.current) return;

      if (rect && !currentStep.fixed) {
        const scrollResult = await scrollTargetIntoView(currentStep.tab, rect);
        if (cancelled || token !== measureTokenRef.current) return;
        if (scrollResult.scrolled) {
          const remeasured = await measureStepTarget(currentStepIndex);
          if (cancelled || token !== measureTokenRef.current) return;
          if (remeasured) rect = remeasured;
        }
      }

      setTargetRect(rect);
      setDisplayedStepIndex(currentStepIndex);
      setTooltipVisible(true);
      if (__DEV__) {
        devLog('app-tour', {
          action: 'measureStep',
          stepIndex: currentStepIndex,
          stepId: currentStep.id,
          tab: currentStep.tab,
          rect,
        });
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

  const handleBack = useCallback(() => {
    if (currentStepIndex <= 0) return;
    hapticSelection();
    setStepIndex(currentStepIndex - 1);
  }, [currentStepIndex, setStepIndex]);

  const handleSkip = useCallback(() => {
    hapticSelection();
    void finishTour('skip');
  }, [finishTour]);

  return (
    <>
      {children}
      {isActive && displayedStep ? (
        <TourOverlay
          visible
          step={displayedStep}
          stepIndex={displayedStepIndex}
          stepCount={TOUR_STEP_COUNT}
          targetRect={targetRect}
          tooltipVisible={tooltipVisible}
          onNext={handleNext}
          onBack={handleBack}
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
