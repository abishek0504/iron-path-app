import { useCallback, useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { ENTITLEMENT_ID } from '../lib/subscriptions/constants';
import { resolveOfferingPackages } from '../lib/subscriptions/offeringPackages';
import {
  checkProEntitlement,
  configureRevenueCat,
  getPurchases,
  logOutRevenueCat,
} from '../lib/subscriptions/revenueCat';
import { devLog } from '../lib/utils/logger';

const SUBSCRIPTION_REFRESH_FALLBACK_MS = 400;

export function useSubscription(userId: string | null) {
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [monthlyPackage, setMonthlyPackage] = useState<PurchasesPackage | null>(null);
  const [annualPackage, setAnnualPackage] = useState<PurchasesPackage | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setIsPro(false);
      setMonthlyPackage(null);
      setAnnualPackage(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const ready = await configureRevenueCat(userId);
      if (!ready) {
        setIsPro(false);
        setMonthlyPackage(null);
        setAnnualPackage(null);
        return;
      }

      const Purchases = getPurchases();
      let hasMonthly = false;
      let hasAnnual = false;
      if (Purchases) {
        const offerings = await Purchases.default.getOfferings();
        const resolved = resolveOfferingPackages(offerings.current);
        hasMonthly = resolved.monthly != null;
        hasAnnual = resolved.annual != null;
        setMonthlyPackage(resolved.monthly);
        setAnnualPackage(resolved.annual);
      } else {
        setMonthlyPackage(null);
        setAnnualPackage(null);
      }

      const pro = await checkProEntitlement();
      setIsPro(pro);
      if (__DEV__) {
        devLog('subscription', { action: 'refresh', isPro: pro, userId, hasMonthly, hasAnnual });
      }
    } catch (e) {
      if (__DEV__) {
        devLog('subscription', { action: 'refresh_failed', error: String(e), userId });
      }
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      void refresh();
      return;
    }

    let cancelled = false;
    let started = false;
    const start = () => {
      if (cancelled || started) return;
      started = true;
      void refresh();
    };

    const task = InteractionManager.runAfterInteractions(start);
    const fallback = setTimeout(start, SUBSCRIPTION_REFRESH_FALLBACK_MS);
    return () => {
      cancelled = true;
      task.cancel();
      clearTimeout(fallback);
    };
  }, [refresh, userId]);

  const purchasePackage = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    const Purchases = getPurchases();
    if (!Purchases) return false;
    try {
      const { customerInfo } = await Purchases.default.purchasePackage(pkg);
      const active = customerInfo.entitlements.active[ENTITLEMENT_ID] != null;
      setIsPro(active);
      return active;
    } catch (e: unknown) {
      const err = e as { userCancelled?: boolean };
      if (!err?.userCancelled && __DEV__) {
        devLog('subscription', { action: 'purchase_failed', error: String(e) });
      }
      return false;
    }
  }, []);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    const Purchases = getPurchases();
    if (!Purchases) return false;
    try {
      const info = await Purchases.default.restorePurchases();
      const active = info.entitlements.active[ENTITLEMENT_ID] != null;
      setIsPro(active);
      return active;
    } catch {
      return false;
    }
  }, []);

  const signOutSubscription = useCallback(async () => {
    await logOutRevenueCat();
    setIsPro(false);
  }, []);

  return {
    isPro,
    isLoading,
    monthlyPackage,
    annualPackage,
    refresh,
    purchasePackage,
    restorePurchases,
    signOutSubscription,
  };
}
