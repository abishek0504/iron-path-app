import { View, Text, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function TrackerScreen() {
  const { exercise } = useLocalSearchParams();
  const router = useRouter();

  return (
    <View className="flex-1 items-center justify-center bg-gray-900">
      <Text className="text-2xl font-bold text-white">{exercise}</Text>
      <Text className="text-gray-400 mt-4">Tracker Placeholder</Text>
      
      <TouchableOpacity 
        className="mt-8 bg-red-600 px-6 py-3 rounded-lg active:bg-red-700"
        onPress={() => router.back()}
      >
        <Text className="text-white font-bold text-lg">Back</Text>
      </TouchableOpacity>
    </View>
  );
}
