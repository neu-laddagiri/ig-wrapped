-- IG Wrapped — Supabase schema
-- Run this in the Supabase SQL Editor for your project.

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

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can delete own profile"
  on public.profiles for delete
  using (auth.uid() = id);

-- Auto-create profile on sign up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
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

alter table public.saved_analyses enable row level security;

create policy "Users can view own saved analyses"
  on public.saved_analyses for select
  using (auth.uid() = user_id);

create policy "Users can insert own saved analyses"
  on public.saved_analyses for insert
  with check (auth.uid() = user_id);

create policy "Users can update own saved analyses"
  on public.saved_analyses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own saved analyses"
  on public.saved_analyses for delete
  using (auth.uid() = user_id);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
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
