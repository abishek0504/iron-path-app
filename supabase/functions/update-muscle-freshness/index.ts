/**
 * Edge Function: Update Muscle Freshness
 *
 * Triggered automatically when a workout session is marked as 'completed'.
 * Implements the Banister Impulse-Response model for continuous muscle recovery tracking.
 *
 * Flow:
 * 1. Authenticate caller (service-role bearer for DB trigger; user JWT for client)
 * 2. Verify session ownership (prevents cross-user freshness corruption)
 * 3. Fetch session exercises and sets
 * 4. Calculate stress per muscle using existing biomechanical model
 * 5. Hit muscles → freshness = 0; non-hit muscles → Banister decay
 * 6. Upsert all rows to v2_muscle_freshness in one batch
 *
 * Security model:
 *   - Service-role bearer (SUPABASE_SERVICE_ROLE_KEY) is treated as trusted
 *     (only the DB trigger uses this path).
 *   - Any other bearer is treated as a user JWT and validated via auth.getUser().
 *     The body's user_id is ignored in the user-JWT path; we always derive
 *     user_id from the verified JWT.
 *   - In both paths, session_id ownership is verified against v2_workout_sessions.
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
  adductors: 0.060,
};

const DEFAULT_LAMBDA = 0.041;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function normalizeMuscleKey(raw: unknown): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase().replace(/\s+/g, '_');
}

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

function applyDecay(initialFatigue: number, hoursElapsed: number, lambda: number): number {
  const fatigue = initialFatigue * Math.exp(-lambda * hoursElapsed);
  return Math.max(0, Math.min(100, fatigue));
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse({ error: 'Server misconfigured' }, 500);
    }

    const authHeader = req.headers.get('authorization') ?? '';
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!bearer) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    const body = await req.json().catch(() => null) as
      | { user_id?: unknown; session_id?: unknown }
      | null;
    const sessionIdRaw = body?.session_id;
    if (typeof sessionIdRaw !== 'string' || !sessionIdRaw || !isUuid(sessionIdRaw)) {
      return jsonResponse({ error: 'Missing or invalid session_id' }, 400);
    }
    const sessionId = sessionIdRaw;

    // Service client bypasses RLS for the actual mutations / cross-table reads
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Resolve userId
    //  - service-role bearer: trust body user_id (DB trigger path)
    //  - any other bearer: verify it's a real user JWT, derive userId from it
    let userId: string;
    if (bearer === serviceRoleKey) {
      const bodyUserId = body?.user_id;
      if (typeof bodyUserId !== 'string' || !bodyUserId) {
        return jsonResponse({ error: 'Missing user_id (service-role caller)' }, 400);
      }
      userId = bodyUserId;
    } else {
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: userData, error: userErr } = await authClient.auth.getUser(bearer);
      if (userErr || !userData?.user) {
        return jsonResponse({ error: 'Invalid or expired token' }, 401);
      }
      userId = userData.user.id;
    }

    // Ownership check: session must belong to userId. Always enforced (both paths).
    const { data: ownership, error: ownershipErr } = await serviceClient
      .from('v2_workout_sessions')
      .select('user_id, status')
      .eq('id', sessionId)
      .maybeSingle();

    if (ownershipErr) {
      console.error('Ownership check failed:', ownershipErr.message);
      return jsonResponse({ error: 'Failed to verify session ownership' }, 500);
    }
    if (!ownership) {
      return jsonResponse({ error: 'Session not found' }, 404);
    }
    if (ownership.user_id !== userId) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }
    if (ownership.status !== 'completed') {
      return jsonResponse({ error: 'Session must be completed' }, 409);
    }

    // 1. Fetch session exercises
    const { data: sessionExercises, error: seError } = await serviceClient
      .from('v2_session_exercises')
      .select('id, exercise_id, custom_exercise_id')
      .eq('session_id', sessionId);

    if (seError) throw seError;
    if (!sessionExercises || sessionExercises.length === 0) {
      return jsonResponse({ message: 'No exercises in session' }, 200);
    }

    const sessionExerciseIds = sessionExercises.map(se => se.id);

    // 2. Fetch sets for these exercises (warmups don't contribute meaningful stress)
    const { data: sets, error: setsError } = await serviceClient
      .from('v2_session_sets')
      .select('session_exercise_id, reps, weight, rpe, rir, duration_sec')
      .in('session_exercise_id', sessionExerciseIds)
      .neq('set_type', 'warmup');

    if (setsError) throw setsError;

    // 3. Get exercise metadata in parallel
    const masterIds = new Set<string>();
    const customIds = new Set<string>();

    for (const se of sessionExercises) {
      if (se.exercise_id) masterIds.add(se.exercise_id);
      if (se.custom_exercise_id) customIds.add(se.custom_exercise_id);
    }

    const [masterMeta, customMeta] = await Promise.all([
      masterIds.size > 0
        ? serviceClient
            .from('v2_exercises')
            .select('id, primary_muscles, implicit_hits, is_stretch')
            .in('id', Array.from(masterIds))
        : Promise.resolve({ data: [], error: null }),
      customIds.size > 0
        ? serviceClient
            .from('v2_user_custom_exercises')
            .select('id, primary_muscles, implicit_hits')
            .in('id', Array.from(customIds))
        : Promise.resolve({ data: [], error: null })
    ]);

    if (masterMeta.error) throw masterMeta.error;
    if (customMeta.error) throw customMeta.error;

    const exerciseMetaMap = new Map<string, { primary_muscles?: unknown; implicit_hits?: unknown; is_stretch?: boolean }>();
    for (const ex of [...(masterMeta.data || []), ...(customMeta.data || [])]) {
      exerciseMetaMap.set(ex.id, ex);
    }

    const stretchSessionExerciseIds = new Set<string>();
    for (const se of sessionExercises) {
      if (!se.exercise_id) continue;
      const meta = exerciseMetaMap.get(se.exercise_id);
      if (meta?.is_stretch) {
        stretchSessionExerciseIds.add(se.id);
      }
    }

    // 4. Calculate stress per muscle (stretches excluded — cooldown only, not training stress)
    const muscleStress: Record<string, number> = {};

    for (const set of sets || []) {
      if (stretchSessionExerciseIds.has(set.session_exercise_id)) continue;
      const se = sessionExercises.find(s => s.id === set.session_exercise_id);
      if (!se) continue;

      const exerciseId = se.exercise_id || se.custom_exercise_id;
      if (!exerciseId) continue;

      const meta = exerciseMetaMap.get(exerciseId);
      if (!meta) continue;

      const stimulus = calculateStimulus(set.rpe, set.rir);
      const muscleWeights = new Map<string, number>();

      if (Array.isArray(meta.primary_muscles)) {
        for (const m of meta.primary_muscles) {
          const key = normalizeMuscleKey(m);
          if (!key) continue;
          muscleWeights.set(key, (muscleWeights.get(key) || 0) + 1);
        }
      }

      if (meta.implicit_hits && typeof meta.implicit_hits === 'object') {
        for (const [m, w] of Object.entries(meta.implicit_hits as Record<string, unknown>)) {
          const key = normalizeMuscleKey(m);
          if (!key) continue;
          const weight = typeof w === 'number' ? w : 0;
          if (weight > 0) {
            muscleWeights.set(key, (muscleWeights.get(key) || 0) + weight);
          }
        }
      }

      let totalW = 0;
      for (const w of muscleWeights.values()) totalW += w;

      if (totalW > 0) {
        for (const [muscle, w] of muscleWeights.entries()) {
          const normalized = w / totalW;
          muscleStress[muscle] = (muscleStress[muscle] || 0) + stimulus * normalized;
        }
      }
    }

    const musclesHit = new Set(Object.keys(muscleStress));
    const now = new Date();

    // 5. Get all canonical muscles AND existing freshness in parallel (single query each — no per-muscle SELECT loop)
    const [musclesRes, existingRes] = await Promise.all([
      serviceClient.from('v2_muscles').select('key'),
      serviceClient
        .from('v2_muscle_freshness')
        .select('muscle_key, freshness, last_trained_at')
        .eq('user_id', userId),
    ]);

    if (musclesRes.error) throw musclesRes.error;
    if (existingRes.error) throw existingRes.error;

    const existingByMuscle = new Map<string, { freshness: number | null; last_trained_at: string | null }>();
    for (const row of existingRes.data || []) {
      existingByMuscle.set(row.muscle_key, {
        freshness: row.freshness,
        last_trained_at: row.last_trained_at,
      });
    }

    // 6. Build all updates in memory
    const freshnessUpdates: Array<{
      user_id: string;
      muscle_key: string;
      freshness: number;
      last_trained_at: string | null;
    }> = [];

    for (const muscle of musclesRes.data || []) {
      const muscleKey = muscle.key;

      if (musclesHit.has(muscleKey)) {
        freshnessUpdates.push({
          user_id: userId,
          muscle_key: muscleKey,
          freshness: 0,
          last_trained_at: now.toISOString(),
        });
        continue;
      }

      const current = existingByMuscle.get(muscleKey);
      if (current && current.last_trained_at) {
        const lastTrained = new Date(current.last_trained_at);
        const hoursElapsed = (now.getTime() - lastTrained.getTime()) / (1000 * 60 * 60);
        const lambda = MUSCLE_DECAY_CONSTANTS[muscleKey] ?? DEFAULT_LAMBDA;
        const currentFatigue = 100 - (current.freshness ?? 0);
        const newFatigue = applyDecay(currentFatigue, hoursElapsed, lambda);
        const newFreshness = 100 - newFatigue;

        freshnessUpdates.push({
          user_id: userId,
          muscle_key: muscleKey,
          freshness: Math.round(newFreshness * 10) / 10,
          last_trained_at: current.last_trained_at,
        });
      } else {
        freshnessUpdates.push({
          user_id: userId,
          muscle_key: muscleKey,
          freshness: 100,
          last_trained_at: null,
        });
      }
    }

    // 7. Single batch upsert
    const { error: upsertError } = await serviceClient
      .from('v2_muscle_freshness')
      .upsert(freshnessUpdates, { onConflict: 'user_id,muscle_key' });

    if (upsertError) throw upsertError;

    return jsonResponse(
      {
        success: true,
        musclesHit: musclesHit.size,
        musclesUpdated: freshnessUpdates.length,
      },
      200,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating muscle freshness:', message);
    return jsonResponse({ error: 'Failed to update muscle freshness' }, 500);
  }
});
