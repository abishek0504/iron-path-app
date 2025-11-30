import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SkeletonLoader } from '../SkeletonLoader';

export const WorkoutActiveSkeleton = () => {
  return (
    <SafeAreaView style={styles.container}>
      {/* Header Skeleton */}
      <View style={styles.header}>
        <SkeletonLoader width={180} height={28} borderRadius={4} />
        <SkeletonLoader width={24} height={24} borderRadius={12} />
      </View>

      {/* Progress Bar Skeleton */}
      <View style={styles.progressBar}>
        <SkeletonLoader width={120} height={14} borderRadius={4} style={{ marginBottom: 8 }} />
        <SkeletonLoader width="100%" height={8} borderRadius={4} />
      </View>

      {/* Exercise Container Skeleton */}
      <View style={styles.exerciseContainer}>
        {/* Exercise Name */}
        <SkeletonLoader width="80%" height={32} borderRadius={4} style={{ marginBottom: 12 }} />
        
        {/* Set Number */}
        <SkeletonLoader width={120} height={18} borderRadius={4} style={{ marginBottom: 24 }} />

        {/* Info Card Skeleton */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <SkeletonLoader width={60} height={16} borderRadius={4} />
            <SkeletonLoader width={100} height={16} borderRadius={4} />
          </View>
          <View style={styles.infoRow}>
            <SkeletonLoader width={60} height={16} borderRadius={4} />
            <SkeletonLoader width={80} height={16} borderRadius={4} />
          </View>
          <View style={styles.infoRow}>
            <SkeletonLoader width={60} height={16} borderRadius={4} />
            <SkeletonLoader width={70} height={16} borderRadius={4} />
          </View>
        </View>

        {/* Instructions Card Skeleton */}
        <View style={styles.infoCard}>
          <SkeletonLoader width={100} height={16} borderRadius={4} style={{ marginBottom: 12 }} />
          <SkeletonLoader width="100%" height={14} borderRadius={4} style={{ marginBottom: 8 }} />
          <SkeletonLoader width="90%" height={14} borderRadius={4} style={{ marginBottom: 8 }} />
          <SkeletonLoader width="85%" height={14} borderRadius={4} />
        </View>

        {/* Action Button Skeleton */}
        <SkeletonLoader width="100%" height={56} borderRadius={24} style={{ marginTop: 'auto', marginTop: 24 }} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 48,
  },
  progressBar: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  exerciseContainer: {
    flex: 1,
    padding: 24,
  },
  infoCard: {
    backgroundColor: 'rgba(24, 24, 27, 0.9)',
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#27272a',
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

