import { Tabs } from "expo-router";
import { View, StyleSheet, Platform } from "react-native";
import { Dumbbell, Calendar, TrendingUp, User } from "lucide-react-native";
import { BottomTabBarProps, BottomTabBar } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TabIcon = ({ Icon, focused }: { Icon: any; focused: boolean }) => {
  return (
    <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
      <Icon 
        size={24} 
        color={focused ? '#a3e635' : '#a1a1aa'} // lime-400 when active, zinc-400 when inactive
      />
    </View>
  );
};

const CustomTabBar = (props: BottomTabBarProps) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.tabBarWrapper, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.tabBarCapsule}>
        <BottomTabBar {...props} />
      </View>
    </View>
  );
};

export default function TabLayout() {
  return (
    <Tabs 
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ 
        tabBarActiveTintColor: '#a3e635', // lime-400
        tabBarInactiveTintColor: '#a1a1aa', // zinc-400
        tabBarStyle: { 
          backgroundColor: 'transparent', // Transparent so capsule shows
          height: 72,
          paddingBottom: 16,
          paddingTop: 12,
          borderTopWidth: 0,
          borderBottomWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: "Workout", 
          tabBarIcon: ({ focused }) => <TabIcon Icon={Dumbbell} focused={focused} />,
          headerShown: false,
        }} 
      />
      <Tabs.Screen 
        name="planner" 
        options={{ 
          title: "Plan", 
          tabBarIcon: ({ focused }) => <TabIcon Icon={Calendar} focused={focused} />
        }} 
      />
      <Tabs.Screen 
        name="progress" 
        options={{ 
          title: "Progress", 
          tabBarIcon: ({ focused }) => <TabIcon Icon={TrendingUp} focused={focused} />
        }} 
      />
      <Tabs.Screen 
        name="profile" 
        options={{ 
          title: "Profile", 
          tabBarIcon: ({ focused }) => <TabIcon Icon={User} focused={focused} />
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
  },
  iconContainerActive: {
    backgroundColor: '#27272a', // zinc-800 - darker background for active icon
  },
  tabBarWrapper: {
    position: Platform.OS === 'web' ? 'relative' as const : 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    zIndex: 1000,
    pointerEvents: 'box-none', // Allow touches to pass through to content below
  },
  tabBarCapsule: {
    backgroundColor: '#18181b', // zinc-900 - capsule background
    borderRadius: 36, // Full capsule shape
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
});