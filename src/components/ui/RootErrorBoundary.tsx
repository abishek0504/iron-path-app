import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { borderRadius, spacing, typography, type ThemeColors } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

const RETRY_MIN_SIZE = 44;

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const colors = useTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.body}>The screen hit an unexpected error. You can try again.</Text>
      <Pressable
        onPress={onRetry}
        style={styles.button}
        accessibilityRole="button"
        accessibilityLabel="Try again"
      >
        <Text style={styles.buttonLabel}>Try again</Text>
      </Pressable>
    </View>
  );
}

export class RootErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
    });
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
      backgroundColor: colors.background,
      gap: spacing.md,
    },
    title: {
      fontSize: typography.sizes.xl,
      fontWeight: typography.weights.semibold,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    body: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    button: {
      marginTop: spacing.sm,
      minHeight: RETRY_MIN_SIZE,
      minWidth: RETRY_MIN_SIZE,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonLabel: {
      fontSize: typography.sizes.base,
      fontWeight: typography.weights.semibold,
      color: colors.onPrimaryContrast,
    },
  });
}
