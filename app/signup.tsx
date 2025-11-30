import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView, Image } from 'react-native';
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

  const safeBack = () => {
    try {
      if (router.canGoBack && typeof router.canGoBack === 'function' && router.canGoBack()) {
        router.back();
      } else {
        router.push('/');
      }
    } catch (error) {
      router.push('/');
    }
  };

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
      <Image 
        source={require('../assets/splash-icon.png')} 
        style={styles.logo}
      />
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
      
      <TouchableOpacity style={styles.buttonSecondary} onPress={safeBack}>
        <Text style={styles.buttonTextSecondary}>Back to Login</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' }, // zinc-950
  contentContainer: { padding: 24, paddingTop: 60, paddingBottom: 40 },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 24,
    alignSelf: 'center',
    marginBottom: 32,
  },
  title: { fontSize: 32, fontWeight: '700', color: '#ffffff', textAlign: 'center', marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { color: '#a1a1aa', textAlign: 'center', marginBottom: 40, fontSize: 14 }, // zinc-400
  input: { backgroundColor: 'rgba(24, 24, 27, 0.9)', color: '#ffffff', padding: 18, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#27272a', justifyContent: 'center', fontSize: 16 }, // zinc-900/90, zinc-800
  buttonPrimary: { backgroundColor: '#a3e635', padding: 18, borderRadius: 24, marginBottom: 16, alignItems: 'center', justifyContent: 'center', minHeight: 56 }, // lime-400, rounded-3xl
  buttonSecondary: { borderWidth: 1, borderColor: '#a3e635', backgroundColor: 'rgba(163, 230, 53, 0.1)', padding: 18, borderRadius: 24 }, // lime-400, rounded-3xl
  buttonText: { color: '#09090b', textAlign: 'center', fontWeight: '700', fontSize: 18, letterSpacing: 0.5 }, // zinc-950
  buttonTextSecondary: { color: '#a3e635', textAlign: 'center', fontWeight: '700', fontSize: 18, letterSpacing: 0.5 }, // lime-400
  errorContainer: { backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#ef4444' }, // red-500/10
  errorText: { color: '#fca5a5', textAlign: 'center', fontWeight: '600', fontSize: 14 }, // red-300
});