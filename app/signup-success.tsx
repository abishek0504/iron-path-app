import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle } from 'lucide-react-native';

export default function SignupSuccessScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <CheckCircle size={80} color="#a3e635" strokeWidth={2} />
        </View>
        
        <Text style={styles.title}>Thank You for Signing Up!</Text>
        
        <View style={styles.messageCard}>
          <Text style={styles.message}>
            Please check your email to confirm your account before logging in.
          </Text>
          <Text style={styles.subMessage}>
            We've sent a confirmation email to your inbox. Click the link in the email to verify your account.
          </Text>
        </View>
        
        <TouchableOpacity 
          style={styles.button}
          onPress={() => router.replace('/onboarding')}
        >
          <Text style={styles.buttonText}>Continue to Onboarding</Text>
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
    alignItems: 'center',
    padding: 32, // p-8
  },
  iconContainer: {
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff', // white
    textAlign: 'center',
    marginBottom: 32,
    letterSpacing: -0.5,
  },
  messageCard: {
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    borderRadius: 24, // rounded-3xl
    padding: 32, // p-8
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
    marginBottom: 40,
    width: '100%',
    maxWidth: 400,
  },
  message: {
    fontSize: 18,
    color: '#ffffff', // white
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 26,
    fontWeight: '500',
  },
  subMessage: {
    fontSize: 14,
    color: '#a1a1aa', // zinc-400
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#a3e635', // lime-400
    padding: 18,
    borderRadius: 24, // rounded-3xl
    minWidth: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#09090b', // zinc-950
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 0.5,
  },
});

