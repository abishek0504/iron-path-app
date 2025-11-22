import { useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search, LogOut } from 'lucide-react-native';
import { masterExerciseList } from '../../src/data/exercises';
import { supabase } from '../../src/lib/supabase';

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const filteredExercises = masterExerciseList.filter((exercise) =>
    exercise.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectExercise = (exercise: string) => {
    router.push({
      pathname: '/tracker',
      params: { exercise },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-900">
      <View className="flex-1 p-4">
        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-3xl font-bold text-blue-400">Exercise Selector</Text>
          <TouchableOpacity onPress={handleLogout}>
             <LogOut color="#ef4444" size={24} />
          </TouchableOpacity>
        </View>
        
        {/* Search Bar */}
        <View className="flex-row items-center bg-gray-800 rounded-lg px-4 py-3 mb-4 border border-gray-700">
          <Search size={20} color="#9ca3af" />
          <TextInput
            className="flex-1 ml-3 text-white text-base"
            placeholder="Search exercises..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
        </View>

        {/* Exercise List */}
        <FlatList
          data={filteredExercises}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              className="bg-black p-4 rounded-lg mb-3 active:bg-gray-900 border border-gray-800"
              onPress={() => handleSelectExercise(item)}
            >
              <Text className="text-white text-lg font-medium">{item}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={() => (
            <Text className="text-gray-500 text-center mt-10">
              No exercises found matching "{searchQuery}"
            </Text>
          )}
          contentContainerClassName="pb-20"
        />
      </View>
    </SafeAreaView>
  );
}