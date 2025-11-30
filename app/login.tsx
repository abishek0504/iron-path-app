import { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { LoginSkeleton } from '../src/components/skeletons/LoginSkeleton';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/(tabs)');
      }
      setIsCheckingSession(false);
    }).catch(() => {
      setIsCheckingSession(false);
    });
  }, []);

  // Also check on focus (e.g., when swiping back to this screen)
  useFocusEffect(
    useCallback(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          router.replace('/(tabs)');
        }
      });
    }, [router])
  );

  const signIn = async () => {
    setErrorMessage('');
    if (!email || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
      } else {
        router.replace('/(tabs)');
        setLoading(false);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Network failed");
      setLoading(false);
    }
  };

  if (isCheckingSession) {
    return <LoginSkeleton />;
  }

  return (
    <View style={styles.container}>
      <Image 
        source={require('../assets/splash-icon.png')} 
        style={styles.logo}
      />
      <Text style={styles.title}>IronPath</Text>
      <Text style={styles.subtitle}>Track your progress. Build your path.</Text>
      
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

      {errorMessage ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <TouchableOpacity style={styles.buttonPrimary} onPress={signIn} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Loading..." : "Sign In"}</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.buttonSecondary} 
        onPress={() => router.push('/signup')}
        disabled={loading}
      >
        <Text style={styles.buttonTextSecondary}>Create Account</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => router.push('/')}
        disabled={loading}
      >
        <Text style={styles.backButtonText}>Back to Welcome</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b', // zinc-950
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 24,
    alignSelf: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#a1a1aa', // zinc-400
    textAlign: 'center',
    marginBottom: 40,
    fontSize: 14,
  },
  text: {
    color: '#ffffff',
    marginTop: 16,
    fontSize: 14,
  },
  input: {
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    color: '#ffffff',
    padding: 18,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
    fontSize: 16,
  },
  buttonPrimary: {
    backgroundColor: '#a3e635', // lime-400
    padding: 18,
    borderRadius: 24, // rounded-3xl
    marginBottom: 16,
  },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: '#a3e635', // lime-400
    backgroundColor: 'rgba(163, 230, 53, 0.1)', // lime-400/10
    padding: 18,
    borderRadius: 24, // rounded-3xl
  },
  buttonText: {
    color: '#09090b', // zinc-950
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 0.5,
  },
  buttonTextSecondary: {
    color: '#a3e635', // lime-400
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 0.5,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)', // red-500/10
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  errorText: {
    color: '#fca5a5', // red-300
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 14,
  },
  backButton: {
    marginTop: 16,
    padding: 12,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#a1a1aa', // zinc-400
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 14,
  },
});

