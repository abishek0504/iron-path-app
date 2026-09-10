import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { sanitizeCoachNotes } from '../../lib/ai/coachNotes';
import { MAX_COACH_NOTES_LENGTH } from '../../lib/ai/coachPrefs';
import { spacing, typography, type ThemeColors } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';

interface TalkToCoachSheetProps {
  visible: boolean;
  initialNotes: string | null | undefined;
  onCancel: () => void;
  onClosed?: () => void;
  onSave: (notes: string | null) => void;
}

export function TalkToCoachSheet({
  visible,
  initialNotes,
  onCancel,
  onClosed,
  onSave,
}: TalkToCoachSheetProps) {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [draft, setDraft] = useState(initialNotes ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setDraft(initialNotes ?? '');
      setError(null);
    }
  }, [visible, initialNotes]);

  const handleSave = () => {
    const result = sanitizeCoachNotes(draft);
    if (!result.ok) {
      setError('That note looks like an instruction to the model. Rephrase your preference.');
      return;
    }
    onSave(result.notes);
  };

  const handleClear = () => {
    setDraft('');
    setError(null);
    onSave(null);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onCancel}
      onClosed={onClosed}
      title="Talk to your coach"
      height="70%"
      avoidKeyboard
    >
      <View style={styles.body}>
        <Text style={styles.hint}>
          Likes, dislikes, injuries, how sessions should feel. Split, which day is Push or Legs,
          length, and exercise count still come from your profile.
        </Text>
        <TextInput
          value={draft}
          onChangeText={(text) => {
            setDraft(text);
            setError(null);
          }}
          placeholder="e.g. No hip thrusts. Shoulders feel beat up."
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          multiline
          textAlignVertical="top"
          maxLength={MAX_COACH_NOTES_LENGTH}
        />
        <Text style={styles.counter}>
          {draft.trim().length}/{MAX_COACH_NOTES_LENGTH}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.actions}>
          <Button label="Save" onPress={handleSave} fullWidth />
          <Button label="Clear" variant="secondary" onPress={handleClear} fullWidth />
        </View>
      </View>
    </BottomSheet>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    body: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
      gap: spacing.sm,
    },
    hint: {
      color: colors.textMuted,
      fontSize: typography.sizes.sm,
    },
    input: {
      minHeight: 140,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      padding: spacing.md,
      color: colors.textPrimary,
      fontSize: typography.sizes.base,
    },
    counter: {
      color: colors.textMuted,
      fontSize: typography.sizes.xs,
      textAlign: 'right',
    },
    error: {
      color: colors.error,
      fontSize: typography.sizes.sm,
    },
    actions: {
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
  });
}
