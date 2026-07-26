import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import type { TourTabRoute } from '../../lib/onboarding/tourSteps';

export interface TourScrollController {
  getScrollY: () => number;
  scrollToY: (y: number, animated?: boolean) => void;
}

export interface TourScrollable {
  scrollTo: (opts: { y: number; animated?: boolean }) => void;
}

interface TourScrollContextValue {
  registerScroll: (tab: TourTabRoute, controller: TourScrollController) => void;
  unregisterScroll: (tab: TourTabRoute) => void;
  getScrollController: (tab: TourTabRoute) => TourScrollController | null;
}

const TourScrollContext = createContext<TourScrollContextValue | null>(null);

export function TourScrollRegistryProvider({ children }: { children: ReactNode }) {
  const controllersRef = useRef(new Map<TourTabRoute, TourScrollController>());

  const registerScroll = useCallback((tab: TourTabRoute, controller: TourScrollController) => {
    controllersRef.current.set(tab, controller);
  }, []);

  const unregisterScroll = useCallback((tab: TourTabRoute) => {
    controllersRef.current.delete(tab);
  }, []);

  const getScrollController = useCallback((tab: TourTabRoute) => {
    return controllersRef.current.get(tab) ?? null;
  }, []);

  const value = useMemo(
    () => ({ registerScroll, unregisterScroll, getScrollController }),
    [registerScroll, unregisterScroll, getScrollController],
  );

  return (
    <TourScrollContext.Provider value={value}>{children}</TourScrollContext.Provider>
  );
}

export function useTourScroll(): TourScrollContextValue {
  const ctx = useContext(TourScrollContext);
  if (!ctx) {
    throw new Error('useTourScroll must be used within TourScrollRegistryProvider');
  }
  return ctx;
}

type ScrollableRef = RefObject<TourScrollable | null>;

/**
 * Registers a tab's primary vertical scroll container with the tour system.
 * Returns an `onScroll` handler that must be attached to keep scrollY current.
 */
export function useRegisterTourScroll(tab: TourTabRoute, scrollRef: ScrollableRef) {
  const { registerScroll, unregisterScroll } = useTourScroll();
  const scrollYRef = useRef(0);

  useEffect(() => {
    registerScroll(tab, {
      getScrollY: () => scrollYRef.current,
      scrollToY: (y, animated = true) => {
        scrollRef.current?.scrollTo({ y: Math.max(0, y), animated });
      },
    });
    return () => unregisterScroll(tab);
  }, [tab, registerScroll, unregisterScroll, scrollRef]);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.current = event.nativeEvent.contentOffset.y;
  }, []);

  return { onScroll };
}
