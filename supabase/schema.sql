-- 在 Supabase SQL Editor 執行一次。
-- 日精進把每位使用者的復盤、下一步、素材庫、週月報存在同一列，並用 RLS 隔離。

create table if not exists public.nichi_user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  reviews jsonb not null default '{}'::jsonb,
  tasks jsonb not null default '[]'::jsonb,
  sfm jsonb not null default '[]'::jsonb,
  reports jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists nichi_user_data_email_idx on public.nichi_user_data (email);

alter table public.nichi_user_data enable row level security;

drop policy if exists "nichi_user_data_select_own" on public.nichi_user_data;
create policy "nichi_user_data_select_own"
  on public.nichi_user_data for select
  using (auth.uid() = user_id);

drop policy if exists "nichi_user_data_insert_own" on public.nichi_user_data;
create policy "nichi_user_data_insert_own"
  on public.nichi_user_data for insert
  with check (auth.uid() = user_id);

drop policy if exists "nichi_user_data_update_own" on public.nichi_user_data;
create policy "nichi_user_data_update_own"
  on public.nichi_user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
