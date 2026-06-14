/**
 * Full-screen AI generation loading UI — cube messages, step checklist, day subtitle.
 */

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AiGenerateSteps } from './AiGenerateSteps';
import { AiLoadingMessageCube } from './AiLoadingMessageCube';
import { getShuffledAiLoadingMessages } from '../../lib/ai/generateAiLoadingMessages';
import { spacing, typography, type ThemeColors } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';

export interface AiGenerateLoadingScreenProps {
  dayName: string;
}

export function AiGenerateLoadingScreen({ dayName }: AiGenerateLoadingScreenProps) {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const messages = useMemo(() => getShuffledAiLoadingMessages(), []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.messageRegion}>
          <AiLoadingMessageCube messages={messages} />
        </View>

        <View style={styles.stepsRegion}>
          <AiGenerateSteps />
        </View>

        <Text style={styles.subtitle}>Building {dayName} with AI</Text>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: spacing.xl,
    },
    messageRegion: {
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepsRegion: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: typography.sizes.sm,
      textAlign: 'center',
      paddingBottom: spacing.xl,
      marginTop: 'auto',
    },
  });
}
