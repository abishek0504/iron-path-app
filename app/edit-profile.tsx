import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Modal, ActivityIndicator, Platform, Switch } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Upload, X } from 'lucide-react-native';

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];
const GOALS = ['Strength', 'Hypertrophy', 'Endurance', 'Weight Loss', 'General Fitness'];

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

  const safeBack = () => {
    try {
      if (router.canGoBack && typeof router.canGoBack === 'function' && router.canGoBack()) {
        router.back();
      } else {
        router.push('/(tabs)/profile');
      }
    } catch (error) {
      router.push('/(tabs)/profile');
    }
  };
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [currentWeight, setCurrentWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [height, setHeight] = useState('');
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');
  const [goal, setGoal] = useState('');
  const [profilePictureUri, setProfilePictureUri] = useState<string | null>(null);
  const [useImperial, setUseImperial] = useState(true); // Will be loaded from database

  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
        } else {
          setHeight(heightInCm.toFixed(1));
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
        } else {
          setHeight(heightInCm.toFixed(1));
          setHeightFeet('');
          setHeightInches('');
        }
      } else {
        setHeightFeet('');
        setHeightInches('');
        setHeight('');
      }
      
      setGoal(data.goal || '');
      setProfilePictureUri(data.avatar_url || null);
    }
  };

  const pickImage = async (source: 'camera' | 'library') => {
    setShowImagePicker(false);

    let result;
    if (source === 'camera') {
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
    } else if (height) {
      heightCm = parseFloat(height);
    }

    const updateData: any = {
      full_name: fullName,
      age: age ? parseInt(age, 10) : null,
      gender: gender || null,
      current_weight: weightKg,
      goal_weight: goalWeightKg,
      height: heightCm,
      goal: goal || null,
      use_imperial: useImperial,
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
      // Navigate back immediately with saved parameter
      router.push('/(tabs)/profile?saved=true');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={safeBack}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <TouchableOpacity onPress={saveProfile} disabled={loading}>
            <Text style={[styles.saveButton, loading && styles.saveButtonDisabled]}>
              {loading ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.profilePictureSection}>
          <Text style={styles.sectionTitle}>Profile Picture</Text>
          <View style={styles.profilePictureContainer}>
            {uploading ? (
              <View style={styles.uploadingContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
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
                        setHeight('');
                      } else {
                        setHeight(heightInCm.toFixed(1));
                        setHeightFeet('');
                        setHeightInches('');
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
                        setHeight(cm.toFixed(1));
                        setHeightFeet('');
                        setHeightInches('');
                      }
                    } else if (!useImperial && newUseImperial) {
                      const cm = parseFloat(height);
                      if (!isNaN(cm)) {
                        const { feet, inches } = cmToFtIn(cm);
                        setHeightFeet(feet.toString());
                        setHeightInches(inches.toString());
                        setHeight('');
                      }
                    }
                  }
                  
                  setUseImperial(newUseImperial);
                }}
                trackColor={{ false: '#374151', true: '#3b82f6' }}
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

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Age</Text>
              <TextInput
                style={styles.input}
                value={age}
                onChangeText={setAge}
                keyboardType="number-pad"
                placeholder="25"
                placeholderTextColor="#666"
              />
            </View>

            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Gender</Text>
              <TouchableOpacity 
                style={styles.input}
                onPress={() => setShowGenderPicker(true)}
              >
                <Text style={[styles.inputText, !gender && styles.placeholderText]}>
                  {gender || 'Select'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Current Weight {useImperial ? '(lbs)' : '(kg)'}</Text>
              <TextInput
                style={styles.input}
                value={currentWeight}
                onChangeText={setCurrentWeight}
                keyboardType="numeric"
                placeholder={useImperial ? "150" : "68"}
                placeholderTextColor="#666"
              />
            </View>

            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Goal Weight {useImperial ? '(lbs)' : '(kg)'}</Text>
              <TextInput
                style={styles.input}
                value={goalWeight}
                onChangeText={setGoalWeight}
                keyboardType="numeric"
                placeholder={useImperial ? "140" : "64"}
                placeholderTextColor="#666"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Height {useImperial ? '(ft/in)' : '(cm)'}</Text>
            {useImperial ? (
              <View style={styles.heightRow}>
                <TextInput
                  style={[styles.input, styles.heightInput]}
                  value={heightFeet}
                  onChangeText={setHeightFeet}
                  keyboardType="number-pad"
                  placeholder="5"
                  placeholderTextColor="#666"
                />
                <Text style={styles.heightSeparator}>ft</Text>
                <TextInput
                  style={[styles.input, styles.heightInput]}
                  value={heightInches}
                  onChangeText={setHeightInches}
                  keyboardType="number-pad"
                  placeholder="10"
                  placeholderTextColor="#666"
                />
                <Text style={styles.heightSeparator}>in</Text>
              </View>
            ) : (
              <TextInput
                style={styles.input}
                value={height}
                onChangeText={setHeight}
                keyboardType="numeric"
                placeholder="175"
                placeholderTextColor="#666"
              />
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Primary Goal</Text>
            <TouchableOpacity 
              style={styles.input}
              onPress={() => setShowGoalPicker(true)}
            >
              <Text style={[styles.inputText, !goal && styles.placeholderText]}>
                {goal || 'Select'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.saveButtonLarge, loading && styles.saveButtonDisabled]} 
          onPress={saveProfile}
          disabled={loading}
        >
          <Text style={styles.saveButtonLargeText}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Gender Picker Modal */}
      <Modal
        visible={showGenderPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGenderPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Gender</Text>
            {GENDERS.map((g) => (
              <TouchableOpacity
                key={g}
                style={styles.modalOption}
                onPress={() => { setGender(g); setShowGenderPicker(false); }}
              >
                <Text style={styles.modalOptionText}>{g}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowGenderPicker(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
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
              <Upload size={24} color="#3b82f6" />
              <Text style={styles.imagePickerOptionText}>Choose from Library</Text>
            </TouchableOpacity>
            {Platform.OS !== 'web' && (
              <TouchableOpacity
                style={styles.imagePickerOption}
                onPress={() => pickImage('camera')}
              >
                <Camera size={24} color="#3b82f6" />
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
    backgroundColor: '#111827',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  cancelButton: {
    color: '#9ca3af',
    fontSize: 16,
  },
  saveButton: {
    color: '#3b82f6',
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
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
  profilePictureSection: {
    marginBottom: 32,
    backgroundColor: '#1f2937',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  profilePictureContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profilePicture: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#374151',
  },
  placeholderPicture: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderPictureText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  uploadingContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#ef4444',
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#111827',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1f2937',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  uploadButtonText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1f2937',
    color: '#ffffff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    fontSize: 16,
  },
  inputText: {
    color: '#ffffff',
    fontSize: 16,
  },
  placeholderText: {
    color: '#666',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  saveButtonLarge: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  saveButtonLargeText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1f2937',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  modalOptionText: {
    color: '#ffffff',
    fontSize: 16,
  },
  imagePickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  imagePickerOptionText: {
    color: '#ffffff',
    fontSize: 16,
  },
  modalCancelButton: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#374151',
    borderRadius: 8,
  },
  modalCancelText: {
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
  unitToggleContainer: {
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 24,
  },
  unitToggleLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  unitToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unitToggleText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  unitToggleTextActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  heightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heightInput: {
    flex: 1,
    minWidth: 60,
  },
  heightSeparator: {
    color: '#9ca3af',
    fontSize: 14,
  },
  deleteConfirmContent: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    borderWidth: 1,
    borderColor: '#374151',
  },
  deleteConfirmTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  deleteConfirmMessage: {
    color: '#9ca3af',
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 22,
  },
  deleteConfirmButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  deleteConfirmCancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#374151',
  },
  deleteConfirmCancelText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteConfirmDeleteButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#ef4444',
  },
  deleteConfirmDeleteText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
