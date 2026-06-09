/**
 * Custom Date Picker Component
 * Uses separate year/month/day pickers in a BottomSheet
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { BottomSheet } from './BottomSheet';
import { spacing, typography } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';

interface DatePickerProps {
  visible: boolean;
  onClose: () => void;
  value: Date | null;
  onChange: (date: Date) => void;
  maximumDate?: Date;
  minimumDate?: Date;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  visible,
  onClose,
  value,
  onChange,
  maximumDate = new Date(),
  minimumDate = new Date(1900, 0, 1),
}) => {
  const colors = useTheme();
  const initialDate = value || new Date(2000, 0, 1);

  const [selectedYear, setSelectedYear] = useState(initialDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(initialDate.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState(initialDate.getDate());

  // Update local state when value changes
  useEffect(() => {
    if (value) {
      setSelectedYear(value.getFullYear());
      setSelectedMonth(value.getMonth() + 1);
      setSelectedDay(value.getDate());
    }
  }, [value]);

  const minYear = minimumDate.getFullYear();
  const maxYear = maximumDate.getFullYear();
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const getDaysInMonth = (month: number, year: number) => new Date(year, month, 0).getDate();
  const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  useEffect(() => {
    if (selectedDay > daysInMonth) {
      setSelectedDay(daysInMonth);
    }
  }, [selectedMonth, selectedYear, daysInMonth, selectedDay]);

  const updateDate = (year: number, month: number, day: number) => {
    const newDate = new Date(year, month - 1, day);
    if (newDate >= minimumDate && newDate <= maximumDate) {
      onChange(newDate);
    }
  };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    updateDate(year, selectedMonth, selectedDay);
  };

  const handleMonthChange = (month: number) => {
    setSelectedMonth(month);
    updateDate(selectedYear, month, selectedDay);
  };

  const handleDayChange = (day: number) => {
    setSelectedDay(day);
    updateDate(selectedYear, selectedMonth, day);
  };

  const formatMonth = (month: number) => {
    const date = new Date(2000, month - 1, 1);
    return date.toLocaleString('default', { month: 'long' });
  };

  const styles = useMemo(() => StyleSheet.create({
    pickerContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: spacing.md,
    },
    pickerColumn: {
      flex: 1,
      alignItems: 'center',
    },
    pickerLabel: {
      fontSize: typography.sizes.sm,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
      fontWeight: typography.weights.medium,
    },
    picker: {
      width: '100%',
      height: 200,
    },
    pickerItem: {
      fontSize: typography.sizes.base,
      color: colors.textPrimary,
    },
  }), [colors]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Select Date of Birth"
      height={350}
    >
      <View style={styles.pickerContainer}>
        <View style={styles.pickerColumn}>
          <Text style={styles.pickerLabel}>Year</Text>
          <Picker
            selectedValue={selectedYear}
            onValueChange={handleYearChange}
            style={styles.picker}
            itemStyle={styles.pickerItem}
          >
            {years.map((year) => (
              <Picker.Item key={year} label={String(year)} value={year} />
            ))}
          </Picker>
        </View>

        <View style={styles.pickerColumn}>
          <Text style={styles.pickerLabel}>Month</Text>
          <Picker
            selectedValue={selectedMonth}
            onValueChange={handleMonthChange}
            style={styles.picker}
            itemStyle={styles.pickerItem}
          >
            {months.map((month) => (
              <Picker.Item
                key={month}
                label={formatMonth(month)}
                value={month}
              />
            ))}
          </Picker>
        </View>

        <View style={styles.pickerColumn}>
          <Text style={styles.pickerLabel}>Day</Text>
          <Picker
            selectedValue={selectedDay}
            onValueChange={handleDayChange}
            style={styles.picker}
            itemStyle={styles.pickerItem}
          >
            {days.map((day) => (
              <Picker.Item key={day} label={String(day)} value={day} />
            ))}
          </Picker>
        </View>
      </View>
    </BottomSheet>
  );
};
