import React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SkeletonLoader } from '../SkeletonLoader';

interface PlannerDaySkeletonProps {
  exerciseCount?: number;
}

export const PlannerDaySkeleton = ({ exerciseCount }: PlannerDaySkeletonProps) => {
  // Use provided exercise count, or default to 2-3 cards
  const skeletonCount = exerciseCount !== undefined && exerciseCount > 0 
    ? exerciseCount 
    : 3;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Section */}
      <View style={styles.headerSection}>
        <View style={styles.header}>
          <SkeletonLoader width={24} height={24} borderRadius={4} />
          <SkeletonLoader width={120} height={28} borderRadius={4} />
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.exercisesHeader}>
          <SkeletonLoader width={150} height={20} borderRadius={4} />
          <SkeletonLoader width={80} height={36} borderRadius={18} />
        </View>
      </View>

      {/* Exercise Cards Skeleton */}
      <FlatList
        data={Array.from({ length: skeletonCount }, (_, i) => i)}
        keyExtractor={(item) => `skeleton-${item}`}
        contentContainerStyle={styles.listContent}
        renderItem={() => (
          <View style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              {/* Drag handle */}
              <SkeletonLoader width={22} height={22} borderRadius={4} />
              
              {/* Exercise name */}
              <View style={styles.exerciseNameContainer}>
                <SkeletonLoader width={180} height={20} borderRadius={4} />
              </View>
              
              {/* Action buttons */}
              <View style={styles.exerciseHeaderActions}>
                <SkeletonLoader width={18} height={18} borderRadius={4} />
                <SkeletonLoader width={20} height={20} borderRadius={4} />
              </View>
            </View>
            
            {/* Exercise details */}
            <View style={styles.exerciseRow}>
              <View style={styles.exerciseField}>
                <SkeletonLoader width={40} height={12} borderRadius={4} style={{ marginBottom: 4 }} />
                <SkeletonLoader width={60} height={16} borderRadius={4} />
              </View>
              <View style={styles.exerciseField}>
                <SkeletonLoader width={50} height={12} borderRadius={4} style={{ marginBottom: 4 }} />
                <SkeletonLoader width={60} height={16} borderRadius={4} />
              </View>
              <View style={styles.exerciseField}>
                <SkeletonLoader width={60} height={12} borderRadius={4} style={{ marginBottom: 4 }} />
                <SkeletonLoader width={50} height={16} borderRadius={4} />
              </View>
            </View>
          </View>
        )}
        ListFooterComponent={
          <View style={styles.footerSection}>
            <View style={styles.buttonContainer}>
              <SkeletonLoader width="100%" height={56} borderRadius={24} style={{ marginBottom: 12 }} />
              <SkeletonLoader width="100%" height={56} borderRadius={24} />
            </View>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b', // zinc-950
  },
  headerSection: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    marginBottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerSpacer: {
    width: 40,
  },
  exercisesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 120,
  },
  exerciseCard: {
    backgroundColor: '#18181b', // zinc-900
    borderRadius: 24, // rounded-3xl
    padding: 32,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  exerciseNameContainer: {
    flex: 1,
    marginLeft: 4,
    marginRight: 12,
  },
  exerciseHeaderActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  exerciseRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  exerciseField: {
    flex: 1,
  },
  footerSection: {
    marginTop: 0,
    paddingTop: 24,
    paddingBottom: 24,
  },
  buttonContainer: {
    marginTop: 24,
    marginBottom: 40,
    gap: 12,
  },
});

