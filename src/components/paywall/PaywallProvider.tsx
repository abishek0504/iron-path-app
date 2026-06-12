import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { PaywallModal } from './PaywallModal';
import { useSubscription } from '../../hooks/useSubscription';
import { useUserStore } from '../../stores/userStore';
import { isProProfile } from '../../lib/subscriptions/gates';
import {
  createPaywallSessionState,
  shouldShowPaywall,
  type PaywallTrigger,
} from '../../lib/subscriptions/paywallTriggers';
import { registerPaywallBridge } from '../../lib/subscriptions/paywallBridge';
import { useToast } from '../../hooks/useToast';
import { hapticSuccess } from '../../lib/utils/haptics';

interface PaywallContextValue {
  isPro: boolean;
  isLoading: boolean;
  showPaywall: (
    trigger: PaywallTrigger,
    options?: { onSubscribed?: () => void },
  ) => void;
  tryRandomPaywall: (trigger: PaywallTrigger) => void;
  tryAppOpenPaywall: () => void;
  requestGenerateAi: (onAllowed: () => void) => void;
  restoreSubscription: () => Promise<boolean>;
}

const PaywallContext = createContext<PaywallContextValue | null>(null);

export function usePaywall(): PaywallContextValue {
  const ctx = useContext(PaywallContext);
  if (!ctx) {
    throw new Error('usePaywall must be used within PaywallProvider');
  }
  return ctx;
}

export function PaywallProvider({ children }: { children: ReactNode }) {
  const profile = useUserStore((s) => s.profile);
  const userId = profile?.id ?? null;
  const toast = useToast();

  const {
    isPro: rcPro,
    isLoading,
    monthlyPackage,
    annualPackage,
    purchasePackage,
    restorePurchases,
    refresh,
  } = useSubscription(userId);

  const profilePro = isProProfile(
    (profile as { subscription_tier?: string })?.subscription_tier,
    (profile as { subscription_expires_at?: string | null })?.subscription_expires_at,
  );
  const isPro = rcPro || profilePro;

  const sessionRef = useRef(createPaywallSessionState());
  const [visible, setVisible] = useState(false);
  const [trigger, setTrigger] = useState<PaywallTrigger>('app_open');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const onSubscribedRef = useRef<(() => void) | null>(null);

  const openPaywall = useCallback(
    (nextTrigger: PaywallTrigger, onSubscribed?: () => void) => {
      setTrigger(nextTrigger);
      onSubscribedRef.current = onSubscribed ?? null;
      setVisible(true);
    },
    [],
  );

  const showPaywall = useCallback(
    (nextTrigger: PaywallTrigger, options?: { onSubscribed?: () => void }) => {
      if (isPro) {
        options?.onSubscribed?.();
        return;
      }
      openPaywall(nextTrigger, options?.onSubscribed);
    },
    [isPro, openPaywall],
  );

  const tryRandomPaywall = useCallback(
    (nextTrigger: PaywallTrigger) => {
      const result = shouldShowPaywall({
        trigger: nextTrigger,
        isPro,
        state: sessionRef.current,
        nowMs: Date.now(),
        randomRoll: Math.random(),
      });
      sessionRef.current = result.nextState;
      if (result.show) {
        openPaywall(nextTrigger);
      }
    },
    [isPro, openPaywall],
  );

  const tryAppOpenPaywall = useCallback(() => {
    const result = shouldShowPaywall({
      trigger: 'app_open',
      isPro,
      state: sessionRef.current,
      nowMs: Date.now(),
      randomRoll: 0,
    });
    sessionRef.current = result.nextState;
    if (result.show) {
      openPaywall('app_open');
    }
  }, [isPro, openPaywall]);

  const requestGenerateAi = useCallback(
    (onAllowed: () => void) => {
      if (isPro) {
        onAllowed();
        return;
      }
      const result = shouldShowPaywall({
        trigger: 'generate_ai',
        isPro: false,
        state: sessionRef.current,
        nowMs: Date.now(),
        randomRoll: 0,
      });
      sessionRef.current = result.nextState;
      openPaywall('generate_ai', onAllowed);
    },
    [isPro, openPaywall],
  );

  const handleDismiss = useCallback(() => {
    setVisible(false);
    onSubscribedRef.current = null;
  }, []);

  const handlePurchase = useCallback(
    async (pkg: Parameters<typeof purchasePackage>[0]) => {
      setIsPurchasing(true);
      try {
        const success = await purchasePackage(pkg);
        if (success) {
          hapticSuccess();
          await refresh();
          setVisible(false);
          toast.success('Welcome to IronPath Pro!');
          onSubscribedRef.current?.();
          onSubscribedRef.current = null;
        }
      } finally {
        setIsPurchasing(false);
      }
    },
    [purchasePackage, refresh, toast],
  );

  const restoreSubscription = useCallback(async (): Promise<boolean> => {
    setIsPurchasing(true);
    try {
      const restored = await restorePurchases();
      if (restored) {
        await refresh();
        toast.success('Subscription restored');
        return true;
      }
      toast.error('No active subscription found');
      return false;
    } finally {
      setIsPurchasing(false);
    }
  }, [restorePurchases, refresh, toast]);

  const handleRestore = useCallback(async () => {
    const restored = await restoreSubscription();
    if (restored) {
      setVisible(false);
      onSubscribedRef.current?.();
      onSubscribedRef.current = null;
    }
  }, [restoreSubscription]);

  const contextValue = useMemo(
    () => ({
      isPro,
      isLoading,
      showPaywall,
      tryRandomPaywall,
      tryAppOpenPaywall,
      requestGenerateAi,
      restoreSubscription,
    }),
    [
      isPro,
      isLoading,
      showPaywall,
      tryRandomPaywall,
      tryAppOpenPaywall,
      requestGenerateAi,
      restoreSubscription,
    ],
  );

  useEffect(() => {
    registerPaywallBridge(contextValue);
    return () => registerPaywallBridge(null);
  }, [contextValue]);

  return (
    <PaywallContext.Provider value={contextValue}>
      {children}
      <PaywallModal
        visible={visible}
        trigger={trigger}
        monthlyPackage={monthlyPackage}
        annualPackage={annualPackage}
        isPurchasing={isPurchasing}
        onDismiss={handleDismiss}
        onPurchase={handlePurchase}
        onRestore={handleRestore}
      />
    </PaywallContext.Provider>
  );
}
