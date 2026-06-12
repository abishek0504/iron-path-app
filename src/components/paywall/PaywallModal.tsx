import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LegalLinks } from '../ui/LegalLinks';
import { SOFT_DISMISS_DELAY_MS } from '../../lib/subscriptions/constants';
import type { PaywallTrigger } from '../../lib/subscriptions/paywallTriggers';
import { headlineForTrigger } from '../../lib/subscriptions/paywallTriggers';
import { hapticSelection } from '../../lib/utils/haptics';
import { borderRadius, spacing, typography } from '../../lib/utils/theme';

const PAYWALL_BG = '#09090b';
const CTA_LIME = '#a3e635';
const CLOSE_ICON_OPACITY = 0.1;

const BULLETS = [
  'AI plans your week',
  'Split-aware exercise picks',
  'Saves planning time',
] as const;

type PlanId = 'annual' | 'monthly';

interface PaywallModalProps {
  visible: boolean;
  trigger: PaywallTrigger;
  monthlyPackage: PurchasesPackage | null;
  annualPackage: PurchasesPackage | null;
  isPurchasing: boolean;
  onDismiss: () => void;
  onPurchase: (pkg: PurchasesPackage) => void;
  onRestore: () => void;
}

function annualSavingsPercent(monthlyPrice: number, annualPrice: number): number | null {
  const fullYear = monthlyPrice * 12;
  if (fullYear <= 0 || annualPrice <= 0) return null;
  const pct = Math.round((1 - annualPrice / fullYear) * 100);
  return pct >= 10 ? pct : null;
}

function priceDisclosure(plan: PlanId, pkg: PurchasesPackage | null): string {
  const price = pkg?.product.priceString ?? (plan === 'annual' ? '$59.99' : '$9.99');
  const period = plan === 'annual' ? 'year' : 'month';
  return `Then ${price}/${period} after trial unless canceled.`;
}

