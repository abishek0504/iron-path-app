import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SkeletonLoader } from '../SkeletonLoader';

export const OnboardingSkeleton = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Title Skeleton */}
        <SkeletonLoader width={200} height={32} borderRadius={4} style={styles.title} />
        
        {/* Subtitle Skeleton */}
        <SkeletonLoader width={280} height={16} borderRadius={4} style={styles.subtitle} />

        {/* Form Fields Skeleton */}
        <View style={styles.formSection}>
          {/* Age Input */}
          <SkeletonLoader width={80} height={14} borderRadius={4} style={styles.label} />
          <SkeletonLoader width="100%" height={56} borderRadius={16} style={styles.input} />

          {/* Gender Selector */}
          <SkeletonLoader width={80} height={14} borderRadius={4} style={styles.label} />
          <SkeletonLoader width="100%" height={56} borderRadius={16} style={styles.input} />

          {/* Weight Input */}
          <SkeletonLoader width={100} height={14} borderRadius={4} style={styles.label} />
          <SkeletonLoader width="100%" height={56} borderRadius={16} style={styles.input} />

          {/* Height Inputs (Side by side) */}
          <SkeletonLoader width={80} height={14} borderRadius={4} style={styles.label} />
          <View style={styles.rowInputs}>
            <SkeletonLoader width="48%" height={56} borderRadius={16} />
            <SkeletonLoader width="48%" height={56} borderRadius={16} />
          </View>

          {/* Goal Selector */}
          <SkeletonLoader width={100} height={14} borderRadius={4} style={styles.label} />
          <SkeletonLoader width="100%" height={56} borderRadius={16} style={styles.input} />

          {/* Days Slider */}
          <SkeletonLoader width={120} height={14} borderRadius={4} style={styles.label} />
          <SkeletonLoader width="100%" height={40} borderRadius={8} style={styles.slider} />
          <SkeletonLoader width={40} height={20} borderRadius={4} style={styles.sliderValue} />
        </View>

        {/* Continue Button Skeleton */}
        <SkeletonLoader width="100%" height={56} borderRadius={24} style={styles.button} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },
  title: {
    alignSelf: 'center',
    marginBottom: 8,
  },
  subtitle: {
    alignSelf: 'center',
    marginBottom: 32,
  },
  formSection: {
    marginBottom: 32,
  },
  label: {
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    marginBottom: 8,
  },
  rowInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  slider: {
    marginBottom: 8,
  },
  sliderValue: {
    alignSelf: 'center',
  },
  button: {
    marginTop: 8,
  },
});

