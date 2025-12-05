import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { Check, ArrowLeft, Search, X, ChevronDown, ChevronUp } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface EquipmentWeight {
  weight: string;
  quantity: number;
}

interface EquipmentItem {
  name: string;
  hasEditableWeights?: boolean;
  weightOptions?: string[];
  icon?: string;
}

interface EquipmentCategory {
  title: string;
  items: EquipmentItem[];
}

const EQUIPMENT_CATEGORIES: EquipmentCategory[] = [
  {
    title: 'Small weights',
    items: [
      { 
        name: 'Dumbbells',
        hasEditableWeights: true,
        weightOptions: ['2.5', '3.0', '5.0', '8.0', '10.0', '12.0', '15.0', '20.0', '25.0', '30.0', '35.0', '40.0', '45.0', '50.0', '55.0', '60.0', '65.0', '70.0', '75.0', '80.0', '85.0', '90.0', '95.0', '100.0']
      },
      { 
        name: 'Kettlebells',
        hasEditableWeights: true,
        weightOptions: ['9.0', '13.0', '18.0', '26.0', '35.0', '44.0', '53.0', '62.0', '70.0']
      },
      { 
        name: 'Medicine Balls',
        hasEditableWeights: true,
        weightOptions: ['4.0', '6.0', '8.0', '10.0', '12.0', '14.0', '16.0', '20.0']
      },
    ],
  },
  {
    title: 'Bars & plates',
    items: [
      { 
        name: 'Barbells',
        hasEditableWeights: true,
        weightOptions: ['35.0', '45.0']
      },
      { 
        name: 'Plates',
        hasEditableWeights: true,
        weightOptions: ['2.5', '5.0', '10.0', '25.0', '35.0', '45.0']
      },
      { name: 'EZ Bar' },
      { name: 'Landmine' },
      { name: 'PVC Pipe' },
      { name: "Farmer's Walk Handles" },
      { name: 'Trap Bar' },
      { name: 'Yoke' },
    ],
  },
  {
    title: 'Benches & racks',
    items: [
      { name: 'Pull Up Bar' },
      { name: 'Squat Rack' },
      { name: 'Flat Bench' },
      { name: 'Incline Bench' },
      { name: 'Decline Bench' },
      { name: 'Vertical Bench (Vertical Knee Raise)' },
      { name: 'Reverse Hyper Bench' },
      { name: 'Preacher Curl Bench' },
    ],
  },
  {
    title: '',
    items: [
      { name: 'Back Extension Bench' },
      { name: 'Glute Ham Raise Bench' },
      { name: 'Dip (Parallel) Bar' },
    ],
  },
  {
    title: 'Cable machines',
    items: [
      { name: 'Crossover Cable' },
      { name: 'Lat Pulldown Cable' },
      { name: 'Hi-Lo Pulley Cable' },
      { name: 'Row Cable' },
      { name: 'Rope Cable' },
    ],
  },
  {
    title: 'Resistance bands',
    items: [
      { 
        name: 'Handle Bands',
        hasEditableWeights: true,
        weightOptions: ['Extra Light', 'Light', 'Medium', 'Heavy', 'Extra Heavy']
      },
      { 
        name: 'Mini Loop Bands',
        hasEditableWeights: true,
        weightOptions: ['Extra Light', 'Light', 'Medium', 'Heavy', 'Extra Heavy']
      },
      { 
        name: 'Loop Bands',
        hasEditableWeights: true,
        weightOptions: ['Extra Light', 'Light', 'Medium', 'Heavy', 'Extra Heavy']
      },
    ],
  },
  {
    title: 'Exercise balls & more',
    items: [
      { name: 'BOSU® Balance Trainer' },
      { name: 'Stability (Swiss) Ball' },
      { name: 'Foam Roller' },
      { name: 'Parallette Bars' },
      { name: 'Ab Wheel' },
      { name: 'Tire' },
      { name: 'Box' },
      { name: 'Sled' },
      { name: 'Cone' },
      { name: 'Platforms' },
    ],
  },
  {
    title: 'Plated machines',
    items: [
      { name: 'Leg Press' },
      { name: 'Smith Machine' },
      { name: 'Hammerstrength (Leverage) Machine (all forms)' },
      { name: 'T Bar' },
    ],
  },
  {
    title: 'Weight machines',
    items: [
      { name: 'Ab Crunch Machine' },
      { name: 'Preacher Curl Machine' },
      { name: 'Bicep Curl Machine' },
      { name: 'Bench Press Machine' },
      { name: 'Leg Press Machine' },
      { name: 'Fly Machine' },
      { name: 'Thigh Adductor Machine' },
      { name: 'Leg Extension Machine' },
      { name: 'Hack Squat Machine' },
      { name: 'Tricep Dip Machine' },
      { name: 'Thigh Abductor Machine' },
      { name: 'Assisted Weight Machine' },
      { name: 'Calf Raise Machine' },
      { name: 'Squat Machine' },
      { name: 'Glute Kickback Machine' },
      { name: 'Freemotion Machine (all forms)' },
      { name: 'Row Machine' },
      { name: 'Triceps Extension Machine' },
      { name: 'Shoulder Press Machine' },
      { name: 'Leg Curl Machine' },
      { name: 'Shoulder Shrug Machine' },
      { name: 'Back Extension Machine' },
    ],
  },
  {
    title: 'Rope & suspension',
    items: [
      { name: 'TRX' },
      { name: 'Battle Ropes' },
      { name: 'Rings' },
      { name: 'Rope' },
    ],
  },
];

