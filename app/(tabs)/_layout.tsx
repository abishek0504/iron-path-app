import { Tabs } from "expo-router";
import { View, StyleSheet, Platform, TouchableOpacity, Text } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { Dumbbell, Calendar, TrendingUp, Trophy } from "lucide-react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, useEffect } from "react";
import { colors, spacing, typography } from "../../src/lib/utils/theme";

const CustomTabBar = (props: BottomTabBarProps) => {
  const insets = useSafeAreaInsets();
  const { state, descriptors, navigation } = props;
  const activeIndex = state.index;
  
  // Animation for the sliding circle indicator
  const circlePosition = useSharedValue(0);
  
  // Store tab button positions
  const [tabLayouts, setTabLayouts] = useState<Array<{ x: number; width: number } | null>>([
    null, null, null, null
  ]);
  
  // Update circle position when active tab changes
  useEffect(() => {
    const layout = tabLayouts[activeIndex];
    if (layout && layout.width > 0) {
      // Center the circle on the tab button (circle is 40px, so center it in the tab button)
      const tabCenter = layout.x + layout.width / 2;
      circlePosition.value = withTiming(tabCenter - 20, {
        duration: 300,
      });
    } else if (tabLayouts.some(l => l !== null)) {
      // If current tab layout not ready but others are, set initial position
      const firstLayout = tabLayouts.find(l => l !== null);
      if (firstLayout) {
        const tabCenter = firstLayout.x + firstLayout.width / 2;
        circlePosition.value = tabCenter - 20;
      }
    }
  }, [activeIndex, tabLayouts, circlePosition]);
  
  // Handle tab button layout
  const handleTabLayout = (index: number) => (event: any) => {
    const { x, width } = event.nativeEvent.layout;
    setTabLayouts(prev => {
      const newLayouts = [...prev];
      newLayouts[index] = { x, width };
      return newLayouts;
    });
  };
  
  // Animated style for the sliding circle
  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: circlePosition.value }],
  }));
  
  return (
    <View style={[styles.tabBarWrapper, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <View style={styles.tabBarCapsule}>
        <Animated.View style={[styles.slidingCircle, circleStyle]} />
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;
          
          const isFocused = state.index === index;
          
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };
          
          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };
          
          // Get icon component
          let IconComponent = Dumbbell;
          if (route.name === 'planner') IconComponent = Calendar;
          else if (route.name === 'progress') IconComponent = TrendingUp;
          else if (route.name === 'dashboard') IconComponent = Trophy;
          
          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              onLayout={handleTabLayout(index)}
              style={styles.tabButton}
              activeOpacity={0.7}
            >
              <View style={styles.iconContainer}>
                <IconComponent 
                  size={24} 
                  color={isFocused ? colors.primary : colors.textSecondary}
                />
              </View>
              <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export default function TabLayout() {
  return (
    <Tabs 
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ 
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { 
          backgroundColor: 'transparent',
          height: 72,
          paddingBottom: spacing.md,
          paddingTop: 12,
          borderTopWidth: 0,
          borderBottomWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.medium,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: "Workout", 
          headerShown: false,
        }} 
      />
      <Tabs.Screen 
        name="planner" 
        options={{ 
          title: "Plan",
        }} 
      />
      <Tabs.Screen 
        name="progress" 
        options={{ 
          title: "Progress",
        }} 
      />
      <Tabs.Screen 
        name="dashboard" 
        options={{ 
          title: "Dashboard",
        }} 
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  slidingCircle: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardBorder,
    top: 12,
    left: 0,
  },
  tabBarWrapper: {
    position: Platform.OS === 'web' ? 'relative' as const : 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Platform.OS === 'web' ? colors.background : 'transparent',
    paddingHorizontal: spacing.md,
    zIndex: 1000,
    pointerEvents: 'box-none',
  },
  tabBarCapsule: {
    backgroundColor: '#18181b', // zinc-900 - solid for capsule (not rgba)
    borderRadius: 36,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    flexDirection: 'row',
    position: 'relative',
    padding: spacing.xs,
    gap: spacing.xs,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    zIndex: 1,
    minHeight: 60,
  },
  tabLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  tabLabelActive: {
    color: colors.textPrimary,
    fontWeight: typography.weights.semibold,
  },
});
