import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import type { GenerateWeekDayInput, WeekDayPlan, WeekJobRow } from './types.ts';

export async function getWeekJob(
  client: SupabaseClient,
  jobId: string,
  userId: string,
): Promise<WeekJobRow | null> {
  const { data, error } = await client
    .from('v2_ai_week_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('getWeekJob failed:', error.message);
    return null;
  }

  return data as WeekJobRow | null;
}

export async function upsertPendingWeekJob(
  client: SupabaseClient,
  input: {
    id: string;
    userId: string;
    templateId: string;
    mode: 'auto' | 'regenerate';
    weekStartDate: string;
    days: GenerateWeekDayInput[];
  },
): Promise<boolean> {
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const { error } = await client.from('v2_ai_week_jobs').upsert(
    {
      id: input.id,
      user_id: input.userId,
      template_id: input.templateId,
      mode: input.mode,
      week_start_date: input.weekStartDate,
      days_json: input.days,
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
    console.error('upsertPendingWeekJob failed:', error.message);
    return false;
  }
  return true;
}

export async function markWeekJobGenerated(
  client: SupabaseClient,
  jobId: string,
  sessions: WeekDayPlan[],
  model: string,
): Promise<boolean> {
  const { error } = await client
    .from('v2_ai_week_jobs')
    .update({
      status: 'generated',
      sessions_json: sessions,
      model,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) {
    console.error('markWeekJobGenerated failed:', error.message);
    return false;
  }
  return true;
}

export async function markWeekJobFailed(
  client: SupabaseClient,
  jobId: string,
  errorCode: string,
): Promise<void> {
  await client
    .from('v2_ai_week_jobs')
    .update({
      status: 'failed',
      error_code: errorCode.slice(0, 200),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);
}

export async function commitWeekJob(
  client: SupabaseClient,
  jobId: string,
): Promise<{ slotsCreated: number } | null> {
  const { data, error } = await client.rpc('commit_ai_week', {
    p_job_id: jobId,
  });

  if (error) {
    console.error('commit_ai_week failed:', error.message);
    return null;
  }

  const slotsCreated = typeof data?.slots_created === 'number' ? data.slots_created : 0;
  return { slotsCreated };
}

export async function purgeExpiredWeekJobs(client: SupabaseClient): Promise<void> {
  const { error } = await client.rpc('purge_expired_ai_week_jobs');
  if (error) {
    console.error('purge_expired_ai_week_jobs failed:', error.message);
  }
}
