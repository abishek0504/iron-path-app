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
    backgroundColor: '#09090b', // zinc-950
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
    fontWeight: '700',
    color: '#a3e635', // lime-400
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 18,
    color: '#a1a1aa', // zinc-400
    textAlign: 'center',
    marginBottom: 48,
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
});
