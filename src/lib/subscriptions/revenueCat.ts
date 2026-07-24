import { Platform } from 'react-native';
import {
  ENTITLEMENT_ID,
  PRODUCT_ID_ANNUAL,
  PRODUCT_ID_MONTHLY,
} from './constants';

export type PurchasesModule = typeof import('react-native-purchases');

let configured = false;
let activeUserId: string | null = null;

function getPurchases(): PurchasesModule | null {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  try {
    return require('react-native-purchases') as PurchasesModule;
  } catch {
    return null;
  }
}

export function getRevenueCatApiKey(): string | null {
  const key = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? key ?? null;
  }
  return key ?? null;
}

export async function configureRevenueCat(userId: string): Promise<boolean> {
  const Purchases = getPurchases();
  const apiKey = getRevenueCatApiKey();
  if (!Purchases || !apiKey) return false;

  if (!configured) {
    Purchases.default.setLogLevel(
      __DEV__ ? Purchases.LOG_LEVEL.DEBUG : Purchases.LOG_LEVEL.WARN,
    );
    await Purchases.default.configure({ apiKey });
    configured = true;
  }

  if (activeUserId === userId) return true;

  await Purchases.default.logIn(userId);
  activeUserId = userId;
  return true;
}

export async function logOutRevenueCat(): Promise<void> {
  const Purchases = getPurchases();
  if (!Purchases || !configured || !activeUserId) return;
  try {
    await Purchases.default.logOut();
  } finally {
    activeUserId = null;
  }
}

export async function checkProEntitlement(): Promise<boolean> {
  const Purchases = getPurchases();
  if (!Purchases) return false;
  try {
    const info = await Purchases.default.getCustomerInfo();
    return info.entitlements.active[ENTITLEMENT_ID] != null;
  } catch {
    return false;
  }
}

export async function getRevenueCatOfferings(): Promise<
  import('react-native-purchases').PurchasesOfferings | null
> {
  const Purchases = getPurchases();
  if (!Purchases) return null;
  try {
    return await Purchases.default.getOfferings();
  } catch {
    return null;
  }
}

type RevenueCatUiModule = { presentCustomerCenter: () => Promise<void> };

function getRevenueCatUI(): RevenueCatUiModule | null {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  try {
    const mod = require('react-native-purchases-ui');
    return (mod?.default ?? mod) as RevenueCatUiModule;
  } catch {
    return null;
  }
}

/**
 * Presents RevenueCat's Customer Center (manage/cancel/refund/change-plan).
 * Returns false when the native UI module is unavailable (web / Expo Go), so
 * the caller can fall back to store-managed subscriptions.
 */
export async function presentCustomerCenter(): Promise<boolean> {
  const RevenueCatUI = getRevenueCatUI();
  if (!RevenueCatUI) return false;
  try {
    await RevenueCatUI.presentCustomerCenter();
    return true;
  } catch {
    return false;
  }
}

export { getPurchases, PRODUCT_ID_MONTHLY, PRODUCT_ID_ANNUAL, ENTITLEMENT_ID };
