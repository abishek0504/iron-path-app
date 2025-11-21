import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const router = useRouter();

  // 1. Check if user is already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/(tabs)/home'); // Skip login if already authenticated
      }
      setIsCheckingSession(false);
    });
  }, []);

  // 2. Login Logic
  const signIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) Alert.alert("Login Failed", error.message);
    else router.replace('/(tabs)/home');
    setLoading(false);
  };

  // 3. Sign Up Logic
  const signUp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) Alert.alert("Error", error.message);
    else Alert.alert("Success", "Check your email for the verification link!");
    setLoading(false);
  };

  if (isCheckingSession) {
    return (
      <View className="flex-1 bg-gray-900 justify-center items-center">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-900 justify-center px-6">
      <Text className="text-4xl font-bold text-blue-500 mb-2 text-center">IronPath</Text>
      <Text className="text-gray-400 mb-8 text-center">Track your progress. Build your path.</Text>
      
      <TextInput
        className="bg-gray-800 text-white p-4 rounded-lg mb-4 border border-gray-700"
        placeholder="Email"
        placeholderTextColor="#666"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      
      <TextInput
        className="bg-gray-800 text-white p-4 rounded-lg mb-8 border border-gray-700"
        placeholder="Password"
        placeholderTextColor="#666"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity 
        className="bg-blue-600 p-4 rounded-lg mb-4"
        onPress={signIn}
        disabled={loading}
      >
        <Text className="text-white text-center font-bold text-lg">
          {loading ? "Loading..." : "Sign In"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity 
        className="border border-blue-600 p-4 rounded-lg"
        onPress={signUp}
        disabled={loading}
      >
        <Text className="text-blue-400 text-center font-bold text-lg">Create Account</Text>
      </TouchableOpacity>
    </View>
  );
}