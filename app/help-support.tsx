/**
 * Help & Support
 * Contact form with name, email, and message. Submits to v2_support.
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { spacing, borderRadius, typography, type ThemeColors } from '../src/lib/utils/theme';
import { useTheme } from '../src/lib/utils/ThemeContext';
import { useUserStore } from '../src/stores/userStore';
import { useUIStore } from '../src/stores/uiStore';
import { supabase } from '../src/lib/supabase/client';
import { LegalLinks } from '../src/components/ui/LegalLinks';
import { LogoEdgeLoader } from '../src/components/ui/LogoEdgeLoader';
import { LoadingScreen } from '../src/components/ui/LoadingScreen';

const SUPPORT_MESSAGE_MAX_LENGTH = 5000;

export default function HelpSupportScreen() {
  const router = useRouter();
  const profile = useUserStore((state) => state.profile);
  const showToast = useUIStore((state) => state.showToast);
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const parts = [profile?.first_name, profile?.last_name].filter(Boolean);
      setName(parts.length > 0 ? parts.join(' ') : '');
      setEmail(user?.email ?? '');
      setLoading(false);
    };
    load();
  }, [profile?.first_name, profile?.last_name]);

  const handleClose = () => {
    const canGoBack = (router as { canGoBack?: () => boolean })?.canGoBack?.() ?? true;
    if (canGoBack) {
      try {
        router.back();
        return;
      } catch {
        // fall through
      }
    }
    router.replace('/(tabs)');
  };

  const handleSend = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();
    if (!trimmedName || !trimmedEmail || !trimmedMessage) {
      showToast('Please fill in name, email, and your message', 'error');
      return;
    }
    if (trimmedMessage.length > SUPPORT_MESSAGE_MAX_LENGTH) {
      showToast(`Message must be ${SUPPORT_MESSAGE_MAX_LENGTH} characters or fewer`, 'error');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showToast('Please log in to send', 'error');
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.from('v2_support').insert({
        user_id: user.id,
        name: trimmedName,
        email: trimmedEmail,
        message: trimmedMessage,
      });
      if (error) throw error;
      showToast('Message sent. We\'ll get back to you soon.', 'success');
      handleClose();
    } catch (e) {
      showToast('Failed to send message', 'error');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top']}>
        <LoadingScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Help & Support</Text>
        <TouchableOpacity onPress={handleClose} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Close">
          <X size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Got questions or concerns? We&apos;re here to help. Reach out and we&apos;ll get back to you.
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Your message</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Type your question or concern here..."
              placeholderTextColor={colors.textMuted}
              style={styles.messageInput}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.sendButton, sending && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={sending}
            activeOpacity={0.85}
          >
            {sending ? (
              <LogoEdgeLoader size="small" variant="inverted" />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </TouchableOpacity>

          <View style={styles.legalContainer}>
            <LegalLinks />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    title: {
      fontSize: typography.sizes.xl,
      fontWeight: typography.weights.bold,
      color: colors.textPrimary,
    },
    headerButton: {
      padding: spacing.sm,
      borderRadius: borderRadius.sm,
    },
    scroll: {
      flex: 1,
    },
    keyboardAvoid: {
      flex: 1,
    },
    content: {
      padding: spacing.lg,
      gap: spacing.md,
      paddingBottom: spacing.xxl,
    },
    intro: {
      color: colors.textSecondary,
      fontSize: typography.sizes.base,
      lineHeight: 22,
      marginBottom: spacing.sm,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: spacing.md,
      gap: spacing.xs,
    },
    label: {
      color: colors.textSecondary,
      fontSize: typography.sizes.sm,
    },
    input: {
      color: colors.textPrimary,
      fontSize: typography.sizes.base,
      paddingVertical: spacing.xs,
    },
    messageInput: {
      color: colors.textPrimary,
      fontSize: typography.sizes.base,
      paddingVertical: spacing.sm,
      minHeight: 140,
      maxHeight: 200,
    },
    sendButton: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.sm,
    },
    sendButtonDisabled: {
      opacity: 0.7,
    },
    sendButtonText: {
      color: colors.background,
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.bold,
    },
    legalContainer: {
      marginTop: spacing.lg,
      alignItems: 'center',
    },
  });
}
