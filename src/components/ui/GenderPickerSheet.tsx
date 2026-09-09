import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { BottomSheet } from './BottomSheet';
import { typography } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';

export const GENDER_OPTIONS = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Prefer not to say', label: 'Prefer Not To Say' },
] as const;

/** Sentinel for scroller placeholders — never persisted to the DB. */
export const GENDER_PLACEHOLDER = '__select__';

type Props = {
  visible: boolean;
  value: string;
  onChange: (gender: string) => void;
  onClose: () => void;
  onClosed?: () => void;
};

export function GenderPickerSheet({ visible, value, onChange, onClose, onClosed }: Props) {
  const colors = useTheme();
  const [selected, setSelected] = useState(value || GENDER_PLACEHOLDER);

  useEffect(() => {
    if (visible) {
      setSelected(value || GENDER_PLACEHOLDER);
    }
  }, [visible, value]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        picker: {
          width: '100%',
          color: colors.textPrimary,
        },
        pickerItem: {
          color: colors.textPrimary,
          fontSize: typography.sizes.base,
        },
      }),
    [colors],
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onClosed={onClosed}
      title="Select gender"
      height={280}
    >
      <Picker
        selectedValue={selected}
        onValueChange={(itemValue) => {
          if (itemValue === GENDER_PLACEHOLDER) return;
          setSelected(itemValue);
          onChange(itemValue);
        }}
        style={styles.picker}
        itemStyle={styles.pickerItem}
      >
        <Picker.Item label="(Select)" value={GENDER_PLACEHOLDER} />
        {GENDER_OPTIONS.map((opt) => (
          <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
        ))}
      </Picker>
    </BottomSheet>
  );
}
