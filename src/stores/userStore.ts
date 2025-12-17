/**
 * User Store (Zustand)
 * Caches user profile and preferences
 */

import { create } from 'zustand';
import { devLog } from '../lib/utils/logger';

export interface UserProfile {
  id: string;
  full_name?: string;
  age?: number;
  gender?: string;
  height?: number;
  current_weight?: number;
  goal_weight?: number;
  experience_level?: string;
  equipment_access?: string[];
  days_per_week?: number;
  workout_days?: string[];
  preferred_training_style?: string;
  use_imperial?: boolean;
  avatar_url?: string;
}

interface UserState {
  profile: UserProfile | null;
  isLoading: boolean;
  
  // Actions
  setProfile: (profile: UserProfile | null) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  clearProfile: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  profile: null,
  isLoading: false,
  
  setProfile: (profile) => {
    if (__DEV__) {
      devLog('user-store', { 
        action: 'setProfile', 
        hasProfile: !!profile,
        userId: profile?.id 
      });
    }
    set({ profile });
  },
  
  updateProfile: (updates) => {
    if (__DEV__) {
      devLog('user-store', { 
        action: 'updateProfile', 
        updateKeys: Object.keys(updates) 
      });
    }
    set((state) => ({
      profile: state.profile ? { ...state.profile, ...updates } : null,
    }));
  },
  
  clearProfile: () => {
    if (__DEV__) {
      devLog('user-store', { action: 'clearProfile' });
    }
    set({ profile: null });
  },
}));