export default function OnboardingEquipmentScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Set<string>>(new Set());
  const [equipmentDetails, setEquipmentDetails] = useState<Map<string, EquipmentWeight[]>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedEquipment, setExpandedEquipment] = useState<string | null>(null);

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

  const handleEquipmentClick = (equipmentName: string, item: EquipmentItem) => {
    if (item.hasEditableWeights && item.weightOptions) {
      // Toggle expansion for equipment with editable weights
      if (expandedEquipment === equipmentName) {
        setExpandedEquipment(null);
      } else {
        setExpandedEquipment(equipmentName);
        // Initialize with one weight entry if none exist
        const existingWeights = equipmentDetails.get(equipmentName);
        if (!existingWeights || existingWeights.length === 0) {
          const newDetails = new Map(equipmentDetails);
          newDetails.set(equipmentName, [{ weight: item.weightOptions[0], quantity: 1 }]);
          setEquipmentDetails(newDetails);
          setSelectedEquipment(new Set(selectedEquipment).add(equipmentName));
        }
      }
    } else {
      // Toggle selection for regular equipment
      handleEquipmentToggle(equipmentName);
    }
  };

  const handleEquipmentToggle = (equipmentName: string) => {
    const newSelected = new Set(selectedEquipment);
    if (newSelected.has(equipmentName)) {
      newSelected.delete(equipmentName);
      equipmentDetails.delete(equipmentName);
      setEquipmentDetails(new Map(equipmentDetails));
      if (expandedEquipment === equipmentName) {
        setExpandedEquipment(null);
      }
    } else {
      newSelected.add(equipmentName);
    }
    setSelectedEquipment(newSelected);
  };

  const handleAddWeight = (equipmentName: string, item: EquipmentItem) => {
    if (!item.weightOptions || item.weightOptions.length === 0) return;
    
    const existingWeights = equipmentDetails.get(equipmentName) || [];
      const newWeights = [...existingWeights, { weight: item.weightOptions[0], quantity: 1 }];
    const newDetails = new Map(equipmentDetails);
    newDetails.set(equipmentName, newWeights);
    setEquipmentDetails(newDetails);
    setSelectedEquipment(new Set(selectedEquipment).add(equipmentName));
  };

  const handleRemoveWeight = (equipmentName: string, index: number) => {
    const existingWeights = equipmentDetails.get(equipmentName) || [];
    const newWeights = existingWeights.filter((_, i) => i !== index);
    const newDetails = new Map(equipmentDetails);
    
    if (newWeights.length === 0) {
      newDetails.delete(equipmentName);
      const newSelected = new Set(selectedEquipment);
      newSelected.delete(equipmentName);
      setSelectedEquipment(newSelected);
      setExpandedEquipment(null);
    } else {
      newDetails.set(equipmentName, newWeights);
    }
    setEquipmentDetails(newDetails);
  };

  const handleWeightChange = (equipmentName: string, index: number, weight: string) => {
    const existingWeights = equipmentDetails.get(equipmentName) || [];
    const newWeights = [...existingWeights];
    newWeights[index].weight = weight;
    const newDetails = new Map(equipmentDetails);
    newDetails.set(equipmentName, newWeights);
    setEquipmentDetails(newDetails);
  };

  const handleQuantityChange = (equipmentName: string, index: number, quantity: string) => {
    const qty = parseInt(quantity) || 0;
    if (qty >= 0) {
      const existingWeights = equipmentDetails.get(equipmentName) || [];
      const newWeights = [...existingWeights];
      newWeights[index].quantity = qty;
      const newDetails = new Map(equipmentDetails);
      newDetails.set(equipmentName, newWeights);
      setEquipmentDetails(newDetails);
      if (qty > 0) {
        setSelectedEquipment(new Set(selectedEquipment).add(equipmentName));
      }
    }
  };

  const getDisplayWeights = (equipmentName: string): string => {
    const weights = equipmentDetails.get(equipmentName);
    if (weights && weights.length > 0) {
      return weights.map(w => `${w.weight} (${w.quantity}x)`).join(', ');
    }
    return '';
  };

  const saveEquipment = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const equipmentArray = Array.from(selectedEquipment).map(name => {
        const weights = equipmentDetails.get(name);
        return weights && weights.length > 0 
          ? { name, weights: weights.map(w => ({ weight: w.weight, quantity: w.quantity })) }
          : name;
      });
      
      const { error } = await supabase
        .from('profiles')
        .update({
          equipment_access: equipmentArray,
        })
        .eq('id', user.id);

      if (error) {
        console.error('Error updating equipment:', error);
        Alert.alert('Error', 'Failed to save equipment. Please try again.');
        setLoading(false);
      } else {
        // Continue to next step in onboarding (personal info - step 4)
        router.replace({
          pathname: '/onboarding',
          params: { step: '5' }
        });
      }
    } else {
      Alert.alert('Error', 'You must be logged in to continue.');
      setLoading(false);
    }
  };

  const filteredCategories = EQUIPMENT_CATEGORIES.map(category => ({
    ...category,
    items: category.items.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter(category => category.items.length > 0 || !searchQuery);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={safeBack} style={styles.backButton}>
          <ArrowLeft size={24} color="#a3e635" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace({
          pathname: '/onboarding',
          params: { step: '4' }
        })}>
          <Text style={styles.skipButton}>Skip</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color="#71717a" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search For Equipment"
          placeholderTextColor="#71717a"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <X size={20} color="#71717a" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView 
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Select the equipment you have available.</Text>
        <Text style={styles.subtitle}>You can edit this now or adjust later.</Text>

        {filteredCategories.map((category, categoryIndex) => (
          <View key={categoryIndex} style={styles.categorySection}>
            {category.title && (
              <Text style={styles.categoryTitle}>{category.title}</Text>
            )}
            {category.items.map((item, itemIndex) => {
              const isSelected = selectedEquipment.has(item.name);
              const isExpanded = expandedEquipment === item.name;
              const weights = equipmentDetails.get(item.name) || [];
              const displayWeights = getDisplayWeights(item.name);
              
              return (
                <View key={`${categoryIndex}-${itemIndex}`}>
                  <TouchableOpacity
                    style={[
                      styles.equipmentItem,
                      isSelected && styles.equipmentItemSelected
                    ]}
                    onPress={() => handleEquipmentClick(item.name, item)}
                    disabled={loading}
                  >
                    <View style={styles.equipmentContent}>
                      <View style={styles.equipmentIconPlaceholder}>
                        {/* Icon placeholder - can be replaced with actual icons */}
                      </View>
                      <View style={styles.equipmentTextContainer}>
                        <Text style={[
                          styles.equipmentName,
                          isSelected && styles.equipmentNameSelected
                        ]}>
                          {item.name}
                        </Text>
                        {isSelected && displayWeights && !item.hasEditableWeights && (
                          <Text style={styles.weightsText}>{displayWeights}</Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.rightSection}>
                      {item.hasEditableWeights && (
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            handleEquipmentClick(item.name, item);
                          }}
                          style={styles.expandButton}
                        >
                          {isExpanded ? (
                            <ChevronUp size={20} color="#a3e635" />
                          ) : (
                            <ChevronDown size={20} color="#a1a1aa" />
                          )}
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          handleEquipmentToggle(item.name);
                        }}
                      >
                        <View style={[
                          styles.checkbox,
                          isSelected && styles.checkboxSelected
                        ]}>
                          {isSelected && <Check size={16} color="#09090b" />}
                        </View>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>

                  {/* Expanded weight input section */}
                  {isExpanded && item.hasEditableWeights && item.weightOptions && (
                    <View style={styles.expandedContent}>
                      {weights.map((weight, weightIndex) => (
                        <View key={weightIndex} style={styles.weightRow}>
                          <View style={styles.weightInputContainer}>
                            <Text style={styles.weightLabel}>Weight</Text>
                            <ScrollView 
                              horizontal 
                              showsHorizontalScrollIndicator={false}
                              style={styles.weightPicker}
                            >
                              {item.weightOptions?.map((weightOption) => (
                                <TouchableOpacity
                                  key={weightOption}
                                  style={[
                                    styles.weightOption,
                                    weight.weight === weightOption && styles.weightOptionSelected
                                  ]}
                                  onPress={() => handleWeightChange(item.name, weightIndex, weightOption)}
                                >
                                  <Text style={[
                                    styles.weightOptionText,
                                    weight.weight === weightOption && styles.weightOptionTextSelected
                                  ]}>
                                    {weightOption}
                                  </Text>
                                </TouchableOpacity>
                              )) || []}
                            </ScrollView>
                          </View>
                          <View style={styles.quantityContainer}>
                            <Text style={styles.weightLabel}>Qty</Text>
                            <TextInput
                              style={styles.quantityInput}
                              value={weight.quantity.toString()}
                              onChangeText={(text) => handleQuantityChange(item.name, weightIndex, text)}
                              keyboardType="number-pad"
                              placeholder="0"
                              placeholderTextColor="#71717a"
                            />
                          </View>
                          <TouchableOpacity
                            onPress={() => handleRemoveWeight(item.name, weightIndex)}
                            style={styles.removeButton}
                          >
                            <X size={20} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      ))}

                      <TouchableOpacity
                        onPress={() => handleAddWeight(item.name, item)}
                        style={styles.addWeightButton}
                      >
                        <Text style={styles.addWeightText}>+ Add Weight</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity
        style={[styles.nextButton, loading && styles.nextButtonDisabled]}
        onPress={saveEquipment}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#09090b" />
        ) : (
          <Text style={styles.nextButtonText}>Next</Text>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#09090b', // zinc-950
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  skipButton: {
    color: '#a3e635', // lime-400
    fontSize: 16,
    fontWeight: '600',
    padding: 8,
  },
  searchContainer: {
    position: 'absolute',
    bottom: 120, // Position above the footer button
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24, 24, 27, 0.95)', // zinc-900/95
    borderRadius: 36, // rounded-3xl
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 10,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 200, // Extra padding for search bar and footer
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#a1a1aa', // zinc-400
    marginBottom: 32,
  },
  categorySection: {
    marginBottom: 32,
  },
  categoryTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    fontStyle: 'italic',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  equipmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    borderRadius: 24, // rounded-3xl
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
  },
  equipmentItemSelected: {
    borderColor: '#a3e635', // lime-400
    backgroundColor: 'rgba(163, 230, 53, 0.05)', // lime-400/5
  },
  equipmentContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  equipmentIconPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#27272a', // zinc-800
    marginRight: 16,
  },
  equipmentTextContainer: {
    flex: 1,
  },
  equipmentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  equipmentNameSelected: {
    color: '#ffffff',
  },
  weightsText: {
    fontSize: 14,
    color: '#a1a1aa', // zinc-400
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  expandButton: {
    padding: 8,
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
  },
  checkboxSelected: {
    borderColor: '#a3e635', // lime-400
    backgroundColor: '#a3e635', // lime-400
  },
  expandedContent: {
    backgroundColor: 'rgba(24, 24, 27, 0.9)', // zinc-900/90
    borderRadius: 24, // rounded-3xl
    padding: 20,
    marginTop: -12,
    marginBottom: 12,
    marginLeft: 0,
    marginRight: 0,
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
    borderTopWidth: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  weightInputContainer: {
    flex: 1,
  },
  weightLabel: {
    fontSize: 12,
    color: '#a1a1aa', // zinc-400
    marginBottom: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  weightPicker: {
    flexDirection: 'row',
  },
  weightOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(39, 39, 42, 0.5)', // zinc-800/50
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
    marginRight: 8,
  },
  weightOptionSelected: {
    backgroundColor: '#a3e635', // lime-400
    borderColor: '#a3e635', // lime-400
  },
  weightOptionText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  weightOptionTextSelected: {
    color: '#09090b', // zinc-950
  },
  quantityContainer: {
    width: 80,
  },
  quantityInput: {
    backgroundColor: 'rgba(39, 39, 42, 0.5)', // zinc-800/50
    borderRadius: 16,
    padding: 12,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
  },
  removeButton: {
    padding: 12,
    marginTop: 24,
  },
  addWeightButton: {
    backgroundColor: 'rgba(163, 230, 53, 0.1)', // lime-400/10
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#a3e635', // lime-400
    marginTop: 8,
  },
  addWeightText: {
    color: '#a3e635', // lime-400
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    backgroundColor: '#a3e635', // lime-400
    borderRadius: 36, // rounded-3xl capsule shape
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    color: '#09090b', // zinc-950
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
