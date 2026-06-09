-- Scheduled hard-delete of soft-deleted accounts (pg_cron).
--
-- delete-account marks v2_profiles.deleted_at / scheduled_purge_at (now + 30d).
-- This job hard-deletes auth.users rows whose grace period has elapsed; every
-- v2_* table references auth.users(id) ON DELETE CASCADE, so user data is
-- purged in the same transaction.

create extension if not exists pg_cron;

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
    delete from auth.users where id = account.id;
    purged := purged + 1;
  end loop;

  return purged;
end;
$$;

comment on function public.purge_soft_deleted_accounts() is
  'Hard-deletes auth.users (cascading all v2_* data) for accounts past scheduled_purge_at. Run nightly by pg_cron.';

-- Only the cron runner (postgres) should be able to execute this.
revoke all on function public.purge_soft_deleted_accounts() from public;
revoke all on function public.purge_soft_deleted_accounts() from anon;
revoke all on function public.purge_soft_deleted_accounts() from authenticated;

-- Idempotent scheduling: replace any existing job with the same name.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-soft-deleted-accounts') then
    perform cron.unschedule('purge-soft-deleted-accounts');
  end if;
end $$;

select cron.schedule(
  'purge-soft-deleted-accounts',
  '0 3 * * *', -- daily at 03:00 UTC
  $$select public.purge_soft_deleted_accounts()$$
);
