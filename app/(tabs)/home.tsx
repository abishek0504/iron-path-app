import { useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
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
    <SafeAreaView style={styles.container}>
      <FlatList
        data={filteredExercises}
        keyExtractor={(item) => item}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Exercise Selector</Text>
              <TouchableOpacity onPress={handleLogout}>
                <LogOut color="#ef4444" size={24} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.searchContainer}>
              <Search size={20} color="#9ca3af" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search exercises..."
                placeholderTextColor="#9ca3af"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
            </View>
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.exerciseItem}
            onPress={() => handleSelectExercise(item)}
          >
            <Text style={styles.exerciseText}>{item}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <Text style={styles.emptyText}>
            No exercises found matching "{searchQuery}"
          </Text>
        )}
        contentContainerStyle={styles.listContainer}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingTop: 60, paddingHorizontal: 24 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#3b82f6' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f2937', borderRadius: 8, padding: 16, marginBottom: 16, marginHorizontal: 24, borderWidth: 1, borderColor: '#374151' },
  searchInput: { flex: 1, marginLeft: 12, color: 'white', fontSize: 16 },
  exerciseItem: { backgroundColor: '#1f2937', padding: 16, borderRadius: 8, marginBottom: 12, marginHorizontal: 24, borderWidth: 1, borderColor: '#374151' },
  exerciseText: { color: 'white', fontSize: 18, fontWeight: '500' },
  emptyText: { color: '#9ca3af', textAlign: 'center', marginTop: 40 },
  listContainer: { paddingBottom: 20 },
});