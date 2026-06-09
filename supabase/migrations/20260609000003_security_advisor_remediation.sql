-- Security advisor remediation (Supabase linter, June 2026 run).
--
-- 1. function_search_path_mutable: pin search_path on the two remaining
--    flagged functions.
-- 2. anon/authenticated_security_definer_function_executable: trigger
--    functions must not be callable through /rest/v1/rpc. Triggers don't
--    check EXECUTE at fire time, so revoking is safe.
-- 3. public_bucket_allows_listing: the avatars bucket had duplicate broad
--    policies. The app doesn't list or download via the API (public-bucket
--    downloads bypass RLS), so the broad policies are dropped; the
--    owner-scoped per-folder policies remain.
-- 4. pg_graphql_anon_table_exposed: revoke all anon privileges on v2_* tables.
--    Every app query runs as `authenticated` behind RLS; anon needs nothing.
--
-- NOT covered here (dashboard settings, no SQL equivalent):
--   * auth_leaked_password_protection — enable "Leaked password protection"
--     under Auth → Providers → Email in the Supabase dashboard.

-- 1. Pin search_path -----------------------------------------------------
alter function public.adjust_bw_exercises(pd jsonb) set search_path = public, pg_temp;
alter function public.adjust_plan_data(pd jsonb) set search_path = public, pg_temp;

-- 2. Lock down trigger functions -----------------------------------------
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;

revoke execute on function public.trigger_upsert_exercise_pr() from public;
revoke execute on function public.trigger_upsert_exercise_pr() from anon;
revoke execute on function public.trigger_upsert_exercise_pr() from authenticated;

-- 3. Avatars bucket: drop broad/duplicate policies ------------------------
drop policy if exists "Public can read avatars" on storage.objects;
drop policy if exists "Public can view avatars" on storage.objects;
drop policy if exists "Authenticated users can upload avatars" on storage.objects;
drop policy if exists "Authenticated users can update avatars" on storage.objects;
drop policy if exists "Authenticated users can delete avatars" on storage.objects;

-- 4. Remove anon grants on all app tables ---------------------------------
do $$
declare
  t record;
begin
  for t in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename like 'v2\_%' escape '\'
  loop
    execute format('revoke all on table public.%I from anon', t.tablename);
  end loop;
end $$;

-- Prevent future tables from re-granting to anon by default.
alter default privileges in schema public revoke all on tables from anon;
