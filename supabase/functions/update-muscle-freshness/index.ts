/**
 * Edge Function: Update Muscle Freshness
 * 
 * Triggered automatically when a workout session is marked as 'completed'.
 * Implements the Banister Impulse-Response model for continuous muscle recovery tracking.
 * 
 * Flow:
 * 1. Fetch session exercises and sets for the completed session
 * 2. Calculate stress per muscle using existing biomechanical model
 * 3. For muscles hit in session: Set freshness = 0 (fully fatigued)
 * 4. For all other muscles: Apply exponential decay based on time elapsed
 * 5. Upsert to v2_muscle_freshness table
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

// Decay constants (λ) for different muscle groups
// λ = ln(2) / half-life (in hours)
const MUSCLE_DECAY_CONSTANTS: Record<string, number> = {
  // Slow recovery (λ=0.020, half-life ~35h)
  lower_back: 0.020,
  hamstrings: 0.020,
  
  // Medium recovery (λ=0.041, half-life ~17h)
  chest: 0.041,
  upper_chest: 0.041,
  lower_chest: 0.041,
  quads: 0.041,
  lats: 0.041,
  glutes: 0.041,
  upper_back: 0.041,
  traps: 0.041,
  abs: 0.041,
  obliques: 0.041,
  
  // Fast recovery (λ=0.099, half-life ~7h)
  lateral_deltoids: 0.099,
  posterior_deltoids: 0.099,
  anterior_deltoids: 0.099,
  biceps: 0.099,
  triceps: 0.099,
  calves: 0.099,
  soleus: 0.099,
  forearms: 0.099,
  
  // Stabilizers (medium-fast, λ=0.060, half-life ~12h)
  rotator_cuff: 0.060,
  serratus_anterior: 0.060,
  transverse_abdominis: 0.060,
  glute_medius: 0.060,
  glute_minimus: 0.060,
  piriformis: 0.060,
  tibialis_anterior: 0.060,
  hip_flexors: 0.060,
};

// Stimulus calculation (same as getMuscleStressStats)
function calculateStimulus(rpe?: number | null, rir?: number | null): number {
  const RPE_THRESHOLD = 5;
  const DEFAULT_STIMULUS = 0.6;
  
  if (rpe != null && typeof rpe === 'number') {
    return Math.max(0, Math.min(1, (rpe - RPE_THRESHOLD) / 5));
  } else if (rir != null && typeof rir === 'number') {
    const estRpe = 10 - rir;
    return Math.max(0, Math.min(1, (estRpe - RPE_THRESHOLD) / 5));
  }
  return DEFAULT_STIMULUS;
}

// Apply Banister decay formula
function applyDecay(initialFatigue: number, hoursElapsed: number, lambda: number): number {
  // Fatigue(t) = Fatigue₀ × e^(-λ × t)
  const fatigue = initialFatigue * Math.exp(-lambda * hoursElapsed);
  return Math.max(0, Math.min(100, fatigue));
}

Deno.serve(async (req) => {
  try {
    // Get request payload
    const { user_id, session_id } = await req.json();
    
    if (!user_id || !session_id) {
      return new Response(
        JSON.stringify({ error: 'Missing user_id or session_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // 1. Fetch session exercises for this session
    const { data: sessionExercises, error: seError } = await supabase
      .from('v2_session_exercises')
      .select('id, exercise_id, custom_exercise_id')
      .eq('session_id', session_id);
    
    if (seError) throw seError;
    if (!sessionExercises || sessionExercises.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No exercises in session' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const sessionExerciseIds = sessionExercises.map(se => se.id);
    
    // 2. Fetch sets for these exercises
    const { data: sets, error: setsError } = await supabase
      .from('v2_session_sets')
      .select('session_exercise_id, reps, weight, rpe, rir, duration_sec')
      .in('session_exercise_id', sessionExerciseIds);
    
    if (setsError) throw setsError;
    
    // 3. Get exercise metadata (primary_muscles + implicit_hits)
    const masterIds = new Set<string>();
    const customIds = new Set<string>();
    
    for (const se of sessionExercises) {
      if (se.exercise_id) masterIds.add(se.exercise_id);
      if (se.custom_exercise_id) customIds.add(se.custom_exercise_id);
    }
    
    const [masterMeta, customMeta] = await Promise.all([
      masterIds.size > 0
        ? supabase
            .from('v2_exercises')
            .select('id, primary_muscles, implicit_hits')
            .in('id', Array.from(masterIds))
        : Promise.resolve({ data: [], error: null }),
      customIds.size > 0
        ? supabase
            .from('v2_user_custom_exercises')
            .select('id, primary_muscles, implicit_hits')
            .in('id', Array.from(customIds))
        : Promise.resolve({ data: [], error: null })
    ]);
    
    if (masterMeta.error) throw masterMeta.error;
    if (customMeta.error) throw customMeta.error;
    
    const exerciseMetaMap = new Map();
    for (const ex of [...(masterMeta.data || []), ...(customMeta.data || [])]) {
      exerciseMetaMap.set(ex.id, ex);
    }
    
    // 4. Calculate stress per muscle for this session
    const muscleStress: Record<string, number> = {};
    
    for (const set of sets || []) {
      const se = sessionExercises.find(s => s.id === set.session_exercise_id);
      if (!se) continue;
      
      const exerciseId = se.exercise_id || se.custom_exercise_id;
      if (!exerciseId) continue;
      
      const meta = exerciseMetaMap.get(exerciseId);
      if (!meta) continue;
      
      // Calculate stimulus for this set
      const stimulus = calculateStimulus(set.rpe, set.rir);
      
      // Build muscle weights
      const muscleWeights = new Map<string, number>();
      
      if (Array.isArray(meta.primary_muscles)) {
        for (const m of meta.primary_muscles) {
          if (m) muscleWeights.set(m, (muscleWeights.get(m) || 0) + 1);
        }
      }
      
      if (meta.implicit_hits && typeof meta.implicit_hits === 'object') {
        for (const [m, w] of Object.entries(meta.implicit_hits)) {
          const weight = typeof w === 'number' ? w : 0;
          if (weight > 0) muscleWeights.set(m, (muscleWeights.get(m) || 0) + weight);
        }
      }
      
      // Normalize weights
      let totalW = 0;
      for (const w of muscleWeights.values()) totalW += w;
      
      if (totalW > 0) {
        for (const [muscle, w] of muscleWeights.entries()) {
          const normalized = w / totalW;
          muscleStress[muscle] = (muscleStress[muscle] || 0) + stimulus * normalized;
        }
      }
    }
    
    const musclesHit = Object.keys(muscleStress);
    const now = new Date();
    
    // 5. Get all canonical muscles
    const { data: allMuscles, error: musclesError } = await supabase
      .from('v2_muscles')
      .select('key');
    
    if (musclesError) throw musclesError;
    
    // 6. Prepare freshness updates
    const freshnessUpdates = [];
    
    for (const muscle of allMuscles || []) {
      const muscleKey = muscle.key;
      
      if (musclesHit.includes(muscleKey)) {
        // Muscle was hit in this session - fully fatigued
        freshnessUpdates.push({
          user_id,
          muscle_key: muscleKey,
          freshness: 0,
          last_trained_at: now.toISOString()
        });
      } else {
        // Muscle not hit - apply decay formula
        const { data: current } = await supabase
          .from('v2_muscle_freshness')
          .select('freshness, last_trained_at')
          .eq('user_id', user_id)
          .eq('muscle_key', muscleKey)
          .maybeSingle();
        
        if (current && current.last_trained_at) {
          const lastTrained = new Date(current.last_trained_at);
          const hoursElapsed = (now.getTime() - lastTrained.getTime()) / (1000 * 60 * 60);
          const lambda = MUSCLE_DECAY_CONSTANTS[muscleKey] || 0.041; // Default to medium
          const currentFatigue = 100 - (current.freshness || 0);
          const newFatigue = applyDecay(currentFatigue, hoursElapsed, lambda);
          const newFreshness = 100 - newFatigue;
          
          freshnessUpdates.push({
            user_id,
            muscle_key: muscleKey,
            freshness: Math.round(newFreshness * 10) / 10, // Round to 1 decimal
            last_trained_at: current.last_trained_at // Keep original
          });
        } else {
          // Never trained - keep at 100% fresh
          freshnessUpdates.push({
            user_id,
            muscle_key: muscleKey,
            freshness: 100,
            last_trained_at: null
          });
        }
      }
    }
    
    // 7. Upsert all freshness updates
    const { error: upsertError } = await supabase
      .from('v2_muscle_freshness')
      .upsert(freshnessUpdates, {
        onConflict: 'user_id,muscle_key'
      });
    
    if (upsertError) throw upsertError;
    
    return new Response(
      JSON.stringify({
        success: true,
        musclesHit: musclesHit.length,
        musclesUpdated: freshnessUpdates.length
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error updating muscle freshness:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
