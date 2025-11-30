import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonLoader } from '../SkeletonLoader';

export const ProgressSkeleton = () => {
  return (
    <>
      {/* Week View Skeleton */}
      <View style={styles.content}>
        <View style={styles.weekHeader}>
          <SkeletonLoader width={24} height={24} borderRadius={12} />
          <View style={styles.weekTitleContainer}>
            <SkeletonLoader width={120} height={18} borderRadius={4} style={{ marginBottom: 4 }} />
            <SkeletonLoader width={100} height={12} borderRadius={4} />
          </View>
          <SkeletonLoader width={24} height={24} borderRadius={12} />
        </View>

        <View style={styles.weekScrollContent}>
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <View key={i} style={styles.weekDayCard}>
              <View style={styles.weekDayLeft}>
                <View style={styles.weekDayDateContainer}>
                  <SkeletonLoader width={50} height={12} borderRadius={4} style={{ marginBottom: 4 }} />
                  <SkeletonLoader width={40} height={28} borderRadius={4} />
                </View>
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <SkeletonLoader width="60%" height={16} borderRadius={4} style={{ marginBottom: 8 }} />
                  <SkeletonLoader width="40%" height={14} borderRadius={4} />
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  weekTitleContainer: {
    alignItems: 'center',
  },
  weekScrollContent: {
    padding: 16,
    paddingTop: 8,
  },
  weekDayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(24, 24, 27, 0.9)',
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#27272a',
    minHeight: 80,
  },
  weekDayLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  weekDayDateContainer: {
    alignItems: 'center',
    minWidth: 50,
  },
});

