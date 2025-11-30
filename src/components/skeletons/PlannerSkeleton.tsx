import React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SkeletonLoader } from '../SkeletonLoader';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const PlannerSkeleton = () => {
  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={DAYS_OF_WEEK}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={
          <View style={styles.header}>
            <SkeletonLoader width={200} height={28} borderRadius={4} style={{ alignSelf: 'center', marginBottom: 8 }} />
            <SkeletonLoader width={150} height={16} borderRadius={4} style={{ alignSelf: 'center', marginBottom: 32 }} />
          </View>
        }
        renderItem={() => (
          <View style={styles.dayCard}>
            <SkeletonLoader width={120} height={20} borderRadius={4} style={{ marginBottom: 8 }} />
            <SkeletonLoader width={100} height={14} borderRadius={4} />
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
  listContainer: {
    padding: 24,
    paddingTop: 48,
    paddingBottom: 120,
  },
  header: {
    marginBottom: 24,
  },
  dayCard: {
    backgroundColor: 'rgba(24, 24, 27, 0.9)',
    padding: 24,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#27272a',
  },
});

