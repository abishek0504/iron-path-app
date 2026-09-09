import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { View, type ViewProps } from 'react-native';

export interface TourTargetMeasurement {
  x: number;
  y: number;
  width: number;
  height: number;
}

type TargetRegistry = Map<string, View>;
type Waiter = (node: View) => void;

interface TourTargetContextValue {
  registerTarget: (id: string, ref: View) => void;
  unregisterTarget: (id: string) => void;
  measureTarget: (id: string) => Promise<TourTargetMeasurement | null>;
  waitForTarget: (id: string, timeoutMs: number) => Promise<View | null>;
  hasTarget: (id: string) => boolean;
}

const TourTargetContext = createContext<TourTargetContextValue | null>(null);

const MEASURE_TIMEOUT_MS = 400;

function measureNode(target: View): Promise<TourTargetMeasurement | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: TourTargetMeasurement | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), MEASURE_TIMEOUT_MS);
    requestAnimationFrame(() => {
      target.measureInWindow((x, y, width, height) => {
        clearTimeout(timer);
        if (width <= 0 || height <= 0) {
          finish(null);
          return;
        }
        finish({ x, y, width, height });
      });
    });
  });
}

export function TourTargetRegistryProvider({ children }: { children: ReactNode }) {
  const targetsRef = useRef<TargetRegistry>(new Map());
  const waitersRef = useRef<Map<string, Set<Waiter>>>(new Map());

  const registerTarget = useCallback((id: string, ref: View) => {
    targetsRef.current.set(id, ref);
    const waiters = waitersRef.current.get(id);
    if (waiters) {
      waitersRef.current.delete(id);
      waiters.forEach((waiter) => waiter(ref));
    }
  }, []);

  const unregisterTarget = useCallback((id: string) => {
    targetsRef.current.delete(id);
  }, []);

  const measureTarget = useCallback(async (id: string) => {
    const target = targetsRef.current.get(id);
    if (!target) return null;
    return measureNode(target);
  }, []);

  const waitForTarget = useCallback((id: string, timeoutMs: number) => {
    const existing = targetsRef.current.get(id);
    if (existing) {
      return Promise.resolve(existing);
    }
    return new Promise<View | null>((resolve) => {
      let settled = false;
      const finish = (node: View | null) => {
        if (settled) return;
        settled = true;
        const waiters = waitersRef.current.get(id);
        if (waiters) {
          waiters.delete(onRegister);
          if (waiters.size === 0) waitersRef.current.delete(id);
        }
        resolve(node);
      };
      const onRegister: Waiter = (node) => finish(node);
      const waiters = waitersRef.current.get(id) ?? new Set<Waiter>();
      waiters.add(onRegister);
      waitersRef.current.set(id, waiters);
      setTimeout(() => finish(null), timeoutMs);
    });
  }, []);

  const hasTarget = useCallback((id: string) => targetsRef.current.has(id), []);

  const value = useMemo(
    () => ({ registerTarget, unregisterTarget, measureTarget, waitForTarget, hasTarget }),
    [registerTarget, unregisterTarget, measureTarget, waitForTarget, hasTarget],
  );

  return (
    <TourTargetContext.Provider value={value}>{children}</TourTargetContext.Provider>
  );
}

export function useTourTargets(): TourTargetContextValue {
  const ctx = useContext(TourTargetContext);
  if (!ctx) {
    throw new Error('useTourTargets must be used within TourTargetRegistryProvider');
  }
  return ctx;
}

interface TourTargetProps extends ViewProps {
  id: string;
  children: ReactNode;
  collapsable?: boolean;
}

export function TourTarget({
  id,
  children,
  collapsable = false,
  style,
  ...rest
}: TourTargetProps) {
  const { registerTarget, unregisterTarget } = useTourTargets();
  const viewRef = useRef<View>(null);

  useEffect(() => {
    const node = viewRef.current;
    if (!node) return;
    registerTarget(id, node);
    return () => unregisterTarget(id);
  }, [id, registerTarget, unregisterTarget]);

  return (
    <View ref={viewRef} collapsable={collapsable} style={style} {...rest}>
      {children}
    </View>
  );
}
