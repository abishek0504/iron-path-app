import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonLoader } from '../SkeletonLoader';

export const LoginSkeleton = () => {
  return (
    <View style={styles.container}>
      {/* Logo Skeleton */}
      <SkeletonLoader width={120} height={120} borderRadius={24} style={styles.logo} />
      
      {/* Title Skeleton */}
      <SkeletonLoader width={200} height={32} borderRadius={4} style={styles.title} />
      
      {/* Subtitle Skeleton */}
      <SkeletonLoader width={250} height={16} borderRadius={4} style={styles.subtitle} />
      
      {/* Email Input Skeleton */}
      <SkeletonLoader width="100%" height={56} borderRadius={16} style={styles.input} />
      
      {/* Password Input Skeleton */}
      <SkeletonLoader width="100%" height={56} borderRadius={16} style={styles.input} />
      
      {/* Primary Button Skeleton */}
      <SkeletonLoader width="100%" height={56} borderRadius={24} style={styles.button} />
      
      {/* Secondary Button Skeleton */}
      <SkeletonLoader width="100%" height={56} borderRadius={24} style={styles.buttonSecondary} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    alignSelf: 'center',
    marginBottom: 32,
  },
  title: {
    alignSelf: 'center',
    marginBottom: 8,
  },
  subtitle: {
    alignSelf: 'center',
    marginBottom: 40,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginBottom: 16,
  },
  buttonSecondary: {
    marginTop: 0,
  },
});

