-- The Media Planner - Supabase starter schema
-- Run in Supabase SQL Editor after creating a project.
create extension if not exists pgcrypto;

create table if not exists public.media_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  brand text,
  objective text not null,
  currency text not null default 'INR',
  total_budget numeric(14,2) not null default 0,
  duration_days integer not null default 30,
  plan_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists media_plans_user_updated_idx on public.media_plans(user_id, updated_at desc);
alter table public.media_plans enable row level security;
create policy "Users can read own plans" on public.media_plans for select using (auth.uid() = user_id);
create policy "Users can insert own plans" on public.media_plans for insert with check (auth.uid() = user_id);
create policy "Users can update own plans" on public.media_plans for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own plans" on public.media_plans for delete using (auth.uid() = user_id);

create table if not exists public.media_benchmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  objective text not null,
  industry text,
  country text not null default 'IN',
  metric text not null,
  metric_value numeric(14,4) not null,
  source_label text not null default 'User supplied historical data',
  observed_on date,
  created_at timestamptz not null default now()
);
alter table public.media_benchmarks enable row level security;
create policy "Users can manage own benchmarks" on public.media_benchmarks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
