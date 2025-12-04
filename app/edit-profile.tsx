import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Modal, ActivityIndicator, Platform, Switch } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import {
  deriveStyleAndComponentsFromProfile,
  getDefaultComponentsForStyle,
  serializeComponentsForStorage,
  TrainingStyleId,
  ComponentPreferences,
} from '../src/lib/trainingPreferences';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Upload, X, Check } from 'lucide-react-native';
import { ConfirmDialog } from '../src/components/ConfirmDialog';

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];
const GOALS = ['Strength', 'Hypertrophy', 'Endurance', 'Weight Loss', 'General Fitness'];

const DAYS_OF_WEEK = [
  { label: 'Monday', short: 'Mon' },
  { label: 'Tuesday', short: 'Tue' },
  { label: 'Wednesday', short: 'Wed' },
  { label: 'Thursday', short: 'Thu' },
  { label: 'Friday', short: 'Fri' },
  { label: 'Saturday', short: 'Sat' },
  { label: 'Sunday', short: 'Sun' },
];

const lbsToKg = (lbs: number): number => lbs * 0.453592;
const kgToLbs = (kg: number): number => kg / 0.453592;

const ftInToCm = (feet: number, inches: number): number => (feet * 30.48) + (inches * 2.54);
const cmToFtIn = (cm: number): { feet: number; inches: number } => {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches };
};

