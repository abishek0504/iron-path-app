-- Replace purge_soft_deleted_accounts() so hard-delete also removes leftover
-- avatars. storage.objects has no FK to auth.users, so avatar keys would
-- otherwise remain in the avatars bucket after the account row is gone.
--
-- Does not reschedule pg_cron: job purge-soft-deleted-accounts already exists.

create or replace function public.purge_soft_deleted_accounts()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  purged integer := 0;
  account record;
begin
  -- Batch cap keeps each nightly run short-lived; remaining rows are picked
  -- up the following night.
  for account in
    select id
    from public.v2_profiles
    where scheduled_purge_at is not null
      and scheduled_purge_at <= now()
    limit 50
  loop
    -- Avatars use flat keys `{user_id}-{timestamp}...`; also match owner_id
    -- for objects whose name prefix does not follow that convention.
    delete from storage.objects
    where bucket_id = 'avatars'
      and (
        name like account.id::text || '-%'
        or owner_id = account.id::text
      );

    delete from auth.users where id = account.id;
    purged := purged + 1;
  end loop;

  return purged;
end;
$$;

comment on function public.purge_soft_deleted_accounts() is
  'Hard-deletes auth.users (cascading all v2_* data) for accounts past scheduled_purge_at, after deleting matching avatars-bucket objects in storage.objects. Run nightly by pg_cron.';

-- Only the cron runner (postgres) should be able to execute this.
-- Re-state revokes so CREATE OR REPLACE cannot restore default EXECUTE grants.
revoke all on function public.purge_soft_deleted_accounts() from public;
revoke all on function public.purge_soft_deleted_accounts() from anon;
revoke all on function public.purge_soft_deleted_accounts() from authenticated;
