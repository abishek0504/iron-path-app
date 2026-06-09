/**
 * LegalLinks
 * Reusable inline "Privacy Policy" + "Terms of Service" links.
 *
 * Use on signup (required before account creation), in Settings, and on
 * Help & Support so users can always reach the policies. Tapping a link
 * opens the URL in the system browser.
 */

import React, { useMemo } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { spacing, typography } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '../../lib/utils/legal';

interface LegalLinksProps {
  /** Optional intro text shown above the links (e.g. "By signing up you agree to..."). */
  intro?: string;
  /** Slightly more compact rendering for use in dense menus / settings. */
  compact?: boolean;
}

export const LegalLinks: React.FC<LegalLinksProps> = ({ intro, compact = false }) => {
  const colors = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    container: {
      alignItems: 'center',
      gap: spacing.xs,
    },
    compact: {
      gap: 2,
    },
    intro: {
      color: colors.textMuted,
      fontSize: typography.sizes.xs,
      textAlign: 'center',
      lineHeight: 16,
      paddingHorizontal: spacing.sm,
    },
    linksRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    link: {
      color: colors.textSecondary,
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.medium,
      textDecorationLine: 'underline',
    },
    separator: {
      color: colors.textMuted,
      fontSize: typography.sizes.xs,
    },
  }), [colors]);

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => undefined);
  };

  return (
    <View style={[styles.container, compact && styles.compact]}>
      {intro ? <Text style={styles.intro}>{intro}</Text> : null}
      <View style={styles.linksRow}>
        <TouchableOpacity onPress={() => openUrl(PRIVACY_POLICY_URL)} accessibilityRole="link">
          <Text style={styles.link}>Privacy Policy</Text>
        </TouchableOpacity>
        <Text style={styles.separator}>·</Text>
        <TouchableOpacity onPress={() => openUrl(TERMS_OF_SERVICE_URL)} accessibilityRole="link">
          <Text style={styles.link}>Terms of Service</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
