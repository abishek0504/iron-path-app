import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native';
import { SkeletonLoader } from '../SkeletonLoader';

export const ProfileSkeleton = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* Header Skeleton */}
        <View style={styles.header}>
          <SkeletonLoader width={120} height={28} borderRadius={4} />
          <SkeletonLoader width={80} height={40} borderRadius={16} />
        </View>

        {/* Profile Picture Container Skeleton */}
        <View style={styles.profilePictureContainer}>
          <SkeletonLoader width={150} height={150} borderRadius={75} />
        </View>

        {/* Info Cards Skeleton - Matches actual card layout */}
        <View style={styles.infoSection}>
          {['Name', 'Age', 'Weight', 'Goal Weight', 'Height', 'Gender', 'Goal', 'Days'].map((label, i) => (
            <View key={i} style={styles.infoCard}>
              <SkeletonLoader width={120} height={12} borderRadius={4} style={{ marginBottom: 12 }} />
              <SkeletonLoader width="70%" height={20} borderRadius={4} />
            </View>
          ))}
        </View>

        {/* Sign Out Button Skeleton */}
        <SkeletonLoader width="100%" height={56} borderRadius={24} style={{ marginTop: 8 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  profilePictureContainer: {
    alignItems: 'center',
    marginBottom: 32,
    paddingVertical: 32,
    backgroundColor: 'rgba(24, 24, 27, 0.9)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  infoSection: {
    gap: 16,
    marginBottom: 32,
  },
  infoCard: {
    backgroundColor: 'rgba(24, 24, 27, 0.9)',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#27272a',
  },
});

