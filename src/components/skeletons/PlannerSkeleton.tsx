import React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SkeletonLoader } from '../SkeletonLoader';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const PlannerSkeleton = () => {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <SkeletonLoader width={180} height={32} borderRadius={4} />
      </View>
      
      <View style={styles.weekHeader}>
        <SkeletonLoader width={24} height={24} borderRadius={4} />
        <View style={styles.weekTitleContainer}>
          <SkeletonLoader width={200} height={18} borderRadius={4} style={{ marginBottom: 4 }} />
          <SkeletonLoader width={60} height={12} borderRadius={4} />
        </View>
        <SkeletonLoader width={24} height={24} borderRadius={4} />
      </View>
      
      <FlatList
        data={DAYS_OF_WEEK}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.listContainer}
        renderItem={() => (
          <View style={styles.dayCard}>
            <View style={styles.dayCardHeader}>
              <View>
                <SkeletonLoader width={120} height={20} borderRadius={4} style={{ marginBottom: 4 }} />
                <SkeletonLoader width={80} height={14} borderRadius={4} />
              </View>
            </View>
            <SkeletonLoader width={100} height={14} borderRadius={4} style={{ marginTop: 8 }} />
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  header: {
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a', // zinc-800
    backgroundColor: '#09090b', // zinc-950
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a', // zinc-800
  },
  weekTitleContainer: {
    alignItems: 'center',
  },
  listContainer: {
    padding: 24,
    paddingTop: 16,
    paddingBottom: 120,
  },
  dayCard: {
    backgroundColor: 'rgba(24, 24, 27, 0.9)',
    padding: 24,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  dayCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
});

