-- Website waitlist: service-role inserts only; no anon/authenticated API access
revoke all on table public.waitlist from anon, authenticated;
revoke all on table public.waitlist from public;
grant all on table public.waitlist to service_role;
