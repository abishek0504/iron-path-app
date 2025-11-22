import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const router = useRouter();

  const validatePasswords = (): boolean => {
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return false;
    }
    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return false;
    }
    return true;
  };

  const signUp = async () => {
    setErrorMessage('');
    
    if (!name || !email || !password || !confirmPassword) {
      setErrorMessage("Please fill in all fields.");
      return;
    }

    if (!validatePasswords()) return;
    
    setLoading(true);
    
    try {
      // 1. Create Auth User
      const { data: authData, error: authError } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: { full_name: name } // Save name to metadata as backup
        }
      });
      
      if (authError) throw authError;
      if (!authData.user) throw new Error("No user created");

      // 2. Update the Profile Row (Created automatically by our SQL Trigger)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: name,
          // We leave age/gender/weight/height/goal for the Onboarding screen
        })
        .eq('id', authData.user.id);

      if (profileError) throw profileError;

      router.replace('/signup-success');
    } catch (err: any) {
      console.error('Signup error:', err);
      setErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Join IronPath</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Full Name"
        placeholderTextColor="#999"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />
      
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#999"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#999"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      
      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        placeholderTextColor="#999"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />

      {errorMessage ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <TouchableOpacity style={styles.buttonPrimary} onPress={signUp} disabled={loading}>
        {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Create Account</Text>}
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.buttonSecondary} onPress={() => router.back()}>
        <Text style={styles.buttonTextSecondary}>Back to Login</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  contentContainer: { padding: 24, paddingTop: 60 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#3b82f6', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: '#9ca3af', textAlign: 'center', marginBottom: 32 },
  input: { backgroundColor: '#1f2937', color: 'white', padding: 16, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#374151', justifyContent: 'center' },
  buttonPrimary: { backgroundColor: '#2563eb', padding: 16, borderRadius: 8, marginBottom: 16, alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  buttonSecondary: { borderWidth: 1, borderColor: '#2563eb', padding: 16, borderRadius: 8 },
  buttonText: { color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 18 },
  buttonTextSecondary: { color: '#60a5fa', textAlign: 'center', fontWeight: 'bold', fontSize: 16 },
  errorContainer: { backgroundColor: 'rgba(127, 29, 29, 0.5)', padding: 12, borderRadius: 4, marginBottom: 16, borderWidth: 1, borderColor: '#ef4444' },
  errorText: { color: '#fecaca', textAlign: 'center', fontWeight: 'bold' },
});