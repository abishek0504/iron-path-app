<<<<<<< Updated upstream
import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image } from 'react-native';
=======
import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Switch, Animated, Platform } from 'react-native';
import { Image } from 'expo-image';
>>>>>>> Stashed changes
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Edit, LogOut, Check } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';

export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
<<<<<<< Updated upstream
=======
  const [useImperial, setUseImperial] = useState(true); // Will be loaded from database
  const [showToast, setShowToast] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-100)).current;
  const hasShownToastForParam = useRef(false);

  const showToastMessage = useCallback(() => {
    setShowToast(true);
    Animated.parallel([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(toastTranslateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(toastTranslateY, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowToast(false);
      });
    }, 2000);
  }, [toastOpacity, toastTranslateY]);
>>>>>>> Stashed changes

  useFocusEffect(
    useCallback(() => {
      loadProfile();
      // Reset the flag when the screen loses focus (user navigates away)
      hasShownToastForParam.current = false;
    }, [])
  );

  useEffect(() => {
    // Only show toast if saved param is true AND we haven't shown it for this navigation
    if (params.saved === 'true' && !hasShownToastForParam.current) {
      hasShownToastForParam.current = true;
      showToastMessage();
      // Clear the param after a short delay to allow the navigation to complete
      setTimeout(() => {
        router.replace('/(tabs)/profile');
      }, 100);
    }
  }, [params.saved, showToastMessage]);

  const loadProfile = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error loading profile:', error);
    } else if (data) {
      setProfile(data);
<<<<<<< Updated upstream
=======
      // Load unit preference from database, default to true (imperial) if not set
      setUseImperial(data.use_imperial !== null && data.use_imperial !== undefined ? data.use_imperial : true);
      // Log avatar URL for debugging
      if (data.avatar_url) {
        console.log('Loaded avatar URL:', data.avatar_url);
      }
>>>>>>> Stashed changes
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Failed to load profile</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {showToast && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              opacity: toastOpacity,
              transform: [{ translateY: toastTranslateY }],
            },
          ]}
        >
          <View style={styles.toastContent}>
            <Check size={20} color="#10b981" />
            <Text style={styles.toastText}>Changes saved</Text>
          </View>
        </Animated.View>
      )}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => router.push('/edit-profile')}
          >
            <Edit size={20} color="#3b82f6" />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.profilePictureContainer}>
          {profile.avatar_url ? (
            <View style={styles.profilePictureWrapper}>
              <Image 
                key={profile.avatar_url}
                source={{ uri: profile.avatar_url }} 
                style={styles.profilePicture}
                contentFit="cover"
                transition={200}
                onError={(error) => {
                  console.error('Image load error:', error);
                  console.error('Image URL:', profile.avatar_url);
                }}
                onLoad={() => {
                  console.log('Image loaded successfully:', profile.avatar_url);
                }}
              />
            </View>
          ) : (
            <View style={styles.placeholderPicture}>
              <Text style={styles.placeholderText}>No Photo</Text>
            </View>
          )}
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Name</Text>
            <Text style={styles.infoValue}>{profile.full_name || 'Not set'}</Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Age</Text>
            <Text style={styles.infoValue}>{profile.age ? `${profile.age} years` : 'Not set'}</Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Current Weight</Text>
            <Text style={styles.infoValue}>{profile.current_weight ? `${profile.current_weight} lbs` : 'Not set'}</Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Goal Weight</Text>
            <Text style={styles.infoValue}>{profile.goal_weight ? `${profile.goal_weight} lbs` : 'Not set'}</Text>
          </View>

          {profile.height && (
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Height</Text>
              <Text style={styles.infoValue}>{profile.height} cm</Text>
            </View>
          )}

          {profile.gender && (
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Gender</Text>
              <Text style={styles.infoValue}>{profile.gender}</Text>
            </View>
          )}

          {profile.goal && (
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Primary Goal</Text>
              <Text style={styles.infoValue}>{profile.goal}</Text>
            </View>
          )}

          {profile.days_per_week && (
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Workout Days per Week</Text>
              <Text style={styles.infoValue}>{profile.days_per_week} days</Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <LogOut size={20} color="#ef4444" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1f2937',
  },
  editButtonText: {
    color: '#3b82f6',
    fontWeight: '600',
    fontSize: 16,
  },
  profilePictureContainer: {
    alignItems: 'center',
    marginBottom: 32,
    paddingVertical: 24,
    backgroundColor: '#1f2937',
    borderRadius: 16,
  },
  profilePictureWrapper: {
    width: 150,
    height: 150,
    borderRadius: 75,
    overflow: 'hidden',
    backgroundColor: '#374151',
  },
  profilePicture: {
    width: 150,
    height: 150,
  },
  placeholderPicture: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  infoSection: {
    gap: 12,
    marginBottom: 24,
  },
  infoCard: {
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  infoLabel: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 4,
    fontWeight: '500',
  },
  infoValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ef4444',
    marginTop: 8,
  },
  signOutText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  toastContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1f2937',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10b981',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toastText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