export default function EditProfileScreen() {
  const router = useRouter();

  const hasProfileChanges = () => {
    if (!profile || !originalProfile) return false;

    const originalComponents = originalProfile.include_components || null;
    const currentComponents = serializeComponentsForStorage(componentPrefs);

    return (
      fullName !== (originalProfile.full_name || '') ||
      age !== (originalProfile.age?.toString() || '') ||
      gender !== (originalProfile.gender || '') ||
      currentWeight !== (originalProfile.current_weight ? (useImperial ? kgToLbs(originalProfile.current_weight).toFixed(1) : originalProfile.current_weight.toFixed(1)) : '') ||
      goalWeight !== (originalProfile.goal_weight ? (useImperial ? kgToLbs(originalProfile.goal_weight).toFixed(1) : originalProfile.goal_weight.toFixed(1)) : '') ||
      (useImperial ? (heightFeet !== (originalProfile.height ? cmToFtIn(originalProfile.height).feet.toString() : '') || heightInches !== (originalProfile.height ? cmToFtIn(originalProfile.height).inches.toString() : '')) : heightCm !== (originalProfile.height ? originalProfile.height.toFixed(1) : '')) ||
      goal !== (originalProfile.goal || '') ||
      daysPerWeek !== (originalProfile.days_per_week || null) ||
      JSON.stringify(Array.from(selectedDays).sort()) !== JSON.stringify((originalProfile.selected_days || []).sort()) ||
      useImperial !== (originalProfile.use_imperial !== false) ||
      profilePictureUri !== (originalProfile.profile_picture_url || null) ||
      preferredTrainingStyle !== (originalProfile.preferred_training_style || null) ||
      JSON.stringify(currentComponents) !== JSON.stringify(originalComponents || null)
    );
  };

  const safeBack = () => {
    if (hasProfileChanges()) {
      setShowDiscardDialog(true);
    } else {
      try {
        router.replace('/(tabs)/profile');
      } catch (error) {
        router.replace('/(tabs)/profile');
      }
    }
  };

  const handleDiscardConfirm = () => {
    setShowDiscardDialog(false);
    try {
      router.replace('/(tabs)/profile');
    } catch (error) {
      router.replace('/(tabs)/profile');
    }
  };
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [originalProfile, setOriginalProfile] = useState<any>(null);

  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [currentWeight, setCurrentWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [height, setHeight] = useState('');
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [goal, setGoal] = useState('');
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(null);
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [profilePictureUri, setProfilePictureUri] = useState<string | null>(null);
  const [useImperial, setUseImperial] = useState(true); // Will be loaded from database

  // Adaptive training preferences
  const [preferredTrainingStyle, setPreferredTrainingStyle] =
    useState<TrainingStyleId>('comprehensive');
  const [componentPrefs, setComponentPrefs] = useState<ComponentPreferences>(
    getDefaultComponentsForStyle('comprehensive'),
  );

  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [showAgePicker, setShowAgePicker] = useState(false);
  const [showWeightPicker, setShowWeightPicker] = useState(false);
  const [showGoalWeightPicker, setShowGoalWeightPicker] = useState(false);
  const [showHeightPicker, setShowHeightPicker] = useState(false);
  const [showDaysPicker, setShowDaysPicker] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  useEffect(() => {
    loadProfile();
    requestImagePermission();
  }, []);

  useEffect(() => {
    if (profile) {
      // Reload display values when unit preference changes
      // Database always stores weight in kg, so we need to convert for display
      if (profile.current_weight !== null && profile.current_weight !== undefined) {
        const weightInKg = parseFloat(String(profile.current_weight));
        if (!isNaN(weightInKg)) {
          if (useImperial) {
            // Convert from kg (database) to lbs (display)
            const weightInLbs = kgToLbs(weightInKg);
            setCurrentWeight(weightInLbs.toFixed(1));
          } else {
            // Display in kg (same as database)
            setCurrentWeight(weightInKg.toFixed(1));
          }
        }
      }
      if (profile.goal_weight !== null && profile.goal_weight !== undefined) {
        const goalWeightInKg = parseFloat(String(profile.goal_weight));
        if (!isNaN(goalWeightInKg)) {
          if (useImperial) {
            // Convert from kg (database) to lbs (display)
            const goalWeightInLbs = kgToLbs(goalWeightInKg);
            setGoalWeight(goalWeightInLbs.toFixed(1));
          } else {
            // Display in kg (same as database)
            setGoalWeight(goalWeightInKg.toFixed(1));
          }
        }
      }
      if (profile.height) {
        const heightInCm = profile.height;
        if (useImperial) {
          const { feet, inches } = cmToFtIn(heightInCm);
          setHeightFeet(feet.toString());
          setHeightInches(inches.toString());
          setHeight('');
          setHeightCm('');
        } else {
          setHeightCm(heightInCm.toFixed(1));
          setHeight('');
          setHeightFeet('');
          setHeightInches('');
        }
      }
    }
  }, [useImperial, profile]);

  const requestImagePermission = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'We need permission to access your photos to set a profile picture.');
      }
    }
  };

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile');
      safeBack();
      return;
    }

    if (data) {
      setProfile(data);
      setOriginalProfile(JSON.parse(JSON.stringify(data))); // Deep copy for comparison
      // Load unit preference from database, default to true (imperial) if not set
      const loadedUseImperial = data.use_imperial !== null && data.use_imperial !== undefined ? data.use_imperial : true;
      setUseImperial(loadedUseImperial);
      
      setFullName(data.full_name || '');
      setAge(data.age?.toString() || '');
      setGender(data.gender || '');
      
      // Always convert from kg (database storage) to display units
      // Database always stores weight in kg, so we need to convert for display
      if (data.current_weight !== null && data.current_weight !== undefined) {
        const weightInKg = parseFloat(String(data.current_weight));
        if (!isNaN(weightInKg)) {
          if (loadedUseImperial) {
            // Convert from kg (database) to lbs (display)
            const weightInLbs = kgToLbs(weightInKg);
            setCurrentWeight(weightInLbs.toFixed(1));
          } else {
            // Display in kg (same as database)
            setCurrentWeight(weightInKg.toFixed(1));
          }
        } else {
          setCurrentWeight('');
        }
      } else {
        setCurrentWeight('');
      }
      
      if (data.goal_weight !== null && data.goal_weight !== undefined) {
        const goalWeightInKg = parseFloat(String(data.goal_weight));
        if (!isNaN(goalWeightInKg)) {
          if (loadedUseImperial) {
            // Convert from kg (database) to lbs (display)
            const goalWeightInLbs = kgToLbs(goalWeightInKg);
            setGoalWeight(goalWeightInLbs.toFixed(1));
          } else {
            // Display in kg (same as database)
            setGoalWeight(goalWeightInKg.toFixed(1));
          }
        } else {
          setGoalWeight('');
        }
      } else {
        setGoalWeight('');
      }
      
      if (data.height) {
        const heightInCm = data.height;
        if (loadedUseImperial) {
          const { feet, inches } = cmToFtIn(heightInCm);
          setHeightFeet(feet.toString());
          setHeightInches(inches.toString());
          setHeight('');
          setHeightCm('');
        } else {
          setHeightCm(heightInCm.toFixed(1));
          setHeight('');
          setHeightFeet('');
          setHeightInches('');
        }
      } else {
        setHeightFeet('');
        setHeightInches('');
        setHeight('');
        setHeightCm('');
      }
      
      setGoal(data.goal || '');
      setDaysPerWeek(data.days_per_week || null);
      setSelectedDays(data.workout_days && Array.isArray(data.workout_days) ? new Set(data.workout_days) : new Set());
      setProfilePictureUri(data.avatar_url || null);

      // Training style and components
      const { style, components } = deriveStyleAndComponentsFromProfile(data);
      setPreferredTrainingStyle(style);
      setComponentPrefs(components);
    }
  };

  const pickImage = async (source: 'camera' | 'library') => {
    setShowImagePicker(false);

    let result;
    if (source === 'camera') {
      // Camera not available on web
      if (Platform.OS === 'web') {
        Alert.alert('Not Available', 'Camera is not available on web. Please use photo library instead.');
        return;
      }
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'We need camera permission to take a photo.');
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
    }

    if (!result.canceled && result.assets[0]) {
      await uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not found');
      }

      // Delete old avatar if it exists (clean up storage)
      if (profilePictureUri) {
        try {
          const urlParts = profilePictureUri.split('/');
          const oldFileName = urlParts[urlParts.length - 1].split('?')[0];
          await supabase.storage
            .from('avatars')
            .remove([oldFileName]);
        } catch (e) {
          // Ignore errors when deleting old file
          console.log('Could not delete old file:', e);
        }
      }

      const response = await fetch(uri);
      const blob = await response.blob();
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      // Ensure we use a clean filename - just user ID and timestamp, no folders
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      // Save directly to bucket root - NO folder structure
      const filePath = fileName;

      console.log('Uploading to path:', filePath);

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      console.log('Public URL:', publicUrl);

      setProfilePictureUri(publicUrl);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) {
        console.error('Database update error:', updateError);
        throw updateError;
      }

      Alert.alert('Success', 'Profile picture updated!');
    } catch (error: any) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', error.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeleteImage = async () => {
    setShowDeleteConfirm(false);
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUploading(false);
        return;
      }

      // First, get the current profile from database to ensure we have the latest avatar_url
      const { data: currentProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single();

      if (fetchError) {
        console.error('Error fetching profile:', fetchError);
      }

      // Use the avatar URL from database, fallback to local state
      const avatarUrlToDelete = currentProfile?.avatar_url || profile?.avatar_url || profilePictureUri;

      if (avatarUrlToDelete) {
        // Extract the file path from the URL
        // Supabase URLs are typically: https://[project].supabase.co/storage/v1/object/public/avatars/[filename]
        const urlParts = avatarUrlToDelete.split('/');
        const fileName = urlParts[urlParts.length - 1].split('?')[0]; // Remove query params if any
        // File is stored directly in bucket root, no folder structure
        const filePath = fileName;

        console.log('Deleting file from storage:', filePath);

        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from('avatars')
          .remove([filePath]);

        if (storageError) {
          console.error('Storage delete error:', storageError);
        } else {
          console.log('Successfully deleted from storage');
        }
      }

      // CRITICAL: Update database FIRST before anything else
      console.log('Updating database to remove avatar_url for user:', user.id);
      
      // Use select to verify the update worked
      const { data: updateData, error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id)
        .select('avatar_url')
        .single();

      if (updateError) {
        console.error('Database update error:', updateError);
        console.error('Error details:', JSON.stringify(updateError, null, 2));
        throw new Error(`Database update failed: ${updateError.message}`);
      }

      if (!updateData) {
        throw new Error('No data returned from update - profile may not exist');
      }

      console.log('Database update result:', updateData);
      console.log('avatar_url after update:', updateData.avatar_url);

      // Verify it's actually null
      if (updateData.avatar_url !== null && updateData.avatar_url !== '') {
        console.error('ERROR: avatar_url was not set to null! Value:', updateData.avatar_url);
        // Force update one more time
        const { error: forceError } = await supabase
          .from('profiles')
          .update({ avatar_url: null })
          .eq('id', user.id);
        
        if (forceError) {
          throw new Error(`Force update also failed: ${forceError.message}`);
        }
      }

      // Update local state
      setProfilePictureUri(null);
      
      // Reload profile to ensure state is in sync
      await loadProfile();
      
      Alert.alert('Success', 'Profile picture deleted');
    } catch (error: any) {
      console.error('Error removing image:', error);
      Alert.alert('Error', error.message || 'Failed to remove image');
    } finally {
      setUploading(false);
    }
  };


  const saveProfile = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    let weightKg: number | null = null;
    let goalWeightKg: number | null = null;
    let heightCm: number | null = null;

    if (currentWeight) {
      const weightValue = parseFloat(currentWeight);
      weightKg = useImperial ? lbsToKg(weightValue) : weightValue;
    }

    if (goalWeight) {
      const goalWeightValue = parseFloat(goalWeight);
      goalWeightKg = useImperial ? lbsToKg(goalWeightValue) : goalWeightValue;
    }

    if (useImperial) {
      const feet = parseInt(heightFeet, 10);
      const inches = parseInt(heightInches, 10);
      if (!isNaN(feet) && !isNaN(inches)) {
        heightCm = ftInToCm(feet, inches);
      }
    } else if (heightCm) {
      heightCm = parseFloat(heightCm);
    }

    // Determine days_per_week and workout_days
    let finalDaysPerWeek = daysPerWeek;
    let workoutDays: string[] | null = null;
    
    if (selectedDays.size > 0) {
      // If specific days are selected, use that count and store the days
      finalDaysPerWeek = selectedDays.size;
      workoutDays = Array.from(selectedDays);
    } else if (daysPerWeek) {
      // If only number of days is set, clear workout_days
      workoutDays = null;
    }

    const updateData: any = {
      full_name: fullName,
      age: age ? parseInt(age, 10) : null,
      gender: gender || null,
      current_weight: weightKg,
      goal_weight: goalWeightKg,
      height: heightCm,
      goal: goal || null,
      days_per_week: finalDaysPerWeek,
      workout_days: workoutDays,
      use_imperial: useImperial,
      preferred_training_style: preferredTrainingStyle,
      include_components: serializeComponentsForStorage(componentPrefs),
    };

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id);

    if (error) {
      Alert.alert('Error', error.message);
      setLoading(false);
    } else {
      setLoading(false);
      setOriginalProfile(JSON.parse(JSON.stringify(profile))); // Update original after save
      // Navigate back immediately with saved parameter using replace to prevent stacking
      router.replace('/(tabs)/profile?saved=true');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={[styles.contentContainer, { paddingBottom: 120 }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={safeBack}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.profilePictureSection}>
          <Text style={styles.sectionTitle}>Profile Picture</Text>
          <View style={styles.profilePictureContainer}>
            {uploading ? (
              <View style={styles.uploadingContainer}>
                <ActivityIndicator size="large" color="#a3e635" />
              </View>
            ) : (
              <>
                {profilePictureUri ? (
                  <Image 
                    source={{ uri: profilePictureUri }} 
                    style={styles.profilePicture}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  <View style={styles.placeholderPicture}>
                    <Text style={styles.placeholderPictureText}>No Photo</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={removeImage}
                  disabled={!profilePictureUri || uploading}
                >
                  <X size={16} color="#ffffff" />
                </TouchableOpacity>
              </>
            )}
          </View>
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={() => setShowImagePicker(true)}
            disabled={uploading}
          >
            <Upload size={20} color="#3b82f6" />
            <Text style={styles.uploadButtonText}>Upload Photo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          
          <View style={styles.unitToggleContainer}>
            <Text style={styles.unitToggleLabel}>Units</Text>
            <View style={styles.unitToggleRow}>
              <Text style={[styles.unitToggleText, !useImperial && styles.unitToggleTextActive]}>Metric</Text>
              <Switch
                value={useImperial}
                onValueChange={(value) => {
                  const newUseImperial = value;
                  
                  // Convert weight values - database always stores in kg
                  // If switching from imperial to metric: convert displayed lbs back to kg (database format)
                  // If switching from metric to imperial: convert kg (database format) to lbs
                  if (profile) {
                    if (profile.current_weight) {
                      const weightInKg = Number(profile.current_weight);
                      if (newUseImperial) {
                        setCurrentWeight(kgToLbs(weightInKg).toFixed(1));
                      } else {
                        setCurrentWeight(weightInKg.toFixed(1));
                      }
                    }
                    
                    if (profile.goal_weight) {
                      const goalWeightInKg = Number(profile.goal_weight);
                      if (newUseImperial) {
                        setGoalWeight(kgToLbs(goalWeightInKg).toFixed(1));
                      } else {
                        setGoalWeight(goalWeightInKg.toFixed(1));
                      }
                    }
                    
                    if (profile.height) {
                      const heightInCm = Number(profile.height);
                      if (newUseImperial) {
                        const { feet, inches } = cmToFtIn(heightInCm);
                        setHeightFeet(feet.toString());
                        setHeightInches(inches.toString());
                        setHeightCm('');
                        setHeight('');
                      } else {
                        setHeightCm(heightInCm.toFixed(1));
                        setHeightFeet('');
                        setHeightInches('');
                        setHeight('');
                      }
                    }
                  } else {
                    // If profile not loaded yet, convert from current displayed values
                    if (currentWeight) {
                      const weightValue = parseFloat(currentWeight);
                      if (useImperial && !newUseImperial) {
                        // Converting from lbs (display) to kg (database format)
                        setCurrentWeight(lbsToKg(weightValue).toFixed(1));
                      } else if (!useImperial && newUseImperial) {
                        // Converting from kg (display) to lbs
                        setCurrentWeight(kgToLbs(weightValue).toFixed(1));
                      }
                    }
                    
                    if (goalWeight) {
                      const goalWeightValue = parseFloat(goalWeight);
                      if (useImperial && !newUseImperial) {
                        setGoalWeight(lbsToKg(goalWeightValue).toFixed(1));
                      } else if (!useImperial && newUseImperial) {
                        setGoalWeight(kgToLbs(goalWeightValue).toFixed(1));
                      }
                    }
                    
                    if (useImperial && !newUseImperial) {
                      const feet = parseInt(heightFeet, 10);
                      const inches = parseInt(heightInches, 10);
                      if (!isNaN(feet) && !isNaN(inches)) {
                        const cm = ftInToCm(feet, inches);
                        setHeightCm(cm.toFixed(1));
                        setHeightFeet('');
                        setHeightInches('');
                        setHeight('');
                      }
                    } else if (!useImperial && newUseImperial) {
                      const cm = parseFloat(heightCm);
                      if (!isNaN(cm)) {
                        const { feet, inches } = cmToFtIn(cm);
                        setHeightFeet(feet.toString());
                        setHeightInches(inches.toString());
                        setHeightCm('');
                        setHeight('');
                      }
                    }
                  }
                  
                  setUseImperial(newUseImperial);
                }}
                trackColor={{ false: '#27272a', true: '#a3e635' }}
                thumbColor="#ffffff"
              />
              <Text style={[styles.unitToggleText, useImperial && styles.unitToggleTextActive]}>Imperial</Text>
            </View>
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your name"
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Age</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowAgePicker(true)}
            >
              <Text style={[styles.pickerButtonText, !age && styles.pickerButtonPlaceholder]}>
                {age || 'Select age'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Gender</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowGenderPicker(true)}
            >
              <Text style={[styles.pickerButtonText, !gender && styles.pickerButtonPlaceholder]}>
                {gender || 'Select gender'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Current Weight ({useImperial ? 'lbs' : 'kg'})</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowWeightPicker(true)}
            >
              <Text style={[styles.pickerButtonText, !currentWeight && styles.pickerButtonPlaceholder]}>
                {currentWeight ? `${currentWeight} ${useImperial ? 'lbs' : 'kg'}` : `Select weight (${useImperial ? 'lbs' : 'kg'})`}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Goal Weight ({useImperial ? 'lbs' : 'kg'})</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowGoalWeightPicker(true)}
            >
              <Text style={[styles.pickerButtonText, !goalWeight && styles.pickerButtonPlaceholder]}>
                {goalWeight ? `${goalWeight} ${useImperial ? 'lbs' : 'kg'}` : `Select goal weight (${useImperial ? 'lbs' : 'kg'})`}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Height</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowHeightPicker(true)}
            >
              <Text style={[styles.pickerButtonText, (!heightCm && !heightFeet) && styles.pickerButtonPlaceholder]}>
                {useImperial 
                  ? (heightFeet || heightInches ? `${heightFeet || 0}' ${heightInches || 0}"` : "Select height (ft'in\")")
                  : (heightCm ? `${heightCm} cm` : 'Select height (cm)')
                }
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Primary Goal</Text>
            <TouchableOpacity 
              style={styles.pickerButton}
              onPress={() => setShowGoalPicker(true)}
            >
              <Text style={[styles.pickerButtonText, !goal && styles.pickerButtonPlaceholder]}>
                {goal || 'Select goal'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Workout Days</Text>
            <TouchableOpacity 
              style={styles.pickerButton}
              onPress={() => setShowDaysPicker(true)}
            >
              <Text style={[styles.pickerButtonText, selectedDays.size === 0 && !daysPerWeek && styles.pickerButtonPlaceholder]}>
                {selectedDays.size > 0 
                  ? `${selectedDays.size} day${selectedDays.size > 1 ? 's' : ''} selected`
                  : daysPerWeek 
                    ? `${daysPerWeek} day${daysPerWeek > 1 ? 's' : ''} per week`
                    : 'Select workout days'
                }
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Workout Components</Text>
            <View style={styles.trainingStyleRow}>
              {(['comprehensive', 'strength_primary_plus_accessories', 'calisthenics_compound_only', 'cardio_only'] as TrainingStyleId[]).map(
                (styleId) => {
                  const isSelected = preferredTrainingStyle === styleId;
                  const label =
                    styleId === 'comprehensive'
                      ? 'Comprehensive'
                      : styleId === 'strength_primary_plus_accessories'
                      ? 'Strength + accessories'
                      : styleId === 'calisthenics_compound_only'
                      ? 'Calisthenics'
                      : 'Cardio only';
                  return (
                    <TouchableOpacity
                      key={styleId}
                      style={[styles.trainingStylePill, isSelected && styles.trainingStylePillSelected]}
                      onPress={() => {
                        setPreferredTrainingStyle(styleId);
                        setComponentPrefs(getDefaultComponentsForStyle(styleId));
                      }}
                    >
                      <Text
                        style={[
                          styles.trainingStylePillText,
                          isSelected && styles.trainingStylePillTextSelected,
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                },
              )}
            </View>

            <View style={styles.componentToggleRow}>
              <Text style={styles.componentLabel}>Tier 1 Compounds</Text>
              <Switch
                value={componentPrefs.include_tier1_compounds}
                onValueChange={(value) =>
                  setComponentPrefs((prev) => ({ ...prev, include_tier1_compounds: value }))
                }
                trackColor={{ false: '#27272a', true: '#a3e635' }}
                thumbColor="#ffffff"
              />
            </View>
            <View style={styles.componentToggleRow}>
              <Text style={styles.componentLabel}>Tier 2 Accessories</Text>
              <Switch
                value={componentPrefs.include_tier2_accessories}
                onValueChange={(value) =>
                  setComponentPrefs((prev) => ({ ...prev, include_tier2_accessories: value }))
                }
                trackColor={{ false: '#27272a', true: '#a3e635' }}
                thumbColor="#ffffff"
              />
            </View>
            <View style={styles.componentToggleRow}>
              <Text style={styles.componentLabel}>Tier 3 Prehab & Mobility</Text>
              <Switch
                value={componentPrefs.include_tier3_prehab_mobility}
                onValueChange={(value) =>
                  setComponentPrefs((prev) => ({ ...prev, include_tier3_prehab_mobility: value }))
                }
                trackColor={{ false: '#27272a', true: '#a3e635' }}
                thumbColor="#ffffff"
              />
            </View>
            <View style={styles.componentToggleRow}>
              <Text style={styles.componentLabel}>Cardio / Conditioning</Text>
              <Switch
                value={componentPrefs.include_cardio_conditioning}
                onValueChange={(value) =>
                  setComponentPrefs((prev) => ({ ...prev, include_cardio_conditioning: value }))
                }
                trackColor={{ false: '#27272a', true: '#a3e635' }}
                thumbColor="#ffffff"
              />
            </View>
          </View>
        </View>

      </ScrollView>

      {/* Floating Save Button */}
      <View style={styles.floatingSaveContainer}>
        <View style={styles.floatingSaveCapsule}>
          <TouchableOpacity 
            style={[styles.floatingSaveButton, (loading || !hasProfileChanges()) && styles.floatingSaveButtonDisabled]} 
            onPress={saveProfile}
            disabled={loading || !hasProfileChanges()}
          >
            <Text style={styles.floatingSaveButtonText}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ConfirmDialog
        visible={showDiscardDialog}
        title="Discard changes?"
        message="You have unsaved changes. Are you sure you want to discard them?"
        confirmText="Discard"
        cancelText="Cancel"
        onConfirm={handleDiscardConfirm}
        onCancel={() => setShowDiscardDialog(false)}
        destructive={true}
      />

      {/* Age Picker Modal */}
      <Modal
        visible={showAgePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAgePicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAgePicker(false)}
        >
          <View style={styles.nativePickerModal} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Age</Text>
              <TouchableOpacity
                onPress={() => setShowAgePicker(false)}
                style={styles.pickerDoneButton}
              >
                <Text style={styles.pickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <Picker
              selectedValue={age}
              onValueChange={(itemValue) => setAge(itemValue)}
              style={styles.nativePicker}
              itemStyle={{ color: '#ffffff' }}
            >
              {Array.from({ length: 150 }, (_, i) => i + 1).map((ageValue) => (
                <Picker.Item key={ageValue} label={ageValue.toString()} value={ageValue.toString()} color="#ffffff" />
              ))}
            </Picker>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Gender Picker Modal */}
      <Modal
        visible={showGenderPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGenderPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowGenderPicker(false)}
        >
          <View style={styles.nativePickerModal} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Gender</Text>
              <TouchableOpacity
                onPress={() => setShowGenderPicker(false)}
                style={styles.pickerDoneButton}
              >
                <Text style={styles.pickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <Picker
              selectedValue={gender}
              onValueChange={(itemValue) => setGender(itemValue)}
              style={styles.nativePicker}
              itemStyle={{ color: '#ffffff' }}
            >
              {GENDERS.map((genderOption) => (
                <Picker.Item key={genderOption} label={genderOption} value={genderOption} color="#ffffff" />
              ))}
            </Picker>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Weight Picker Modal */}
      <Modal
        visible={showWeightPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowWeightPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowWeightPicker(false)}
        >
          <View style={styles.nativePickerModal} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Weight</Text>
              <TouchableOpacity
                onPress={() => setShowWeightPicker(false)}
                style={styles.pickerDoneButton}
              >
                <Text style={styles.pickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.nativePickerRow}>
              <Picker
                selectedValue={currentWeight}
                onValueChange={(itemValue) => setCurrentWeight(itemValue)}
                style={[styles.nativePicker, { flex: 1 }]}
                itemStyle={{ color: '#ffffff' }}
              >
                {Array.from({ length: useImperial ? 601 : 301 }, (_, i) => i).map((weightValue) => (
                  <Picker.Item key={weightValue} label={weightValue.toString()} value={weightValue.toString()} color="#ffffff" />
                ))}
              </Picker>
              <View style={styles.pickerUnitLabel}>
                <Text style={styles.pickerUnitText}>{useImperial ? 'lbs' : 'kg'}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Goal Weight Picker Modal */}
      <Modal
        visible={showGoalWeightPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGoalWeightPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowGoalWeightPicker(false)}
        >
          <View style={styles.nativePickerModal} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Goal Weight</Text>
              <TouchableOpacity
                onPress={() => setShowGoalWeightPicker(false)}
                style={styles.pickerDoneButton}
              >
                <Text style={styles.pickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.nativePickerRow}>
              <Picker
                selectedValue={goalWeight}
                onValueChange={(itemValue) => setGoalWeight(itemValue)}
                style={[styles.nativePicker, { flex: 1 }]}
                itemStyle={{ color: '#ffffff' }}
              >
                {Array.from({ length: useImperial ? 601 : 301 }, (_, i) => i).map((weightValue) => (
                  <Picker.Item key={weightValue} label={weightValue.toString()} value={weightValue.toString()} color="#ffffff" />
                ))}
              </Picker>
              <View style={styles.pickerUnitLabel}>
                <Text style={styles.pickerUnitText}>{useImperial ? 'lbs' : 'kg'}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Height Picker Modal */}
      <Modal
        visible={showHeightPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowHeightPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowHeightPicker(false)}
        >
          <View style={styles.nativePickerModal} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Height</Text>
              <TouchableOpacity
                onPress={() => setShowHeightPicker(false)}
                style={styles.pickerDoneButton}
              >
                <Text style={styles.pickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
            {useImperial ? (
              <View style={styles.nativePickerRow}>
                <Picker
                  selectedValue={heightFeet}
                  onValueChange={(itemValue) => setHeightFeet(itemValue)}
                  style={[styles.nativePicker, { flex: 1 }]}
                  itemStyle={{ color: '#ffffff' }}
                >
                  {Array.from({ length: 9 }, (_, i) => i).map((feetValue) => (
                    <Picker.Item key={feetValue} label={feetValue.toString()} value={feetValue.toString()} color="#ffffff" />
                  ))}
                </Picker>
                <View style={styles.pickerUnitLabel}>
                  <Text style={styles.pickerUnitText}>ft</Text>
                </View>
                <Picker
                  selectedValue={heightInches}
                  onValueChange={(itemValue) => setHeightInches(itemValue)}
                  style={[styles.nativePicker, { flex: 1 }]}
                  itemStyle={{ color: '#ffffff' }}
                >
                  {Array.from({ length: 12 }, (_, i) => i).map((inchesValue) => (
                    <Picker.Item key={inchesValue} label={inchesValue.toString()} value={inchesValue.toString()} color="#ffffff" />
                  ))}
                </Picker>
                <View style={styles.pickerUnitLabel}>
                  <Text style={styles.pickerUnitText}>in</Text>
                </View>
              </View>
            ) : (
              <View style={styles.nativePickerRow}>
                <Picker
                  selectedValue={heightCm}
                  onValueChange={(itemValue) => setHeightCm(itemValue)}
                  style={[styles.nativePicker, { flex: 1 }]}
                  itemStyle={{ color: '#ffffff' }}
                >
                  {Array.from({ length: 301 }, (_, i) => i).map((cmValue) => (
                    <Picker.Item key={cmValue} label={cmValue.toString()} value={cmValue.toString()} color="#ffffff" />
                  ))}
                </Picker>
                <View style={styles.pickerUnitLabel}>
                  <Text style={styles.pickerUnitText}>cm</Text>
                </View>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Days Picker Modal */}
      <Modal
        visible={showDaysPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDaysPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDaysPicker(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Workout Days</Text>
              <TouchableOpacity
                onPress={() => setShowDaysPicker(false)}
                style={styles.pickerDoneButton}
              >
                <Text style={styles.pickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.daysPickerScroll}>
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = selectedDays.has(day.label);
                return (
                  <TouchableOpacity
                    key={day.label}
                    style={[styles.dayOptionCard, isSelected && styles.dayOptionCardSelected]}
                    onPress={() => {
                      const newSelectedDays = new Set(selectedDays);
                      if (newSelectedDays.has(day.label)) {
                        newSelectedDays.delete(day.label);
                      } else {
                        newSelectedDays.add(day.label);
                      }
                      setSelectedDays(newSelectedDays);
                      if (newSelectedDays.size > 0) {
                        setDaysPerWeek(newSelectedDays.size);
                      }
                    }}
                  >
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Check size={16} color="#09090b" />}
                    </View>
                    <Text style={[styles.dayOptionText, isSelected && styles.dayOptionTextSelected]}>
                      {day.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Goal Picker Modal */}
      <Modal
        visible={showGoalPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGoalPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Goal</Text>
            {GOALS.map((g) => (
              <TouchableOpacity
                key={g}
                style={styles.modalOption}
                onPress={() => { setGoal(g); setShowGoalPicker(false); }}
              >
                <Text style={styles.modalOptionText}>{g}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowGoalPicker(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Image Picker Modal */}
      <Modal
        visible={showImagePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowImagePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Photo</Text>
            <TouchableOpacity
              style={styles.imagePickerOption}
              onPress={() => pickImage('library')}
            >
              <Upload size={24} color="#a3e635" />
              <Text style={styles.imagePickerOptionText}>Choose from Library</Text>
            </TouchableOpacity>
            {Platform.OS !== 'web' && (
              <TouchableOpacity
                style={styles.imagePickerOption}
                onPress={() => pickImage('camera')}
              >
                <Camera size={24} color="#a3e635" />
                <Text style={styles.imagePickerOptionText}>Take Photo</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowImagePicker(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteConfirmContent}>
            <Text style={styles.deleteConfirmTitle}>Delete Profile Picture</Text>
            <Text style={styles.deleteConfirmMessage}>
              Are you sure you want to delete your profile picture? This action cannot be undone.
            </Text>
            <View style={styles.deleteConfirmButtons}>
              <TouchableOpacity
                style={styles.deleteConfirmCancelButton}
                onPress={() => setShowDeleteConfirm(false)}
              >
                <Text style={styles.deleteConfirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteConfirmDeleteButton}
                onPress={confirmDeleteImage}
              >
                <Text style={styles.deleteConfirmDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  cancelButton: {
    color: '#a1a1aa', // zinc-400
    fontSize: 16,
    fontWeight: '500',
  },
  headerSpacer: {
    width: 60, // Match cancel button width for centering
  },
  saveButton: {
    color: '#a3e635', // lime-400
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 24,
    letterSpacing: -0.3,
  },
  profilePictureSection: {
    marginBottom: 32,
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    padding: 32, // p-8
    borderRadius: 24, // rounded-3xl
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
    alignItems: 'center',
  },
  profilePictureContainer: {
    position: 'relative',
    marginBottom: 24,
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
    borderWidth: 1,
    borderColor: '#3f3f46', // zinc-700
  },
  placeholderPictureText: {
    color: '#a1a1aa', // zinc-400
    fontSize: 14,
    fontWeight: '500',
  },
  uploadingContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#27272a', // zinc-800
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3f3f46', // zinc-700
  },
  removeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#ef4444', // red-500
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#09090b', // zinc-950
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(163, 230, 53, 0.1)', // lime-400/10
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24, // rounded-3xl
    borderWidth: 1,
    borderColor: '#a3e635', // lime-400
  },
  uploadButtonText: {
    color: '#a3e635', // lime-400
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#a1a1aa', // zinc-400
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    color: '#ffffff',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
    fontSize: 16,
  },
  inputText: {
    color: '#ffffff',
    fontSize: 16,
  },
  placeholderText: {
    color: '#71717a', // zinc-500
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  halfWidth: {
    flex: 1,
  },
  saveButtonLarge: {
    backgroundColor: '#a3e635', // lime-400
    padding: 18,
    borderRadius: 24, // rounded-3xl
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 40,
    shadowColor: '#a3e635',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  saveButtonLargeText: {
    color: '#09090b', // zinc-950
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 11, 0.8)', // zinc-950/80
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#18181b', // zinc-900
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 32,
    paddingBottom: 40,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
    borderBottomWidth: 0,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  modalOption: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a', // zinc-800
  },
  modalOptionText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  imagePickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a', // zinc-800
  },
  imagePickerOptionText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  modalCancelButton: {
    marginTop: 24,
    padding: 18,
    backgroundColor: 'rgba(39, 39, 42, 0.8)', // zinc-800/80
    borderRadius: 24, // rounded-3xl
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
  },
  modalCancelText: {
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  unitToggleContainer: {
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    padding: 24,
    borderRadius: 24, // rounded-3xl
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
    marginBottom: 32,
  },
  unitToggleLabel: {
    color: '#a1a1aa', // zinc-400
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
    letterSpacing: 0.2,
  },
  unitToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unitToggleText: {
    color: '#71717a', // zinc-500
    fontSize: 16,
    fontWeight: '500',
  },
  unitToggleTextActive: {
    color: '#a3e635', // lime-400
    fontWeight: '600',
  },
  heightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heightInput: {
    flex: 1,
    minWidth: 60,
  },
  heightSeparator: {
    color: '#a1a1aa', // zinc-400
    fontSize: 14,
    fontWeight: '500',
  },
  deleteConfirmContent: {
    backgroundColor: '#18181b', // zinc-900
    borderRadius: 24, // rounded-3xl
    padding: 32,
    margin: 24,
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
  },
  deleteConfirmTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  deleteConfirmMessage: {
    color: '#a1a1aa', // zinc-400
    fontSize: 16,
    marginBottom: 32,
    lineHeight: 24,
  },
  deleteConfirmButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  deleteConfirmCancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24, // rounded-3xl
    backgroundColor: 'rgba(39, 39, 42, 0.8)', // zinc-800/80
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
  },
  deleteConfirmCancelText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  deleteConfirmDeleteButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24, // rounded-3xl
    backgroundColor: '#ef4444', // red-500
  },
  deleteConfirmDeleteText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  pickerButton: {
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
    justifyContent: 'center',
    minHeight: 56,
  },
  pickerButtonText: {
    color: '#ffffff',
    fontSize: 16,
  },
  pickerButtonPlaceholder: {
    color: '#71717a', // zinc-500
  },
  nativePickerModal: {
    backgroundColor: '#18181b', // zinc-900
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '50%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  nativePicker: {
    height: 216,
    backgroundColor: '#18181b', // zinc-900
  },
  nativePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b', // zinc-900
  },
  pickerUnitLabel: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerUnitText: {
    fontSize: 18,
    color: '#71717a', // zinc-500
    fontWeight: '400',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a', // zinc-800
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  pickerDoneButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  pickerDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#a3e635', // lime-400
  },
  daysPickerScroll: {
    maxHeight: 400,
  },
  dayOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
    marginBottom: 12,
  },
  dayOptionCardSelected: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#71717a', // zinc-500
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  checkboxSelected: {
    borderColor: '#a3e635', // lime-400
    backgroundColor: '#a3e635', // lime-400
  },
  dayOptionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  dayOptionTextSelected: {
    color: '#09090b', // zinc-950
  },
  floatingSaveContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: Platform.OS === 'web' ? 16 : 32,
    backgroundColor: 'transparent',
    zIndex: 1000,
    pointerEvents: 'box-none',
  },
  floatingSaveCapsule: {
    backgroundColor: '#18181b', // zinc-900 - capsule background
    borderRadius: 36, // Full capsule shape matching tab bar
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    padding: 4,
  },
  floatingSaveButton: {
    backgroundColor: '#a3e635', // lime-400
    padding: 18,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  floatingSaveButtonDisabled: {
    backgroundColor: '#27272a', // zinc-800
    opacity: 0.5,
  },
  floatingSaveButtonText: {
    color: '#09090b', // zinc-950 for contrast
    fontWeight: 'bold',
    fontSize: 18,
    letterSpacing: 0.5,
  },
  trainingStyleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  trainingStylePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#27272a',
    backgroundColor: '#18181b',
  },
  trainingStylePillSelected: {
    borderColor: '#a3e635',
    backgroundColor: 'rgba(163, 230, 53, 0.1)',
  },
  trainingStylePillText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#a1a1aa',
  },
  trainingStylePillTextSelected: {
    color: '#a3e635',
  },
  componentToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  componentLabel: {
    fontSize: 14,
    color: '#e4e4e7',
    flexShrink: 1,
    marginRight: 12,
  },
});
