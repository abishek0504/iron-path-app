-- Waitlist emails captured from tryironpath.com
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now(),
  source text default 'website'
);

alter table public.waitlist enable row level security;

-- No public policies: inserts happen via service role in the API route only.
