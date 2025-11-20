import { View, Text } from 'react-native';

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-gray-900">
      <Text className="text-3xl font-bold text-blue-400">IronPath</Text>
      <Text className="text-white mt-2">System Operational.</Text>
    </View>
  );
}
