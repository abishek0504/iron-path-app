import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Chip } from '../ui/Chip';
import { spacing } from '../../lib/utils/theme';
import { hapticSelection } from '../../lib/utils/haptics';
import { devLog } from '../../lib/utils/logger';
import {
  layoutsFromWidths,
  nearestCenteredIndex,
  offsetToCenterIndex,
  sidePaddingForViewport,
  snapOffsetsForLayouts,
} from '../../lib/planner/planDayScroller';

const CHIP_GAP = spacing.sm;
const PROGRAMMATIC_SCROLL_MS = 420;

export interface PlanDayScrollerProps {
  days: readonly string[];
  selectedDayName: string | null;
  onSelectDayName: (dayName: string) => void;
}

export function PlanDayScroller({ days, selectedDayName, onSelectDayName }: PlanDayScrollerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const programmaticUntilRef = useRef(0);
  const lastEmittedNameRef = useRef<string | null>(selectedDayName);
  const layoutsReadyRef = useRef(false);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [chipWidths, setChipWidths] = useState<number[]>(() => days.map(() => 0));

  const allWidthsKnown = chipWidths.length === days.length && chipWidths.every((width) => width > 0);

  const padding = useMemo(() => {
    if (!allWidthsKnown || viewportWidth <= 0) {
      return { left: 0, right: 0 };
    }
    return sidePaddingForViewport(viewportWidth, chipWidths[0], chipWidths[chipWidths.length - 1]);
  }, [allWidthsKnown, chipWidths, viewportWidth]);

  const layouts = useMemo(() => {
    if (!allWidthsKnown) return [];
    return layoutsFromWidths(chipWidths, padding.left, CHIP_GAP);
  }, [allWidthsKnown, chipWidths, padding.left]);

  const snapOffsets = useMemo(
    () => snapOffsetsForLayouts(layouts, viewportWidth),
    [layouts, viewportWidth],
  );

  const scrollToDayName = useCallback(
    (dayName: string, animated: boolean) => {
      if (viewportWidth <= 0 || layouts.length === 0) return;
      const index = days.indexOf(dayName);
      if (index < 0) return;
      programmaticUntilRef.current = Date.now() + PROGRAMMATIC_SCROLL_MS;
      scrollRef.current?.scrollTo({
        x: offsetToCenterIndex(layouts, index, viewportWidth),
        animated,
      });
    },
    [days, layouts, viewportWidth],
  );

  useEffect(() => {
    if (!selectedDayName || layouts.length === 0 || viewportWidth <= 0) return;
    const justReady = !layoutsReadyRef.current;
    layoutsReadyRef.current = true;
    if (justReady) {
      lastEmittedNameRef.current = selectedDayName;
      scrollToDayName(selectedDayName, false);
      return;
    }
    if (selectedDayName === lastEmittedNameRef.current) return;
    lastEmittedNameRef.current = selectedDayName;
    scrollToDayName(selectedDayName, true);
  }, [layouts, scrollToDayName, selectedDayName, viewportWidth]);

  const emitDay = useCallback(
    (dayName: string, source: 'scroll' | 'tap') => {
      if (dayName === lastEmittedNameRef.current) return;
      lastEmittedNameRef.current = dayName;
      if (__DEV__) {
        devLog('planner-day-scroller', { action: 'select', dayName, source });
      }
      if (source === 'scroll') {
        hapticSelection();
      }
      onSelectDayName(dayName);
    },
    [onSelectDayName],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (Date.now() < programmaticUntilRef.current) return;
      if (layouts.length === 0 || viewportWidth <= 0) return;
      const index = nearestCenteredIndex(event.nativeEvent.contentOffset.x, layouts, viewportWidth);
      const dayName = days[index];
      if (dayName) emitDay(dayName, 'scroll');
    },
    [days, emitDay, layouts, viewportWidth],
  );

  const handleChipPress = useCallback(
    (dayName: string) => {
      emitDay(dayName, 'tap');
      scrollToDayName(dayName, true);
    },
    [emitDay, scrollToDayName],
  );

  return (
    <View
      style={styles.root}
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        if (nextWidth > 0 && Math.abs(nextWidth - viewportWidth) > 1) {
          setViewportWidth(nextWidth);
        }
      }}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToOffsets={snapOffsets.length > 0 ? snapOffsets : undefined}
        snapToAlignment="start"
        disableIntervalMomentum
        nestedScrollEnabled
        directionalLockEnabled
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.row}
      >
        <View style={{ width: padding.left }} />
        {days.map((weekday, index) => (
          <View
            key={weekday}
            style={index === 0 ? undefined : styles.chipOffset}
            onLayout={(event) => {
              const width = event.nativeEvent.layout.width;
              if (width <= 0) return;
              setChipWidths((prev) => {
                if (prev[index] === width) return prev;
                const next = [...prev];
                next[index] = width;
                return next;
              });
            }}
          >
            <Chip
              label={weekday}
              selected={selectedDayName === weekday}
              onPress={() => handleChipPress(weekday)}
            />
          </View>
        ))}
        <View style={{ width: padding.right }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  chipOffset: {
    marginLeft: CHIP_GAP,
  },
});
