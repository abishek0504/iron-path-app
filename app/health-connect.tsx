import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { spacing, borderRadius, typography, type ThemeColors } from '../src/lib/utils/theme';
import { useTheme } from '../src/lib/utils/ThemeContext';
import { LogoEdgeLoader } from '../src/components/ui/LogoEdgeLoader';
import { useUIStore } from '../src/stores/uiStore';
import { supabase } from '../src/lib/supabase/client';
import {
  requestAppleHealthAccess,
  syncBodyMassWithHealth,
} from '../src/lib/health/healthIntegration';

export default function HealthConnectScreen() {
  const router = useRouter();
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const showToast = useUIStore((s) => s.showToast);
  const [busy, setBusy] = useState(false);

  const onConnect = async () => {
    setBusy(true);
    try {
      const res = await requestAppleHealthAccess();
      if (res.state === 'authorized') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await syncBodyMassWithHealth(user.id);
        showToast('Apple Health connected', 'success');
        router.back();
        return;
      }
      showToast(res.message ?? 'Health sync is not available in this build.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ChevronLeft size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Apple Health</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>
          Connect Apple Health to sync body weight and logged workouts. IronPath requests read access
          for body weight and write access for workouts and body mass when you complete sessions or
          log weight.
        </Text>
        <Text style={styles.lead}>
          Weight data syncs both ways — existing Apple Health entries import into IronPath, and your
          IronPath weight history exports to Apple Health. New entries continue syncing after you connect.
        </Text>

        <Text style={styles.sectionTitle}>Privacy</Text>
        <Text style={styles.para}>
          Data is used only to improve your IronPath experience and to write back workouts you complete in
          the app. You can revoke access anytime in the iOS Settings app under Privacy → Health.
        </Text>

        {Platform.OS !== 'ios' ? (
          <Text style={styles.warn}>Apple Health is only available on iOS.</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.primaryBtn, busy && styles.primaryBtnDisabled]}
          onPress={onConnect}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Request Apple Health permission"
        >
          {busy ? (
            <LogoEdgeLoader size="small" variant="inverted" />
          ) : (
            <Text style={styles.primaryBtnText}>Continue with Apple Health</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    headerTitle: {
      fontSize: typography.sizes.lg,
      fontWeight: typography.weights.semibold,
      color: colors.textPrimary,
    },
    body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
    lead: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
      lineHeight: 20,
    },
    sectionTitle: {
      marginTop: spacing.sm,
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
      color: colors.textPrimary,
    },
    para: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
      lineHeight: 20,
    },
    warn: { color: colors.warningText, fontSize: typography.sizes.sm },
    primaryBtn: {
      marginTop: spacing.lg,
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
    },
    primaryBtnDisabled: { opacity: 0.6 },
    primaryBtnText: {
      color: colors.onPrimaryContrast,
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
    },
  });
}
