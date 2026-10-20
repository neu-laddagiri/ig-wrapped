-- IG Wrapped — Supabase schema
-- Run this in the Supabase SQL Editor for your project.
-- Safe to re-run: policies, constraints and triggers are dropped and recreated.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users can delete own profile" on public.profiles;
create policy "Users can delete own profile"
  on public.profiles for delete
  to authenticated
  using ((select auth.uid()) = id);

-- Auto-create profile on sign up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
  set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- saved_analyses
-- ---------------------------------------------------------------------------
create table if not exists public.saved_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  export_name text,
  instagram_username text,
  analysis_mode text default 'full',
  file_fingerprint text,
  full_analysis_json jsonb not null,
  linkedin_progress_json jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_analyses_user_id_idx
  on public.saved_analyses (user_id);

create index if not exists saved_analyses_updated_at_idx
  on public.saved_analyses (user_id, updated_at desc);

-- Cap each snapshot at 20 MB. NOT VALID skips checking rows saved before this
-- constraint existed; new inserts and updates are always checked.
alter table public.saved_analyses
  drop constraint if exists saved_analyses_json_size;
alter table public.saved_analyses
  add constraint saved_analyses_json_size
  check (pg_column_size(full_analysis_json) < 20 * 1024 * 1024) not valid;

alter table public.saved_analyses enable row level security;

drop policy if exists "Users can view own saved analyses" on public.saved_analyses;
create policy "Users can view own saved analyses"
  on public.saved_analyses for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own saved analyses" on public.saved_analyses;
create policy "Users can insert own saved analyses"
  on public.saved_analyses for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own saved analyses" on public.saved_analyses;
create policy "Users can update own saved analyses"
  on public.saved_analyses for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own saved analyses" on public.saved_analyses;
create policy "Users can delete own saved analyses"
  on public.saved_analyses for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists saved_analyses_updated_at on public.saved_analyses;
create trigger saved_analyses_updated_at
  before update on public.saved_analyses
  for each row execute function public.set_updated_at();

-- Per-user row cap (50). The advisory lock serializes concurrent inserts for
-- the same user so parallel requests cannot slip past the count.
create or replace function public.enforce_saved_analyses_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  if (
    select count(*) from public.saved_analyses where user_id = new.user_id
  ) >= 50 then
    raise exception 'saved_analyses_limit: You can keep up to 50 saved analyses. Delete one and try again.';
  end if;
  return new;
end;
$$;

drop trigger if exists saved_analyses_limit on public.saved_analyses;
create trigger saved_analyses_limit
  before insert on public.saved_analyses
  for each row execute function public.enforce_saved_analyses_limit();
