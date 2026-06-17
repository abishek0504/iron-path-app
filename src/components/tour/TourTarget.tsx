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

interface TourTargetContextValue {
  registerTarget: (id: string, ref: View) => void;
  unregisterTarget: (id: string) => void;
  measureTarget: (id: string) => Promise<TourTargetMeasurement | null>;
}

const TourTargetContext = createContext<TourTargetContextValue | null>(null);

export function TourTargetRegistryProvider({ children }: { children: ReactNode }) {
  const targetsRef = useRef<TargetRegistry>(new Map());

  const registerTarget = useCallback((id: string, ref: View) => {
    targetsRef.current.set(id, ref);
  }, []);

  const unregisterTarget = useCallback((id: string) => {
    targetsRef.current.delete(id);
  }, []);

  const measureTarget = useCallback((id: string) => {
    return new Promise<TourTargetMeasurement | null>((resolve) => {
      const target = targetsRef.current.get(id);
      if (!target) {
        resolve(null);
        return;
      }

      requestAnimationFrame(() => {
        target.measureInWindow((x, y, width, height) => {
          if (width <= 0 || height <= 0) {
            resolve(null);
            return;
          }
          resolve({ x, y, width, height });
        });
      });
    });
  }, []);

  const value = useMemo(
    () => ({ registerTarget, unregisterTarget, measureTarget }),
    [registerTarget, unregisterTarget, measureTarget],
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
