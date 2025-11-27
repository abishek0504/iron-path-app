import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { Check } from 'lucide-react-native';

const EQUIPMENT_OPTIONS = [
  'Barbell',
  'Dumbbells',
  'Cable Machine',
  'Smith Machine',
  'Leg Press',
  'Pull-up Bar',
  'Kettlebells',
  'Resistance Bands',
  'Bodyweight Only'
];

export default function OnboardingEquipmentScreen() {
  const router = useRouter();

  const safeBack = () => {
    try {
      if (router.canGoBack && typeof router.canGoBack === 'function' && router.canGoBack()) {
        router.back();
      } else {
        router.push('/onboarding');
      }
    } catch (error) {
      router.push('/onboarding');
    }
  };
  const [loading, setLoading] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [fullGymAccess, setFullGymAccess] = useState(false);

  const handleFullGymToggle = () => {
    if (fullGymAccess) {
      setFullGymAccess(false);
      setSelectedEquipment([]);
    } else {
      setFullGymAccess(true);
      setSelectedEquipment([...EQUIPMENT_OPTIONS]);
    }
  };

  const handleEquipmentToggle = (equipment: string) => {
    if (fullGymAccess) {
      return;
    }

    if (selectedEquipment.includes(equipment)) {
      setSelectedEquipment(selectedEquipment.filter(eq => eq !== equipment));
    } else {
      setSelectedEquipment([...selectedEquipment, equipment]);
    }
  };

  const saveEquipment = async () => {
    if (!fullGymAccess && selectedEquipment.length === 0) {
      Alert.alert("Selection Required", "Please select at least one equipment option or choose Full Gym Access.");
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const equipmentToSave = fullGymAccess ? EQUIPMENT_OPTIONS : selectedEquipment;
      
      const { error } = await supabase
        .from('profiles')
        .update({
          equipment_access: equipmentToSave,
        })
        .eq('id', user.id);

      if (error) {
        Alert.alert("Error", error.message);
        setLoading(false);
      } else {
        router.replace('/(tabs)/home');
      }
    } else {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Equipment Access</Text>
      <Text style={styles.subtitle}>What equipment do you have access to?</Text>

      <View style={styles.fullGymContainer}>
        <TouchableOpacity
          style={[styles.checkboxContainer, fullGymAccess && styles.checkboxContainerSelected]}
          onPress={handleFullGymToggle}
          disabled={loading}
        >
          <View style={[styles.checkbox, fullGymAccess && styles.checkboxSelected]}>
            {fullGymAccess && <Check size={20} color="#ffffff" />}
          </View>
          <Text style={[styles.checkboxLabel, fullGymAccess && styles.checkboxLabelSelected]}>
            Full Gym Access
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Individual Equipment</Text>
      <View style={styles.equipmentList}>
        {EQUIPMENT_OPTIONS.map((equipment) => {
          const isSelected = selectedEquipment.includes(equipment);
          const isDisabled = fullGymAccess;

          return (
            <TouchableOpacity
              key={equipment}
              style={[
                styles.equipmentItem,
                isSelected && styles.equipmentItemSelected,
                isDisabled && styles.equipmentItemDisabled
              ]}
              onPress={() => handleEquipmentToggle(equipment)}
              disabled={isDisabled || loading}
            >
              <View style={[
                styles.checkbox,
                isSelected && styles.checkboxSelected,
                isDisabled && styles.checkboxDisabled
              ]}>
                {isSelected && <Check size={18} color="#ffffff" />}
              </View>
              <Text style={[
                styles.equipmentText,
                isSelected && styles.equipmentTextSelected,
                isDisabled && styles.equipmentTextDisabled
              ]}>
                {equipment}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.buttonSecondary}
          onPress={safeBack}
          disabled={loading}
        >
          <Text style={styles.buttonSecondaryText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.buttonPrimary, loading && styles.buttonDisabled]}
          onPress={saveEquipment}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Saving..." : "Continue"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#111827',
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 8,
  },
  subtitle: {
    color: '#9ca3af',
    marginBottom: 32,
    fontSize: 16,
  },
  fullGymContainer: {
    marginBottom: 32,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#374151',
  },
  checkboxContainerSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#1e3a8a',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#6b7280',
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#3b82f6',
  },
  checkboxDisabled: {
    borderColor: '#4b5563',
    backgroundColor: '#374151',
    opacity: 0.5,
  },
  checkboxLabel: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  checkboxLabelSelected: {
    color: '#ffffff',
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  equipmentList: {
    marginBottom: 32,
  },
  equipmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 12,
  },
  equipmentItemSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#1e3a8a',
  },
  equipmentItemDisabled: {
    opacity: 0.5,
  },
  equipmentText: {
    color: '#9ca3af',
    fontSize: 16,
    flex: 1,
  },
  equipmentTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  equipmentTextDisabled: {
    color: '#6b7280',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  buttonPrimary: {
    flex: 1,
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonSecondary: {
    flex: 1,
    backgroundColor: '#374151',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 18,
  },
  buttonSecondaryText: {
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 18,
  },
});

