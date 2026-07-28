export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      v2_ai_generation_jobs: {
        Row: {
          constraints: Json
          created_at: string
          day_id: string
          day_name: string
          error_code: string | null
          expires_at: string
          id: string
          model: string | null
          session_end_iso_exclusive: string
          session_start_iso: string
          sessions_json: Json | null
          sessions_per_day: number
          slots_created: number
          status: string
          template_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          constraints?: Json
          created_at?: string
          day_id: string
          day_name: string
          error_code?: string | null
          expires_at?: string
          id: string
          model?: string | null
          session_end_iso_exclusive: string
          session_start_iso: string
          sessions_json?: Json | null
          sessions_per_day: number
          slots_created?: number
          status?: string
          template_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          constraints?: Json
          created_at?: string
          day_id?: string
          day_name?: string
          error_code?: string | null
          expires_at?: string
          id?: string
          model?: string | null
          session_end_iso_exclusive?: string
          session_start_iso?: string
          sessions_json?: Json | null
          sessions_per_day?: number
          slots_created?: number
          status?: string
          template_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_ai_generation_jobs_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "v2_template_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_ai_generation_jobs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "v2_workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_ai_generations: {
        Row: {
          created_at: string
          day_name: string | null
          error_code: string | null
          exercise_count: number | null
          generation_job_id: string | null
          id: string
          latency_ms: number | null
          model: string | null
          sessions_per_day: number | null
          source: string
          template_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          day_name?: string | null
          error_code?: string | null
          exercise_count?: number | null
          generation_job_id?: string | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          sessions_per_day?: number | null
          source: string
          template_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          day_name?: string | null
          error_code?: string | null
          exercise_count?: number | null
          generation_job_id?: string | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          sessions_per_day?: number | null
          source?: string
          template_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_ai_generations_generation_job_id_fkey"
            columns: ["generation_job_id"]
            isOneToOne: false
            referencedRelation: "v2_ai_generation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_ai_generations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "v2_workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_ai_recommended_exercises: {
        Row: {
          created_at: string | null
          exercise_id: string
          is_active: boolean
          notes: string | null
          priority_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          exercise_id: string
          is_active?: boolean
          notes?: string | null
          priority_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          exercise_id?: string
          is_active?: boolean
          notes?: string | null
          priority_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_ai_recommended_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: true
            referencedRelation: "v2_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_daily_muscle_stress: {
        Row: {
          date: string
          muscle_key: string
          stress: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          date: string
          muscle_key: string
          stress?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          date?: string
          muscle_key?: string
          stress?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_daily_muscle_stress_muscle_key_fkey"
            columns: ["muscle_key"]
            isOneToOne: false
            referencedRelation: "v2_muscles"
            referencedColumns: ["key"]
          },
        ]
      }
      v2_exercise_prescriptions: {
        Row: {
          created_at: string | null
          duration_sec_max: number | null
          duration_sec_min: number | null
          exercise_id: string
          experience: string
          goal: string
          id: string
          is_active: boolean
          mode: string
          reps_max: number | null
          reps_min: number | null
          sets_max: number
          sets_min: number
          source_notes: string | null
          suggested_weight_kg: number | null
          suggested_weight_lbs: number | null
          suggested_weight_multiplier_bw: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          duration_sec_max?: number | null
          duration_sec_min?: number | null
          exercise_id: string
          experience: string
          goal: string
          id?: string
          is_active?: boolean
          mode: string
          reps_max?: number | null
          reps_min?: number | null
          sets_max: number
          sets_min: number
          source_notes?: string | null
          suggested_weight_kg?: number | null
          suggested_weight_lbs?: number | null
          suggested_weight_multiplier_bw?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          duration_sec_max?: number | null
          duration_sec_min?: number | null
          exercise_id?: string
          experience?: string
          goal?: string
          id?: string
          is_active?: boolean
          mode?: string
          reps_max?: number | null
          reps_min?: number | null
          sets_max?: number
          sets_min?: number
          source_notes?: string | null
          suggested_weight_kg?: number | null
          suggested_weight_lbs?: number | null
          suggested_weight_multiplier_bw?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_exercise_prescriptions_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "v2_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_exercises: {
        Row: {
          avg_time_per_set_sec: number
          created_at: string | null
          density_score: number
          description: string | null
          equipment_needed: string[] | null
          id: string
          implicit_hits: Json
          is_stretch: boolean
          is_timed: boolean
          is_unilateral: boolean
          movement_pattern: string | null
          name: string
          primary_muscles: string[]
          secondary_muscles: string[] | null
          setup_buffer_sec: number
          tempo_category: string | null
          updated_at: string | null
        }
        Insert: {
          avg_time_per_set_sec: number
          created_at?: string | null
          density_score: number
          description?: string | null
          equipment_needed?: string[] | null
          id?: string
          implicit_hits: Json
          is_stretch?: boolean
          is_timed?: boolean
          is_unilateral: boolean
          movement_pattern?: string | null
          name: string
          primary_muscles: string[]
          secondary_muscles?: string[] | null
          setup_buffer_sec: number
          tempo_category?: string | null
          updated_at?: string | null
        }
        Update: {
          avg_time_per_set_sec?: number
          created_at?: string | null
          density_score?: number
          description?: string | null
          equipment_needed?: string[] | null
          id?: string
          implicit_hits?: Json
          is_stretch?: boolean
          is_timed?: boolean
          is_unilateral?: boolean
          movement_pattern?: string | null
          name?: string
          primary_muscles?: string[]
          secondary_muscles?: string[] | null
          setup_buffer_sec?: number
          tempo_category?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      v2_health_sync: {
        Row: {
          last_synced_at: string | null
          types: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          last_synced_at?: string | null
          types?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          last_synced_at?: string | null
          types?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      v2_muscle_freshness: {
        Row: {
          freshness: number
          last_trained_at: string | null
          muscle_key: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          freshness?: number
          last_trained_at?: string | null
          muscle_key: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          freshness?: number
          last_trained_at?: string | null
          muscle_key?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_muscle_freshness_muscle_key_fkey"
            columns: ["muscle_key"]
            isOneToOne: false
            referencedRelation: "v2_muscles"
            referencedColumns: ["key"]
          },
        ]
      }
      v2_muscles: {
        Row: {
          created_at: string | null
          display_name: string
          group: string | null
          is_active: boolean | null
          key: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_name: string
          group?: string | null
          is_active?: boolean | null
          key: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string
          group?: string | null
          is_active?: boolean | null
          key?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      v2_profiles: {
        Row: {
          app_tour_completed_at: string | null
          avatar_url: string | null
          created_at: string | null
          current_weight: number | null
          date_of_birth: string | null
          days_per_week: number | null
          deleted_at: string | null
          equipment_access: string[] | null
          experience_level: string | null
          first_name: string
          gender: string | null
          goal: string | null
          goal_weight: number | null
          height: number | null
          id: string
          last_name: string | null
          preferred_training_style: string | null
          revenuecat_app_user_id: string | null
          scheduled_purge_at: string | null
          subscription_expires_at: string | null
          subscription_tier: string
          updated_at: string | null
          use_imperial: boolean | null
          workout_days: string[] | null
        }
        Insert: {
          app_tour_completed_at?: string | null
          avatar_url?: string | null
          created_at?: string | null
          current_weight?: number | null
          date_of_birth?: string | null
          days_per_week?: number | null
          deleted_at?: string | null
          equipment_access?: string[] | null
          experience_level?: string | null
          first_name: string
          gender?: string | null
          goal?: string | null
          goal_weight?: number | null
          height?: number | null
          id: string
          last_name?: string | null
          preferred_training_style?: string | null
          revenuecat_app_user_id?: string | null
          scheduled_purge_at?: string | null
          subscription_expires_at?: string | null
          subscription_tier?: string
          updated_at?: string | null
          use_imperial?: boolean | null
          workout_days?: string[] | null
        }
        Update: {
          app_tour_completed_at?: string | null
          avatar_url?: string | null
          created_at?: string | null
          current_weight?: number | null
          date_of_birth?: string | null
          days_per_week?: number | null
          deleted_at?: string | null
          equipment_access?: string[] | null
          experience_level?: string | null
          first_name?: string
          gender?: string | null
          goal?: string | null
          goal_weight?: number | null
          height?: number | null
          id?: string
          last_name?: string | null
          preferred_training_style?: string | null
          revenuecat_app_user_id?: string | null
          scheduled_purge_at?: string | null
          subscription_expires_at?: string | null
          subscription_tier?: string
          updated_at?: string | null
          use_imperial?: boolean | null
          workout_days?: string[] | null
        }
        Relationships: []
      }
      v2_session_exercises: {
        Row: {
          created_at: string | null
          custom_exercise_id: string | null
          exercise_id: string | null
          id: string
          rest_sec: number | null
          session_id: string
          sort_order: number
          superset_group: number | null
        }
        Insert: {
          created_at?: string | null
          custom_exercise_id?: string | null
          exercise_id?: string | null
          id?: string
          rest_sec?: number | null
          session_id: string
          sort_order: number
          superset_group?: number | null
        }
        Update: {
          created_at?: string | null
          custom_exercise_id?: string | null
          exercise_id?: string | null
          id?: string
          rest_sec?: number | null
          session_id?: string
          sort_order?: number
          superset_group?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_session_exercises_custom_exercise_id_fkey"
            columns: ["custom_exercise_id"]
            isOneToOne: false
            referencedRelation: "v2_user_custom_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_session_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "v2_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_session_exercises_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v2_workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_session_sets: {
        Row: {
          duration_sec: number | null
          id: string
          notes: string | null
          performed_at: string | null
          reps: number | null
          rest_sec: number | null
          rir: number | null
          rpe: number | null
          session_exercise_id: string
          set_number: number
          set_type: string
          weight: number | null
        }
        Insert: {
          duration_sec?: number | null
          id?: string
          notes?: string | null
          performed_at?: string | null
          reps?: number | null
          rest_sec?: number | null
          rir?: number | null
          rpe?: number | null
          session_exercise_id: string
          set_number: number
          set_type?: string
          weight?: number | null
        }
        Update: {
          duration_sec?: number | null
          id?: string
          notes?: string | null
          performed_at?: string | null
          reps?: number | null
          rest_sec?: number | null
          rir?: number | null
          rpe?: number | null
          session_exercise_id?: string
          set_number?: number
          set_type?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_session_sets_session_exercise_id_fkey"
            columns: ["session_exercise_id"]
            isOneToOne: false
            referencedRelation: "v2_session_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_support: {
        Row: {
          created_at: string | null
          email: string
          id: string
          message: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          message: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          message?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      v2_template_days: {
        Row: {
          created_at: string | null
          day_name: string
          id: string
          sort_order: number
          template_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          day_name: string
          id?: string
          sort_order: number
          template_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          day_name?: string
          id?: string
          sort_order?: number
          template_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_template_days_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "v2_workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_template_slots: {
        Row: {
          created_at: string | null
          custom_exercise_id: string | null
          day_id: string
          exercise_id: string | null
          experience: string | null
          goal: string | null
          id: string
          notes: string | null
          rest_sec: number | null
          sort_order: number
          superset_group: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          custom_exercise_id?: string | null
          day_id: string
          exercise_id?: string | null
          experience?: string | null
          goal?: string | null
          id?: string
          notes?: string | null
          rest_sec?: number | null
          sort_order: number
          superset_group?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          custom_exercise_id?: string | null
          day_id?: string
          exercise_id?: string | null
          experience?: string | null
          goal?: string | null
          id?: string
          notes?: string | null
          rest_sec?: number | null
          sort_order?: number
          superset_group?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_template_slots_custom_exercise_id_fkey"
            columns: ["custom_exercise_id"]
            isOneToOne: false
            referencedRelation: "v2_user_custom_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_template_slots_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "v2_template_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_template_slots_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "v2_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_user_custom_exercises: {
        Row: {
          avg_time_per_set_sec: number
          created_at: string | null
          density_score: number
          description: string | null
          equipment_needed: string[] | null
          id: string
          implicit_hits: Json
          is_timed: boolean
          is_unilateral: boolean
          movement_pattern: string | null
          name: string
          primary_muscles: string[]
          secondary_muscles: string[] | null
          setup_buffer_sec: number
          tempo_category: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avg_time_per_set_sec: number
          created_at?: string | null
          density_score: number
          description?: string | null
          equipment_needed?: string[] | null
          id?: string
          implicit_hits: Json
          is_timed?: boolean
          is_unilateral: boolean
          movement_pattern?: string | null
          name: string
          primary_muscles: string[]
          secondary_muscles?: string[] | null
          setup_buffer_sec: number
          tempo_category?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avg_time_per_set_sec?: number
          created_at?: string | null
          density_score?: number
          description?: string | null
          equipment_needed?: string[] | null
          id?: string
          implicit_hits?: Json
          is_timed?: boolean
          is_unilateral?: boolean
          movement_pattern?: string | null
          name?: string
          primary_muscles?: string[]
          secondary_muscles?: string[] | null
          setup_buffer_sec?: number
          tempo_category?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      v2_user_exercise_overrides: {
        Row: {
          avg_time_per_set_sec_override: number | null
          created_at: string | null
          default_duration_sec: number | null
          default_reps: number | null
          default_rest_sec: number | null
          default_set_count: number | null
          default_weight: number | null
          density_score_override: number | null
          exercise_id: string
          implicit_hits_override: Json | null
          is_timed_override: boolean | null
          is_unilateral_override: boolean | null
          primary_muscles_override: string[] | null
          setup_buffer_sec_override: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avg_time_per_set_sec_override?: number | null
          created_at?: string | null
          default_duration_sec?: number | null
          default_reps?: number | null
          default_rest_sec?: number | null
          default_set_count?: number | null
          default_weight?: number | null
          density_score_override?: number | null
          exercise_id: string
          implicit_hits_override?: Json | null
          is_timed_override?: boolean | null
          is_unilateral_override?: boolean | null
          primary_muscles_override?: string[] | null
          setup_buffer_sec_override?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avg_time_per_set_sec_override?: number | null
          created_at?: string | null
          default_duration_sec?: number | null
          default_reps?: number | null
          default_rest_sec?: number | null
          default_set_count?: number | null
          default_weight?: number | null
          density_score_override?: number | null
          exercise_id?: string
          implicit_hits_override?: Json | null
          is_timed_override?: boolean | null
          is_unilateral_override?: boolean | null
          primary_muscles_override?: string[] | null
          setup_buffer_sec_override?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_user_exercise_overrides_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "v2_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_user_exercise_prs: {
        Row: {
          custom_exercise_id: string | null
          duration_sec: number | null
          exercise_id: string | null
          id: string
          performed_at: string
          pr_type: string
          reps: number | null
          session_exercise_id: string
          session_id: string
          set_id: string
          user_id: string
          weight: number | null
        }
        Insert: {
          custom_exercise_id?: string | null
          duration_sec?: number | null
          exercise_id?: string | null
          id?: string
          performed_at: string
          pr_type?: string
          reps?: number | null
          session_exercise_id: string
          session_id: string
          set_id: string
          user_id: string
          weight?: number | null
        }
        Update: {
          custom_exercise_id?: string | null
          duration_sec?: number | null
          exercise_id?: string | null
          id?: string
          performed_at?: string
          pr_type?: string
          reps?: number | null
          session_exercise_id?: string
          session_id?: string
          set_id?: string
          user_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_user_exercise_prs_custom_exercise_id_fkey"
            columns: ["custom_exercise_id"]
            isOneToOne: false
            referencedRelation: "v2_user_custom_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_user_exercise_prs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "v2_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_user_exercise_prs_session_exercise_id_fkey"
            columns: ["session_exercise_id"]
            isOneToOne: false
            referencedRelation: "v2_session_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_user_exercise_prs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v2_workout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_user_exercise_prs_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "v2_session_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_weight_logs: {
        Row: {
          created_at: string | null
          hk_sample_uuid: string | null
          id: string
          recorded_at: string
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string | null
          hk_sample_uuid?: string | null
          id?: string
          recorded_at?: string
          user_id: string
          weight: number
        }
        Update: {
          created_at?: string | null
          hk_sample_uuid?: string | null
          id?: string
          recorded_at?: string
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      v2_workout_preset_slots: {
        Row: {
          created_at: string
          custom_exercise_id: string | null
          exercise_id: string | null
          id: string
          notes: string | null
          preset_id: string
          rest_sec: number | null
          sort_order: number
          superset_group: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_exercise_id?: string | null
          exercise_id?: string | null
          id?: string
          notes?: string | null
          preset_id: string
          rest_sec?: number | null
          sort_order: number
          superset_group?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_exercise_id?: string | null
          exercise_id?: string | null
          id?: string
          notes?: string | null
          preset_id?: string
          rest_sec?: number | null
          sort_order?: number
          superset_group?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_workout_preset_slots_custom_exercise_id_fkey"
            columns: ["custom_exercise_id"]
            isOneToOne: false
            referencedRelation: "v2_user_custom_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_workout_preset_slots_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "v2_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_workout_preset_slots_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "v2_workout_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_workout_presets: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      v2_workout_sessions: {
        Row: {
          completed_at: string | null
          day_name: string | null
          hk_workout_uuid: string | null
          id: string
          origin: string
          started_at: string | null
          status: string
          template_id: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          day_name?: string | null
          hk_workout_uuid?: string | null
          id?: string
          origin?: string
          started_at?: string | null
          status?: string
          template_id?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          day_name?: string | null
          hk_workout_uuid?: string | null
          id?: string
          origin?: string
          started_at?: string | null
          status?: string
          template_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_workout_sessions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "v2_workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_workout_templates: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_bw_exercises: { Args: { pd: Json }; Returns: Json }
      adjust_plan_data: { Args: { pd: Json }; Returns: Json }
      commit_ai_generation: { Args: { p_job_id: string }; Returns: Json }
      convert_user_stored_weights: { Args: { p_to_imperial: boolean }; Returns: Json }
      migrate_rep_range: { Args: { value: Json }; Returns: Json }
      purge_expired_ai_generation_jobs: { Args: never; Returns: number }
      purge_soft_deleted_accounts: { Args: never; Returns: number }
      resolve_ai_exercise_targets: {
        Args: {
          p_ai_plan: Json
          p_bodyweight?: number
          p_exercise_id: string
          p_experience: string
          p_use_imperial?: boolean
        }
        Returns: {
          duration_sec: number
          reps: number
          sets: number
          weight: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
