-- AI generation should replace the day's plan, not append another copy
-- of the same lifts. Also skip duplicate exercise_ids inside one commit.

create or replace function public.clear_plan_day_for_ai_replace(
  p_user_id uuid,
  p_day_id uuid,
  p_session_start timestamptz,
  p_session_end timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.v2_template_slots
  where day_id = p_day_id;

  delete from public.v2_session_sets ss
  using public.v2_session_exercises se
  join public.v2_workout_sessions ws on ws.id = se.session_id
  where ss.session_exercise_id = se.id
    and ws.user_id = p_user_id
    and ws.status = 'active'
    and ws.started_at >= p_session_start
    and ws.started_at < p_session_end
    and not exists (
      select 1
      from public.v2_session_sets performed
      where performed.session_exercise_id = se.id
        and performed.performed_at is not null
    );

  delete from public.v2_session_exercises se
  using public.v2_workout_sessions ws
  where se.session_id = ws.id
    and ws.user_id = p_user_id
    and ws.status = 'active'
    and ws.started_at >= p_session_start
    and ws.started_at < p_session_end
    and not exists (
      select 1
      from public.v2_session_sets performed
      where performed.session_exercise_id = se.id
        and performed.performed_at is not null
    );

  delete from public.v2_workout_sessions ws
  where ws.user_id = p_user_id
    and ws.status = 'active'
    and ws.started_at >= p_session_start
    and ws.started_at < p_session_end
    and not exists (
      select 1
      from public.v2_session_exercises se
      where se.session_id = ws.id
    );
end;
$$;

revoke all on function public.clear_plan_day_for_ai_replace(uuid, uuid, timestamptz, timestamptz) from public;
revoke all on function public.clear_plan_day_for_ai_replace(uuid, uuid, timestamptz, timestamptz) from anon;
revoke all on function public.clear_plan_day_for_ai_replace(uuid, uuid, timestamptz, timestamptz) from authenticated;

create or replace function public.commit_ai_generation(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  job record;
  tmpl_user_id uuid;
  day_template_id uuid;
  experience text;
  bodyweight numeric;
  use_imperial boolean;
  sort_order int;
  session_ids uuid[];
  existing_count int;
  s_idx int;
  group_len int;
  e_idx int;
  plan jsonb;
  exercise_id uuid;
  target_session_id uuid;
  new_session_id uuid;
  slot_id uuid;
  se_id uuid;
  tgt record;
  set_n int;
  v_slots_created int := 0;
  v_seen uuid[] := '{}';
begin
  select *
  into job
  from public.v2_ai_generation_jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'generation_job_not_found';
  end if;

  if job.expires_at < now() then
    update public.v2_ai_generation_jobs
    set status = 'failed', error_code = 'job_expired', updated_at = now()
    where id = p_job_id;
    raise exception 'generation_job_expired';
  end if;

  if job.status = 'committed' then
    return jsonb_build_object('slots_created', job.slots_created);
  end if;

  if job.status <> 'generated' or job.sessions_json is null then
    raise exception 'generation_job_not_ready';
  end if;

  select t.user_id, d.template_id
  into tmpl_user_id, day_template_id
  from public.v2_template_days d
  join public.v2_workout_templates t on t.id = d.template_id
  where d.id = job.day_id;

  if tmpl_user_id is null or tmpl_user_id <> job.user_id or day_template_id <> job.template_id then
    update public.v2_ai_generation_jobs
    set status = 'failed', error_code = 'ownership_mismatch', updated_at = now()
    where id = p_job_id;
    raise exception 'generation_job_ownership_mismatch';
  end if;

  perform public.clear_plan_day_for_ai_replace(
    job.user_id,
    job.day_id,
    job.session_start_iso,
    job.session_end_iso_exclusive
  );

  select coalesce(p.experience_level, 'beginner'), p.current_weight, coalesce(p.use_imperial, true)
  into experience, bodyweight, use_imperial
  from public.v2_profiles p
  where p.id = job.user_id;

  select coalesce(max(ts.sort_order), 0)
  into sort_order
  from public.v2_template_slots ts
  where ts.day_id = job.day_id;

  select coalesce(array_agg(s.id order by s.started_at asc), array[]::uuid[])
  into session_ids
  from public.v2_workout_sessions s
  where s.user_id = job.user_id
    and s.started_at >= job.session_start_iso
    and s.started_at < job.session_end_iso_exclusive;

  existing_count := coalesce(array_length(session_ids, 1), 0);
  group_len := jsonb_array_length(job.sessions_json);

  for s_idx in 0..(group_len - 1) loop
    if (job.sessions_json->s_idx) is null
       or jsonb_array_length(job.sessions_json->s_idx) = 0 then
      continue;
    end if;

    if s_idx + 1 <= existing_count then
      target_session_id := session_ids[s_idx + 1];
    else
      insert into public.v2_workout_sessions (
        user_id, template_id, day_name, status, started_at
      ) values (
        job.user_id,
        job.template_id,
        job.day_name,
        'active',
        job.session_start_iso
      )
      returning id into new_session_id;
      target_session_id := new_session_id;
      existing_count := existing_count + 1;
      session_ids := session_ids || new_session_id;
    end if;

    for e_idx in 0..(jsonb_array_length(job.sessions_json->s_idx) - 1) loop
      plan := job.sessions_json->s_idx->e_idx;
      exercise_id := (plan->>'exercise_id')::uuid;
      if exercise_id is null then
        continue;
      end if;
      if exercise_id = any(v_seen) then
        continue;
      end if;
      v_seen := v_seen || exercise_id;

      sort_order := sort_order + 1;

      insert into public.v2_template_slots (
        day_id, exercise_id, experience, notes, sort_order
      ) values (
        job.day_id, exercise_id, null, null, sort_order
      )
      returning id into slot_id;

      v_slots_created := v_slots_created + 1;

      insert into public.v2_session_exercises (
        session_id, exercise_id, custom_exercise_id, sort_order
      ) values (
        target_session_id, exercise_id, null, sort_order
      )
      returning id into se_id;

      select * into tgt
      from public.resolve_ai_exercise_targets(
        exercise_id, experience, plan, bodyweight, use_imperial
      );

      if tgt.sets is null then
        continue;
      end if;

      for set_n in 1..tgt.sets loop
        insert into public.v2_session_sets (
          session_exercise_id,
          set_number,
          reps,
          weight,
          duration_sec,
          rpe,
          rir,
          rest_sec,
          notes
        ) values (
          se_id,
          set_n,
          tgt.reps,
          tgt.weight,
          tgt.duration_sec,
          null,
          null,
          null,
          null
        );
      end loop;
    end loop;
  end loop;

  if v_slots_created = 0 then
    update public.v2_ai_generation_jobs
    set status = 'failed', error_code = 'no_slots_created', updated_at = now()
    where id = p_job_id;
    raise exception 'generation_no_slots_created';
  end if;

  update public.v2_ai_generation_jobs
  set status = 'committed',
      slots_created = v_slots_created,
      updated_at = now()
  where id = p_job_id;

  return jsonb_build_object('slots_created', v_slots_created);
exception
  when others then
    update public.v2_ai_generation_jobs
    set status = 'failed',
        error_code = left(sqlerrm, 200),
        updated_at = now()
    where id = p_job_id
      and status <> 'committed';
    raise;
end;
$$;

revoke all on function public.commit_ai_generation(uuid) from public;
revoke all on function public.commit_ai_generation(uuid) from anon;
revoke all on function public.commit_ai_generation(uuid) from authenticated;
grant execute on function public.commit_ai_generation(uuid) to service_role;
