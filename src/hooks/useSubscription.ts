import { useCallback, useEffect, useState } from 'react';
import type { PurchasesPackage } from 'react-native-purchases';
import { ENTITLEMENT_ID } from '../lib/subscriptions/constants';
import {
  checkProEntitlement,
  configureRevenueCat,
  getPurchases,
  logOutRevenueCat,
} from '../lib/subscriptions/revenueCat';
import { devLog } from '../lib/utils/logger';

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
        return;
      }

      const Purchases = getPurchases();
      if (Purchases) {
        const offerings = await Purchases.default.getOfferings();
        const current = offerings.current;
        if (current) {
          setMonthlyPackage(
            current.monthly ??
              current.availablePackages.find(
                (p) => p.packageType === Purchases.PACKAGE_TYPE.MONTHLY,
              ) ??
              null,
          );
          setAnnualPackage(
            current.annual ??
              current.availablePackages.find(
                (p) => p.packageType === Purchases.PACKAGE_TYPE.ANNUAL,
              ) ??
              null,
          );
        }
      }

      const pro = await checkProEntitlement();
      setIsPro(pro);
      if (__DEV__) {
        devLog('subscription', { action: 'refresh', isPro: pro, userId });
      }
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
