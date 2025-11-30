import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const containerRef = useRef<View>(null);
  const [containerWidth, setContainerWidth] = React.useState(300);

  useEffect(() => {
    // Create a looping slide animation
    const slide = Animated.loop(
      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    slide.start();
    return () => slide.stop();
  }, []);

  // Calculate shimmer width based on container width
  const shimmerWidth = containerWidth + 200; // Make shimmer wider than container for smooth effect
  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-shimmerWidth, shimmerWidth],
  });

  return (
    <View 
      ref={containerRef}
      style={[{ width, height, borderRadius, overflow: 'hidden' }, style]}
      onLayout={(event) => {
        const { width: w } = event.nativeEvent.layout;
        if (w > 0) {
          setContainerWidth(w);
        }
      }}
    >
      {/* Base background */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(24, 24, 27, 0.9)' }]} />
      
      {/* Sliding green shimmer effect */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: shimmerWidth,
            height: '100%',
            transform: [{ translateX }],
          },
        ]}
      >
        {/* Gradient-like effect using multiple layers for smooth transition */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '25%',
            backgroundColor: 'rgba(163, 230, 53, 0.2)', // lime-400 faint
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: '25%',
            top: 0,
            bottom: 0,
            width: '50%',
            backgroundColor: 'rgba(163, 230, 53, 0.6)', // lime-400 bright
          }}
        />
        <View
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: '25%',
            backgroundColor: 'rgba(163, 230, 53, 0.2)', // lime-400 faint
          }}
        />
      </Animated.View>
    </View>
  );
};

interface SkeletonCardProps {
  children?: React.ReactNode;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ children }) => {
  return (
    <View style={styles.card}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    borderRadius: 24, // rounded-3xl
    padding: 24,
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
    marginBottom: 16,
  },
});

