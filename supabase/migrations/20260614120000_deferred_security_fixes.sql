-- Deferred security fixes: avatar flat-key policies, PR table write restriction.

-- 1. Avatar storage: align owner policies with flat {user_id}-{timestamp} keys
--    (folder-based policies from legacy uploads never matched flat keys).
drop policy if exists "Users can upload their own avatar" on storage.objects;
drop policy if exists "Users can update their own avatar" on storage.objects;
drop policy if exists "Users can delete their own avatar" on storage.objects;

create policy "Users can upload their own avatar" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and name like (auth.uid())::text || '-%'
  );

create policy "Users can update their own avatar" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and name like (auth.uid())::text || '-%'
  )
  with check (
    bucket_id = 'avatars'
    and name like (auth.uid())::text || '-%'
  );

create policy "Users can delete their own avatar" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and name like (auth.uid())::text || '-%'
  );

-- 2. PR cache: clients read only; writes happen via trigger_upsert_exercise_pr (SECURITY DEFINER).
drop policy if exists "v2_user_exercise_prs_owner" on v2_user_exercise_prs;

create policy "v2_user_exercise_prs_select" on v2_user_exercise_prs
  for select to authenticated
  using (user_id = auth.uid());
