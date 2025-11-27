import { useState, useEffect, useRef } from 'react';
<<<<<<< Updated upstream
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Modal, Image, ActivityIndicator, Platform, Animated } from 'react-native';
=======
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Modal, ActivityIndicator, Platform, Animated, Switch } from 'react-native';
import { Image } from 'expo-image';
>>>>>>> Stashed changes
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Camera, Upload, X, Check } from 'lucide-react-native';

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];
const GOALS = ['Strength', 'Hypertrophy', 'Endurance', 'Weight Loss', 'General Fitness'];

export default function EditProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [currentWeight, setCurrentWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [height, setHeight] = useState('');
  const [goal, setGoal] = useState('');
  const [profilePictureUri, setProfilePictureUri] = useState<string | null>(null);

  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    loadProfile();
    requestImagePermission();
  }, []);

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
      router.back();
      return;
    }

    if (data) {
      setProfile(data);
      setFullName(data.full_name || '');
      setAge(data.age?.toString() || '');
      setGender(data.gender || '');
      setCurrentWeight(data.current_weight?.toString() || '');
      setGoalWeight(data.goal_weight?.toString() || '');
      setHeight(data.height?.toString() || '');
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

      // Resize and compress the image to 400x400 pixels
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 400, height: 400 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      const response = await fetch(manipulatedImage.uri);
      const blob = await response.blob();
      
      // Use jpg extension for consistency
      const fileName = `${user.id}-${Date.now()}.jpg`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
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
      console.log('File path:', filePath);

      // Update local state immediately for preview
      setProfilePictureUri(publicUrl);

      // Update database
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) {
        console.error('Database update error:', updateError);
        throw updateError;
      }

      // Reload profile to ensure state is in sync
      await loadProfile();
      
      Alert.alert('Success', 'Profile picture updated!');
    } catch (error: any) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', error.message || 'Failed to upload image. Please check that the avatars storage bucket exists and has proper permissions.');
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

      if (profilePictureUri) {
        // Extract the file path from the URL
        // Supabase URLs are typically: https://[project].supabase.co/storage/v1/object/public/avatars/[filename]
        const urlParts = profilePictureUri.split('/');
        const fileName = urlParts[urlParts.length - 1].split('?')[0]; // Remove query params if any
        const filePath = `avatars/${fileName}`;

        console.log('Deleting file from storage:', filePath);

        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from('avatars')
          .remove([filePath]);

        if (storageError) {
          console.error('Storage delete error:', storageError);
          // Continue with database update even if storage delete fails
        }
      }

      // Update database to remove avatar_url
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id);

      if (updateError) throw updateError;

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

  const showToastMessage = () => {
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
        router.back();
      });
    }, 2000);
  };

  const saveProfile = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const updateData: any = {
      full_name: fullName,
      age: age ? parseInt(age, 10) : null,
      gender: gender || null,
      current_weight: currentWeight ? parseFloat(currentWeight) : null,
      goal_weight: goalWeight ? parseFloat(goalWeight) : null,
      height: height ? parseFloat(height) : null,
      goal: goal || null,
<<<<<<< Updated upstream
=======
      use_imperial: useImperial,
      avatar_url: profilePictureUri || null,
>>>>>>> Stashed changes
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
      router.push('/(tabs)/profile?saved=true');
    }
  };

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
          <TouchableOpacity onPress={() => router.back()}>
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
                  <View style={styles.profilePictureWrapper}>
                    <Image 
                      key={profilePictureUri}
                      source={{ uri: profilePictureUri }} 
                      style={styles.profilePicture}
                      contentFit="cover"
                      transition={200}
                      onError={(error) => {
                        console.error('Image load error:', error);
                        console.error('Image URL:', profilePictureUri);
                      }}
                      onLoad={() => {
                        console.log('Image loaded successfully:', profilePictureUri);
                      }}
                    />
                  </View>
                ) : (
                  <View style={styles.placeholderPicture}>
                    <Text style={styles.placeholderPictureText}>No Photo</Text>
                  </View>
                )}
                {profilePictureUri && (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => {
                      console.log('Remove button pressed');
                      removeImage();
                    }}
                    disabled={uploading}
                  >
                    <X size={16} color="#ffffff" />
                  </TouchableOpacity>
                )}
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
          
<<<<<<< Updated upstream
=======
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
                    
                    // Use useImperial (current state) to determine what format the height is currently in
                    if (useImperial && !newUseImperial) {
                      // Currently in imperial, switching to metric
                      const feet = parseInt(heightFeet, 10);
                      const inches = parseInt(heightInches, 10);
                      if (!isNaN(feet) && !isNaN(inches)) {
                        const cm = ftInToCm(feet, inches);
                        setHeight(cm.toFixed(1));
                        setHeightFeet('');
                        setHeightInches('');
                      }
                    } else if (!useImperial && newUseImperial) {
                      // Currently in metric, switching to imperial
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
          
>>>>>>> Stashed changes
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
              <Text style={styles.label}>Current Weight (lbs)</Text>
              <TextInput
                style={styles.input}
                value={currentWeight}
                onChangeText={setCurrentWeight}
                keyboardType="numeric"
                placeholder="150"
                placeholderTextColor="#666"
              />
            </View>

            <View style={[styles.inputGroup, styles.halfWidth]}>
              <Text style={styles.label}>Goal Weight (lbs)</Text>
              <TextInput
                style={styles.input}
                value={goalWeight}
                onChangeText={setGoalWeight}
                keyboardType="numeric"
                placeholder="140"
                placeholderTextColor="#666"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Height (cm)</Text>
            <TextInput
              style={styles.input}
              value={height}
              onChangeText={setHeight}
              keyboardType="numeric"
              placeholder="175"
              placeholderTextColor="#666"
            />
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
<<<<<<< Updated upstream
=======
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
>>>>>>> Stashed changes
});
