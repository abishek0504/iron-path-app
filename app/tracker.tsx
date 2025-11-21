import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';

export default function TrackerScreen() {
  const { exercise } = useLocalSearchParams();
  const router = useRouter();
  
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const logSet = async () => {
    if (!weight || !reps) {
      Alert.alert("Missing Data", "Please enter both weight and reps.");
      return;
    }

    setIsSubmitting(true);

    // 1. GET CURRENT USER
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      Alert.alert("Error", "You must be logged in to save data.");
      setIsSubmitting(false);
      router.replace('/'); // Kick them back to login if session expired
      return;
    }

    try {
      // 2. INSERT DATA WITH USER_ID
      const { error } = await supabase
        .from('workout_logs')
        .insert([
          { 
            user_id: user.id,
            exercise: exercise,
            weight: Number(weight), 
            reps: Number(reps) 
          }
        ]);

      if (error) {
        Alert.alert("Error", error.message);
      } else {
        Alert.alert("Success", "Set logged!");
        setWeight('');
        setReps('');
      }
    } catch (err) {
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-gray-900 p-6 justify-center"
    >
      <Text className="text-3xl font-bold text-white mb-2">{exercise}</Text>
      <Text className="text-gray-400 mb-8">Log your working set</Text>

      <View className="flex-row justify-between mb-6">
        <View className="w-[48%]">
          <Text className="text-gray-400 mb-2">Weight (lbs)</Text>
          <TextInput 
            className="bg-gray-800 text-white p-4 rounded-lg text-xl text-center border border-gray-700"
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="#555"
            value={weight}
            onChangeText={setWeight}
          />
        </View>

        <View className="w-[48%]">
          <Text className="text-gray-400 mb-2">Reps</Text>
          <TextInput 
            className="bg-gray-800 text-white p-4 rounded-lg text-xl text-center border border-gray-700"
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="#555"
            value={reps}
            onChangeText={setReps}
          />
        </View>
      </View>

      <TouchableOpacity 
        className={`p-4 rounded-lg mb-4 ${isSubmitting ? 'bg-blue-800' : 'bg-blue-600'}`}
        onPress={logSet}
        disabled={isSubmitting}
      >
        <Text className="text-white text-center font-bold text-lg">
          {isSubmitting ? 'Saving...' : 'Log Set'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity 
        onPress={() => router.back()}
        className="p-4"
      >
        <Text className="text-gray-500 text-center text-lg">Cancel</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}