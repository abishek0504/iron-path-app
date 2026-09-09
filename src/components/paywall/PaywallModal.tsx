import { useEffect, useMemo, useState } from 'react';
import {
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
  cancelAnimation,
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
import { borderRadius, spacing, typography, type ThemeColors } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import { IronPathLogo } from '../ui/IronPathLogo';
import { LogoEdgeLoader } from '../ui/LogoEdgeLoader';
import { Button } from '../ui/Button';

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

function introPrice(pkg: PurchasesPackage) {
  return pkg.product.introPrice ?? null;
}

function periodNoun(plan: PlanId): 'year' | 'month' {
  return plan === 'annual' ? 'year' : 'month';
}

function trialSublabel(pkg: PurchasesPackage): string | null {
  const intro = introPrice(pkg);
  if (!intro || intro.price !== 0) return null;
  const units = intro.periodNumberOfUnits;
  const unit = (intro.periodUnit ?? 'DAY').toLowerCase();
  if (unit.startsWith('day')) return `${units}-day free trial`;
  if (unit.startsWith('week')) return units === 1 ? '1-week free trial' : `${units}-week free trial`;
  if (unit.startsWith('month')) return units === 1 ? '1-month free trial' : `${units}-month free trial`;
  return `${units}-${unit} free trial`;
}

function planPriceLabel(pkg: PurchasesPackage, plan: PlanId): string {
  const period = periodNoun(plan);
  return `${pkg.product.priceString}/${period === 'year' ? 'yr' : 'mo'}`;
}

function ctaLabel(pkg: PurchasesPackage | null): string {
  if (!pkg) return 'Subscribe';
  const trial = trialSublabel(pkg);
  if (trial) return `Start ${trial}`;
  return `Subscribe for ${pkg.product.priceString}`;
}

function priceDisclosure(plan: PlanId, pkg: PurchasesPackage | null): string | null {
  if (!pkg) return null;
  const price = pkg.product.priceString;
  const period = periodNoun(plan);
  if (trialSublabel(pkg)) {
    return `Then ${price}/${period} after trial unless canceled.`;
  }
  return `${price}/${period}. Auto-renews unless canceled.`;
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
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('annual');
  const [canDismiss, setCanDismiss] = useState(false);
  const ctaScale = useSharedValue(1);

  useEffect(() => {
    if (!visible) {
      setCanDismiss(false);
      cancelAnimation(ctaScale);
      ctaScale.value = 1;
      return;
    }
    setSelectedPlan(annualPackage ? 'annual' : monthlyPackage ? 'monthly' : 'annual');
    const timer = setTimeout(() => {
      setCanDismiss(true);
      ctaScale.value = withRepeat(
        withSequence(withTiming(1.02, { duration: 900 }), withTiming(1, { duration: 900 })),
        -1,
        false,
      );
    }, SOFT_DISMISS_DELAY_MS);
    return () => {
      clearTimeout(timer);
      cancelAnimation(ctaScale);
    };
  }, [visible, ctaScale, annualPackage, monthlyPackage]);

  useEffect(() => {
    if (selectedPlan === 'annual' && !annualPackage && monthlyPackage) {
      setSelectedPlan('monthly');
    } else if (selectedPlan === 'monthly' && !monthlyPackage && annualPackage) {
      setSelectedPlan('annual');
    }
  }, [annualPackage, monthlyPackage, selectedPlan]);

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
              <X size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <View style={styles.closePlaceholder} />
        )}

        <View style={styles.content}>
          <IronPathLogo size={72} style={styles.logo} />
          <Text style={styles.headline}>{headline}</Text>
          <Text style={styles.subhead}>Cancel anytime</Text>

          <View style={styles.plans}>
            {annualPackage ? (
              <PlanRow
                styles={styles}
                label="Annual"
                price={planPriceLabel(annualPackage, 'annual')}
                sublabel={trialSublabel(annualPackage)}
                selected={selectedPlan === 'annual'}
                muted={false}
                badge={savingsPct != null ? `Save ${savingsPct}%` : undefined}
                onPress={() => setSelectedPlan('annual')}
              />
            ) : null}
            {monthlyPackage ? (
              <PlanRow
                styles={styles}
                label="Monthly"
                price={planPriceLabel(monthlyPackage, 'monthly')}
                sublabel={trialSublabel(monthlyPackage)}
                selected={selectedPlan === 'monthly'}
                muted={selectedPlan !== 'monthly'}
                onPress={() => setSelectedPlan('monthly')}
              />
            ) : null}
            {!annualPackage && !monthlyPackage ? (
              <Text style={styles.plansUnavailable}>
                Subscription options are unavailable right now. Restore purchases or try again later.
              </Text>
            ) : null}
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
            <Button
              label={ctaLabel(selectedPackage)}
              onPress={handlePurchasePress}
              disabled={!selectedPackage || isPurchasing}
              fullWidth
              style={styles.cta}
              textStyle={styles.ctaText}
            >
              {isPurchasing ? <LogoEdgeLoader size="small" variant="inverted" /> : undefined}
            </Button>
          </Animated.View>

          {disclosure ? <Text style={styles.disclosure}>{disclosure}</Text> : null}

          <TouchableOpacity
            onPress={onRestore}
            disabled={isPurchasing}
            style={styles.restore}
            activeOpacity={0.85}
          >
            <Text style={styles.restoreText}>Restore Purchases</Text>
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
  styles,
  label,
  price,
  sublabel,
  selected,
  muted,
  badge,
  onPress,
}: {
  styles: ReturnType<typeof createStyles>;
  label: string;
  price: string;
  sublabel: string | null;
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
        {sublabel ? <Text style={styles.planTrial}>{sublabel}</Text> : null}
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
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
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  headline: {
    color: colors.textPrimary,
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    textAlign: 'center',
    lineHeight: 32,
  },
  subhead: {
    color: colors.textSecondary,
    fontSize: typography.sizes.md,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  plans: {
    gap: spacing.sm,
  },
  plansUnavailable: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    textAlign: 'center',
    lineHeight: 20,
    paddingVertical: spacing.md,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    backgroundColor: colors.card,
  },
  planRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySubtleBg,
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
    color: colors.textPrimary,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
  },
  planLabelMuted: {
    color: colors.textMuted,
  },
  planPrice: {
    color: colors.textPrimary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
  },
  planTrial: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
  },
  badge: {
    backgroundColor: colors.successBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    color: colors.successText,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  bullets: {
    marginTop: spacing.sm,
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  bullet: {
    color: colors.textSecondary,
    fontSize: typography.sizes.md,
    lineHeight: 22,
  },
  footer: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  cta: {
    minHeight: 52,
  },
  ctaText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  disclosure: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    textAlign: 'center',
    lineHeight: 16,
  },
  restore: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  restoreText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    textDecorationLine: 'underline',
  },
  });
}
