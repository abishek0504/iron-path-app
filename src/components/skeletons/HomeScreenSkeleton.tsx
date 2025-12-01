import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SkeletonLoader } from '../SkeletonLoader';

export const HomeScreenSkeleton = () => {
  return (
    <SafeAreaView style={styles.container}>
      {/* Background Ambient Glows */}
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <View style={styles.scrollView}>
        <View style={styles.scrollContent}>
          {/* Header Skeleton */}
          <View style={styles.header}>
            <View>
              <SkeletonLoader width={120} height={12} borderRadius={4} style={{ marginBottom: 8 }} />
              <SkeletonLoader width={200} height={24} borderRadius={4} />
            </View>
            <SkeletonLoader width={40} height={40} borderRadius={20} />
          </View>

          {/* Hero Workout Card Skeleton - Matches actual card structure */}
          <View style={styles.workoutCard}>
            <View style={styles.workoutCardContent}>
              {/* Badges */}
              <View style={styles.badgeContainer}>
                <SkeletonLoader width={100} height={28} borderRadius={999} />
                <SkeletonLoader width={120} height={28} borderRadius={999} />
              </View>

              {/* Title */}
              <SkeletonLoader width="80%" height={32} borderRadius={4} style={{ marginBottom: 12 }} />
              
              {/* Subtitle */}
              <SkeletonLoader width="60%" height={16} borderRadius={4} style={{ marginBottom: 24 }} />

              {/* Exercise List with Icons */}
              <View style={styles.exercisesContainer}>
                {[1, 2, 3].map((i) => (
                  <View key={i} style={styles.exerciseItem}>
                    <SkeletonLoader width={24} height={24} borderRadius={12} />
                    <SkeletonLoader width="75%" height={20} borderRadius={4} />
                  </View>
                ))}
                <View style={styles.exerciseItem}>
                  <SkeletonLoader width={24} height={24} borderRadius={12} />
                  <SkeletonLoader width={140} height={16} borderRadius={4} />
                </View>
              </View>
            </View>
          </View>

          {/* Circular Button Skeleton */}
          <View style={styles.buttonContainer}>
            <View style={styles.circularButtonWrapper}>
              {/* Gradient border skeleton */}
              <SkeletonLoader width={164} height={164} borderRadius={82} style={styles.gradientBorderSkeleton} />
              {/* Main button skeleton */}
              <View style={styles.circularButtonSkeleton}>
                <SkeletonLoader width={140} height={140} borderRadius={70} style={styles.circularButtonInnerSkeleton} />
              </View>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b', // zinc-950
  },
  glowTop: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: 500,
    height: 500,
    backgroundColor: '#84cc16', // lime-500
    opacity: 0.1,
    borderRadius: 250,
  },
  glowBottom: {
    position: 'absolute',
    bottom: -100,
    right: -100,
    width: 400,
    height: 400,
    backgroundColor: '#06b6d4', // cyan-500
    opacity: 0.1,
    borderRadius: 200,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  workoutCard: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(39, 39, 42, 0.5)',
  },
  workoutCardContent: {
    backgroundColor: 'rgba(24, 24, 27, 0.9)',
    padding: 32,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  exercisesContainer: {
    marginBottom: 24,
    gap: 12,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  buttonContainer: {
    alignItems: 'center',
    marginTop: 48,
  },
  circularButtonWrapper: {
    width: 164,
    height: 164,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gradientBorderSkeleton: {
    position: 'absolute',
  },
  circularButtonSkeleton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circularButtonInnerSkeleton: {
    backgroundColor: 'rgba(24, 24, 27, 0.9)',
  },
});

