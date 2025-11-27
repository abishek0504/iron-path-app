import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Image 
          source={require('../assets/splash-icon.png')} 
          style={styles.logo}
        />
        <Text style={styles.title}>IronPath</Text>
        <Text style={styles.subtitle}>Track your progress. Build your path.</Text>
        
        <TouchableOpacity 
          style={styles.buttonPrimary}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.buttonText}>Sign In</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.buttonSecondary}
          onPress={() => router.push('/signup')}
        >
          <Text style={styles.buttonTextSecondary}>Create Account</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 24,
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#3b82f6',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 48,
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
});
