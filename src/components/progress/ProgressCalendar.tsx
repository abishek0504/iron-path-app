/**
 * Progress Calendar Component
 * Displays weekly or monthly calendar view with completed workout sessions marked
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { spacing, typography, borderRadius, type ThemeColors } from '../../lib/utils/theme';
import { useTheme } from '../../lib/utils/ThemeContext';

type ViewMode = 'week' | 'month';

type CalendarDate = {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  hasSession: boolean;
  sessionCount: number;
};

type Props = {
  viewMode: ViewMode;
  currentDate: Date;
  sessionsByDate: Map<string, { count: number }>;
  onDateSelect: (date: Date) => void;
  selectedDate: Date | null;
};

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const ProgressCalendar: React.FC<Props> = ({
  viewMode,
  currentDate,
  sessionsByDate,
  onDateSelect,
  selectedDate,
}) => {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getLocalDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getWeekDates = (): CalendarDate[] => {
    const start = new Date(currentDate);
    start.setHours(0, 0, 0, 0);
    const dayOfWeek = start.getDay();
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() - dayOfWeek);

    const dates: CalendarDate[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const dateKey = getLocalDateKey(date);
      const sessionData = sessionsByDate.get(dateKey);
      const dateObj: CalendarDate = {
        date,
        isCurrentMonth: true,
        isToday: date.getTime() === today.getTime(),
        hasSession: !!sessionData,
        sessionCount: sessionData?.count || 0,
      };
      dates.push(dateObj);
    }
    return dates;
  };

  const getMonthDates = (): CalendarDate[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const dates: CalendarDate[] = [];
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 41);

    let current = new Date(startDate);
    while (current <= endDate) {
      const dateKey = getLocalDateKey(current);
      const sessionData = sessionsByDate.get(dateKey);
      const isCurrentMonth = current.getMonth() === month;
      const dateCopy = new Date(current);
      dates.push({
        date: dateCopy,
        isCurrentMonth,
        isToday: dateCopy.getTime() === today.getTime(),
        hasSession: !!sessionData,
        sessionCount: sessionData?.count || 0,
      });
      current.setDate(current.getDate() + 1);
    }

    return dates;
  };

  const isDateSelected = (date: Date): boolean => {
    if (!selectedDate) return false;
    return (
      date.getFullYear() === selectedDate.getFullYear() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getDate() === selectedDate.getDate()
    );
  };

  const formatDateLabel = (): string => {
    if (viewMode === 'week') {
      const start = new Date(currentDate);
      start.setHours(0, 0, 0, 0);
      const dayOfWeek = start.getDay();
      start.setDate(start.getDate() - dayOfWeek);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);

      const startMonth = MONTH_NAMES[start.getMonth()];
      const endMonth = MONTH_NAMES[end.getMonth()];
      const startDay = start.getDate();
      const endDay = end.getDate();

      if (startMonth === endMonth) {
        return `${startMonth} ${startDay} - ${endDay}, ${start.getFullYear()}`;
      }
      return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${start.getFullYear()}`;
    } else {
      return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
  };

  if (viewMode === 'week') {
    const weekDates = getWeekDates();
    return (
      <View style={styles.container}>
        <Text style={styles.headerLabel}>{formatDateLabel()}</Text>
        <View style={styles.weekList}>
          {weekDates.map((item, index) => {
            const isSelected = isDateSelected(item.date);
            const dayName = WEEK_DAYS[item.date.getDay()];
            const dateLabel = item.date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            });
            return (
              <TouchableOpacity
                key={`${item.date.toISOString()}-${index}`}
                style={[
                  styles.weekListItem,
                  item.isToday && styles.weekListItemToday,
                  isSelected && styles.weekListItemSelected,
                ]}
                onPress={() => onDateSelect(item.date)}
                activeOpacity={0.7}
              >
                <View style={styles.weekListItemContent}>
                  <View>
                    <Text
                      style={[
                        styles.weekListItemDay,
                        item.isToday && styles.weekListItemDayToday,
                      ]}
                    >
                      {dayName}
                    </Text>
                    <Text
                      style={[
                        styles.weekListItemDate,
                        item.isToday && styles.weekListItemDateToday,
                      ]}
                    >
                      {dateLabel}
                    </Text>
                  </View>
                  {item.hasSession ? (
                    <View style={styles.weekListItemBadge}>
                      <Text style={styles.weekListItemBadgeText}>
                        {item.sessionCount} {item.sessionCount === 1 ? 'workout' : 'workouts'}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.weekListItemEmpty}>No workouts</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  // Month view - calendar grid
  const monthDates = getMonthDates();
  return (
    <View style={styles.container}>
      <Text style={styles.headerLabel}>{formatDateLabel()}</Text>

      <View style={styles.weekDaysHeader}>
        {WEEK_DAYS.map((day) => (
          <View key={day} style={styles.weekDayCell}>
            <Text style={styles.weekDayText}>{day}</Text>
          </View>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {monthDates.map((item, index) => {
          const isSelected = isDateSelected(item.date);
          return (
            <TouchableOpacity
              key={`${item.date.toISOString()}-${index}`}
              style={[
                styles.dateCell,
                !item.isCurrentMonth && styles.dateCellOtherMonth,
                item.isToday && styles.dateCellToday,
                isSelected && styles.dateCellSelected,
                item.hasSession && styles.dateCellWithSession,
              ]}
              onPress={() => onDateSelect(item.date)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.dateText,
                  !item.isCurrentMonth && styles.dateTextOtherMonth,
                  item.isToday && styles.dateTextToday,
                  isSelected && styles.dateTextSelected,
                ]}
              >
                {item.date.getDate()}
              </Text>
              {item.hasSession && (
                <View style={styles.sessionIndicator}>
                  <View
                    style={[
                      styles.sessionDot,
                      item.sessionCount > 1 && styles.sessionDotMultiple,
                    ]}
                  />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: spacing.md,
    },
  headerLabel: {
    color: colors.textPrimary,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
  },
  weekDaysHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    paddingBottom: spacing.sm,
  },
  weekDayCell: {
    width: '14.28%',
    alignItems: 'center',
  },
  weekDayText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dateCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: 'transparent',
    position: 'relative',
    marginBottom: spacing.xs,
  },
  dateCellOtherMonth: {
    opacity: 0.3,
  },
  dateCellToday: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(163, 230, 53, 0.1)',
  },
  dateCellSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(163, 230, 53, 0.2)',
  },
  dateCellWithSession: {
    borderColor: colors.primaryDark,
  },
  dateText: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
  },
  dateTextOtherMonth: {
    color: colors.textMuted,
  },
  dateTextToday: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  dateTextSelected: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  sessionIndicator: {
    position: 'absolute',
    bottom: spacing.xs,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  sessionDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  sessionDotMultiple: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  weekList: {
    gap: spacing.sm,
  },
  weekListItem: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
  },
  weekListItemToday: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(163, 230, 53, 0.1)',
  },
  weekListItemSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(163, 230, 53, 0.2)',
  },
  weekListItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weekListItemDay: {
    color: colors.textPrimary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  weekListItemDayToday: {
    color: colors.primary,
  },
  weekListItemDate: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    marginTop: spacing.xs,
  },
  weekListItemDateToday: {
    color: colors.textPrimary,
  },
  weekListItemBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  weekListItemBadgeText: {
    color: '#000',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  weekListItemEmpty: {
    color: colors.textMuted,
    fontSize: typography.sizes.sm,
  },
  });
}

