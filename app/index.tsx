import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const router = useRouter();

  useEffect(() => {
    console.log("Checking session...");
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("Session check complete. User:", session?.user?.email);
      if (session) {
        router.replace('/(tabs)/home');
      }
      setIsCheckingSession(false);
    }).catch(err => {
      console.error("Session Check Error:", err);
      setIsCheckingSession(false);
    });
  }, []);

  const signIn = async () => {
    setErrorMessage('');
    if (!email || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setErrorMessage(error.message);
      else router.replace('/(tabs)/home');
    } catch (err: any) {
      setErrorMessage(err.message || "Network failed");
    }
    setLoading(false);
  };

  const signUp = async () => {
    setErrorMessage('');
    if (!email || !password) return setErrorMessage("Fill in all fields");
    if (password.length < 6) return setErrorMessage("Password too short (min 6 chars)");
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setErrorMessage(error.message);
      else setErrorMessage("Success! Check your email.");
    } catch (err: any) {
      setErrorMessage(err.message || "Network failed");
    }
    setLoading(false);
  };

  if (isCheckingSession) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.text}>Loading IronPath...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>IronPath</Text>
      <Text style={styles.subtitle}>Track your progress. Build your path.</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#999"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#999"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {/* ERROR MESSAGE AREA */}
      {errorMessage ? (
        <View style={styles.errorContainer}>
           <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <TouchableOpacity style={styles.buttonPrimary} onPress={signIn} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Loading..." : "Sign In"}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.buttonSecondary} onPress={signUp} disabled={loading}>
        <Text style={styles.buttonTextSecondary}>Create Account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827', // Dark Gray
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3b82f6', // Blue
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#9ca3af', // Gray
    textAlign: 'center',
    marginBottom: 32,
  },
  text: {
    color: 'white',
    marginTop: 10,
  },
  input: {
    backgroundColor: '#1f2937', // Darker Gray
    color: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  buttonPrimary: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: '#2563eb',
    padding: 16,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 18,
  },
  buttonTextSecondary: {
    color: '#60a5fa',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 18,
  },
  errorContainer: {
    backgroundColor: 'rgba(127, 29, 29, 0.5)',
    padding: 12,
    borderRadius: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  errorText: {
    color: '#fecaca',
    textAlign: 'center',
    fontWeight: 'bold',
  }
});