export function PaywallModal({
  visible,
  trigger,
  monthlyPackage,
  annualPackage,
  isPurchasing,
  onDismiss,
  onPurchase,
  onRestore,
}: PaywallModalProps) {
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('annual');
  const [canDismiss, setCanDismiss] = useState(false);
  const ctaScale = useSharedValue(1);

  useEffect(() => {
    if (!visible) {
      setCanDismiss(false);
      ctaScale.value = 1;
      return;
    }
    setSelectedPlan('annual');
    const timer = setTimeout(() => {
      setCanDismiss(true);
      ctaScale.value = withRepeat(
        withSequence(withTiming(1.02, { duration: 900 }), withTiming(1, { duration: 900 })),
        -1,
        false,
      );
    }, SOFT_DISMISS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [visible, ctaScale]);

  const ctaAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ctaScale.value }],
  }));

  const savingsPct = useMemo(() => {
    const m = monthlyPackage?.product.price ?? 0;
    const a = annualPackage?.product.price ?? 0;
    return annualSavingsPercent(m, a);
  }, [monthlyPackage, annualPackage]);

  const selectedPackage =
    selectedPlan === 'annual' ? annualPackage : monthlyPackage;

  const headline = headlineForTrigger(trigger);
  const disclosure = priceDisclosure(selectedPlan, selectedPackage);

  const handlePurchasePress = () => {
    if (!selectedPackage || isPurchasing) return;
    hapticSelection();
    onPurchase(selectedPackage);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent={Platform.OS === 'android'}
      onRequestClose={canDismiss ? onDismiss : undefined}
    >
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {canDismiss ? (
          <Animated.View entering={FadeIn.duration(400)} style={styles.closeWrap}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onDismiss}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={22} color={`rgba(250,250,250,${CLOSE_ICON_OPACITY})`} />
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <View style={styles.closePlaceholder} />
        )}

        <View style={styles.content}>
          <Image source={require('../../../assets/icon.png')} style={styles.logo} />
          <Text style={styles.headline}>{headline}</Text>
          <Text style={styles.subhead}>Cancel anytime</Text>

          <View style={styles.plans}>
            <PlanRow
              label="Annual"
              price={annualPackage?.product.priceString ?? '$59.99/yr'}
              sublabel="7-day free trial"
              selected={selectedPlan === 'annual'}
              muted={false}
              badge={savingsPct != null ? `Save ${savingsPct}%` : undefined}
              onPress={() => setSelectedPlan('annual')}
            />
            <PlanRow
              label="Monthly"
              price={monthlyPackage?.product.priceString ?? '$9.99/mo'}
              sublabel="7-day free trial"
              selected={selectedPlan === 'monthly'}
              muted={selectedPlan !== 'monthly'}
              onPress={() => setSelectedPlan('monthly')}
            />
          </View>

          <View style={styles.bullets}>
            {BULLETS.map((line) => (
              <Text key={line} style={styles.bullet}>
                • {line}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <Animated.View style={canDismiss ? ctaAnimatedStyle : undefined}>
            <TouchableOpacity
              style={[styles.cta, (!selectedPackage || isPurchasing) && styles.ctaDisabled]}
              disabled={!selectedPackage || isPurchasing}
              onPress={handlePurchasePress}
              accessibilityRole="button"
            >
              {isPurchasing ? (
                <ActivityIndicator color={PAYWALL_BG} />
              ) : (
                <Text style={styles.ctaText}>Start 7-day free trial</Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          <Text style={styles.disclosure}>{disclosure}</Text>

          <TouchableOpacity onPress={onRestore} disabled={isPurchasing} style={styles.restore}>
            <Text style={styles.restoreText}>Have a subscription?</Text>
          </TouchableOpacity>

          <LegalLinks
            intro="Auto-renews unless canceled at least 24 hours before the end of the current period."
            compact
          />
        </View>
      </View>
    </Modal>
  );
}

function PlanRow({
  label,
  price,
  sublabel,
  selected,
  muted,
  badge,
  onPress,
}: {
  label: string;
  price: string;
  sublabel: string;
  selected: boolean;
  muted: boolean;
  badge?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.planRow,
        selected && styles.planRowSelected,
        muted && !selected && styles.planRowMuted,
      ]}
    >
      <View style={styles.planRowMain}>
        <View style={styles.planTitleRow}>
          <Text style={[styles.planLabel, muted && !selected && styles.planLabelMuted]}>
            {label}
          </Text>
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.planPrice, muted && !selected && styles.planLabelMuted]}>
          {price}
        </Text>
        <Text style={styles.planTrial}>{sublabel}</Text>
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PAYWALL_BG,
    paddingHorizontal: spacing.lg,
  },
  closeWrap: {
    alignSelf: 'flex-end',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closePlaceholder: {
    height: 44,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.lg,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  headline: {
    color: '#fafafa',
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    textAlign: 'center',
    lineHeight: 32,
  },
  subhead: {
    color: 'rgba(250,250,250,0.65)',
    fontSize: typography.sizes.md,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  plans: {
    gap: spacing.sm,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(250,250,250,0.15)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    backgroundColor: 'rgba(250,250,250,0.04)',
  },
  planRowSelected: {
    borderColor: '#fafafa',
    backgroundColor: 'rgba(250,250,250,0.08)',
  },
  planRowMuted: {
    opacity: 0.55,
  },
  planRowMain: {
    flex: 1,
    gap: 2,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  planLabel: {
    color: '#fafafa',
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
  },
  planLabelMuted: {
    color: 'rgba(250,250,250,0.55)',
  },
  planPrice: {
    color: '#fafafa',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
  },
  planTrial: {
    color: 'rgba(250,250,250,0.5)',
    fontSize: typography.sizes.sm,
  },
  badge: {
    backgroundColor: 'rgba(34,197,94,0.2)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    color: '#86efac',
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(250,250,250,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: '#fafafa',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fafafa',
  },
  bullets: {
    marginTop: spacing.sm,
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  bullet: {
    color: 'rgba(250,250,250,0.75)',
    fontSize: typography.sizes.md,
    lineHeight: 22,
  },
  footer: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  cta: {
    backgroundColor: CTA_LIME,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  ctaDisabled: {
    opacity: 0.5,
  },
  ctaText: {
    color: PAYWALL_BG,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  disclosure: {
    color: 'rgba(250,250,250,0.45)',
    fontSize: typography.sizes.xs,
    textAlign: 'center',
    lineHeight: 16,
  },
  restore: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  restoreText: {
    color: 'rgba(250,250,250,0.55)',
    fontSize: typography.sizes.sm,
    textDecorationLine: 'underline',
  },
});
