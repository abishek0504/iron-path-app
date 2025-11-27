import { Tabs } from "expo-router";
import { Dumbbell, Calendar, User } from "lucide-react-native";

export default function TabLayout() {
  return (
    <Tabs 
      screenOptions={{ 
        tabBarActiveTintColor: '#3b82f6', // Blue-500
        tabBarStyle: { backgroundColor: '#111827', borderTopColor: '#374151' }, // Gray-900
        headerShown: false 
      }}
    >
      <Tabs.Screen 
        name="home" 
        options={{ 
          title: "Workout", 
          tabBarIcon: ({ color }) => <Dumbbell size={24} color={color} /> 
        }} 
      />
      <Tabs.Screen 
        name="planner" 
        options={{ 
          title: "Plan", 
          tabBarIcon: ({ color }) => <Calendar size={24} color={color} /> 
        }} 
      />
      <Tabs.Screen 
        name="profile" 
        options={{ 
          title: "Profile", 
          tabBarIcon: ({ color }) => <User size={24} color={color} /> 
        }} 
      />
    </Tabs>
  );
}