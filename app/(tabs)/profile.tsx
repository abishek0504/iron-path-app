import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Animated, Platform } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Edit, LogOut, Check } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';
import { ProfileSkeleton } from '../../src/components/skeletons/ProfileSkeleton';

const kgToLbs = (kg: number): number => kg / 0.453592;
const cmToFtIn = (cm: number): { feet: number; inches: number } => {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches };
};

export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const [useImperial, setUseImperial] = useState(true); // Will be loaded from database
  const [showToast, setShowToast] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-100)).current;
  const hasShownToastForParam = useRef(false);

  const showToastMessage = useCallback(() => {
    setShowToast(true);
    hasShownToastForParam.current = true;
    Animated.parallel([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(toastTranslateY, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(toastTranslateY, {
          toValue: -100,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowToast(false);
      });
    }, 2000);
  }, [toastOpacity, toastTranslateY]);

  useEffect(() => {
    // Only load on initial mount
    if (!hasInitiallyLoaded) {
      loadProfile();
    }
  }, [hasInitiallyLoaded]);

  useFocusEffect(
    useCallback(() => {
      // Only refresh data on focus if we've already loaded, don't show loading
      if (hasInitiallyLoaded) {
        const refresh = async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (!error && data) {
            setProfile(data);
            setUseImperial(data.use_imperial !== null && data.use_imperial !== undefined ? data.use_imperial : true);
          }
        };
        refresh();
      }
      // Reset the flag when the screen loses focus (user navigates away)
      hasShownToastForParam.current = false;
    }, [hasInitiallyLoaded])
  );

  useEffect(() => {
    // Only show toast if saved param is true AND we haven't shown it for this navigation
    if (params.saved === 'true' && !hasShownToastForParam.current) {
      // Small delay to ensure screen is ready
      setTimeout(() => {
        showToastMessage();
        // Clear the param after showing toast
        router.replace('/(tabs)/profile');
      }, 100);
    }
  }, [params.saved, showToastMessage, router]);

  const loadProfile = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      setHasInitiallyLoaded(true);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      // Check if it's a "not found" error (PGRST116) - profile might not exist yet
      if (error.code === 'PGRST116') {
        console.log('Profile not found, creating default profile...');
        // Profile doesn't exist yet, create a default one
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert([{
            id: user.id,
            use_imperial: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select()
          .single();
        
        if (!createError && newProfile) {
          setProfile(newProfile);
          setUseImperial(true);
        } else {
          console.error('Error creating profile:', createError);
        }
      } else {
        console.error('Error loading profile:', error);
      }
    } else if (data) {
      setProfile(data);
      // Load unit preference from database, default to true (imperial) if not set
      setUseImperial(data.use_imperial !== null && data.use_imperial !== undefined ? data.use_imperial : true);
    }
    setLoading(false);
    setHasInitiallyLoaded(true);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Failed to load profile</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
            <Check size={20} color="#a3e635" />
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
            <Edit size={20} color="#a3e635" />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.profilePictureContainer}>
          {profile.avatar_url ? (
            <Image 
              source={{ uri: profile.avatar_url }} 
              style={styles.profilePicture}
              contentFit="cover"
              transition={200}
            />
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
            <Text style={styles.infoValue}>
              {profile.current_weight 
                ? useImperial 
                  ? `${kgToLbs(profile.current_weight).toFixed(1)} lbs`
                  : `${profile.current_weight.toFixed(1)} kg`
                : 'Not set'}
            </Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Goal Weight</Text>
            <Text style={styles.infoValue}>
              {profile.goal_weight 
                ? useImperial 
                  ? `${kgToLbs(profile.goal_weight).toFixed(1)} lbs`
                  : `${profile.goal_weight.toFixed(1)} kg`
                : 'Not set'}
            </Text>
          </View>

          {profile.height && (
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Height</Text>
              <Text style={styles.infoValue}>
                {useImperial 
                  ? (() => {
                      const { feet, inches } = cmToFtIn(profile.height);
                      return `${feet}'${inches}"`;
                    })()
                  : `${profile.height.toFixed(1)} cm`}
              </Text>
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
    backgroundColor: '#09090b', // zinc-950
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 120,
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
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
  },
  editButtonText: {
    color: '#a3e635', // lime-400
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  profilePictureContainer: {
    alignItems: 'center',
    marginBottom: 32,
    paddingVertical: 32,
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    borderRadius: 24, // rounded-3xl
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
  },
  profilePicture: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#27272a', // zinc-800
  },
  placeholderPicture: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#27272a', // zinc-800
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#71717a', // zinc-500
    fontSize: 16,
  },
  infoSection: {
    gap: 16,
    marginBottom: 32,
  },
  infoCard: {
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    padding: 24,
    borderRadius: 24, // rounded-3xl
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
  },
  infoLabel: {
    color: '#71717a', // zinc-500
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  infoValue: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    padding: 18,
    borderRadius: 24, // rounded-3xl
    borderWidth: 1,
    borderColor: '#ef4444',
    marginTop: 8,
  },
  signOutText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
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
    gap: 10,
    backgroundColor: 'rgba(24, 24, 27, 0.95)', // zinc-900/95
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 24, // rounded-3xl
    borderWidth: 1,
    borderColor: '#a3e635', // lime-400
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toastText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
