/**
 * Idempotency job CRUD for generate-workout.
 */

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export type GenerationJobStatus = 'pending' | 'generated' | 'committed' | 'failed';

export interface GenerationJobRow {
  id: string;
  user_id: string;
  template_id: string;
  day_id: string;
  day_name: string;
  sessions_per_day: number;
  constraints: Record<string, unknown>;
  session_start_iso: string;
  session_end_iso_exclusive: string;
  status: GenerationJobStatus;
  sessions_json: unknown[] | null;
  slots_created: number;
  error_code: string | null;
  model: string | null;
  expires_at: string;
}

export interface UpsertPendingJobInput {
  id: string;
  userId: string;
  templateId: string;
  dayId: string;
  dayName: string;
  sessionsPerDay: number;
  constraints: Record<string, unknown>;
  sessionStartIso: string;
  sessionEndIsoExclusive: string;
}

export async function getGenerationJob(
  client: SupabaseClient,
  jobId: string,
  userId: string,
): Promise<GenerationJobRow | null> {
  const { data, error } = await client
    .from('v2_ai_generation_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('getGenerationJob failed:', error.message);
    return null;
  }

  return data as GenerationJobRow | null;
}

export async function upsertPendingJob(
  client: SupabaseClient,
  input: UpsertPendingJobInput,
): Promise<boolean> {
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const { error } = await client.from('v2_ai_generation_jobs').upsert(
    {
      id: input.id,
      user_id: input.userId,
      template_id: input.templateId,
      day_id: input.dayId,
      day_name: input.dayName,
      sessions_per_day: input.sessionsPerDay,
      constraints: input.constraints,
      session_start_iso: input.sessionStartIso,
      session_end_iso_exclusive: input.sessionEndIsoExclusive,
      status: 'pending',
      sessions_json: null,
      slots_created: 0,
      error_code: null,
      model: null,
      updated_at: new Date().toISOString(),
      expires_at: expiresAt,
    },
    { onConflict: 'id', ignoreDuplicates: false },
  );

  if (error) {
    console.error('upsertPendingJob failed:', error.message);
    return false;
  }

  return true;
}

export async function markJobGenerated(
  client: SupabaseClient,
  jobId: string,
  sessions: unknown[],
  model: string,
): Promise<boolean> {
  const { error } = await client
    .from('v2_ai_generation_jobs')
    .update({
      status: 'generated',
      sessions_json: sessions,
      model,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) {
    console.error('markJobGenerated failed:', error.message);
    return false;
  }

  return true;
}

export async function markJobFailed(
  client: SupabaseClient,
  jobId: string,
  errorCode: string,
): Promise<void> {
  await client
    .from('v2_ai_generation_jobs')
    .update({
      status: 'failed',
      error_code: errorCode.slice(0, 200),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);
}

export async function commitGenerationJob(
  client: SupabaseClient,
  jobId: string,
): Promise<{ slotsCreated: number } | null> {
  const { data, error } = await client.rpc('commit_ai_generation', {
    p_job_id: jobId,
  });

  if (error) {
    console.error('commit_ai_generation failed:', error.message);
    return null;
  }

  const slotsCreated = typeof data?.slots_created === 'number' ? data.slots_created : 0;
  return { slotsCreated };
}

export async function purgeExpiredJobs(client: SupabaseClient): Promise<void> {
  const { error } = await client.rpc('purge_expired_ai_generation_jobs');
  if (error) {
    console.error('purge_expired_ai_generation_jobs failed:', error.message);
  }
}
